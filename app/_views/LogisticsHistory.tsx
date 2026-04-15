'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowUpDown,
  CalendarRange,
  CheckCheck,
  ChevronDown,
  ClipboardCopy,
  Download,
  Factory,
  Gift,
  MapPin,
  Phone,
  RefreshCw,
  Truck,
  User,
} from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import EmptyState from '@/app/_components/EmptyState';
import ErrorBoundary from '@/app/_components/ErrorBoundary';
import { SkeletonCard } from '@/app/_components/Skeleton';
import StatusBadge from '@/app/_components/StatusBadge';
import { generatePickupJobPdf, generateDeliveryJobPdf } from '@/app/_lib/pdfGenerator';
import {
  ApiError,
  logisticsApi,
  type LogisticsPickupJobItem,
  type LogisticsRewardDeliveryJobItem,
} from '@/app/_lib/apiClient';

function hasAccessToken(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem('AREX_ACCESS_TOKEN'));
}

function formatMaterial(materialType: string): string {
  const map: Record<string, string> = {
    rice_straw: 'ฟางข้าว',
    cassava_root: 'เหง้ามันสำปะหลัง',
    sugarcane_bagasse: 'ชานอ้อย',
    corn_stover: 'ตอซังข้าวโพด',
    plastic_waste: 'พลาสติก',
  };
  return map[materialType] ?? materialType;
}

function fallbackThaiUnit(unitCode: string): string {
  const map: Record<string, string> = { kg: 'กิโลกรัม', ton: 'ตัน' };
  return map[unitCode] ?? unitCode;
}

function formatDateRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) return '-';
  const s = new Date(start).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });
  if (!end) return s;
  const e = new Date(end).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });
  return s === e ? s : `${s} – ${e}`;
}

function hasValidCoordinates(lat: number | null | undefined, lng: number | null | undefined): boolean {
  return typeof lat === 'number' && Number.isFinite(lat) && typeof lng === 'number' && Number.isFinite(lng);
}

function buildGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

