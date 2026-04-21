'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  CalendarRange,
  CheckCheck,
  ClipboardCopy,
  Download,
  MapPin,
  Navigation,
  PackageCheck,
  Pencil,
  Phone,
  RefreshCw,
  Truck,
  User,
} from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import DateRangePicker, { type DateRangeValue } from '@/app/_components/DateRangePicker';
import EmptyState from '@/app/_components/EmptyState';
import { SkeletonCard } from '@/app/_components/Skeleton';
import StatusBadge from '@/app/_components/StatusBadge';
import SortHeaderBar, { type SortDir } from '@/app/_components/SortHeaderBar';
import { generateDeliveryJobPdf } from '@/app/_lib/pdfGenerator';
import { type LogisticsInfoItem, type LogisticsRewardDeliveryJobItem } from '@/app/_lib/api';
import ExpandableCard from './ExpandableCard';
import RouteStepper from './RouteStepper';
import { buildGoogleMapsDirectionsUrl, buildGoogleMapsUrl, formatDateRange, hasValidCoordinates, isoToDateOnly } from './logisticsUtils';

function formatDeliveryStatus(status: string): string {
  const map: Record<string, string> = {
    reward_delivery_scheduled: 'จัดรอบส่งแล้ว',
    out_for_delivery: 'กำลังนำส่ง',
    reward_delivered: 'ส่งมอบสำเร็จ',
  };
  return map[status] ?? status;
}

interface Props {
  items: LogisticsRewardDeliveryJobItem[];
  myInfo: LogisticsInfoItem | null;
  isLoading: boolean;
  loadIssue?: string;
  expandedId: string | null;
  onToggle: (id: string) => void;
  updatingId: string | null;
  reschedulingId: string | null;
  onMarkOutForDelivery: (jobId: string) => void;
  onMarkDelivered: (jobId: string) => void;
  onReschedule: (jobId: string, range: DateRangeValue) => void;
  confirm: (message: string, onConfirm: () => void) => void;
}

