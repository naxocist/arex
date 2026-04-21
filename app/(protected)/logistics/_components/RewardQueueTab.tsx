'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { CalendarRange, MapPin, Navigation, PackageCheck, Phone, StickyNote, User } from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import DateRangePicker, { type DateRangeValue } from '@/app/_components/DateRangePicker';
import EmptyState from '@/app/_components/EmptyState';
import { SkeletonCard } from '@/app/_components/Skeleton';
import SortHeaderBar, { type SortDir } from '@/app/_components/SortHeaderBar';
import {
  type LogisticsApprovedRewardRequestItem,
  type LogisticsInfoItem,
} from '@/app/_lib/api';
import { formatDateTime } from '@/app/_lib/utils';
import ExpandableCard from './ExpandableCard';
import RouteStepper from './RouteStepper';
import { buildGoogleMapsDirectionsUrl, buildGoogleMapsUrl, hasValidCoordinates } from './logisticsUtils';

interface Props {
  items: LogisticsApprovedRewardRequestItem[];
  myInfo: LogisticsInfoItem | null;
  isLoading: boolean;
  loadIssue?: string;
  expandedId: string | null;
  onToggle: (id: string) => void;
  schedulingId: string | null;
  onSchedule: (requestId: string, range: DateRangeValue) => void;
  confirm: (message: string, onConfirm: () => void) => void;
}

export default function RewardQueueTab({
  items,
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

  const [sort, setSort] = useState<{ key: 'requested_points' | 'reward_name' | 'requested_at' | 'distance'; dir: SortDir }>({ key: 'requested_at', dir: 'asc' });
  const [rangeById, setRangeById] = useState<Record<string, DateRangeValue>>({});

  function toggleSort(key: typeof sort.key) {
    setSort((cur) => cur.key === key ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  }

  const sorted = [...items].sort((a, b) => {
    const mul = sort.dir === 'asc' ? 1 : -1;
    if (sort.key === 'reward_name') return mul * (a.reward_name_th ?? '').localeCompare(b.reward_name_th ?? '');
    if (sort.key === 'requested_at') return mul * (a.requested_at < b.requested_at ? -1 : a.requested_at > b.requested_at ? 1 : 0);
    if (sort.key === 'distance') return mul * ((a.distance_to_farmer_km ?? Infinity) - (b.distance_to_farmer_km ?? Infinity));
    return mul * (Number(a.requested_points) - Number(b.requested_points));
  });

  return (
    <div className="space-y-1.5">
      {loadIssue && <AlertBanner message={loadIssue} tone="info" title="บอร์ดคำขอรางวัลยังไม่พร้อม" />}
      {!isLoading && items.length > 0 && (
        <SortHeaderBar
          cols={[
            { key: 'requested_at' as const, label: 'วันที่ขอแลก', dirLabels: ['เก่าก่อน', 'ใหม่ก่อน'] },
            { key: 'requested_points' as const, label: 'แต้ม', dirLabels: ['น้อยก่อน', 'มากก่อน'] },
            { key: 'reward_name' as const, label: 'ชื่อรางวัล', dirLabels: ['ก→ฮ', 'ฮ→ก'] },
            { key: 'distance' as const, label: 'ระยะทาง', dirLabels: ['ใกล้ก่อน', 'ไกลก่อน'] },
          ]}
          sort={sort}
          onSort={toggleSort}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : sorted.length === 0 ? (
        <EmptyState
          title={loadIssue ? 'ยังแสดงคำขอรางวัลที่รอจัดส่งไม่ได้' : 'ไม่มีคำขอที่ต้องจัดรอบส่งเพิ่ม'}
          description={loadIssue ? 'โปรดกดรีเฟรชอีกครั้ง' : 'เมื่อฝ่ายคลังอนุมัติคำขอใหม่ รายการจะปรากฏที่นี่'}
          icon={PackageCheck}
        />
      ) : (
        sorted.map((item) => {
          const isExp = expandedId === item.id;
          const canSchedule = rangeById[item.id]?.from && rangeById[item.id]?.to;
          const farmerMapHref = hasValidCoordinates(item.pickup_lat, item.pickup_lng) ? buildGoogleMapsUrl(item.pickup_lat as number, item.pickup_lng as number) : undefined;
          const leg1Href = myInfo?.lat != null && myInfo?.lng != null && item.pickup_lat != null && item.pickup_lng != null
            ? buildGoogleMapsDirectionsUrl([{ lat: myInfo.lat, lng: myInfo.lng }, { lat: item.pickup_lat, lng: item.pickup_lng }]) : undefined;

          return (
            <div key={item.id}>
              <ExpandableCard
                isExpanded={isExp}
                onToggle={() => onToggle(item.id)}
                accent="violet"
                expandedContent={
                  <div className="space-y-4">
                    {item.reward_instruction_notes && (
                      <div className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                        <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                        <span className="whitespace-pre-line leading-relaxed">{item.reward_instruction_notes}</span>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">ช่วงวันนำส่ง</p>
                      <DateRangePicker
                        value={rangeById[item.id] || { from: null, to: null }}
                        onChange={(v) => setRangeById((prev) => ({ ...prev, [item.id]: v }))}
                        minDate={new Date()}
                        placeholder="เลือกช่วงวัน"
                      />
                    </div>
                    <motion.button
                      type="button"
                      onClick={() => confirm('ยืนยันจัดรอบส่งรางวัล?', () => onSchedule(item.id, rangeById[item.id] || { from: null, to: null }))}
                      disabled={schedulingId === item.id || !canSchedule}
                      className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-white shadow-sm shadow-primary/20 transition hover:opacity-90 disabled:opacity-40"
                      whileTap={reduceMotion ? {} : { scale: 0.97 }}
                    >
                      {schedulingId === item.id ? 'กำลังจัดส่ง...' : 'ยืนยันจัดรอบส่งรางวัล'}
                    </motion.button>
                  </div>
                }
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="text-sm font-semibold text-on-surface leading-tight truncate">{item.reward_name_th ?? 'รางวัล'}</p>
                    {item.distance_to_farmer_km != null && (
                      <RouteStepper
                        nodes={[{ icon: <Navigation className="h-3 w-3" />, label: 'ฉัน' }, { icon: <User className="h-3 w-3" />, label: 'เกษตรกร', mapHref: farmerMapHref }]}
                        legs={[{ km: item.distance_to_farmer_km, href: leg1Href }]}
                      />
                    )}
                    <span className="ml-auto shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">
                      {Number(item.requested_points).toLocaleString('th-TH')} แต้ม
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-400">
                    <span className="font-medium text-stone-600">{Number(item.quantity).toLocaleString('th-TH')} ชิ้น</span>
                    <span className="flex items-center gap-0.5"><CalendarRange className="h-3 w-3" />ขอแลก {formatDateTime(item.requested_at)}</span>
                    {item.farmer_display_name && (
                      <span className="flex items-center gap-0.5">
                        <User className="h-3 w-3" />{item.farmer_display_name}
                        {item.farmer_phone && <><Phone className="h-3 w-3" />{item.farmer_phone}</>}
                      </span>
                    )}
                    {item.pickup_location_text && (
                      <span className="flex items-center gap-0.5 min-w-0">
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
