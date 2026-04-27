'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  CalendarRange,
  CheckCheck,
  ClipboardCopy,
  Download,
  Factory,
  MapPin,
  Navigation,
  Pencil,
  ArrowRight,
  Phone,
  RefreshCw,
  Truck,
  User,
  X,
  ZoomIn,
} from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import DateRangePicker, { type DateRangeValue } from '@/app/_components/DateRangePicker';
import EmptyState from '@/app/_components/EmptyState';
import { SkeletonCard } from '@/app/_components/Skeleton';
import StatusBadge from '@/app/_components/StatusBadge';
import SortHeaderBar, { type SortDir } from '@/app/_components/SortHeaderBar';
import { generatePickupJobPdf } from '@/app/_lib/pdfGenerator';
import {
  type LogisticsFactoryOptionItem,
  type LogisticsInfoItem,
  type LogisticsPickupJobItem,
} from '@/app/_lib/api';
import { fallbackThaiUnit } from '@/app/_lib/utils';
import DistModeChips from './DistModeChips';
import ExpandableCard from './ExpandableCard';
import RouteStepper from './RouteStepper';
import { buildGoogleMapsDirectionsUrl, buildGoogleMapsUrl, formatDateRange, hasValidCoordinates, isoToDateOnly } from './logisticsUtils';

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

function formatPickupJobStatus(status: string): string {
  const map: Record<string, string> = {
    pickup_scheduled: 'กำลังไปรับวัสดุ',
    received: 'รับวัสดุแล้ว',
    delivered: 'ส่งถึงโรงงานแล้ว',
  };
  return map[status] ?? status;
}

function toKgForSort(value: number | null | undefined, unit: string | null | undefined): number {
  const v = Number(value ?? 0);
  return unit === 'ton' ? v * 1000 : v;
}

interface Props {
  items: LogisticsPickupJobItem[];
  factoryOptions: LogisticsFactoryOptionItem[];
  myInfo: LogisticsInfoItem | null;
  isLoading: boolean;
  loadIssue?: string;
  expandedId: string | null;
  onToggle: (id: string) => void;
  updatingId: string | null;
  reschedulingId: string | null;
  onMarkPickedUp: (jobId: string) => void;
  onMarkDeliveredToFactory: (jobId: string) => void;
  onReschedule: (jobId: string, range: DateRangeValue, factoryId: string) => void;
  onCancel: (jobId: string, reason: string) => void;
  confirm: (message: string, onConfirm: () => void) => void;
}