/* ── Expandable card ── */
function HistoryCard({
  children,
  expandedContent,
  isExpanded,
  onToggle,
  accent = 'emerald',
}: {
  children: React.ReactNode;
  expandedContent: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  accent?: 'emerald' | 'violet';
}) {
  const reduceMotion = useReducedMotion();
  const borderColor = accent === 'violet' ? 'border-l-violet-400' : 'border-l-emerald-400';
  const hasExpanded = expandedContent !== null && expandedContent !== undefined && expandedContent !== false && expandedContent !== '';
  return (
    <motion.div className={`overflow-hidden rounded-xl border border-stone-200/80 border-l-4 ${borderColor} bg-white shadow-sm`}>
      {hasExpanded ? (
        <button type="button" onClick={onToggle} className="flex w-full items-start gap-3 px-5 py-4 text-left">
          <div className="min-w-0 flex-1">{children}</div>
          <motion.span
            animate={reduceMotion ? {} : { rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.22 }}
            style={{ display: 'inline-flex' }}
            className="mt-0.5 shrink-0 text-stone-400"
          >
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        </button>
      ) : (
        <div className="flex w-full items-start gap-3 px-5 py-4 text-left">
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      )}
      <AnimatePresence initial={false}>
        {hasExpanded && isExpanded && (
          <motion.div
            key="expanded"
            initial={reduceMotion ? {} : { height: 0, opacity: 0 }}
            animate={reduceMotion ? {} : { height: 'auto', opacity: 1 }}
            exit={reduceMotion ? {} : { height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="border-t border-stone-100 bg-stone-50/60 px-5 pb-5 pt-4">
              {expandedContent}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

type SortDir = 'asc' | 'desc';

function SortHeaderBar<T extends string>({
  cols,
  sort,
  onSort,
}: {
  cols: { key: T; label: string; dirLabels?: [string, string] }[];
  sort: { key: T; dir: SortDir };
  onSort: (key: T) => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-stone-100 bg-stone-50/70 px-4 py-2 rounded-t-xl -mb-1 flex-wrap">
      {cols.map((col) => {
        const active = sort.key === col.key;
        const [ascLabel, descLabel] = col.dirLabels ?? ['ก่อน', 'หลัง'];
        return (
          <button
            key={col.key}
            type="button"
            onClick={() => onSort(col.key)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
              active ? 'text-primary' : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            {col.label}
            {active ? (
              <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold bg-primary/10 text-primary">
                {sort.dir === 'asc' ? ascLabel : descLabel}
              </span>
            ) : (
              <ArrowUpDown className="h-3 w-3 opacity-40" />
            )}
          </button>
        );
      })}
      <span className="ml-auto text-[10px] text-stone-300 hidden sm:inline">💡 กดชื่อคอลัมน์เพื่อเรียงลำดับ</span>
    </div>
  );
}

export default function LogisticsHistory() {
  const reduceMotion = useReducedMotion();
  const [pickupJobs, setPickupJobs] = useState<LogisticsPickupJobItem[]>([]);
  const [deliveryJobs, setDeliveryJobs] = useState<LogisticsRewardDeliveryJobItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'material' | 'reward'>('material');
  const [materialSort, setMaterialSort] = useState<{ key: 'planned_pickup_at' | 'material'; dir: SortDir }>({ key: 'planned_pickup_at', dir: 'desc' });
  const [rewardSort, setRewardSort] = useState<{ key: 'planned_delivery_at' | 'reward_name'; dir: SortDir }>({ key: 'planned_delivery_at', dir: 'desc' });

  const deliveredPickupJobsRaw = useMemo(
    () => pickupJobs.filter((i) => i.status === 'delivered_to_factory'),
    [pickupJobs],
  );

  const completedDeliveryJobsRaw = useMemo(
    () => deliveryJobs.filter((i) => i.status === 'reward_delivered'),
    [deliveryJobs],
  );

  function toggleSort<T extends string>(
    current: { key: T; dir: SortDir },
    key: T,
    setter: React.Dispatch<React.SetStateAction<{ key: T; dir: SortDir }>>
  ) {
    setter(current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
  }

  const deliveredPickupJobs = useMemo(() => [...deliveredPickupJobsRaw].sort((a, b) => {
    const mul = materialSort.dir === 'asc' ? 1 : -1;
    if (materialSort.key === 'material') return mul * (a.material_type ?? '').localeCompare(b.material_type ?? '');
    return mul * (new Date(a.planned_pickup_at ?? 0).getTime() - new Date(b.planned_pickup_at ?? 0).getTime());
  }), [deliveredPickupJobsRaw, materialSort]);

  const completedDeliveryJobs = useMemo(() => [...completedDeliveryJobsRaw].sort((a, b) => {
    const mul = rewardSort.dir === 'asc' ? 1 : -1;
    if (rewardSort.key === 'reward_name') return mul * (a.reward_name_th ?? '').localeCompare(b.reward_name_th ?? '');
    return mul * (new Date(a.planned_delivery_at ?? 0).getTime() - new Date(b.planned_delivery_at ?? 0).getTime());
  }), [completedDeliveryJobsRaw, rewardSort]);

  const loadJobs = async (forceRefresh = false) => {
    if (!hasAccessToken()) {
      setError('ยังไม่พบโทเคน กรุณาเข้าสู่ระบบก่อน');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [pickupRes, deliveryRes] = await Promise.allSettled([
        logisticsApi.getPickupJobs({ forceRefresh }),
        logisticsApi.getRewardDeliveryJobs({ forceRefresh }),
      ]);
      if (pickupRes.status === 'fulfilled') setPickupJobs(pickupRes.value.jobs);
      if (deliveryRes.status === 'fulfilled') setDeliveryJobs(deliveryRes.value.jobs);
      if (pickupRes.status === 'rejected' && deliveryRes.status === 'rejected') {
        const e = pickupRes.reason;
        setError(e instanceof ApiError ? `โหลดข้อมูลไม่สำเร็จ: ${e.message}` : 'โหลดข้อมูลไม่สำเร็จ');
      }
    } catch (e) {
      setError(e instanceof ApiError ? `โหลดข้อมูลไม่สำเร็จ: ${e.message}` : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadJobs(); }, []);




  return (
    <ErrorBoundary>
      <div className="space-y-6 pb-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">โลจิสติกส์</p>
            <h1 className="mt-0.5 text-3xl font-light tracking-tight text-on-surface sm:text-4xl">ประวัติการขนส่ง</h1>
            <p className="mt-1 text-sm text-stone-400">บันทึกงานที่ดำเนินการเสร็จสิ้นแล้วทั้งหมด</p>
          </div>
          <motion.button
            type="button"
            onClick={() => void loadJobs(true)}
            disabled={isLoading}
            aria-label="รีเฟรชข้อมูล"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant/20 bg-white text-on-surface-variant transition hover:bg-stone-50 disabled:opacity-50"
            whileTap={reduceMotion ? {} : { scale: 0.88 }}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </motion.button>
        </div>

        {/* Error */}
        {error && <AlertBanner message={error} tone="error" />}


        {/* ── Tab bar ── */}
        <div>
          <div className="flex rounded-xl bg-stone-100 p-0.5 gap-0.5">
            {([
              { key: 'material' as const, label: 'วัสดุ', count: deliveredPickupJobs.length },
              { key: 'reward' as const, label: 'รางวัล', count: completedDeliveryJobs.length },
            ]).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] px-4 py-2 text-sm font-semibold transition-all ${
                  activeTab === tab.key ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                {tab.label}
                {!isLoading && tab.count > 0 && (
                  <span className={`rounded-full min-w-[18px] text-center px-1 py-0.5 text-[10px] font-bold leading-none ${
                    activeTab === tab.key ? 'bg-primary/10 text-primary' : 'bg-stone-200 text-stone-400'
                  }`}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Material delivery history ── */}
        {activeTab === 'material' && (
          <div className="space-y-3">
            {!isLoading && deliveredPickupJobs.length > 0 && (
              <SortHeaderBar
                cols={[
                  { key: 'planned_pickup_at' as const, label: 'วันนัดรับ', dirLabels: ['เก่าก่อน', 'ใหม่ก่อน'] },
                  { key: 'material' as const, label: 'วัสดุ', dirLabels: ['ก→ฮ', 'ฮ→ก'] },
                ]}
                sort={materialSort}
                onSort={(key) => toggleSort(materialSort, key, setMaterialSort)}
              />
            )}
            {isLoading ? (
              <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)}</div>
            ) : deliveredPickupJobs.length === 0 ? (
              <EmptyState title="ยังไม่มีประวัติการรับวัสดุ" description="งานที่ส่งวัสดุถึงโรงงานแล้วจะปรากฏที่นี่" icon={Truck} />
            ) : (
              deliveredPickupJobs.map((item) => {
                const isExp = expandedId === item.id;
                const handleCopy = () => {
                  const lines = [
                    `[ใบรับวัสดุ AREX] เลขที่ ${item.id.slice(0, 8).toUpperCase()}`,
                    `สถานะ: ส่งถึงโรงงานแล้ว`,
                    ``,
                    `วัสดุ: ${item.material_name_th || formatMaterial(item.material_type)}`,
                    `ปริมาณ: ${Number(item.quantity_value).toLocaleString('th-TH')} ${fallbackThaiUnit(item.quantity_unit)}`,
                    ``,
                    item.farmer_display_name ? `เกษตรกร: ${item.farmer_display_name}` : null,
                    item.farmer_phone ? `เบอร์โทร: ${item.farmer_phone}` : null,
                    `จุดรับวัสดุ: ${item.pickup_location_text || '-'}`,
                    hasValidCoordinates(item.pickup_lat, item.pickup_lng) ? `แผนที่จุดรับ: ${buildGoogleMapsUrl(item.pickup_lat as number, item.pickup_lng as number)}` : null,
                    `วันนัดรับ: ${formatDateRange(item.planned_pickup_at, item.pickup_window_end_at)}`,
                    item.destination_factory_name_th ? `` : null,
                    item.destination_factory_name_th ? `โรงงานปลายทาง: ${item.destination_factory_name_th}` : null,
                    item.destination_factory_location_text ? `ที่อยู่โรงงาน: ${item.destination_factory_location_text}` : null,
                    hasValidCoordinates(item.destination_factory_lat, item.destination_factory_lng) ? `แผนที่โรงงาน: ${buildGoogleMapsUrl(item.destination_factory_lat as number, item.destination_factory_lng as number)}` : null,
                  ].filter((l) => l !== null).join('\n');
                  void copyToClipboard(lines).then(() => { setCopiedId(item.id); setTimeout(() => setCopiedId(null), 1500); });
                };
                return (
                  <div key={item.id}>
                    <HistoryCard
                      isExpanded={isExp}
                      onToggle={() => setExpandedId((cur) => cur === item.id ? null : item.id)}
                      accent="emerald"
                      expandedContent={null}
                    >
                      <div className="space-y-2">
                        {/* Row 1: name + status */}
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[15px] font-bold text-on-surface leading-tight truncate">
                            {item.material_name_th || formatMaterial(item.material_type)}
                          </p>
                          <StatusBadge status={item.status} label="ส่งถึงโรงงานแล้ว" size="sm" />
                        </div>
                        {/* Row 2: qty + date + factory chips */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                            {Number(item.quantity_value).toLocaleString('th-TH')} {fallbackThaiUnit(item.quantity_unit)}
                          </span>
                          <span className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                            <CalendarRange className="h-3 w-3 text-stone-400" />
                            นัดรับ {formatDateRange(item.planned_pickup_at, item.pickup_window_end_at)}
                          </span>
                          {item.destination_factory_name_th && (
                            <span className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                              <Factory className="h-3 w-3 text-stone-400" />
                              {item.destination_factory_name_th}
                            </span>
                          )}
                        </div>
                        {/* Row 3: farmer + location (dimmed) + copy/pdf */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-stone-400 min-w-0">
                            {item.farmer_display_name && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />{item.farmer_display_name}
                                {item.farmer_phone && <span className="flex items-center gap-0.5"><Phone className="h-3 w-3" />{item.farmer_phone}</span>}
                              </span>
                            )}
                            {item.pickup_location_text && (
                              <span className="flex items-center gap-1 min-w-0">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{item.pickup_location_text}</span>
                                {hasValidCoordinates(item.pickup_lat, item.pickup_lng) && (
                                  <a href={buildGoogleMapsUrl(item.pickup_lat as number, item.pickup_lng as number)} target="_blank" rel="noopener noreferrer"
                                    className="shrink-0 text-primary hover:underline">แผนที่</a>
                                )}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button type="button" onClick={handleCopy} disabled={copiedId === item.id}
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600 disabled:opacity-40 transition-colors">
                              {copiedId === item.id ? <CheckCheck className="h-4 w-4 text-emerald-500" /> : <ClipboardCopy className="h-4 w-4" />}
                            </button>
                            <button type="button" onClick={() => generatePickupJobPdf(item)}
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors">
                              <Download className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </HistoryCard>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Reward delivery history ── */}
        {activeTab === 'reward' && (
          <div className="space-y-3">
            {!isLoading && completedDeliveryJobs.length > 0 && (
              <SortHeaderBar
                cols={[
                  { key: 'planned_delivery_at' as const, label: 'วันนัดส่ง', dirLabels: ['เก่าก่อน', 'ใหม่ก่อน'] },
                  { key: 'reward_name' as const, label: 'ชื่อรางวัล', dirLabels: ['ก→ฮ', 'ฮ→ก'] },
                ]}
                sort={rewardSort}
                onSort={(key) => toggleSort(rewardSort, key, setRewardSort)}
              />
            )}
            {isLoading ? (
              <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)}</div>
            ) : completedDeliveryJobs.length === 0 ? (
              <EmptyState title="ยังไม่มีประวัติการส่งรางวัล" description="งานที่ส่งมอบรางวัลสำเร็จแล้วจะปรากฏที่นี่" icon={Gift} />
            ) : (
              completedDeliveryJobs.map((item) => {
                const isExp = expandedId === item.id;
                const handleCopy = () => {
                  const lines = [
                    `[ใบส่งรางวัล AREX] เลขที่ ${item.id.slice(0, 8).toUpperCase()}`,
                    `สถานะ: ส่งมอบสำเร็จ`,
                    ``,
                    `รางวัล: ${item.reward_name_th || 'รางวัล'}`,
                    `จำนวน: ${Number(item.quantity).toLocaleString('th-TH')} ชิ้น`,
                    ``,
                    item.farmer_display_name ? `ผู้รับ: ${item.farmer_display_name}` : null,
                    item.farmer_phone ? `เบอร์โทร: ${item.farmer_phone}` : null,
                    `จุดส่งมอบ: ${item.pickup_location_text || '-'}`,
                    hasValidCoordinates(item.pickup_lat, item.pickup_lng) ? `แผนที่จุดส่ง: ${buildGoogleMapsUrl(item.pickup_lat as number, item.pickup_lng as number)}` : null,
                    `วันนัดส่ง: ${formatDateRange(item.planned_delivery_at, item.delivery_window_end_at)}`,
                  ].filter((l) => l !== null).join('\n');
                  void copyToClipboard(lines).then(() => { setCopiedId(item.id); setTimeout(() => setCopiedId(null), 1500); });
                };
                return (
                  <div key={item.id}>
                    <HistoryCard
                      isExpanded={isExp}
                      onToggle={() => setExpandedId((cur) => cur === item.id ? null : item.id)}
                      accent="violet"
                      expandedContent={null}
                    >
                      <div className="space-y-2">
                        {/* Row 1: name + status */}
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[15px] font-bold text-on-surface leading-tight truncate">
                            {item.reward_name_th ?? 'รางวัล'}
                          </p>
                          <StatusBadge status={item.status} label="ส่งมอบสำเร็จ" size="sm" />
                        </div>
                        {/* Row 2: qty + date chips */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-md bg-violet-50 px-2 py-0.5 text-xs font-bold text-violet-700">
                            {Number(item.quantity).toLocaleString('th-TH')} ชิ้น
                          </span>
                          <span className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                            <CalendarRange className="h-3 w-3 text-stone-400" />
                            นัดส่ง {formatDateRange(item.planned_delivery_at, item.delivery_window_end_at)}
                          </span>
                        </div>
                        {/* Row 3: farmer + location (dimmed) + copy/pdf */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-stone-400 min-w-0">
                            {item.farmer_display_name && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />{item.farmer_display_name}
                                {item.farmer_phone && <span className="flex items-center gap-0.5"><Phone className="h-3 w-3" />{item.farmer_phone}</span>}
                              </span>
                            )}
                            {item.pickup_location_text && (
                              <span className="flex items-center gap-1 min-w-0">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{item.pickup_location_text}</span>
                                {hasValidCoordinates(item.pickup_lat, item.pickup_lng) && (
                                  <a href={buildGoogleMapsUrl(item.pickup_lat as number, item.pickup_lng as number)} target="_blank" rel="noopener noreferrer"
                                    className="shrink-0 text-primary hover:underline">แผนที่</a>
                                )}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button type="button" onClick={handleCopy} disabled={copiedId === item.id}
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600 disabled:opacity-40 transition-colors">
                              {copiedId === item.id ? <CheckCheck className="h-4 w-4 text-emerald-500" /> : <ClipboardCopy className="h-4 w-4" />}
                            </button>
                            <button type="button" onClick={() => generateDeliveryJobPdf(item)}
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors">
                              <Download className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </HistoryCard>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