export default function DeliveryJobsTab({
  items,
  myInfo,
  isLoading,
  loadIssue,
  expandedId,
  onToggle,
  updatingId,
  reschedulingId,
  onMarkOutForDelivery,
  onMarkDelivered,
  onReschedule,
  confirm,
}: Props) {
  const reduceMotion = useReducedMotion();

  const [sort, setSort] = useState<{ key: 'planned_delivery_at' | 'status' | 'reward_name' | 'distance'; dir: SortDir }>({ key: 'planned_delivery_at', dir: 'asc' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRangeById, setEditRangeById] = useState<Record<string, DateRangeValue>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyLoadingId, setCopyLoadingId] = useState<string | null>(null);
  const [pdfLoadingId] = useState<string | null>(null);

  function toggleSort(key: typeof sort.key) {
    setSort((cur) => cur.key === key ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  }

  const sorted = [...items].sort((a, b) => {
    const mul = sort.dir === 'asc' ? 1 : -1;
    if (sort.key === 'status') return mul * (a.status ?? '').localeCompare(b.status ?? '');
    if (sort.key === 'reward_name') return mul * (a.reward_name_th ?? '').localeCompare(b.reward_name_th ?? '');
    if (sort.key === 'distance') return mul * ((a.distance_to_farmer_km ?? Infinity) - (b.distance_to_farmer_km ?? Infinity));
    return mul * (new Date(a.planned_delivery_at ?? 0).getTime() - new Date(b.planned_delivery_at ?? 0).getTime());
  });

  return (
    <div className="space-y-1.5">
      {loadIssue && <AlertBanner message={loadIssue} tone="info" title="บอร์ดงานส่งรางวัลยังไม่พร้อม" />}
      {!isLoading && items.length > 0 && (
        <SortHeaderBar
          cols={[
            { key: 'planned_delivery_at' as const, label: 'วันนัดส่ง', dirLabels: ['เร็วก่อน', 'ช้าก่อน'] },
            { key: 'reward_name' as const, label: 'ชื่อรางวัล', dirLabels: ['ก→ฮ', 'ฮ→ก'] },
            { key: 'distance' as const, label: 'ระยะทาง', dirLabels: ['ใกล้ก่อน', 'ไกลก่อน'] },
            { key: 'status' as const, label: 'สถานะ', dirLabels: ['ก→ฮ', 'ฮ→ก'] },
          ]}
          sort={sort}
          onSort={toggleSort}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : sorted.length === 0 ? (
        <EmptyState
          title={loadIssue ? 'ยังแสดงงานส่งรางวัลไม่ได้' : 'ยังไม่มีงานส่งรางวัลที่กำลังดำเนินการ'}
          description={loadIssue ? 'โปรดกดรีเฟรชอีกครั้ง' : 'เมื่อจัดรอบส่งแล้ว งานจะย้ายเข้าบอร์ดนี้เพื่อติดตามจนส่งมอบสำเร็จ'}
          icon={PackageCheck}
        />
      ) : (
        sorted.map((item) => {
          const isExp = expandedId === item.id;
          const isBusy = updatingId === item.id;
          const isOnRoute = item.status === 'out_for_delivery';
          const farmerMapHref = hasValidCoordinates(item.pickup_lat, item.pickup_lng) ? buildGoogleMapsUrl(item.pickup_lat as number, item.pickup_lng as number) : undefined;
          const leg1Href = myInfo?.lat != null && myInfo?.lng != null && item.pickup_lat != null && item.pickup_lng != null
            ? buildGoogleMapsDirectionsUrl([{ lat: myInfo.lat, lng: myInfo.lng }, { lat: item.pickup_lat, lng: item.pickup_lng }]) : undefined;

          const getRouteSegments = () => {
            const segments: Array<{ label: string; distanceKm: number | null }> = [];
            if (item.distance_to_farmer_km != null) segments.push({ label: 'ฉัน → จุดส่งมอบ (เกษตรกร)', distanceKm: item.distance_to_farmer_km });
            return segments;
          };

          const handleCopy = async () => {
            setCopyLoadingId(item.id);
            const segments = getRouteSegments();
            setCopyLoadingId(null);
            const hasDistance = segments.length > 0;
            const lines = [
              `[ใบส่งรางวัล AREX] เลขที่ ${item.id.slice(0, 8).toUpperCase()}`,
              `สถานะ: ${formatDeliveryStatus(item.status)}`,
              ``,
              `รางวัล: ${item.reward_name_th || 'รางวัล'}`,
              `จำนวน: ${Number(item.quantity).toLocaleString('th-TH')} ชิ้น`,
              item.reward_instruction_notes?.trim() ? `หมายเหตุการรับของ: ${item.reward_instruction_notes.trim()}` : null,
              ``,
              item.farmer_display_name ? `ผู้รับ: ${item.farmer_display_name}` : null,
              item.farmer_phone ? `เบอร์โทร: ${item.farmer_phone}` : null,
              `จุดส่งมอบ: ${item.pickup_location_text || '-'}`,
              hasValidCoordinates(item.pickup_lat, item.pickup_lng) ? `แผนที่จุดส่ง: ${buildGoogleMapsUrl(item.pickup_lat as number, item.pickup_lng as number)}` : null,
              `วันนัดส่ง: ${formatDateRange(item.planned_delivery_at, item.delivery_window_end_at)}`,
              hasDistance ? `` : null,
              hasDistance ? `--- ระยะทาง (ทางถนน) ---` : null,
              ...segments.map(s => s.distanceKm !== null ? `${s.label}: ${s.distanceKm.toFixed(1)} กม.` : `${s.label}: ไม่สามารถคำนวณได้`),
            ].filter((l) => l !== null).join('\n');
            void navigator.clipboard.writeText(lines).then(() => { setCopiedId(item.id); setTimeout(() => setCopiedId(null), 1500); });
          };

          return (
            <div key={item.id}>
              <ExpandableCard
                isExpanded={isExp}
                onToggle={() => onToggle(item.id)}
                accent={isOnRoute ? 'emerald' : 'violet'}
                expandedContent={
                  <div className="space-y-3">
                    {item.reward_instruction_notes?.trim() && (
                      <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 space-y-0.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">หมายเหตุการรับของ</p>
                        <p className="text-sm text-on-surface whitespace-pre-wrap">{item.reward_instruction_notes}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2.5">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${item.status === 'reward_delivery_scheduled' ? 'bg-violet-500 text-white' : 'bg-emerald-500 text-white'}`}>
                          {item.status === 'reward_delivery_scheduled' ? '1' : <CheckCheck className="h-2.5 w-2.5" />}
                        </span>
                        <span className={`text-xs font-semibold ${item.status === 'reward_delivery_scheduled' ? 'text-violet-700' : 'text-emerald-600'}`}>ออกนำส่ง</span>
                      </div>
                      <span className="text-stone-300 text-xs shrink-0">──→</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${item.status === 'out_for_delivery' ? 'bg-emerald-500 text-white' : 'bg-stone-200 text-stone-400'}`}>2</span>
                        <span className={`text-xs font-semibold ${item.status === 'out_for_delivery' ? 'text-emerald-700' : 'text-stone-400'}`}>ส่งมอบ</span>
                      </div>
                      <div className="ml-auto">
                        {item.status === 'reward_delivery_scheduled' && (
                          <motion.button type="button"
                            onClick={() => confirm('ยืนยันออกนำส่งแล้ว?', () => onMarkOutForDelivery(item.id))}
                            disabled={isBusy}
                            className="flex min-h-[36px] items-center gap-1.5 rounded-lg bg-violet-500 px-3 text-xs font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
                            whileTap={reduceMotion ? {} : { scale: 0.97 }}>
                            <Truck className="h-3 w-3" />
                            {isBusy ? 'กำลังอัปเดต...' : 'กดเมื่อออกนำส่งแล้ว'}
                          </motion.button>
                        )}
                        {item.status === 'out_for_delivery' && (
                          <motion.button type="button"
                            onClick={() => confirm('ยืนยันส่งมอบสำเร็จ?', () => onMarkDelivered(item.id))}
                            disabled={isBusy}
                            className="flex min-h-[36px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40"
                            whileTap={reduceMotion ? {} : { scale: 0.97 }}>
                            <CheckCheck className="h-3 w-3" />
                            {isBusy ? 'กำลังอัปเดต...' : 'กดเมื่อส่งมอบสำเร็จ'}
                          </motion.button>
                        )}
                      </div>
                    </div>
                    {item.status === 'reward_delivery_scheduled' && (
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            if (editingId === item.id) { setEditingId(null); return; }
                            setEditingId(item.id);
                            setEditRangeById((p) => ({ ...p, [item.id]: { from: isoToDateOnly(item.planned_delivery_at), to: isoToDateOnly(item.delivery_window_end_at) } }));
                          }}
                          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
                        >
                          <Pencil className="h-3 w-3" />
                          {editingId === item.id ? 'ซ่อนฟอร์มแก้ไข' : 'แก้ไขวันนำส่ง'}
                        </button>
                        <AnimatePresence initial={false}>
                          {editingId === item.id && (
                            <motion.div
                              key="edit-delivery"
                              initial={reduceMotion ? {} : { height: 0, opacity: 0 }}
                              animate={reduceMotion ? {} : { height: 'auto', opacity: 1 }}
                              exit={reduceMotion ? {} : { height: 0, opacity: 0 }}
                              transition={{ duration: 0.22, ease: 'easeInOut' }}
                              style={{ overflow: 'hidden' }}
                            >
                              <div className="mt-2 space-y-3 rounded-xl border border-violet-100 bg-violet-50/50 p-3">
                                <div className="space-y-1.5">
                                  <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">ช่วงวันนำส่งใหม่</p>
                                  <DateRangePicker
                                    value={editRangeById[item.id] || { from: null, to: null }}
                                    onChange={(v) => setEditRangeById((p) => ({ ...p, [item.id]: v }))}
                                    minDate={new Date()}
                                    placeholder="เลือกช่วงวัน"
                                  />
                                </div>
                                <motion.button
                                  type="button"
                                  onClick={() => confirm('ยืนยันแก้ไขตารางส่งรางวัล?', () => onReschedule(item.id, editRangeById[item.id] || { from: null, to: null }))}
                                  disabled={reschedulingId === item.id || !editRangeById[item.id]?.from || !editRangeById[item.id]?.to}
                                  className="flex w-full min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-violet-500 text-xs font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
                                  whileTap={reduceMotion ? {} : { scale: 0.97 }}
                                >
                                  {reschedulingId === item.id ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                                </motion.button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                }
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isOnRoute && (
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      </span>
                    )}
                    <p className="text-sm font-semibold text-on-surface leading-tight truncate">{item.reward_name_th ?? 'รางวัล'}</p>
                    {item.distance_to_farmer_km != null && (
                      <RouteStepper
                        nodes={[{ icon: <Navigation className="h-3 w-3" />, label: 'ฉัน' }, { icon: <User className="h-3 w-3" />, label: 'เกษตรกร', mapHref: farmerMapHref }]}
                        legs={[{ km: item.distance_to_farmer_km, href: leg1Href }]}
                      />
                    )}
                    <span className="ml-auto shrink-0"><StatusBadge status={item.status} label={formatDeliveryStatus(item.status)} size="sm" /></span>
                  </div>
                  <div className="flex items-center gap-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-400 min-w-0 flex-1">
                      <span className="font-medium text-stone-600">{Number(item.quantity).toLocaleString('th-TH')} ชิ้น</span>
                      <span className="flex items-center gap-0.5"><CalendarRange className="h-3 w-3" />นัดส่ง {formatDateRange(item.planned_delivery_at, item.delivery_window_end_at)}</span>
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
                    <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
                      <div role="button" tabIndex={0}
                        onClick={copyLoadingId === item.id || copiedId === item.id ? undefined : handleCopy}
                        aria-disabled={copyLoadingId === item.id || copiedId === item.id}
                        onKeyDown={(e) => e.key === 'Enter' && !copyLoadingId && !copiedId && void handleCopy()}
                        className={`flex h-7 w-7 items-center justify-center rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors cursor-pointer ${copyLoadingId === item.id || copiedId === item.id ? 'opacity-40' : ''}`}>
                        {copyLoadingId === item.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : copiedId === item.id ? <CheckCheck className="h-3.5 w-3.5 text-emerald-500" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                      </div>
                      <div role="button" tabIndex={0}
                        onClick={pdfLoadingId === item.id ? undefined : () => { generateDeliveryJobPdf(item, getRouteSegments()); }}
                        onKeyDown={(e) => e.key === 'Enter' && !pdfLoadingId && generateDeliveryJobPdf(item, getRouteSegments())}
                        className={`flex h-7 w-7 items-center justify-center rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors cursor-pointer ${pdfLoadingId === item.id ? 'opacity-40' : ''}`}>
                        {pdfLoadingId === item.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      </div>
                    </div>
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
