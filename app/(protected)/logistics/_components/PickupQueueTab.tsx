'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { CalendarRange, Factory, MapPin, Navigation, Truck, User } from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import DateRangePicker, { type DateRangeValue } from '@/app/_components/DateRangePicker';
import EmptyState from '@/app/_components/EmptyState';
import { SkeletonCard } from '@/app/_components/Skeleton';
import SortHeaderBar, { type SortDir } from '@/app/_components/SortHeaderBar';
import {
  logisticsApi,
  type LogisticsFactoryOptionItem,
  type LogisticsInfoItem,
  type LogisticsPickupQueueItem,
} from '@/app/_lib/api';
import { fallbackThaiUnit, formatDateTime } from '@/app/_lib/utils';
import DistModeChips from './DistModeChips';
import ExpandableCard from './ExpandableCard';
import RouteStepper from './RouteStepper';
import { buildGoogleMapsDirectionsUrl, buildGoogleMapsUrl, hasValidCoordinates } from './logisticsUtils';

function toKgForSort(value: number | null | undefined, unit: string | null | undefined): number {
  const v = Number(value ?? 0);
  return unit === 'ton' ? v * 1000 : v;
}

interface Props {
  items: LogisticsPickupQueueItem[];
  factoryOptions: LogisticsFactoryOptionItem[];
  myInfo: LogisticsInfoItem | null;
  isLoading: boolean;
  loadIssue?: string;
  expandedId: string | null;
  onToggle: (id: string) => void;
  schedulingId: string | null;
  onSchedule: (submissionId: string, range: DateRangeValue, factoryId: string) => void;
  confirm: (message: string, onConfirm: () => void) => void;
}

