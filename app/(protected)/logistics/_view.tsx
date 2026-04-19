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
import { generatePickupJobPdf, generateDeliveryJobPdf } from '@/app/_lib/pdfGenerator';
import EmptyState from '@/app/_components/EmptyState';
import ErrorBoundary from '@/app/_components/ErrorBoundary';
import { SkeletonCard } from '@/app/_components/Skeleton';
import StatusBadge from '@/app/_components/StatusBadge';
import {
  ApiError,
  logisticsApi,
  type LogisticsApprovedRewardRequestItem,
  type LogisticsFactoryOptionItem,
  type LogisticsInfoItem,
  type LogisticsPickupJobItem,
  type LogisticsPickupQueueItem,
  type LogisticsRewardDeliveryJobItem,
} from '@/app/_lib/api';
import { formatKm } from '@/app/_lib/geo';

/* ── helpers ── */
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

function formatPickupJobStatus(status: string): string {
  const map: Record<string, string> = {
    pickup_scheduled: 'กำลังไปรับวัสดุ',
    picked_up: 'รับวัสดุแล้ว',
    delivered_to_factory: 'ส่งถึงโรงงานแล้ว',
  };
  return map[status] ?? status;
}

function formatDeliveryStatus(status: string): string {
  const map: Record<string, string> = {
    reward_delivery_scheduled: 'จัดรอบส่งแล้ว',
    out_for_delivery: 'กำลังนำส่ง',
    reward_delivered: 'ส่งมอบสำเร็จ',
  };
  return map[status] ?? status;
}

function formatDateTime(dateTime: string | null | undefined): string {
  if (!dateTime) return '-';
  return new Date(dateTime).toLocaleString('th-TH', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) return '-';
  const s = new Date(start).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });
  if (!end) return s;
  const e = new Date(end).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });
  return s === e ? s : `${s} - ${e}`;
}

function fallbackThaiUnit(unitCode: string): string {
  const map: Record<string, string> = { kg: 'กิโลกรัม', ton: 'ตัน' };
  return map[unitCode] ?? unitCode;
}

function hasValidCoordinates(lat: number | null | undefined, lng: number | null | undefined): boolean {
  return typeof lat === 'number' && Number.isFinite(lat) && typeof lng === 'number' && Number.isFinite(lng);
}

function buildGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

interface RouteNode { icon: React.ReactNode; label: string; mapHref?: string }
interface RouteLeg { km: number; href?: string }

function DistModeChips<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-lg bg-stone-100 p-0.5" onClick={(e) => e.stopPropagation()}>
      {options.map((opt) => (
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
          className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors ${value === opt.value ? 'bg-white text-primary shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}>
          {opt.label}
        </button>
      ))}
    </span>
  );
}

function RouteStepper({ nodes, legs }: { nodes: RouteNode[]; legs: RouteLeg[] }) {
  return (
    <span className="inline-flex items-center gap-0.5 shrink-0">
      {nodes.map((node, i) => (
        <React.Fragment key={i}>
          <span className="inline-flex items-center gap-0.5 text-xs text-stone-400">
            {node.icon}
            {node.mapHref ? (
              <a href={node.mapHref} target="_blank" rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="leading-none hover:text-primary hover:underline transition-colors"
              >{node.label}</a>
            ) : (
              <span className="leading-none">{node.label}</span>
            )}
          </span>
          {i < legs.length && (
            <span className="inline-flex items-center gap-0.5">
              <span className="text-stone-300 mx-0.5 leading-none">›</span>
              {legs[i].href ? (
                <a
                  href={legs[i].href}
                  target="_blank" rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary hover:bg-primary/20 transition-colors leading-none"
                >{legs[i].km % 1 === 0 ? `${legs[i].km} กม.` : `${legs[i].km.toFixed(1)} กม.`}</a>
              ) : (
                <span className="inline-flex items-center rounded-full bg-stone-100 px-1.5 py-0.5 text-xs font-bold text-stone-500 leading-none">
                  {legs[i].km % 1 === 0 ? `${legs[i].km} กม.` : `${legs[i].km.toFixed(1)} กม.`}
                </span>
              )}
              <span className="text-stone-300 mx-0.5 leading-none">›</span>
            </span>
          )}
        </React.Fragment>
      ))}
    </span>
  );
}

function buildGoogleMapsDirectionsUrl(
  waypoints: { lat: number; lng: number }[]
): string {
  if (waypoints.length < 2) return '';
  const origin = `${waypoints[0].lat},${waypoints[0].lng}`;
  const destination = `${waypoints[waypoints.length - 1].lat},${waypoints[waypoints.length - 1].lng}`;
  const mid = waypoints.slice(1, -1).map((w) => `${w.lat},${w.lng}`).join('|');
  const base = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
  return mid ? `${base}&waypoints=${mid}` : base;
}

function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

function inferMessageTone(message: string | null): 'info' | 'success' | 'error' {
  if (!message) return 'info';
  if (message.includes('ไม่สำเร็จ') || message.includes('กรุณา') || message.includes('ยังไม่')) return 'error';
  if (message.includes('สำเร็จ')) return 'success';
  return 'info';
}

function isConnectivityErrorMessage(message: string): boolean {
  return message.includes('เชื่อมต่อข้อมูลไม่สำเร็จ') || message.includes('กรุณาลองใหม่อีกครั้ง');
}

function formatLoadIssue(label: string, error: unknown): string {
  if (error instanceof ApiError) {
    if (isConnectivityErrorMessage(error.message)) return `ยังโหลด${label}ไม่สำเร็จในขณะนี้ โปรดกดรีเฟรชอีกครั้ง`;
    return `ยังโหลด${label}ไม่สำเร็จ: ${error.message}`;
  }
  return `ยังโหลด${label}ไม่สำเร็จในขณะนี้ โปรดกดรีเฟรชอีกครั้ง`;
}

function dateOnlyToStartIso(d: string): string { return new Date(`${d}T00:00:00`).toISOString(); }
function dateOnlyToEndIso(d: string): string { return new Date(`${d}T23:59:59`).toISOString(); }
function isoToDateOnly(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return iso.slice(0, 10);
}
function toKgForSort(value: number | null | undefined, unit: string | null | undefined): number {
  const v = Number(value ?? 0);
  if (unit === 'ton') return v * 1000;
  return v;
}

type LogisticsTab = 'pickupQueue' | 'pickupJobs' | 'rewardQueue' | 'deliveryJobs';
type LogisticsLoadIssueKey = 'pickupQueue' | 'pickupJobs' | 'rewardQueue' | 'deliveryJobs' | 'factories';

/* ── Expandable card wrapper ── */
const accentBorder: Record<string, string> = {
  amber: 'border-l-amber-400',
  sky: 'border-l-sky-400',
  violet: 'border-l-violet-400',
  emerald: 'border-l-emerald-400',
};

