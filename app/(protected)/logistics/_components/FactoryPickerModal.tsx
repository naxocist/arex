'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowDownAZ,
  ArrowDownUp,
  ArrowUpAZ,
  ArrowUpDown,
  CheckCircle2,
  ChevronRight,
  Factory,
  MapPin,
  Navigation,
  Route,
  Ruler,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { type LogisticsFactoryOptionItem, type LogisticsPickupQueueItem, logisticsApi } from '@/app/_lib/api';
import { fallbackThaiUnit } from '@/app/_lib/utils';
import { buildGoogleMapsUrl, hasValidCoordinates } from './logisticsUtils';

// ─── Tier logic ─────────────────────────────────────────────────────────────

type Tier = 'ideal' | 'accepts' | 'over' | 'decline';

function getTier(f: LogisticsFactoryOptionItem): Tier {
  const p = f.preference;
  if (!p) return 'accepts';
  if (!p.accepts) return 'decline';
  if (p.has_capacity && p.capacity_kg != null) return 'ideal';
  if (p.accepts && p.capacity_kg == null) return 'accepts';
  if (!p.has_capacity) return 'over';
  return 'accepts';
}


const TIER_META: Record<Tier, { label: string; bg: string; text: string; border: string; dot: string }> = {
  ideal:   { label: 'แนะนำ — รับได้พอดี',   bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500' },
  accepts: { label: 'รับได้',                bg: 'bg-blue-50',     text: 'text-blue-700',    border: 'border-blue-200',   dot: 'bg-blue-400'   },
  over:    { label: 'เกินกำลังรับ',          bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200',  dot: 'bg-amber-400'  },
  decline: { label: 'ไม่รับวัสดุนี้',        bg: 'bg-stone-50',    text: 'text-stone-400',   border: 'border-stone-200',  dot: 'bg-stone-300'  },
};

// ─── Capacity bar ────────────────────────────────────────────────────────────

function CapacityBar({ capacityKg, quantityKg }: { capacityKg: number; quantityKg: number }) {
  const fill = Math.min(1, quantityKg / capacityKg);
  const over = quantityKg > capacityKg;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
        <span>ปริมาณที่ส่ง</span>
        <span className={over ? 'font-semibold text-amber-600' : 'font-semibold text-emerald-600'}>
          {Math.round(fill * 100)}% ของปริมาณที่รับได้ต่อรอบ
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
        <motion.div
          className={`h-full rounded-full ${over ? 'bg-amber-400' : 'bg-emerald-500'}`}
          initial={{ width: 0 }}
          animate={{ width: `${fill * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

// ─── Factory card ────────────────────────────────────────────────────────────

interface FactoryCardProps {
  factory: LogisticsFactoryOptionItem;
  tier: Tier;
  isSelected: boolean;
  leg2Km: number | null;
  quantityKg: number;
  onPick: () => void;
  showGroupHeader?: string;
}

function FactoryCard({ factory: f, tier, isSelected, leg2Km, quantityKg, onPick, showGroupHeader }: FactoryCardProps) {
  const meta = TIER_META[tier];
  const p = f.preference;

  return (
    <>
      {showGroupHeader && (
        <div className="flex items-center gap-2 px-1 pt-3 pb-1">
          <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
          <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">{showGroupHeader}</span>
        </div>
      )}
      <motion.button
        type="button"
        onClick={tier === 'decline' ? undefined : onPick}
        disabled={tier === 'decline'}
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        whileTap={tier === 'decline' ? undefined : { scale: 0.985 }}
        className={[
          'w-full rounded-2xl border-2 p-4 text-left transition-all duration-150',
          tier === 'decline'
            ? `${meta.border} ${meta.bg} opacity-60 cursor-not-allowed`
            : isSelected
              ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
              : `${meta.border} ${meta.bg} hover:border-primary/40 hover:shadow-sm`,
        ].join(' ')}
      >
        <div className="flex items-start gap-3">
          {/* Left accent + icon */}
          <div className={[
            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            isSelected ? 'bg-primary text-white' : `${meta.bg} ${meta.text} border ${meta.border}`,
          ].join(' ')}>
            <Factory className="h-4 w-4" />
          </div>

          {/* Main content */}
          <div className="min-w-0 flex-1 space-y-2">
            {/* Name + check */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={`font-semibold leading-tight ${tier === 'decline' ? 'text-stone-400' : 'text-on-surface'}`}>
                  {f.name_th}
                  {f.is_focal_point && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600">
                      <Sparkles className="h-2.5 w-2.5" /> CMU
                    </span>
                  )}
                </p>
                {f.location_text && (
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-on-surface-variant">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {f.location_text}
                  </p>
                )}
              </div>
              {isSelected ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-stone-300" />
              )}
            </div>

            {/* Tier badge */}
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.border} ${meta.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>

            {/* Capacity bar */}
            {p && p.capacity_kg != null && (
              <CapacityBar capacityKg={p.capacity_kg} quantityKg={quantityKg} />
            )}
            {p && p.capacity_value != null && (
              <p className="text-[11px] text-on-surface-variant">
                รับได้ต่อรอบ: {Number(p.capacity_value).toLocaleString('th-TH')} {p.capacity_unit}
              </p>
            )}

            {/* Distance row */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
              {leg2Km != null && (
                <span className="flex items-center gap-1">
                  <Route className="h-3 w-3" />
                  เกษตรกร → โรงงาน: <strong className="text-on-surface">{leg2Km.toFixed(1)} กม.</strong>
                </span>
              )}
              {leg2Km == null && (
                <span className="flex items-center gap-1 text-stone-300">
                  <Ruler className="h-3 w-3" /> กำลังคำนวณระยะทาง...
                </span>
              )}
              {hasValidCoordinates(f.lat, f.lng) && (
                <a
                  href={buildGoogleMapsUrl(f.lat as number, f.lng as number)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                >
                  <Navigation className="h-3 w-3" /> แผนที่
                </a>
              )}
            </div>
          </div>
        </div>
      </motion.button>
    </>
  );
}

// ─── Main modal ──────────────────────────────────────────────────────────────

type SortKey = 'distance' | 'name';
type SortDir = 'asc' | 'desc';

interface Props {
  submission: LogisticsPickupQueueItem;
  initialFactoryId: string;
  onConfirm: (factoryId: string) => void;
  onClose: () => void;
}

export default function FactoryPickerModal({ submission, initialFactoryId, onConfirm, onClose }: Props) {
  const [factories, setFactories] = useState<LogisticsFactoryOptionItem[]>([]);
  const [leg2KmById, setLeg2KmById] = useState<Record<string, number | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(initialFactoryId);
  const [sortKey, setSortKey] = useState<SortKey>('distance');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const quantityKg = useMemo(() => {
    const v = submission.quantity_value;
    const u = submission.quantity_unit;
    if (u === 'ตัน' || u === 'ton') return v * 1000;
    return v;
  }, [submission]);

  // Fetch enriched factory list
  useEffect(() => {
    setIsLoading(true);
    logisticsApi.listFactories({ material_type: submission.material_type, quantity_kg: quantityKg })
      .then((res) => { setFactories(res.factories); })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [submission.material_type, quantityKg]);

  // Fetch leg2 distances for all factories once list is ready
  useEffect(() => {
    if (!factories.length || submission.pickup_lat == null || submission.pickup_lng == null) return;
    void (async () => {
      for (const f of factories) {
        if (f.lat == null || f.lng == null) continue;
        if (leg2KmById[f.id] !== undefined) continue;
        try {
          const res = await logisticsApi.getRouteDistance(
            submission.pickup_lat as number, submission.pickup_lng as number,
            f.lat as number, f.lng as number,
          );
          setLeg2KmById((prev) => ({ ...prev, [f.id]: res.distance_km }));
        } catch {
          setLeg2KmById((prev) => ({ ...prev, [f.id]: null }));
        }
      }
    })();
  }, [factories]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return factories.filter((f) =>
      !q || f.name_th.toLowerCase().includes(q) || (f.location_text ?? '').toLowerCase().includes(q),
    );
  }, [factories, search]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const aDecline = getTier(a) === 'decline';
    const bDecline = getTier(b) === 'decline';
    if (aDecline !== bDecline) return aDecline ? 1 : -1;
    let cmp = 0;
    if (sortKey === 'distance') {
      const da = leg2KmById[a.id] ?? Infinity;
      const db = leg2KmById[b.id] ?? Infinity;
      cmp = da - db;
    } else {
      cmp = a.name_th.localeCompare(b.name_th, 'th');
    }
    return sortDir === 'asc' ? cmp : -cmp;
  }), [filtered, sortKey, sortDir, leg2KmById]);

  const selectedFactory = factories.find((f) => f.id === selectedId);

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        key="sheet"
        className="fixed inset-x-0 bottom-0 z-[61] flex max-h-[92dvh] flex-col rounded-t-3xl bg-surface shadow-2xl sm:inset-x-auto sm:inset-y-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        transition={{ type: 'spring', damping: 28, stiffness: 340 }}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-outline-variant" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">เลือกโรงงานปลายทาง</p>
            <p className="mt-0.5 truncate font-semibold text-on-surface">
              {submission.material_name_th || submission.material_type}
            </p>
            <p className="text-sm text-on-surface-variant">
              {Number(submission.quantity_value).toLocaleString('th-TH')} {fallbackThaiUnit(submission.quantity_unit)}
              {' · '}{submission.pickup_location_text}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant transition hover:bg-surface-container-high"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search + Sort */}
        <div className="flex items-center gap-2 px-5 pb-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาโรงงาน..."
              className="w-full rounded-xl border border-outline-variant/30 bg-stone-50 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {/* Sort pills */}
          <div className="flex shrink-0 items-center gap-1 rounded-xl border border-outline-variant/20 bg-stone-50 p-1">
            {(['distance', 'name'] as SortKey[]).map((key) => {
              const label = key === 'distance' ? 'ระยะทาง' : 'ชื่อ';
              const active = sortKey === key;
              const Icon = active
                ? (key === 'name' ? (sortDir === 'asc' ? ArrowDownAZ : ArrowUpAZ) : (sortDir === 'asc' ? ArrowDownUp : ArrowDownUp))
                : ArrowDownUp;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
                    else { setSortKey(key); setSortDir('asc'); }
                  }}
                  className={[
                    'flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition',
                    active ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:bg-stone-100',
                  ].join(' ')}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                  {active && <span className="opacity-80">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-outline-variant/20" />

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {isLoading ? (
            <div className="space-y-3 pt-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl bg-stone-100" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Factory className="mb-3 h-10 w-10 text-stone-300" />
              <p className="text-sm font-medium text-on-surface-variant">ไม่พบโรงงาน</p>
            </div>
          ) : (
            <div className="pt-2">
              <AnimatePresence mode="popLayout">
                {sorted.filter((f) => getTier(f) !== 'decline').map((f) => (
                  <div key={f.id} className="mb-2">
                    <FactoryCard
                      factory={f}
                      tier={getTier(f)}
                      isSelected={selectedId === f.id}
                      leg2Km={leg2KmById[f.id] ?? null}
                      quantityKg={quantityKg}
                      onPick={() => setSelectedId(f.id)}
                    />
                  </div>
                ))}
              </AnimatePresence>
              {sorted.some((f) => getTier(f) === 'decline') && (
                <>
                  <div className="my-3 flex items-center gap-2">
                    <div className="h-px flex-1 bg-outline-variant/20" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">ไม่รับวัสดุนี้</span>
                    <div className="h-px flex-1 bg-outline-variant/20" />
                  </div>
                  <AnimatePresence mode="popLayout">
                    {sorted.filter((f) => getTier(f) === 'decline').map((f) => (
                      <div key={f.id} className="mb-2">
                        <FactoryCard
                          factory={f}
                          tier="decline"
                          isSelected={false}
                          leg2Km={leg2KmById[f.id] ?? null}
                          quantityKg={quantityKg}
                          onPick={() => {}}
                        />
                      </div>
                    ))}
                  </AnimatePresence>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="border-t border-outline-variant/20 bg-surface px-5 py-4">
          {selectedFactory ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-xl bg-primary/5 px-3 py-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-on-surface">
                  {selectedFactory.name_th}
                </p>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TIER_META[getTier(selectedFactory)].border} ${TIER_META[getTier(selectedFactory)].text}`}>
                  {TIER_META[getTier(selectedFactory)].label}
                </span>
              </div>
              {getTier(selectedFactory) === 'decline' ? (
                <button
                  type="button"
                  disabled
                  className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-stone-200 text-base font-semibold text-stone-400 cursor-not-allowed"
                >
                  โรงงานนี้ไม่รับวัสดุ
                </button>
              ) : (
                <motion.button
                  type="button"
                  onClick={() => onConfirm(selectedId)}
                  className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-white shadow-sm shadow-primary/20 transition hover:opacity-90"
                  whileTap={{ scale: 0.97 }}
                >
                  เลือกโรงงานนี้
                  <ChevronRight className="h-4 w-4" />
                </motion.button>
              )}
            </div>
          ) : (
            <button
              type="button"
              disabled
              className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-stone-200 text-base font-semibold text-stone-400 cursor-not-allowed"
            >
              <ArrowUpDown className="h-4 w-4" />
              เลือกโรงงาน
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