export default function PickupQueueTab({
  items,
  factoryOptions,
  myInfo,
  isLoading,
  loadIssue,
  expandedId,
  onToggle,
  schedulingId,
  onSchedule,
  confirm,
}: Props) {
  const reduceMotion = useReducedMotion();

  const [pickupRangeById, setPickupRangeById] = useState<Record<string, DateRangeValue>>({});
  const [destFactoryById, setDestFactoryById] = useState<Record<string, string>>({});
  const [leg2KmById, setLeg2KmById] = useState<Record<string, number | null>>({});
  const [sort, setSort] = useState<{ key: 'created_at' | 'material' | 'weight' | 'distance'; dir: SortDir }>({ key: 'created_at', dir: 'desc' });
  const [distMode, setDistMode] = useState<'leg1' | 'leg2' | 'sum'>('leg1');

  // Seed default factory for each new queue item
  useEffect(() => {
    if (!factoryOptions.length) return;
    setDestFactoryById((prev) => {
      const next = { ...prev };
      const defaultId = factoryOptions[0].id;
      for (const item of items) {
        const exists = next[item.id] ? factoryOptions.some((f) => f.id === next[item.id]) : false;
        if (!exists && defaultId) next[item.id] = defaultId;
      }
      return next;
    });
  }, [items, factoryOptions]);

  // Fetch leg2 distance when factory selection changes
  useEffect(() => {
    const entries = Object.entries(destFactoryById);
    if (!entries.length) return;
    void (async () => {
      for (const [submissionId, factoryId] of entries) {
        if (!factoryId) continue;
        const item = items.find((q) => q.id === submissionId);
        const factory = factoryOptions.find((f) => f.id === factoryId);
        if (!item || !factory || item.pickup_lat == null || item.pickup_lng == null || factory.lat == null || factory.lng == null) continue;
        try {
          const res = await logisticsApi.getRouteDistance(item.pickup_lat, item.pickup_lng, factory.lat as number, factory.lng as number);
          setLeg2KmById((prev) => ({ ...prev, [submissionId]: res.distance_km }));
        } catch { /* ignore */ }
      }
    })();
  }, [destFactoryById]);

  function toggleSort(key: typeof sort.key) {
    setSort((cur) => cur.key === key ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  }

  const sorted = useMemo(() => [...items].sort((a, b) => {
    const mul = sort.dir === 'asc' ? 1 : -1;
    if (sort.key === 'material') return mul * (a.material_type ?? '').localeCompare(b.material_type ?? '');
    if (sort.key === 'weight') return mul * (toKgForSort(a.quantity_value, a.quantity_unit) - toKgForSort(b.quantity_value, b.quantity_unit));
    if (sort.key === 'distance') {
      const getDist = (item: typeof a) => {
        const l1 = item.distance_to_farmer_km ?? null;
        const l2 = leg2KmById[item.id] ?? null;
        if (distMode === 'leg1') return l1 ?? Infinity;
        if (distMode === 'leg2') return l2 ?? Infinity;
        return l1 != null && l2 != null ? l1 + l2 : l1 ?? Infinity;
      };
      return mul * (getDist(a) - getDist(b));
    }
    return mul * (new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
  }), [items, sort, distMode, leg2KmById]);

  return (
    <div className="space-y-1.5">
      {loadIssue && <AlertBanner message={loadIssue} tone="info" title="บอร์ดคิวรับวัสดุยังไม่พร้อม" />}
      {!isLoading && items.length > 0 && (
        <SortHeaderBar
          cols={[
            { key: 'created_at' as const, label: 'วันที่ส่ง', dirLabels: ['เก่าก่อน', 'ใหม่ก่อน'] },
            { key: 'material' as const, label: 'วัสดุ', dirLabels: ['ก→ฮ', 'ฮ→ก'] },
            { key: 'weight' as const, label: 'น้ำหนัก', dirLabels: ['น้อยก่อน', 'มากก่อน'] },
            {
              key: 'distance' as const, label: 'ระยะทาง', dirLabels: ['ใกล้ก่อน', 'ไกลก่อน'],
              activeExtra: (
                <DistModeChips<'leg1' | 'leg2' | 'sum'>
                  options={[
                    { value: 'leg1', label: 'ฉัน→เกษตรกร' },
                    { value: 'leg2', label: 'เกษตรกร→โรงงาน' },
                    { value: 'sum', label: 'รวมทั้งหมด' },
                  ]}
                  value={distMode}
                  onChange={setDistMode}
                />
              ),
            },
          ]}
          sort={sort}
          onSort={toggleSort}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : sorted.length === 0 ? (
        <EmptyState
          title={loadIssue ? 'ยังแสดงคิวรับวัสดุใหม่ไม่ได้' : 'ไม่มีคิวใหม่ในตอนนี้'}
          description={loadIssue ? 'โปรดกดรีเฟรชอีกครั้ง' : 'เมื่อเกษตรกรส่งคำขอใหม่ รายการจะมาปรากฏในบอร์ดนี้ทันที'}
          icon={Truck}
        />
      ) : (
        sorted.map((item) => {
          const selFactoryId = destFactoryById[item.id] || '';
          const selFactory = factoryOptions.find((f) => f.id === selFactoryId);
          const canSchedule = pickupRangeById[item.id]?.from && pickupRangeById[item.id]?.to && selFactoryId;
          const isExp = expandedId === item.id;
          const leg2Km = leg2KmById[item.id];

          const farmerMapHref = hasValidCoordinates(item.pickup_lat, item.pickup_lng) ? buildGoogleMapsUrl(item.pickup_lat as number, item.pickup_lng as number) : undefined;
          const factoryMapHref = selFactory?.lat != null && selFactory?.lng != null ? buildGoogleMapsUrl(selFactory.lat as number, selFactory.lng as number) : undefined;
          const leg1Href = myInfo?.lat != null && myInfo?.lng != null && item.pickup_lat != null && item.pickup_lng != null
            ? buildGoogleMapsDirectionsUrl([{ lat: myInfo.lat, lng: myInfo.lng }, { lat: item.pickup_lat, lng: item.pickup_lng }]) : undefined;
          const leg2Href = leg2Km != null && item.pickup_lat != null && item.pickup_lng != null && selFactory?.lat != null && selFactory?.lng != null
            ? buildGoogleMapsDirectionsUrl([{ lat: item.pickup_lat, lng: item.pickup_lng }, { lat: selFactory.lat as number, lng: selFactory.lng as number }]) : undefined;

          return (
            <div key={item.id}>
              <ExpandableCard
                isExpanded={isExp}
                onToggle={() => onToggle(item.id)}
                accent="amber"
                expandedContent={
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">โรงงานปลายทาง</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={selFactoryId}
                          onChange={(e) => setDestFactoryById((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          className="flex-1 rounded-xl border border-outline-variant/20 bg-stone-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 min-h-[44px]"
                        >
                          <option value="">เลือกโรงงาน</option>
                          {factoryOptions.map((f) => <option key={f.id} value={f.id}>{f.name_th}</option>)}
                        </select>
                        {selFactory && hasValidCoordinates(selFactory.lat, selFactory.lng) && (
                          <a href={factoryMapHref} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm font-medium text-primary transition hover:bg-primary/10">
                            <MapPin className="h-3.5 w-3.5" /> แผนที่โรงงาน
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">ช่วงวันนัดรับ</p>
                      <DateRangePicker
                        value={pickupRangeById[item.id] || { from: null, to: null }}
                        onChange={(v) => setPickupRangeById((prev) => ({ ...prev, [item.id]: v }))}
                        minDate={new Date()}
                        placeholder="เลือกช่วงวัน"
                      />
                    </div>
                    <motion.button
                      type="button"
                      onClick={() => confirm('ยืนยันจัดคิวรับวัสดุ?', () => void onSchedule(item.id, pickupRangeById[item.id] || { from: null, to: null }, selFactoryId))}
                      disabled={schedulingId === item.id || !canSchedule}
                      className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-white shadow-sm shadow-primary/20 transition hover:opacity-90 disabled:opacity-40"
                      whileTap={reduceMotion ? {} : { scale: 0.97 }}
                    >
                      {schedulingId === item.id ? 'กำลังจัดคิว...' : 'ยืนยันจัดคิวรับวัสดุ'}
                    </motion.button>
                  </div>
                }
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-sm font-semibold text-on-surface leading-tight truncate">
                      {item.material_name_th || item.material_type}
                    </p>
                    {item.distance_to_farmer_km != null && (
                      <RouteStepper
                        nodes={[
                          { icon: <Navigation className="h-3 w-3" />, label: 'ฉัน' },
                          { icon: <User className="h-3 w-3" />, label: 'เกษตรกร', mapHref: farmerMapHref },
                          ...(leg2Km != null ? [{ icon: <Factory className="h-3 w-3" />, label: selFactory?.name_th ?? 'โรงงาน', mapHref: factoryMapHref }] : []),
                        ]}
                        legs={[
                          { km: item.distance_to_farmer_km, href: leg1Href },
                          ...(leg2Km != null ? [{ km: leg2Km, href: leg2Href }] : []),
                        ]}
                      />
                    )}
                    <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                      {Number(item.quantity_value).toLocaleString('th-TH')} {fallbackThaiUnit(item.quantity_unit)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-400">
                    <span className="flex items-center gap-1"><CalendarRange className="h-3 w-3" />ส่งคำขอ {formatDateTime(item.created_at)}</span>
                    {item.pickup_location_text && (
                      <span className="flex items-center gap-1 min-w-0">
                        <MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{item.pickup_location_text}</span>
                      </span>
                    )}
                  </div>
                </div>
              </ExpandableCard>
            </div>
          );
        })
      )}
    </div>
  );
}