function JobCard({
  children,
  expandedContent,
  isExpanded,
  onToggle,
  accent,
}: {
  children: React.ReactNode;
  expandedContent: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  accent?: 'amber' | 'sky' | 'violet' | 'emerald';
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={`overflow-hidden rounded-xl border border-stone-200/80 border-l-4 bg-white shadow-sm transition-shadow hover:shadow-md ${accent ? accentBorder[accent] : 'border-l-stone-300'}`}
    >
      {/* Summary row — tap to expand */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-2 px-3.5 py-2 text-left"
      >
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

      {/* Expanded actions */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="expanded"
            initial={reduceMotion ? {} : { height: 0, opacity: 0 }}
            animate={reduceMotion ? {} : { height: 'auto', opacity: 1 }}
            exit={reduceMotion ? {} : { height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="border-t border-stone-100 bg-stone-50/60 px-3.5 pb-3.5 pt-3">
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
  cols: { key: T; label: string; dirLabels?: [string, string]; activeExtra?: React.ReactNode }[];
  sort: { key: T; dir: SortDir };
  onSort: (key: T) => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-stone-100 bg-stone-50/70 px-4 py-2 rounded-t-xl -mb-1 flex-wrap">
      {cols.map((col) => {
        const active = sort.key === col.key;
        const [ascLabel, descLabel] = col.dirLabels ?? ['ก่อน', 'หลัง'];
        return (
          <React.Fragment key={col.key}>
          <button
            type="button"
            onClick={() => onSort(col.key)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
              active ? 'text-primary' : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            {col.label}
            {active ? (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-primary/10 text-primary' : 'bg-stone-100 text-stone-400'}`}>
                {sort.dir === 'asc' ? ascLabel : descLabel}
              </span>
            ) : (
              <ArrowUpDown className="h-3 w-3 opacity-40" />
            )}
          </button>
          {active && col.activeExtra && col.activeExtra}
          </React.Fragment>
        );
      })}
      <span className="ml-auto text-[11px] text-stone-400 hidden sm:inline">กดชื่อคอลัมน์เพื่อเรียงลำดับ</span>
    </div>
  );
}

function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-stone-900/40 backdrop-blur-sm px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
      >
        <p className="text-base font-semibold text-stone-800">{message}</p>
        <p className="mt-1 text-sm text-stone-500">การกระทำนี้จะอัปเดตสถานะในระบบทันที</p>
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onCancel}
            className="flex-1 rounded-xl border border-stone-200 bg-white py-2.5 text-sm font-semibold text-stone-600 hover:bg-stone-50 transition-colors">
            ยกเลิก
          </button>
          <button type="button" onClick={onConfirm}
            className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity">
            ยืนยัน
          </button>
        </div>
      </motion.div>
    </div>
  );
}


export default function LogisticsTracking() {
  const reduceMotion = useReducedMotion();

  const [pickupQueue, setPickupQueue] = useState<LogisticsPickupQueueItem[]>([]);
  const [pickupJobs, setPickupJobs] = useState<LogisticsPickupJobItem[]>([]);
  const [approvedRewardRequests, setApprovedRewardRequests] = useState<LogisticsApprovedRewardRequestItem[]>([]);
  const [rewardDeliveryJobs, setRewardDeliveryJobs] = useState<LogisticsRewardDeliveryJobItem[]>([]);
  const [factoryOptions, setFactoryOptions] = useState<LogisticsFactoryOptionItem[]>([]);
  const [myInfo, setMyInfo] = useState<LogisticsInfoItem | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loadIssues, setLoadIssues] = useState<Partial<Record<LogisticsLoadIssueKey, string>>>({});

  const [schedulingSubmissionId, setSchedulingSubmissionId] = useState<string | null>(null);
  const [updatingPickupJobId, setUpdatingPickupJobId] = useState<string | null>(null);
  const [schedulingRewardRequestId, setSchedulingRewardRequestId] = useState<string | null>(null);
  const [updatingDeliveryJobId, setUpdatingDeliveryJobId] = useState<string | null>(null);
  const [pickupRangeBySubmissionId, setPickupRangeBySubmissionId] = useState<Record<string, DateRangeValue>>({});
  const [destinationFactoryBySubmissionId, setDestinationFactoryBySubmissionId] = useState<Record<string, string>>({});
  const [pickupQueueLeg2Km, setPickupQueueLeg2Km] = useState<Record<string, number | null>>({});
  const [deliveryRangeByRequestId, setDeliveryRangeByRequestId] = useState<Record<string, DateRangeValue>>({});
  const [activeTab, setActiveTab] = useState<LogisticsTab>('pickupQueue');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyLoadingId, setCopyLoadingId] = useState<string | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmPending, setConfirmPending] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [editingPickupJobId, setEditingPickupJobId] = useState<string | null>(null);
  const [editPickupRangeById, setEditPickupRangeById] = useState<Record<string, DateRangeValue>>({});
  const [editPickupFactoryById, setEditPickupFactoryById] = useState<Record<string, string>>({});
  const [reschedulingPickupJobId, setReschedulingPickupJobId] = useState<string | null>(null);
  const [editingDeliveryJobId, setEditingDeliveryJobId] = useState<string | null>(null);
  const [editDeliveryRangeById, setEditDeliveryRangeById] = useState<Record<string, DateRangeValue>>({});
  const [reschedulingDeliveryJobId, setReschedulingDeliveryJobId] = useState<string | null>(null);

  const [pickupQueueSort, setPickupQueueSort] = useState<{ key: 'created_at' | 'material' | 'weight' | 'distance'; dir: SortDir }>({ key: 'created_at', dir: 'desc' });
  const [pickupQueueDistMode, setPickupQueueDistMode] = useState<'leg1' | 'leg2' | 'sum'>('leg1');
  const [pickupJobSort, setPickupJobSort] = useState<{ key: 'planned_pickup_at' | 'material' | 'status' | 'weight' | 'distance'; dir: SortDir }>({ key: 'planned_pickup_at', dir: 'asc' });
  const [pickupJobDistMode, setPickupJobDistMode] = useState<'leg1' | 'leg2' | 'sum'>('leg1');
  const [rewardQueueSort, setRewardQueueSort] = useState<{ key: 'requested_points' | 'reward_name' | 'requested_at' | 'distance'; dir: SortDir }>({ key: 'requested_at', dir: 'asc' });
  const [deliveryJobSort, setDeliveryJobSort] = useState<{ key: 'planned_delivery_at' | 'status'; dir: SortDir }>({ key: 'planned_delivery_at', dir: 'asc' });

  const submittedQueue = useMemo(() => pickupQueue.filter((i) => i.status === 'submitted'), [pickupQueue]);

  const activeRewardDeliveryJobs = useMemo(
    () => rewardDeliveryJobs.filter((i) => i.status === 'reward_delivery_scheduled' || i.status === 'out_for_delivery'),
    [rewardDeliveryJobs],
  );

  const rewardRequestIdsInDelivery = useMemo(
    () => new Set(activeRewardDeliveryJobs.map((i) => i.reward_request_id)),
    [activeRewardDeliveryJobs],
  );

  const approvedReadyToSchedule = useMemo(
    () => approvedRewardRequests.filter((i) => !rewardRequestIdsInDelivery.has(i.id)),
    [approvedRewardRequests, rewardRequestIdsInDelivery],
  );

  const loadIssueMessages = useMemo(() => Object.values(loadIssues), [loadIssues]);

  function toggleSort<T extends string>(
    current: { key: T; dir: SortDir },
    key: T,
    setter: React.Dispatch<React.SetStateAction<{ key: T; dir: SortDir }>>
  ) {
    setter(current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  }

  const sortedPickupQueue = useMemo(() => [...submittedQueue].sort((a, b) => {
    const mul = pickupQueueSort.dir === 'asc' ? 1 : -1;
    if (pickupQueueSort.key === 'material') return mul * (a.material_type ?? '').localeCompare(b.material_type ?? '');
    if (pickupQueueSort.key === 'weight') return mul * (toKgForSort(a.quantity_value, a.quantity_unit) - toKgForSort(b.quantity_value, b.quantity_unit));
    if (pickupQueueSort.key === 'distance') {
      const getDist = (item: typeof a) => {
        const l1 = item.distance_to_farmer_km ?? null;
        const l2 = pickupQueueLeg2Km[item.id] ?? null;
        if (pickupQueueDistMode === 'leg1') return l1 ?? Infinity;
        if (pickupQueueDistMode === 'leg2') return l2 ?? Infinity;
        return l1 != null && l2 != null ? l1 + l2 : l1 ?? Infinity;
      };
      return mul * (getDist(a) - getDist(b));
    }
    return mul * (new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
  }), [submittedQueue, pickupQueueSort, pickupQueueDistMode, pickupQueueLeg2Km]);

  const sortedPickupJobs = useMemo(() => [...pickupJobs].filter((i) => i.status !== 'delivered_to_factory').sort((a, b) => {
    const mul = pickupJobSort.dir === 'asc' ? 1 : -1;
    if (pickupJobSort.key === 'material') return mul * (a.material_type ?? '').localeCompare(b.material_type ?? '');
    if (pickupJobSort.key === 'status') return mul * (a.status ?? '').localeCompare(b.status ?? '');
    if (pickupJobSort.key === 'weight') return mul * (toKgForSort(a.quantity_value, a.quantity_unit) - toKgForSort(b.quantity_value, b.quantity_unit));
    if (pickupJobSort.key === 'distance') {
      const getDist = (item: typeof a) => {
        const l1 = item.distance_to_farmer_km ?? null;
        const l2 = item.distance_farmer_to_factory_km ?? null;
        if (pickupJobDistMode === 'leg1') return l1 ?? Infinity;
        if (pickupJobDistMode === 'leg2') return l2 ?? Infinity;
        return l1 != null && l2 != null ? l1 + l2 : l1 ?? l2 ?? Infinity;
      };
      return mul * (getDist(a) - getDist(b));
    }
    return mul * (new Date(a.planned_pickup_at ?? 0).getTime() - new Date(b.planned_pickup_at ?? 0).getTime());
  }), [pickupJobs, pickupJobSort, pickupJobDistMode]);

  const sortedRewardQueue = useMemo(() => [...approvedReadyToSchedule].sort((a, b) => {
    const mul = rewardQueueSort.dir === 'asc' ? 1 : -1;
    if (rewardQueueSort.key === 'reward_name') return mul * (a.reward_name_th ?? '').localeCompare(b.reward_name_th ?? '');
    if (rewardQueueSort.key === 'requested_at') return mul * (a.requested_at < b.requested_at ? -1 : a.requested_at > b.requested_at ? 1 : 0);
    if (rewardQueueSort.key === 'distance') return mul * ((a.distance_to_farmer_km ?? Infinity) - (b.distance_to_farmer_km ?? Infinity));
    return mul * (Number(a.requested_points) - Number(b.requested_points));
  }), [approvedReadyToSchedule, rewardQueueSort]);

  const sortedDeliveryJobs = useMemo(() => [...activeRewardDeliveryJobs].sort((a, b) => {
    const mul = deliveryJobSort.dir === 'asc' ? 1 : -1;
    if (deliveryJobSort.key === 'status') return mul * (a.status ?? '').localeCompare(b.status ?? '');
    return mul * (new Date(a.planned_delivery_at ?? 0).getTime() - new Date(b.planned_delivery_at ?? 0).getTime());
  }), [activeRewardDeliveryJobs, deliveryJobSort]);

  const loadAll = async (forceRefresh = false) => {
    if (!hasAccessToken()) {
      setLoadIssues({});
      setMessage('ยังไม่พบโทเคน AREX_ACCESS_TOKEN กรุณาเข้าสู่ระบบที่หน้าเลือกผู้ใช้งาน');
      return;
    }
    setIsLoading(true);
    try {
      const [queueRes, jobsRes, approvedRes, deliveryRes, factoriesRes, myInfoRes] = await Promise.allSettled([
        logisticsApi.getPickupQueue({ forceRefresh }),
        logisticsApi.getPickupJobs({ forceRefresh }),
        logisticsApi.getApprovedRewardRequests({ forceRefresh }),
        logisticsApi.getRewardDeliveryJobs({ forceRefresh }),
        logisticsApi.listFactories({ forceRefresh }),
        logisticsApi.getMyInfo({ forceRefresh }),
      ]);

      const nextIssues: Partial<Record<LogisticsLoadIssueKey, string>> = {};
      let ok = 0;

      if (queueRes.status === 'fulfilled') { setPickupQueue(queueRes.value.queue); ok++; }
      else nextIssues.pickupQueue = formatLoadIssue('คิวรับวัสดุใหม่', queueRes.reason);

      if (jobsRes.status === 'fulfilled') { setPickupJobs(jobsRes.value.jobs); ok++; }
      else nextIssues.pickupJobs = formatLoadIssue('งานขนส่งวัสดุ', jobsRes.reason);

      if (approvedRes.status === 'fulfilled') { setApprovedRewardRequests(approvedRes.value.queue); ok++; }
      else nextIssues.rewardQueue = formatLoadIssue('คำขอรางวัลที่รอจัดส่ง', approvedRes.reason);

      if (deliveryRes.status === 'fulfilled') { setRewardDeliveryJobs(deliveryRes.value.jobs); ok++; }
      else nextIssues.deliveryJobs = formatLoadIssue('งานส่งรางวัล', deliveryRes.reason);

      if (factoriesRes.status === 'fulfilled') {
        setFactoryOptions(factoriesRes.value.factories);
        ok++;
      } else nextIssues.factories = formatLoadIssue('รายชื่อโรงงานปลายทาง', factoriesRes.reason);

      if (myInfoRes.status === 'fulfilled') setMyInfo(myInfoRes.value);

      if (queueRes.status === 'fulfilled' && factoriesRes.status === 'fulfilled') {
        setDestinationFactoryBySubmissionId((prev) => {
          const next = { ...prev };
          const defaultId = factoriesRes.value.factories[0]?.id;
          for (const item of queueRes.value.queue) {
            if (item.status !== 'submitted') continue;
            const exists = next[item.id] ? factoriesRes.value.factories.some((f) => f.id === next[item.id]) : false;
            if (!exists && defaultId) next[item.id] = defaultId;
          }
          return next;
        });
      }

      setLoadIssues(nextIssues);
      if (ok === 0) setMessage('ยังโหลดข้อมูลศูนย์ปฏิบัติการขนส่งไม่สำเร็จ โปรดลองรีเฟรชอีกครั้ง');
      else setMessage((cur) => cur === 'ยังโหลดข้อมูลศูนย์ปฏิบัติการขนส่งไม่สำเร็จ โปรดลองรีเฟรชอีกครั้ง' ? null : cur);
    } catch (error) {
      setLoadIssues({});
      setMessage(error instanceof ApiError ? `โหลดข้อมูลไม่สำเร็จ: ${error.message}` : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadAll(); }, []);

  useEffect(() => {
    const entries = Object.entries(destinationFactoryBySubmissionId);
    if (!entries.length) return;
    void (async () => {
      for (const [submissionId, factoryId] of entries) {
        if (!factoryId) continue;
        const item = sortedPickupQueue.find((q) => q.id === submissionId);
        const factory = factoryOptions.find((f) => f.id === factoryId);
        if (!item || !factory || item.pickup_lat == null || item.pickup_lng == null || factory.lat == null || factory.lng == null) continue;
        try {
          const res = await logisticsApi.getRouteDistance(item.pickup_lat, item.pickup_lng, factory.lat as number, factory.lng as number);
          setPickupQueueLeg2Km((prev) => ({ ...prev, [submissionId]: res.distance_km }));
        } catch { /* ignore */ }
      }
    })();
  }, [destinationFactoryBySubmissionId]);


  const handleSchedulePickup = async (submissionId: string) => {
    const range = pickupRangeBySubmissionId[submissionId] || { from: null, to: null };
    if (!range.from || !range.to) { setMessage('กรุณาระบุช่วงวันนัดรับให้ครบทั้งวันเริ่มและวันสิ้นสุด'); return; }
    if (new Date(range.to).getTime() < new Date(range.from).getTime()) { setMessage('วันสิ้นสุดของช่วงนัดรับต้องไม่น้อยกว่าวันเริ่มต้น'); return; }
    const factoryId = destinationFactoryBySubmissionId[submissionId];
    if (!factoryId) { setMessage('กรุณาเลือกโรงงานปลายทางก่อนจัดคิวรับวัสดุ'); return; }
    setSchedulingSubmissionId(submissionId);
    setMessage(null);
    try {
      await logisticsApi.schedulePickup(submissionId, {
        pickup_window_start_at: dateOnlyToStartIso(range.from),
        pickup_window_end_at: dateOnlyToEndIso(range.to),
        destination_factory_id: factoryId,
        notes: 'จัดคิวโดยฝ่ายขนส่ง',
      });
      setMessage('จัดคิวรับวัสดุสำเร็จแล้ว');
      setExpandedId(null);
      await loadAll(true);
    } catch (error) {
      setMessage(error instanceof ApiError ? `จัดคิวรับวัสดุไม่สำเร็จ: ${error.message}` : 'จัดคิวรับวัสดุไม่สำเร็จ');
    } finally { setSchedulingSubmissionId(null); }
  };

  const handleMarkPickedUp = async (jobId: string) => {
    setUpdatingPickupJobId(jobId); setMessage(null);
    try { await logisticsApi.markPickedUp(jobId); setMessage('อัปเดตสถานะเป็นรับวัสดุแล้ว'); await loadAll(true); }
    catch (error) { setMessage(error instanceof ApiError ? `อัปเดตสถานะไม่สำเร็จ: ${error.message}` : 'อัปเดตสถานะไม่สำเร็จ'); }
    finally { setUpdatingPickupJobId(null); }
  };

  const handleMarkDeliveredToFactory = async (jobId: string) => {
    setUpdatingPickupJobId(jobId); setMessage(null);
    try { await logisticsApi.markDeliveredToFactory(jobId); setMessage('อัปเดตสถานะเป็นส่งถึงโรงงานแล้ว'); await loadAll(true); }
    catch (error) { setMessage(error instanceof ApiError ? `อัปเดตสถานะไม่สำเร็จ: ${error.message}` : 'อัปเดตสถานะไม่สำเร็จ'); }
    finally { setUpdatingPickupJobId(null); }
  };

  const handleReschedulePickup = async (jobId: string) => {
    const range = editPickupRangeById[jobId] || { from: null, to: null };
    if (!range.from || !range.to) { setMessage('กรุณาระบุช่วงวันนัดรับให้ครบ'); return; }
    const factoryId = editPickupFactoryById[jobId];
    if (!factoryId) { setMessage('กรุณาเลือกโรงงานปลายทาง'); return; }
    setReschedulingPickupJobId(jobId); setMessage(null);
    try {
      await logisticsApi.reschedulePickup(jobId, {
        pickup_window_start_at: dateOnlyToStartIso(range.from),
        pickup_window_end_at: dateOnlyToEndIso(range.to),
        destination_factory_id: factoryId,
      });
      setMessage('แก้ไขตารางรับวัสดุสำเร็จแล้ว');
      setEditingPickupJobId(null);
      await loadAll(true);
    } catch (error) {
      setMessage(error instanceof ApiError ? `แก้ไขไม่สำเร็จ: ${error.message}` : 'แก้ไขไม่สำเร็จ');
    } finally { setReschedulingPickupJobId(null); }
  };

  const handleRescheduleDelivery = async (jobId: string) => {
    const range = editDeliveryRangeById[jobId] || { from: null, to: null };
    if (!range.from || !range.to) { setMessage('กรุณาระบุช่วงวันนำส่งให้ครบ'); return; }
    setReschedulingDeliveryJobId(jobId); setMessage(null);
    try {
      await logisticsApi.rescheduleDeliveryJob(jobId, {
        delivery_window_start_at: dateOnlyToStartIso(range.from),
        delivery_window_end_at: dateOnlyToEndIso(range.to),
      });
      setMessage('แก้ไขตารางส่งรางวัลสำเร็จแล้ว');
      setEditingDeliveryJobId(null);
      await loadAll(true);
    } catch (error) {
      setMessage(error instanceof ApiError ? `แก้ไขไม่สำเร็จ: ${error.message}` : 'แก้ไขไม่สำเร็จ');
    } finally { setReschedulingDeliveryJobId(null); }
  };

  const handleScheduleRewardDelivery = async (requestId: string) => {
    const range = deliveryRangeByRequestId[requestId] || { from: null, to: null };
    if (!range.from || !range.to) { setMessage('กรุณาระบุช่วงวันนำส่งให้ครบทั้งวันเริ่มและวันสิ้นสุด'); return; }
    if (new Date(range.to).getTime() < new Date(range.from).getTime()) { setMessage('วันสิ้นสุดของช่วงนำส่งต้องไม่น้อยกว่าวันเริ่มต้น'); return; }
    setSchedulingRewardRequestId(requestId); setMessage(null);
    try {
      await logisticsApi.scheduleRewardDelivery(requestId, {
        delivery_window_start_at: dateOnlyToStartIso(range.from),
        delivery_window_end_at: dateOnlyToEndIso(range.to),
        notes: 'จัดรอบส่งโดยฝ่ายขนส่ง',
      });
      setMessage('จัดรอบส่งรางวัลสำเร็จแล้ว');
      setExpandedId(null);
      await loadAll(true);
    } catch (error) {
      setMessage(error instanceof ApiError ? `จัดรอบส่งรางวัลไม่สำเร็จ: ${error.message}` : 'จัดรอบส่งรางวัลไม่สำเร็จ');
    } finally { setSchedulingRewardRequestId(null); }
  };

  const handleMarkOutForDelivery = async (jobId: string) => {
    setUpdatingDeliveryJobId(jobId); setMessage(null);
    try { await logisticsApi.markRewardOutForDelivery(jobId); setMessage('อัปเดตสถานะรางวัลเป็นกำลังนำส่งแล้ว'); await loadAll(true); }
    catch (error) { setMessage(error instanceof ApiError ? `อัปเดตสถานะรางวัลไม่สำเร็จ: ${error.message}` : 'อัปเดตสถานะรางวัลไม่สำเร็จ'); }
    finally { setUpdatingDeliveryJobId(null); }
  };

  const handleMarkDelivered = async (jobId: string) => {
    setUpdatingDeliveryJobId(jobId); setMessage(null);
    try { await logisticsApi.markRewardDelivered(jobId); setMessage('ยืนยันส่งมอบรางวัลสำเร็จแล้ว'); await loadAll(true); }
    catch (error) { setMessage(error instanceof ApiError ? `ยืนยันส่งมอบรางวัลไม่สำเร็จ: ${error.message}` : 'ยืนยันส่งมอบรางวัลไม่สำเร็จ'); }
    finally { setUpdatingDeliveryJobId(null); }
  };

  const toggleExpand = (id: string) => setExpandedId((cur) => cur === id ? null : id);

  const tabs: { id: LogisticsTab; label: string; sublabel: string; count: number; tone: string }[] = [
    { id: 'pickupQueue', label: 'วัสดุรอจัดรอบ', sublabel: 'รอจัดรอบ', count: submittedQueue.length, tone: 'amber' },
    { id: 'pickupJobs', label: 'วัสดุกำลังขนส่ง', sublabel: 'กำลังขนส่ง', count: sortedPickupJobs.length, tone: 'sky' },
    { id: 'rewardQueue', label: 'รางวัลรอจัดรอบ', sublabel: 'รอจัดรอบ', count: approvedReadyToSchedule.length, tone: 'violet' },
    { id: 'deliveryJobs', label: 'รางวัลกำลังขนส่ง', sublabel: 'กำลังขนส่ง', count: activeRewardDeliveryJobs.length, tone: 'emerald' },
  ];


  const confirm = (message: string, onConfirm: () => void) => setConfirmPending({ message, onConfirm });

  return (
    <ErrorBoundary>
      <AnimatePresence>
        {confirmPending && (
          <ConfirmDialog
            message={confirmPending.message}
            onConfirm={() => { confirmPending.onConfirm(); setConfirmPending(null); }}
            onCancel={() => setConfirmPending(null)}
          />
        )}
      </AnimatePresence>
      <div className="space-y-6 pb-10">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">โลจิสติกส์</p>
            <h1 className="mt-0.5 text-3xl font-light tracking-tight text-on-surface sm:text-4xl">ศูนย์ปฏิบัติการขนส่ง</h1>
          </div>

          <motion.button
            type="button"
            onClick={() => void loadAll(true)}
            disabled={isLoading}
            aria-label="รีเฟรชข้อมูล"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant/20 bg-white text-on-surface-variant transition hover:bg-stone-50 disabled:opacity-50"
            whileTap={reduceMotion ? {} : { scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </motion.button>
        </div>

        {/* ── Alerts ── */}
        <AnimatePresence>
          {message && (
            <motion.div key="msg"
              initial={reduceMotion ? {} : { opacity: 0, y: -8 }}
              animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
              exit={reduceMotion ? {} : { opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              <AlertBanner message={message} tone={inferMessageTone(message)} />
            </motion.div>
          )}
        </AnimatePresence>
        {loadIssueMessages.length > 0 && (
          <AlertBanner message={loadIssueMessages.join(' ')} tone="info" title="บางส่วนของข้อมูลยังโหลดไม่ครบ" />
        )}

        {/* ── Tab bar ── */}
        <div className="flex rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
          {/* วัสดุ half */}
          <div className="flex flex-1 flex-col">
            <div className="flex items-center gap-1.5 border-b border-stone-100 px-4 pt-2.5 pb-2">
              <Truck className="h-3 w-3 text-amber-400 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500">วัสดุ</span>
            </div>
            <div className="flex flex-1">
              {tabs.slice(0, 2).map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => { setActiveTab(tab.id); setExpandedId(null); }}
                    className={`flex flex-1 items-center justify-center gap-2 px-3 py-3 text-sm font-semibold transition-colors ${
                      isActive ? 'text-amber-700 bg-amber-50/60' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <span>{tab.sublabel}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none ${
                      isActive ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-400'
                    }`}>{tab.count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Full-height rule */}
          <div className="w-px bg-stone-200 shrink-0" />

          {/* รางวัล half */}
          <div className="flex flex-1 flex-col">
            <div className="flex items-center gap-1.5 border-b border-stone-100 px-4 pt-2.5 pb-2">
              <PackageCheck className="h-3 w-3 text-violet-400 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-violet-500">รางวัล</span>
            </div>
            <div className="flex flex-1">
              {tabs.slice(2).map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => { setActiveTab(tab.id); setExpandedId(null); }}
                    className={`flex flex-1 items-center justify-center gap-2 px-3 py-3 text-sm font-semibold transition-colors ${
                      isActive ? 'text-violet-700 bg-violet-50/60' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <span>{tab.sublabel}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none ${
                      isActive ? 'bg-violet-100 text-violet-700' : 'bg-stone-100 text-stone-400'
                    }`}>{tab.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Tab content ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={reduceMotion ? {} : { opacity: 0, y: 8 }}
            animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
            exit={reduceMotion ? {} : { opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >

            {/* ── Pickup Queue ── */}
            {activeTab === 'pickupQueue' && (
              <div className="space-y-1.5">
                {loadIssues.pickupQueue && (
                  <AlertBanner message={loadIssues.pickupQueue} tone="info" title="บอร์ดคิวรับวัสดุยังไม่พร้อม" />
                )}
                {!isLoading && submittedQueue.length > 0 && (
                  <SortHeaderBar
                    cols={[
                      { key: 'created_at' as const, label: 'วันที่ส่ง', dirLabels: ['เก่าก่อน', 'ใหม่ก่อน'] },
                      { key: 'material' as const, label: 'วัสดุ', dirLabels: ['ก→ฮ', 'ฮ→ก'] },
                      { key: 'weight' as const, label: 'น้ำหนัก', dirLabels: ['น้อยก่อน', 'มากก่อน'] },
                      { key: 'distance' as const, label: 'ระยะทาง', dirLabels: ['ใกล้ก่อน', 'ไกลก่อน'],
                        activeExtra: <DistModeChips<'leg1'|'leg2'|'sum'> options={[{ value: 'leg1', label: 'ฉัน→เกษตรกร' }, { value: 'leg2', label: 'เกษตรกร→โรงงาน' }, { value: 'sum', label: 'รวมทั้งหมด' }]} value={pickupQueueDistMode} onChange={setPickupQueueDistMode} /> },
                    ]}
                    sort={pickupQueueSort}
                    onSort={(key) => toggleSort(pickupQueueSort, key, setPickupQueueSort)}
                  />
                )}
                {isLoading ? (
                  <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
                ) : submittedQueue.length === 0 ? (
                  <EmptyState
                    title={loadIssues.pickupQueue ? 'ยังแสดงคิวรับวัสดุใหม่ไม่ได้' : 'ไม่มีคิวใหม่ในตอนนี้'}
                    description={loadIssues.pickupQueue ? 'โปรดกดรีเฟรชอีกครั้ง' : 'เมื่อเกษตรกรส่งคำขอใหม่ รายการจะมาปรากฏในบอร์ดนี้ทันที'}
                    icon={Truck}
                  />
                ) : (
                  sortedPickupQueue.map((item) => {
                    const selFactoryId = destinationFactoryBySubmissionId[item.id] || '';
                    const selFactory = factoryOptions.find((f) => f.id === selFactoryId);
                    const canSchedule = pickupRangeBySubmissionId[item.id]?.from && pickupRangeBySubmissionId[item.id]?.to && selFactoryId;
                    const isExp = expandedId === item.id;
                    return (
                      <div key={item.id}>
                        <JobCard
                          isExpanded={isExp}
                          onToggle={() => toggleExpand(item.id)}
                          accent="amber"
                          expandedContent={
                            <div className="space-y-4">
                              {/* Factory selector */}
                              <div className="space-y-1.5">
                                <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">โรงงานปลายทาง</p>
                                <div className="flex flex-wrap items-center gap-2">
                                  <select
                                    value={selFactoryId}
                                    onChange={(e) => setDestinationFactoryBySubmissionId((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                    className="flex-1 rounded-xl border border-outline-variant/20 bg-stone-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 min-h-[44px]"
                                  >
                                    <option value="">เลือกโรงงาน</option>
                                    {factoryOptions.map((f) => (
                                      <option key={f.id} value={f.id}>{f.name_th}</option>
                                    ))}
                                  </select>
                                  {selFactory && hasValidCoordinates(selFactory.lat, selFactory.lng) && (
                                    <a href={buildGoogleMapsUrl(selFactory.lat as number, selFactory.lng as number)} target="_blank" rel="noopener noreferrer"
                                      className="flex items-center gap-1 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm font-medium text-primary transition hover:bg-primary/10"
                                    >
                                      <MapPin className="h-3.5 w-3.5" /> แผนที่โรงงาน
                                    </a>
                                  )}
                                </div>
                              </div>
                              {/* Date range */}
                              <div className="space-y-1.5">
                                <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">ช่วงวันนัดรับ</p>
                                <DateRangePicker
                                  value={pickupRangeBySubmissionId[item.id] || { from: null, to: null }}
                                  onChange={(v) => setPickupRangeBySubmissionId((prev) => ({ ...prev, [item.id]: v }))}
                                  minDate={new Date()}
                                  placeholder="เลือกช่วงวัน"
                                />
                              </div>
                              {/* Action */}
                              <motion.button
                                type="button"
                                onClick={() => confirm('ยืนยันจัดคิวรับวัสดุ?', () => void handleSchedulePickup(item.id))}
                                disabled={schedulingSubmissionId === item.id || !canSchedule}
                                className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-white shadow-sm shadow-primary/20 transition hover:opacity-90 disabled:opacity-40"
                                whileTap={reduceMotion ? {} : { scale: 0.97 }}
                              >
                                {schedulingSubmissionId === item.id ? 'กำลังจัดคิว...' : 'ยืนยันจัดคิวรับวัสดุ'}
                              </motion.button>
                            </div>
                          }
                        >
                          {/* Summary */}
                          <div className="space-y-1">
                            {/* Row 1: name + distance + qty */}
                            <div className="flex items-center gap-2 min-w-0">
                              <p className="text-sm font-semibold text-on-surface leading-tight truncate">
                                {item.material_name_th || formatMaterial(item.material_type)}
                              </p>
                              {item.distance_to_farmer_km != null && (() => {
                                const leg1Href = myInfo?.lat != null && myInfo?.lng != null && item.pickup_lat != null && item.pickup_lng != null
                                  ? buildGoogleMapsDirectionsUrl([{ lat: myInfo.lat, lng: myInfo.lng }, { lat: item.pickup_lat, lng: item.pickup_lng }]) : undefined;
                                const leg2Km = pickupQueueLeg2Km[item.id];
                                const leg2Href = leg2Km != null && item.pickup_lat != null && item.pickup_lng != null && selFactory?.lat != null && selFactory?.lng != null
                                  ? buildGoogleMapsDirectionsUrl([{ lat: item.pickup_lat, lng: item.pickup_lng }, { lat: selFactory.lat as number, lng: selFactory.lng as number }]) : undefined;
                                const farmerMapHref = hasValidCoordinates(item.pickup_lat, item.pickup_lng) ? buildGoogleMapsUrl(item.pickup_lat as number, item.pickup_lng as number) : undefined;
                                const factoryMapHref = selFactory?.lat != null && selFactory?.lng != null ? buildGoogleMapsUrl(selFactory.lat as number, selFactory.lng as number) : undefined;
                                const nodes: RouteNode[] = [
                                  { icon: <Navigation className="h-3 w-3" />, label: 'ฉัน' },
                                  { icon: <User className="h-3 w-3" />, label: 'เกษตรกร', mapHref: farmerMapHref },
                                  ...(leg2Km != null ? [{ icon: <Factory className="h-3 w-3" />, label: selFactory?.name_th ?? 'โรงงาน', mapHref: factoryMapHref }] : []),
                                ];
                                const legs: RouteLeg[] = [
                                  { km: item.distance_to_farmer_km!, href: leg1Href },
                                  ...(leg2Km != null ? [{ km: leg2Km, href: leg2Href }] : []),
                                ];
                                return <RouteStepper nodes={nodes} legs={legs} />;
                              })()}
                              <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                                {Number(item.quantity_value).toLocaleString('th-TH')} {fallbackThaiUnit(item.quantity_unit)}
                              </span>
                            </div>
                            {/* Row 2: date + location */}
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-400">
                              <span className="flex items-center gap-1"><CalendarRange className="h-3 w-3" />ส่งคำขอ {formatDateTime(item.created_at)}</span>
                              {item.pickup_location_text && (
                                <span className="flex items-center gap-1 min-w-0">
                                  <MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{item.pickup_location_text}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </JobCard>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── Pickup Jobs ── */}
            {activeTab === 'pickupJobs' && (
              <div className="space-y-1.5">
                {loadIssues.pickupJobs && (
                  <AlertBanner message={loadIssues.pickupJobs} tone="info" title="บอร์ดงานขนส่งวัสดุยังไม่พร้อม" />
                )}
                {!isLoading && pickupJobs.length > 0 && (
                  <SortHeaderBar
                    cols={[
                      { key: 'planned_pickup_at' as const, label: 'วันนัดรับ', dirLabels: ['เร็วก่อน', 'ช้าก่อน'] },
                      { key: 'material' as const, label: 'วัสดุ', dirLabels: ['ก→ฮ', 'ฮ→ก'] },
                      { key: 'weight' as const, label: 'น้ำหนัก', dirLabels: ['น้อยก่อน', 'มากก่อน'] },
                      { key: 'status' as const, label: 'สถานะ', dirLabels: ['ก→ฮ', 'ฮ→ก'] },
                      { key: 'distance' as const, label: 'ระยะทาง', dirLabels: ['ใกล้ก่อน', 'ไกลก่อน'],
                        activeExtra: <DistModeChips<'leg1'|'leg2'|'sum'> options={[{ value: 'leg1', label: 'ฉัน→เกษตรกร' }, { value: 'leg2', label: 'เกษตรกร→โรงงาน' }, { value: 'sum', label: 'รวมทั้งหมด' }]} value={pickupJobDistMode} onChange={setPickupJobDistMode} /> },
                    ]}
                    sort={pickupJobSort}
                    onSort={(key) => toggleSort(pickupJobSort, key, setPickupJobSort)}
                  />
                )}
                {isLoading ? (
                  <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
                ) : sortedPickupJobs.length === 0 ? (
                  <EmptyState
                    title={loadIssues.pickupJobs ? 'ยังแสดงงานขนส่งวัสดุไม่ได้' : 'ยังไม่มีงานขนส่งวัสดุ'}
                    description={loadIssues.pickupJobs ? 'โปรดกดรีเฟรชอีกครั้ง' : 'เมื่อมีการจัดคิวรับวัสดุ รายการจะเริ่มแสดงในบอร์ดนี้'}
                    icon={Truck}
                  />
                ) : (
                  sortedPickupJobs.map((item) => {
                    const isExp = expandedId === item.id;
                    const isBusy = updatingPickupJobId === item.id;
                    const isLive = item.status === 'picked_up';
                    const getPickupRouteSegments = () => {
                      const segments: Array<{ label: string; distanceKm: number | null }> = [];
                      if (item.distance_to_farmer_km != null) {
                        segments.push({ label: 'ฉัน → จุดรับวัสดุ (เกษตรกร)', distanceKm: item.distance_to_farmer_km });
                      }
                      if (item.distance_farmer_to_factory_km != null) {
                        segments.push({ label: `จุดรับวัสดุ → ${item.destination_factory_name_th ?? 'โรงงาน'}`, distanceKm: item.distance_farmer_to_factory_km });
                      }
                      return segments;
                    };
                    const handleCopy = async () => {
                      setCopyLoadingId(item.id);
                      const segments = getPickupRouteSegments();
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
                        `วันนัดรับ: ${formatDateRange(item.planned_pickup_at, item.pickup_window_end_at)}`,
                        item.destination_factory_name_th ? `` : null,
                        item.destination_factory_name_th ? `โรงงานปลายทาง: ${item.destination_factory_name_th}` : null,
                        item.destination_factory_location_text ? `ที่อยู่โรงงาน: ${item.destination_factory_location_text}` : null,
                        hasValidCoordinates(item.destination_factory_lat, item.destination_factory_lng) ? `แผนที่โรงงาน: ${buildGoogleMapsUrl(item.destination_factory_lat as number, item.destination_factory_lng as number)}` : null,
                        hasDistance ? `` : null,
                        hasDistance ? `--- ระยะทาง (ทางถนน) ---` : null,
                        ...segments.map(s => s.distanceKm !== null ? `${s.label}: ${s.distanceKm.toFixed(1)} กม.` : `${s.label}: ไม่สามารถคำนวณได้`),
                        hasDistance && segments.filter(s => s.distanceKm !== null).length > 1 ? `รวม: ${totalKm.toFixed(1)} กม.` : null,
                      ].filter((l) => l !== null).join('\n');
                      void copyToClipboard(lines).then(() => { setCopiedId(item.id); setTimeout(() => setCopiedId(null), 1500); });
                    };
                    return (
                      <div key={item.id}>
                        <JobCard
                          isExpanded={isExp}
                          onToggle={() => toggleExpand(item.id)}
                          accent={isLive ? 'sky' : item.status === 'delivered_to_factory' ? 'emerald' : 'sky'}
                          expandedContent={
                            <div className="space-y-3">
                              {/* ── Compact step track ── */}
                              {item.status !== 'delivered_to_factory' && (
                                <div className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2.5">
                                  {/* Step 1 */}
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${
                                      item.status === 'pickup_scheduled' ? 'bg-sky-500 text-white' : 'bg-emerald-500 text-white'
                                    }`}>
                                      {item.status === 'pickup_scheduled' ? '1' : <CheckCheck className="h-2.5 w-2.5" />}
                                    </span>
                                    <span className={`text-xs font-semibold ${item.status === 'pickup_scheduled' ? 'text-sky-700' : 'text-emerald-600'}`}>รับวัสดุ</span>
                                  </div>
                                  <span className="text-stone-300 text-xs shrink-0">──→</span>
                                  {/* Step 2 */}
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${
                                      item.status === 'picked_up' ? 'bg-emerald-500 text-white' : 'bg-stone-200 text-stone-400'
                                    }`}>2</span>
                                    <span className={`text-xs font-semibold ${item.status === 'picked_up' ? 'text-emerald-700' : 'text-stone-400'}`}>ส่งโรงงาน</span>
                                  </div>
                                  {/* Action button — pushes right */}
                                  <div className="ml-auto">
                                    {item.status === 'pickup_scheduled' && (
                                      <motion.button type="button"
                                        onClick={() => confirm('ยืนยันว่ารับวัสดุจากเกษตรกรแล้ว?', () => void handleMarkPickedUp(item.id))}
                                        disabled={isBusy}
                                        className="flex min-h-[36px] items-center gap-1.5 rounded-lg bg-sky-500 px-3 text-xs font-semibold text-white transition hover:bg-sky-600 disabled:opacity-40"
                                        whileTap={reduceMotion ? {} : { scale: 0.97 }}>
                                        <Truck className="h-3 w-3" />
                                        {isBusy ? 'กำลังอัปเดต...' : 'กดเมื่อรับวัสดุแล้ว'}
                                      </motion.button>
                                    )}
                                    {item.status === 'picked_up' && (
                                      <motion.button type="button"
                                        onClick={() => confirm('ยืนยันว่าส่งถึงโรงงานแล้ว?', () => void handleMarkDeliveredToFactory(item.id))}
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
                              {/* ── Edit schedule ── */}
                              {item.status === 'pickup_scheduled' && (
                                <div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (editingPickupJobId === item.id) { setEditingPickupJobId(null); return; }
                                      setEditingPickupJobId(item.id);
                                      setEditPickupRangeById((p) => ({ ...p, [item.id]: { from: isoToDateOnly(item.planned_pickup_at), to: isoToDateOnly(item.pickup_window_end_at) } }));
                                      setEditPickupFactoryById((p) => ({ ...p, [item.id]: item.destination_factory_id ?? '' }));
                                    }}
                                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
                                  >
                                    <Pencil className="h-3 w-3" />
                                    {editingPickupJobId === item.id ? 'ซ่อนฟอร์มแก้ไข' : 'แก้ไขวันนัดรับ / โรงงาน'}
                                  </button>
                                  <AnimatePresence initial={false}>
                                    {editingPickupJobId === item.id && (
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
                                              value={editPickupFactoryById[item.id] ?? ''}
                                              onChange={(e) => setEditPickupFactoryById((p) => ({ ...p, [item.id]: e.target.value }))}
                                              className="w-full rounded-xl border border-outline-variant/20 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 min-h-[44px]"
                                            >
                                              <option value="">เลือกโรงงาน</option>
                                              {factoryOptions.map((f) => (
                                                <option key={f.id} value={f.id}>{f.name_th}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div className="space-y-1.5">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">ช่วงวันนัดรับใหม่</p>
                                            <DateRangePicker
                                              value={editPickupRangeById[item.id] || { from: null, to: null }}
                                              onChange={(v) => setEditPickupRangeById((p) => ({ ...p, [item.id]: v }))}
                                              minDate={new Date()}
                                              placeholder="เลือกช่วงวัน"
                                            />
                                          </div>
                                          <motion.button
                                            type="button"
                                            onClick={() => confirm('ยืนยันแก้ไขตารางรับวัสดุ?', () => void handleReschedulePickup(item.id))}
                                            disabled={reschedulingPickupJobId === item.id || !editPickupRangeById[item.id]?.from || !editPickupRangeById[item.id]?.to || !editPickupFactoryById[item.id]}
                                            className="flex w-full min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-sky-500 text-xs font-semibold text-white transition hover:bg-sky-600 disabled:opacity-40"
                                            whileTap={reduceMotion ? {} : { scale: 0.97 }}
                                          >
                                            {reschedulingPickupJobId === item.id ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
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
                          {/* Summary */}
                          <div className="space-y-1">
                            {/* Row 1: live dot + name + route + status */}
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
                              {(item.distance_to_farmer_km != null || item.distance_farmer_to_factory_km != null) && (() => {
                                const nodes: RouteNode[] = [{ icon: <Navigation className="h-3 w-3" />, label: 'ฉัน' }];
                                const legs: RouteLeg[] = [];
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
                                return <RouteStepper nodes={nodes} legs={legs} />;
                              })()}
                              <span className="ml-auto shrink-0"><StatusBadge status={item.status} label={formatPickupJobStatus(item.status)} size="sm" /></span>
                            </div>
                            {/* Row 2: all meta + actions inline */}
                            <div className="flex items-center gap-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-400 min-w-0 flex-1">
                                <span className="font-bold text-sky-700">{Number(item.quantity_value).toLocaleString('th-TH')} {fallbackThaiUnit(item.quantity_unit)}</span>
                                <span className="flex items-center gap-0.5"><CalendarRange className="h-3 w-3" />นัดรับ {formatDateRange(item.planned_pickup_at, item.pickup_window_end_at)}</span>
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
                                  onKeyDown={(e) => e.key === 'Enter' && !copyLoadingId && !copiedId && handleCopy()}
                                  className={`flex h-7 w-7 items-center justify-center rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors cursor-pointer ${copyLoadingId === item.id || copiedId === item.id ? 'opacity-40' : ''}`}>
                                  {copyLoadingId === item.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : copiedId === item.id ? <CheckCheck className="h-3.5 w-3.5 text-emerald-500" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                                </div>
                                <div role="button" tabIndex={0}
                                  onClick={pdfLoadingId === item.id ? undefined : () => { generatePickupJobPdf(item, getPickupRouteSegments()); }}
                                  onKeyDown={(e) => e.key === 'Enter' && !pdfLoadingId && generatePickupJobPdf(item, getPickupRouteSegments())}
                                  className={`flex h-7 w-7 items-center justify-center rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors cursor-pointer ${pdfLoadingId === item.id ? 'opacity-40' : ''}`}>
                                  {pdfLoadingId === item.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                                </div>
                              </div>
                            </div>
                          </div>
                        </JobCard>
                      </div>
                    );
                  })
                )}

                {/* ── Delivered (completed) section ── */}
              </div>
            )}

            {/* ── Reward Queue ── */}
            {activeTab === 'rewardQueue' && (
              <div className="space-y-1.5">
                {loadIssues.rewardQueue && (
                  <AlertBanner message={loadIssues.rewardQueue} tone="info" title="บอร์ดคำขอรางวัลยังไม่พร้อม" />
                )}
                {!isLoading && approvedReadyToSchedule.length > 0 && (
                  <SortHeaderBar
                    cols={[
                      { key: 'requested_at' as const, label: 'วันที่ขอแลก', dirLabels: ['เก่าก่อน', 'ใหม่ก่อน'] },
                      { key: 'requested_points' as const, label: 'แต้ม', dirLabels: ['น้อยก่อน', 'มากก่อน'] },
                      { key: 'reward_name' as const, label: 'ชื่อรางวัล', dirLabels: ['ก→ฮ', 'ฮ→ก'] },
                      { key: 'distance' as const, label: 'ระยะทาง', dirLabels: ['ใกล้ก่อน', 'ไกลก่อน'] },
                    ]}
                    sort={rewardQueueSort}
                    onSort={(key) => toggleSort(rewardQueueSort, key, setRewardQueueSort)}
                  />
                )}
                {isLoading ? (
                  <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
                ) : approvedReadyToSchedule.length === 0 ? (
                  <EmptyState
                    title={loadIssues.rewardQueue ? 'ยังแสดงคำขอรางวัลที่รอจัดส่งไม่ได้' : 'ไม่มีคำขอที่ต้องจัดรอบส่งเพิ่ม'}
                    description={loadIssues.rewardQueue ? 'โปรดกดรีเฟรชอีกครั้ง' : 'เมื่อฝ่ายคลังอนุมัติคำขอใหม่ รายการจะปรากฏที่นี่'}
                    icon={PackageCheck}
                  />
                ) : (
                  sortedRewardQueue.map((item) => {
                    const isExp = expandedId === item.id;
                    const canSchedule = deliveryRangeByRequestId[item.id]?.from && deliveryRangeByRequestId[item.id]?.to;
                    return (
                      <div key={item.id}>
                        <JobCard
                          isExpanded={isExp}
                          onToggle={() => toggleExpand(item.id)}
                          accent="violet"
                          expandedContent={
                            <div className="space-y-4">
                              <div className="space-y-1.5">
                                <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">ช่วงวันนำส่ง</p>
                                <DateRangePicker
                                  value={deliveryRangeByRequestId[item.id] || { from: null, to: null }}
                                  onChange={(v) => setDeliveryRangeByRequestId((prev) => ({ ...prev, [item.id]: v }))}
                                  minDate={new Date()}
                                  placeholder="เลือกช่วงวัน"
                                />
                              </div>
                              <motion.button
                                type="button"
                                onClick={() => confirm('ยืนยันจัดรอบส่งรางวัล?', () => void handleScheduleRewardDelivery(item.id))}
                                disabled={schedulingRewardRequestId === item.id || !canSchedule}
                                className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-white shadow-sm shadow-primary/20 transition hover:opacity-90 disabled:opacity-40"
                                whileTap={reduceMotion ? {} : { scale: 0.97 }}
                              >
                                {schedulingRewardRequestId === item.id ? 'กำลังจัดส่ง...' : 'ยืนยันจัดรอบส่งรางวัล'}
                              </motion.button>
                            </div>
                          }
                        >
                          <div className="space-y-1">
                            {/* Row 1: name + distance + points badge */}
                            <div className="flex items-center gap-1.5 min-w-0">
                              <p className="text-sm font-semibold text-on-surface leading-tight truncate">
                                {item.reward_name_th ?? 'รางวัล'}
                              </p>
                              {item.distance_to_farmer_km != null && (() => {
                                const href = myInfo?.lat != null && myInfo?.lng != null && item.pickup_lat != null && item.pickup_lng != null
                                  ? buildGoogleMapsDirectionsUrl([{ lat: myInfo.lat, lng: myInfo.lng }, { lat: item.pickup_lat, lng: item.pickup_lng }]) : undefined;
                                const farmerMapHref = hasValidCoordinates(item.pickup_lat, item.pickup_lng) ? buildGoogleMapsUrl(item.pickup_lat as number, item.pickup_lng as number) : undefined;
                                return <RouteStepper
                                  nodes={[{ icon: <Navigation className="h-3 w-3" />, label: 'ฉัน' }, { icon: <User className="h-3 w-3" />, label: 'เกษตรกร', mapHref: farmerMapHref }]}
                                  legs={[{ km: item.distance_to_farmer_km!, href }]}
                                />;
                              })()}
                              <span className="ml-auto shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">
                                {Number(item.requested_points).toLocaleString('th-TH')} แต้ม
                              </span>
                            </div>
                            {/* Row 2: all meta inline */}
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
                        </JobCard>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── Delivery Jobs ── */}

            {activeTab === 'deliveryJobs' && (
              <div className="space-y-1.5">
                {loadIssues.deliveryJobs && (
                  <AlertBanner message={loadIssues.deliveryJobs} tone="info" title="บอร์ดงานส่งรางวัลยังไม่พร้อม" />
                )}
                {!isLoading && activeRewardDeliveryJobs.length > 0 && (
                  <SortHeaderBar
                    cols={[
                      { key: 'planned_delivery_at' as const, label: 'วันนัดส่ง', dirLabels: ['เร็วก่อน', 'ช้าก่อน'] },
                      { key: 'status' as const, label: 'สถานะ', dirLabels: ['ก→ฮ', 'ฮ→ก'] },
                    ]}
                    sort={deliveryJobSort}
                    onSort={(key) => toggleSort(deliveryJobSort, key, setDeliveryJobSort)}
                  />
                )}
                {isLoading ? (
                  <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
                ) : activeRewardDeliveryJobs.length === 0 ? (
                  <EmptyState
                    title={loadIssues.deliveryJobs ? 'ยังแสดงงานส่งรางวัลไม่ได้' : 'ยังไม่มีงานส่งรางวัลที่กำลังดำเนินการ'}
                    description={loadIssues.deliveryJobs ? 'โปรดกดรีเฟรชอีกครั้ง' : 'เมื่อจัดรอบส่งแล้ว งานจะย้ายเข้าบอร์ดนี้เพื่อติดตามจนส่งมอบสำเร็จ'}
                    icon={PackageCheck}
                  />
                ) : (
                  sortedDeliveryJobs.map((item) => {
                    const isExp = expandedId === item.id;
                    const isBusy = updatingDeliveryJobId === item.id;
                    const isOnRoute = item.status === 'out_for_delivery';
                    const getDeliveryRouteSegments = () => {
                      const segments: Array<{ label: string; distanceKm: number | null }> = [];
                      if (item.distance_to_farmer_km != null) {
                        segments.push({ label: 'ฉัน → จุดส่งมอบ (เกษตรกร)', distanceKm: item.distance_to_farmer_km });
                      }
                      return segments;
                    };
                    const handleCopy = async () => {
                      setCopyLoadingId(item.id);
                      const segments = getDeliveryRouteSegments();
                      setCopyLoadingId(null);
                      const hasDistance = segments.length > 0;
                      const lines = [
                        `[ใบส่งรางวัล AREX] เลขที่ ${item.id.slice(0, 8).toUpperCase()}`,
                        `สถานะ: ${formatDeliveryStatus(item.status)}`,
                        ``,
                        `รางวัล: ${item.reward_name_th || 'รางวัล'}`,
                        `จำนวน: ${Number(item.quantity).toLocaleString('th-TH')} ชิ้น`,
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
                      void copyToClipboard(lines).then(() => { setCopiedId(item.id); setTimeout(() => setCopiedId(null), 1500); });
                    };
                    return (
                      <div key={item.id}>
                        <JobCard
                          isExpanded={isExp}
                          onToggle={() => toggleExpand(item.id)}
                          accent={isOnRoute ? 'emerald' : 'violet'}
                          expandedContent={
                            <div className="space-y-3">
                              {/* ── Compact step track ── */}
                              <div className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2.5">
                                {/* Step 1 */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${
                                    item.status === 'reward_delivery_scheduled' ? 'bg-violet-500 text-white' : 'bg-emerald-500 text-white'
                                  }`}>
                                    {item.status === 'reward_delivery_scheduled' ? '1' : <CheckCheck className="h-2.5 w-2.5" />}
                                  </span>
                                  <span className={`text-xs font-semibold ${item.status === 'reward_delivery_scheduled' ? 'text-violet-700' : 'text-emerald-600'}`}>ออกนำส่ง</span>
                                </div>
                                <span className="text-stone-300 text-xs shrink-0">──→</span>
                                {/* Step 2 */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${
                                    item.status === 'out_for_delivery' ? 'bg-emerald-500 text-white' : 'bg-stone-200 text-stone-400'
                                  }`}>2</span>
                                  <span className={`text-xs font-semibold ${item.status === 'out_for_delivery' ? 'text-emerald-700' : 'text-stone-400'}`}>ส่งมอบ</span>
                                </div>
                                {/* Action button — pushes right */}
                                <div className="ml-auto">
                                  {item.status === 'reward_delivery_scheduled' && (
                                    <motion.button type="button"
                                      onClick={() => confirm('ยืนยันออกนำส่งแล้ว?', () => void handleMarkOutForDelivery(item.id))}
                                      disabled={isBusy}
                                      className="flex min-h-[36px] items-center gap-1.5 rounded-lg bg-violet-500 px-3 text-xs font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
                                      whileTap={reduceMotion ? {} : { scale: 0.97 }}>
                                      <Truck className="h-3 w-3" />
                                      {isBusy ? 'กำลังอัปเดต...' : 'กดเมื่อออกนำส่งแล้ว'}
                                    </motion.button>
                                  )}
                                  {item.status === 'out_for_delivery' && (
                                    <motion.button type="button"
                                      onClick={() => confirm('ยืนยันส่งมอบสำเร็จ?', () => void handleMarkDelivered(item.id))}
                                      disabled={isBusy}
                                      className="flex min-h-[36px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40"
                                      whileTap={reduceMotion ? {} : { scale: 0.97 }}>
                                      <CheckCheck className="h-3 w-3" />
                                      {isBusy ? 'กำลังอัปเดต...' : 'กดเมื่อส่งมอบสำเร็จ'}
                                    </motion.button>
                                  )}
                                </div>
                              </div>
                              {/* ── Edit delivery schedule ── */}
                              {item.status === 'reward_delivery_scheduled' && (
                                <div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (editingDeliveryJobId === item.id) { setEditingDeliveryJobId(null); return; }
                                      setEditingDeliveryJobId(item.id);
                                      setEditDeliveryRangeById((p) => ({ ...p, [item.id]: { from: isoToDateOnly(item.planned_delivery_at), to: isoToDateOnly(item.delivery_window_end_at) } }));
                                    }}
                                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
                                  >
                                    <Pencil className="h-3 w-3" />
                                    {editingDeliveryJobId === item.id ? 'ซ่อนฟอร์มแก้ไข' : 'แก้ไขวันนำส่ง'}
                                  </button>
                                  <AnimatePresence initial={false}>
                                    {editingDeliveryJobId === item.id && (
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
                                              value={editDeliveryRangeById[item.id] || { from: null, to: null }}
                                              onChange={(v) => setEditDeliveryRangeById((p) => ({ ...p, [item.id]: v }))}
                                              minDate={new Date()}
                                              placeholder="เลือกช่วงวัน"
                                            />
                                          </div>
                                          <motion.button
                                            type="button"
                                            onClick={() => confirm('ยืนยันแก้ไขตารางส่งรางวัล?', () => void handleRescheduleDelivery(item.id))}
                                            disabled={reschedulingDeliveryJobId === item.id || !editDeliveryRangeById[item.id]?.from || !editDeliveryRangeById[item.id]?.to}
                                            className="flex w-full min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-violet-500 text-xs font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
                                            whileTap={reduceMotion ? {} : { scale: 0.97 }}
                                          >
                                            {reschedulingDeliveryJobId === item.id ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
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
                            {/* Row 1: live dot + name + route + status */}
                            <div className="flex items-center gap-1.5 min-w-0">
                              {isOnRoute && (
                                <span className="relative flex h-2 w-2 shrink-0">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                                </span>
                              )}
                              <p className="text-sm font-semibold text-on-surface leading-tight truncate">
                                {item.reward_name_th ?? 'รางวัล'}
                              </p>
                              {item.distance_to_farmer_km != null && (() => {
                                const href = myInfo?.lat != null && myInfo?.lng != null && item.pickup_lat != null && item.pickup_lng != null
                                  ? buildGoogleMapsDirectionsUrl([{ lat: myInfo.lat, lng: myInfo.lng }, { lat: item.pickup_lat, lng: item.pickup_lng }]) : undefined;
                                const farmerMapHref = hasValidCoordinates(item.pickup_lat, item.pickup_lng) ? buildGoogleMapsUrl(item.pickup_lat as number, item.pickup_lng as number) : undefined;
                                return <RouteStepper
                                  nodes={[{ icon: <Navigation className="h-3 w-3" />, label: 'ฉัน' }, { icon: <User className="h-3 w-3" />, label: 'เกษตรกร', mapHref: farmerMapHref }]}
                                  legs={[{ km: item.distance_to_farmer_km, href }]}
                                />;
                              })()}
                              <span className="ml-auto shrink-0"><StatusBadge status={item.status} label={formatDeliveryStatus(item.status)} size="sm" /></span>
                            </div>
                            {/* Row 2: all meta + actions inline */}
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
                                  onKeyDown={(e) => e.key === 'Enter' && !copyLoadingId && !copiedId && handleCopy()}
                                  className={`flex h-7 w-7 items-center justify-center rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors cursor-pointer ${copyLoadingId === item.id || copiedId === item.id ? 'opacity-40' : ''}`}>
                                  {copyLoadingId === item.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : copiedId === item.id ? <CheckCheck className="h-3.5 w-3.5 text-emerald-500" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                                </div>
                                <div role="button" tabIndex={0}
                                  onClick={pdfLoadingId === item.id ? undefined : () => { generateDeliveryJobPdf(item, getDeliveryRouteSegments()); }}
                                  onKeyDown={(e) => e.key === 'Enter' && !pdfLoadingId && generateDeliveryJobPdf(item, getDeliveryRouteSegments())}
                                  className={`flex h-7 w-7 items-center justify-center rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors cursor-pointer ${pdfLoadingId === item.id ? 'opacity-40' : ''}`}>
                                  {pdfLoadingId === item.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                                </div>
                              </div>
                            </div>
                          </div>
                        </JobCard>
                      </div>
                    );
                  })
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}