export default function PickupJobsTab({
  items,
  factoryOptions,
  myInfo,
  isLoading,
  loadIssue,
  expandedId,
  onToggle,
  updatingId,
  reschedulingId,
  onMarkPickedUp,
  onMarkDeliveredToFactory,
  onReschedule,
  onCancel,
  confirm,
}: Props) {
  const reduceMotion = useReducedMotion();

  const [sort, setSort] = useState<{ key: 'scheduled_pickup_at' | 'material' | 'status' | 'weight' | 'distance'; dir: SortDir }>({ key: 'scheduled_pickup_at', dir: 'asc' });
  const [distMode, setDistMode] = useState<'leg1' | 'leg2' | 'sum'>('leg1');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRangeById, setEditRangeById] = useState<Record<string, DateRangeValue>>({});
  const [editFactoryById, setEditFactoryById] = useState<Record<string, string>>({});
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [cancelReasonById, setCancelReasonById] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyLoadingId, setCopyLoadingId] = useState<string | null>(null);
  const [pdfLoadingId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  function toggleSort(key: typeof sort.key) {
    setSort((cur) => cur.key === key ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  }

  const active = items.filter((i) => i.status !== 'delivered');

  const sorted = [...active].sort((a, b) => {
    const mul = sort.dir === 'asc' ? 1 : -1;
    if (sort.key === 'material') return mul * (a.material_type ?? '').localeCompare(b.material_type ?? '');
    if (sort.key === 'status') return mul * (a.status ?? '').localeCompare(b.status ?? '');
    if (sort.key === 'weight') return mul * (toKgForSort(a.quantity_value, a.quantity_unit) - toKgForSort(b.quantity_value, b.quantity_unit));
    if (sort.key === 'distance') {
      const getDist = (item: typeof a) => {
        const l1 = item.distance_to_farmer_km ?? null;
        const l2 = item.distance_farmer_to_factory_km ?? null;
        if (distMode === 'leg1') return l1 ?? Infinity;
        if (distMode === 'leg2') return l2 ?? Infinity;
        return l1 != null && l2 != null ? l1 + l2 : l1 ?? l2 ?? Infinity;
      };
      return mul * (getDist(a) - getDist(b));
    }
    return mul * (new Date(a.scheduled_pickup_at ?? 0).getTime() - new Date(b.scheduled_pickup_at ?? 0).getTime());
  });

  return (
    <>
    <div className="space-y-1.5">
      {loadIssue && <AlertBanner message={loadIssue} tone="info" title="บอร์ดงานขนส่งวัสดุยังไม่พร้อม" />}
      {!isLoading && active.length > 0 && (
        <SortHeaderBar
          cols={[
            { key: 'scheduled_pickup_at' as const, label: 'วันนัดรับ', dirLabels: ['เร็วก่อน', 'ช้าก่อน'] },
            { key: 'material' as const, label: 'วัสดุ', dirLabels: ['ก→ฮ', 'ฮ→ก'] },
            { key: 'weight' as const, label: 'น้ำหนัก', dirLabels: ['น้อยก่อน', 'มากก่อน'] },
            { key: 'status' as const, label: 'สถานะ', dirLabels: ['ก→ฮ', 'ฮ→ก'] },
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
          title={loadIssue ? 'ยังแสดงงานขนส่งวัสดุไม่ได้' : 'ยังไม่มีงานขนส่งวัสดุ'}
          description={loadIssue ? 'โปรดกดรีเฟรชอีกครั้ง' : 'เมื่อมีการจัดคิวรับวัสดุ รายการจะเริ่มแสดงในบอร์ดนี้'}
          icon={Truck}
        />
      ) : (
        sorted.map((item) => {
          const isExp = expandedId === item.id;
          const isBusy = updatingId === item.id;
          const isLive = item.status === 'received';

          const getRouteSegments = () => {
            const segments: Array<{ label: string; distanceKm: number | null }> = [];
            if (item.distance_to_farmer_km != null) segments.push({ label: 'ฉัน → จุดรับวัสดุ (เกษตรกร)', distanceKm: item.distance_to_farmer_km });
            if (item.distance_farmer_to_factory_km != null) segments.push({ label: `จุดรับวัสดุ → ${item.destination_factory_name_th ?? 'โรงงาน'}`, distanceKm: item.distance_farmer_to_factory_km });
            return segments;
          };

          const handleCopy = async () => {
            setCopyLoadingId(item.id);
            const segments = getRouteSegments();
            setCopyLoadingId(null);
            const totalKm = segments.filter(s => s.distanceKm !== null).reduce((sum, s) => sum + (s.distanceKm ?? 0), 0);
            const hasDistance = segments.length > 0;
            const lines = [
              `[ใบรับวัสดุ AREX] เลขที่ ${item.id.slice(0, 8).toUpperCase()}`,
              `สถานะ: ${formatPickupJobStatus(item.status)}`,
              ``,
              `วัสดุ: ${item.material_name_th || formatMaterial(item.material_type)}`,
              `ปริมาณ: ${Number(item.quantity_value).toLocaleString('th-TH')} ${fallbackThaiUnit(item.quantity_unit)}`,
              ``,
              item.farmer_display_name ? `เกษตรกร: ${item.farmer_display_name}` : null,
              item.farmer_phone ? `เบอร์โทร: ${item.farmer_phone}` : null,
              `จุดรับวัสดุ: ${item.pickup_location_text || '-'}`,
              hasValidCoordinates(item.pickup_lat, item.pickup_lng) ? `แผนที่จุดรับ: ${buildGoogleMapsUrl(item.pickup_lat as number, item.pickup_lng as number)}` : null,
              `วันนัดรับ: ${formatDateRange(item.scheduled_pickup_at, item.pickup_window_end_at)}`,
              item.destination_factory_name_th ? `` : null,
              item.destination_factory_name_th ? `โรงงานปลายทาง: ${item.destination_factory_name_th}` : null,
              item.destination_factory_location_text ? `ที่อยู่โรงงาน: ${item.destination_factory_location_text}` : null,
              hasValidCoordinates(item.destination_factory_lat, item.destination_factory_lng) ? `แผนที่โรงงาน: ${buildGoogleMapsUrl(item.destination_factory_lat as number, item.destination_factory_lng as number)}` : null,
              hasDistance ? `` : null,
              hasDistance ? `--- ระยะทาง (ทางถนน) ---` : null,
              ...segments.map(s => s.distanceKm !== null ? `${s.label}: ${s.distanceKm.toFixed(1)} กม.` : `${s.label}: ไม่สามารถคำนวณได้`),
              hasDistance && segments.filter(s => s.distanceKm !== null).length > 1 ? `รวม: ${totalKm.toFixed(1)} กม.` : null,
            ].filter((l) => l !== null).join('\n');
            void navigator.clipboard.writeText(lines).then(() => { setCopiedId(item.id); setTimeout(() => setCopiedId(null), 1500); });
          };

          const routeNodes = (() => {
            const nodes: { icon: React.ReactNode; label: string; mapHref?: string }[] = [{ icon: <Navigation className="h-3 w-3" />, label: 'ฉัน' }];
            const legs: { km: number; href?: string }[] = [];
            if (item.distance_to_farmer_km != null) {
              const href = myInfo?.lat != null && myInfo?.lng != null && item.pickup_lat != null && item.pickup_lng != null
                ? buildGoogleMapsDirectionsUrl([{ lat: myInfo.lat, lng: myInfo.lng }, { lat: item.pickup_lat, lng: item.pickup_lng }]) : undefined;
              legs.push({ km: item.distance_to_farmer_km, href });
              nodes.push({ icon: <User className="h-3 w-3" />, label: 'เกษตรกร', mapHref: hasValidCoordinates(item.pickup_lat, item.pickup_lng) ? buildGoogleMapsUrl(item.pickup_lat as number, item.pickup_lng as number) : undefined });
            }
            if (item.distance_farmer_to_factory_km != null) {
              const href = item.pickup_lat != null && item.pickup_lng != null && item.destination_factory_lat != null && item.destination_factory_lng != null
                ? buildGoogleMapsDirectionsUrl([{ lat: item.pickup_lat, lng: item.pickup_lng }, { lat: item.destination_factory_lat, lng: item.destination_factory_lng }]) : undefined;
              legs.push({ km: item.distance_farmer_to_factory_km, href });
              nodes.push({ icon: <Factory className="h-3 w-3" />, label: item.destination_factory_name_th ?? 'โรงงาน', mapHref: hasValidCoordinates(item.destination_factory_lat, item.destination_factory_lng) ? buildGoogleMapsUrl(item.destination_factory_lat as number, item.destination_factory_lng as number) : undefined });
            }
            return { nodes, legs };
          })();

          return (
            <div key={item.id}>
              <ExpandableCard
                isExpanded={isExp}
                onToggle={() => onToggle(item.id)}
                accent={isLive ? 'sky' : 'sky'}
                expandedContent={
                  <div className="space-y-3">
                    {item.status !== 'delivered' && (
                      <div className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2.5">
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${item.status === 'pickup_scheduled' ? 'bg-sky-500 text-white' : 'bg-emerald-500 text-white'}`}>
                            {item.status === 'pickup_scheduled' ? '1' : <CheckCheck className="h-2.5 w-2.5" />}
                          </span>
                          <span className={`text-xs font-semibold ${item.status === 'pickup_scheduled' ? 'text-sky-700' : 'text-emerald-600'}`}>รับวัสดุ</span>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-stone-300 shrink-0" />
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${item.status === 'received' ? 'bg-emerald-500 text-white' : 'bg-stone-200 text-stone-400'}`}>2</span>
                          <span className={`text-xs font-semibold ${item.status === 'received' ? 'text-emerald-700' : 'text-stone-400'}`}>ส่งโรงงาน</span>
                        </div>
                        <div className="ml-auto">
                          {item.status === 'pickup_scheduled' && (
                            <motion.button type="button"
                              onClick={() => confirm('ยืนยันว่ารับวัสดุจากเกษตรกรแล้ว?', () => onMarkPickedUp(item.id))}
                              disabled={isBusy}
                              className="flex min-h-[36px] items-center gap-1.5 rounded-lg bg-sky-500 px-3 text-xs font-semibold text-white transition hover:bg-sky-600 disabled:opacity-40"
                              whileTap={reduceMotion ? {} : { scale: 0.97 }}>
                              <Truck className="h-3 w-3" />
                              {isBusy ? 'กำลังอัปเดต...' : 'กดเมื่อรับวัสดุแล้ว'}
                            </motion.button>
                          )}
                          {item.status === 'received' && (
                            <motion.button type="button"
                              onClick={() => confirm('ยืนยันว่าส่งถึงโรงงานแล้ว?', () => onMarkDeliveredToFactory(item.id))}
                              disabled={isBusy}
                              className="flex min-h-[36px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40"
                              whileTap={reduceMotion ? {} : { scale: 0.97 }}>
                              <Factory className="h-3 w-3" />
                              {isBusy ? 'กำลังอัปเดต...' : 'กดเมื่อส่งถึงโรงงานแล้ว'}
                            </motion.button>
                          )}
                        </div>
                      </div>
                    )}
                    {item.status === 'pickup_scheduled' && (
                      <div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setCancelingId((cur) => cur === item.id ? null : item.id)}
                            disabled={isBusy}
                            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-colors disabled:opacity-40"
                          >
                            <X className="h-3 w-3" />
                            ยกเลิกงาน
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (editingId === item.id) { setEditingId(null); return; }
                              setEditingId(item.id);
                              setEditRangeById((p) => ({ ...p, [item.id]: { from: isoToDateOnly(item.scheduled_pickup_at), to: isoToDateOnly(item.pickup_window_end_at) } }));
                              setEditFactoryById((p) => ({ ...p, [item.id]: item.destination_factory_id ?? '' }));
                            }}
                            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
                          >
                            <Pencil className="h-3 w-3" />
                            {editingId === item.id ? 'ซ่อนฟอร์มแก้ไข' : 'แก้ไขวันนัดรับ / โรงงาน'}
                          </button>
                        </div>
                        <AnimatePresence initial={false}>
                          {cancelingId === item.id && (
                            <motion.div
                              key="cancel-reason"
                              initial={reduceMotion ? {} : { height: 0, opacity: 0 }}
                              animate={reduceMotion ? {} : { height: 'auto', opacity: 1 }}
                              exit={reduceMotion ? {} : { height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: 'easeInOut' }}
                              style={{ overflow: 'hidden' }}
                            >
                              <div className="mt-2 space-y-2 rounded-xl border border-rose-200 bg-rose-50/60 p-3">
                                <p className="text-xs font-semibold text-rose-700">ระบุเหตุผลการยกเลิก (จำเป็น)</p>
                                <textarea
                                  autoFocus
                                  rows={2}
                                  maxLength={500}
                                  value={cancelReasonById[item.id] ?? ''}
                                  onChange={(e) => setCancelReasonById((p) => ({ ...p, [item.id]: e.target.value }))}
                                  placeholder="เช่น เกษตรกรไม่อยู่บ้าน, ปริมาณไม่ตรงที่แจ้ง..."
                                  className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-rose-300 resize-none"
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    disabled={isBusy || !(cancelReasonById[item.id] ?? '').trim()}
                                    onClick={() => {
                                      const reason = (cancelReasonById[item.id] ?? '').trim();
                                      if (!reason) return;
                                      onCancel(item.id, reason);
                                      setCancelingId(null);
                                    }}
                                    className="flex-1 rounded-lg bg-rose-500 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-600 disabled:opacity-40"
                                  >
                                    {isBusy ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิก'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setCancelingId(null)}
                                    className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-500 hover:bg-stone-100 transition"
                                  >
                                    ปิด
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <AnimatePresence initial={false}>
                          {editingId === item.id && (
                            <motion.div
                              key="edit-pickup"
                              initial={reduceMotion ? {} : { height: 0, opacity: 0 }}
                              animate={reduceMotion ? {} : { height: 'auto', opacity: 1 }}
                              exit={reduceMotion ? {} : { height: 0, opacity: 0 }}
                              transition={{ duration: 0.22, ease: 'easeInOut' }}
                              style={{ overflow: 'hidden' }}
                            >
                              <div className="mt-2 space-y-3 rounded-xl border border-sky-100 bg-sky-50/50 p-3">
                                <div className="space-y-1.5">
                                  <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">โรงงานปลายทาง</p>
                                  <select
                                    value={editFactoryById[item.id] ?? ''}
                                    onChange={(e) => setEditFactoryById((p) => ({ ...p, [item.id]: e.target.value }))}
                                    className="w-full rounded-xl border border-outline-variant/20 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 min-h-[44px]"
                                  >
                                    <option value="">เลือกโรงงาน</option>
                                    {factoryOptions.map((f) => <option key={f.id} value={f.id}>{f.name_th}</option>)}
                                  </select>
                                </div>
                                <div className="space-y-1.5">
                                  <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">ช่วงวันนัดรับใหม่</p>
                                  <DateRangePicker
                                    value={editRangeById[item.id] || { from: null, to: null }}
                                    onChange={(v) => setEditRangeById((p) => ({ ...p, [item.id]: v }))}
                                    minDate={new Date()}
                                    placeholder="เลือกช่วงวัน"
                                  />
                                </div>
                                <motion.button
                                  type="button"
                                  onClick={() => confirm('ยืนยันแก้ไขตารางรับวัสดุ?', () => {
                                    const range = editRangeById[item.id] || { from: null, to: null };
                                    const factoryId = editFactoryById[item.id] ?? '';
                                    onReschedule(item.id, range, factoryId);
                                  })}
                                  disabled={reschedulingId === item.id || !editRangeById[item.id]?.from || !editRangeById[item.id]?.to || !editFactoryById[item.id]}
                                  className="flex w-full min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-sky-500 text-xs font-semibold text-white transition hover:bg-sky-600 disabled:opacity-40"
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
                <div className="flex items-start gap-2">
                  {item.image_url && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setLightboxUrl(item.image_url!); }}
                      onKeyDown={(e) => e.key === 'Enter' && setLightboxUrl(item.image_url!)}
                      className="shrink-0 h-12 w-12 overflow-hidden rounded-xl border border-stone-200 bg-stone-100 hover:opacity-80 transition relative cursor-pointer"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.image_url} alt="ภาพวัสดุ" className="h-full w-full object-cover" />
                      <div className="absolute inset-0 flex items-end justify-end p-0.5">
                        <ZoomIn className="h-3 w-3 text-white drop-shadow" />
                      </div>
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isLive && (
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
                      </span>
                    )}
                    <p className="text-sm font-semibold text-on-surface leading-tight truncate">
                      {item.material_name_th || formatMaterial(item.material_type)}
                    </p>
                    {(item.distance_to_farmer_km != null || item.distance_farmer_to_factory_km != null) && (
                      <RouteStepper nodes={routeNodes.nodes} legs={routeNodes.legs} />
                    )}
                    <span className="ml-auto shrink-0"><StatusBadge status={item.status} label={formatPickupJobStatus(item.status)} size="sm" /></span>
                  </div>
                  <div className="flex items-center gap-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-400 min-w-0 flex-1">
                      <span className="font-bold text-sky-700">{Number(item.quantity_value).toLocaleString('th-TH')} {fallbackThaiUnit(item.quantity_unit)}</span>
                      <span className="flex items-center gap-0.5"><CalendarRange className="h-3 w-3" />นัดรับ {formatDateRange(item.scheduled_pickup_at, item.pickup_window_end_at)}</span>
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
                        onClick={pdfLoadingId === item.id ? undefined : () => { generatePickupJobPdf(item, getRouteSegments()); }}
                        onKeyDown={(e) => e.key === 'Enter' && !pdfLoadingId && generatePickupJobPdf(item, getRouteSegments())}
                        className={`flex h-7 w-7 items-center justify-center rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors cursor-pointer ${pdfLoadingId === item.id ? 'opacity-40' : ''}`}>
                        {pdfLoadingId === item.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      </div>
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

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxUrl(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightboxUrl} alt="ภาพวัสดุ" className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
            <button type="button" onClick={() => setLightboxUrl(null)} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white">
              <ZoomIn className="h-5 w-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
