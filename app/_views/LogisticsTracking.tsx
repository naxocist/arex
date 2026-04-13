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
  PackageCheck,
  Phone,
  RefreshCw,
  Route,
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
  type LogisticsPickupJobItem,
  type LogisticsPickupQueueItem,
  type LogisticsRewardDeliveryJobItem,
} from '@/app/_lib/apiClient';

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
  return s === e ? s : `${s} – ${e}`;
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
        className="flex w-full items-start gap-3 px-5 py-4 text-left"
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
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-primary/10 text-primary' : 'bg-stone-100 text-stone-400'}`}>
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

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loadIssues, setLoadIssues] = useState<Partial<Record<LogisticsLoadIssueKey, string>>>({});

  const [schedulingSubmissionId, setSchedulingSubmissionId] = useState<string | null>(null);
  const [updatingPickupJobId, setUpdatingPickupJobId] = useState<string | null>(null);
  const [schedulingRewardRequestId, setSchedulingRewardRequestId] = useState<string | null>(null);
  const [updatingDeliveryJobId, setUpdatingDeliveryJobId] = useState<string | null>(null);
  const [pickupRangeBySubmissionId, setPickupRangeBySubmissionId] = useState<Record<string, DateRangeValue>>({});
  const [destinationFactoryBySubmissionId, setDestinationFactoryBySubmissionId] = useState<Record<string, string>>({});
  const [deliveryRangeByRequestId, setDeliveryRangeByRequestId] = useState<Record<string, DateRangeValue>>({});
  const [activeTab, setActiveTab] = useState<LogisticsTab>('pickupQueue');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmPending, setConfirmPending] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [pickupQueueSort, setPickupQueueSort] = useState<{ key: 'created_at' | 'material'; dir: SortDir }>({ key: 'created_at', dir: 'desc' });
  const [pickupJobSort, setPickupJobSort] = useState<{ key: 'planned_pickup_at' | 'material' | 'status'; dir: SortDir }>({ key: 'planned_pickup_at', dir: 'asc' });
  const [rewardQueueSort, setRewardQueueSort] = useState<{ key: 'requested_points' | 'reward_name' | 'requested_at'; dir: SortDir }>({ key: 'requested_at', dir: 'asc' });
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
    return mul * (new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
  }), [submittedQueue, pickupQueueSort]);

  const sortedPickupJobs = useMemo(() => [...pickupJobs].filter((i) => i.status !== 'delivered_to_factory').sort((a, b) => {
    const mul = pickupJobSort.dir === 'asc' ? 1 : -1;
    if (pickupJobSort.key === 'material') return mul * (a.material_type ?? '').localeCompare(b.material_type ?? '');
    if (pickupJobSort.key === 'status') return mul * (a.status ?? '').localeCompare(b.status ?? '');
    return mul * (new Date(a.planned_pickup_at ?? 0).getTime() - new Date(b.planned_pickup_at ?? 0).getTime());
  }), [pickupJobs, pickupJobSort]);

  const sortedRewardQueue = useMemo(() => [...approvedReadyToSchedule].sort((a, b) => {
    const mul = rewardQueueSort.dir === 'asc' ? 1 : -1;
    if (rewardQueueSort.key === 'reward_name') return mul * (a.reward_name_th ?? '').localeCompare(b.reward_name_th ?? '');
    if (rewardQueueSort.key === 'requested_at') return mul * (a.requested_at < b.requested_at ? -1 : a.requested_at > b.requested_at ? 1 : 0);
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
      const [queueRes, jobsRes, approvedRes, deliveryRes, factoriesRes] = await Promise.allSettled([
        logisticsApi.getPickupQueue({ forceRefresh }),
        logisticsApi.getPickupJobs({ forceRefresh }),
        logisticsApi.getApprovedRewardRequests({ forceRefresh }),
        logisticsApi.getRewardDeliveryJobs({ forceRefresh }),
        logisticsApi.listFactories({ forceRefresh }),
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
    { id: 'pickupJobs', label: 'วัสดุกำลังขนส่ง', sublabel: 'กำลังขนส่ง', count: pickupJobs.length, tone: 'sky' },
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
              <div className="space-y-3">
                {loadIssues.pickupQueue && (
                  <AlertBanner message={loadIssues.pickupQueue} tone="info" title="บอร์ดคิวรับวัสดุยังไม่พร้อม" />
                )}
                {!isLoading && submittedQueue.length > 0 && (
                  <SortHeaderBar
                    cols={[
                      { key: 'created_at' as const, label: 'วันที่ส่ง', dirLabels: ['เก่าก่อน', 'ใหม่ก่อน'] },
                      { key: 'material' as const, label: 'วัสดุ', dirLabels: ['ก→ฮ', 'ฮ→ก'] },
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
                          <div className="space-y-2">
                            {/* Row 1: name + qty */}
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[15px] font-bold text-on-surface leading-tight">
                                {item.material_name_th || formatMaterial(item.material_type)}
                              </p>
                              <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                                {Number(item.quantity_value).toLocaleString('th-TH')} {fallbackThaiUnit(item.quantity_unit)}
                              </span>
                            </div>
                            {/* Row 2: date chip */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                                <CalendarRange className="h-3 w-3 text-stone-400" />
                                ส่งคำขอ {formatDateTime(item.created_at)}
                              </span>
                              {item.pickup_location_text && (
                                <span className="flex items-center gap-1 text-xs text-stone-400 min-w-0">
                                  <MapPin className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{item.pickup_location_text}</span>
                                  {hasValidCoordinates(item.pickup_lat, item.pickup_lng) && (
                                    <a href={buildGoogleMapsUrl(item.pickup_lat as number, item.pickup_lng as number)} target="_blank" rel="noopener noreferrer"
                                      className="shrink-0 text-primary hover:underline" onClick={(e) => e.stopPropagation()}>แผนที่</a>
                                  )}
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
              <div className="space-y-3">
                {loadIssues.pickupJobs && (
                  <AlertBanner message={loadIssues.pickupJobs} tone="info" title="บอร์ดงานขนส่งวัสดุยังไม่พร้อม" />
                )}
                {!isLoading && pickupJobs.length > 0 && (
                  <SortHeaderBar
                    cols={[
                      { key: 'planned_pickup_at' as const, label: 'วันนัดรับ', dirLabels: ['เร็วก่อน', 'ช้าก่อน'] },
                      { key: 'material' as const, label: 'วัสดุ', dirLabels: ['ก→ฮ', 'ฮ→ก'] },
                      { key: 'status' as const, label: 'สถานะ', dirLabels: ['ก→ฮ', 'ฮ→ก'] },
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
                    icon={Route}
                  />
                ) : (
                  sortedPickupJobs.map((item) => {
                    const isExp = expandedId === item.id;
                    const isBusy = updatingPickupJobId === item.id;
                    const isLive = item.status === 'picked_up';
                    const handleCopy = () => {
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
                            </div>
                          }
                        >
                          {/* Summary */}
                          <div className="space-y-2">
                            {/* Row 1: name + status */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                {isLive && (
                                  <span className="relative flex h-2 w-2 shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
                                  </span>
                                )}
                                <p className="text-[15px] font-bold text-on-surface leading-tight truncate">
                                  {item.material_name_th || formatMaterial(item.material_type)}
                                </p>
                              </div>
                              <StatusBadge status={item.status} label={formatPickupJobStatus(item.status)} size="sm" />
                            </div>
                            {/* Row 2: qty + date + factory chips */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded-md bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-700">
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
                                  {hasValidCoordinates(item.destination_factory_lat, item.destination_factory_lng) && (
                                    <a href={buildGoogleMapsUrl(item.destination_factory_lat as number, item.destination_factory_lng as number)} target="_blank" rel="noopener noreferrer"
                                      className="text-primary hover:underline ml-0.5" onClick={(e) => e.stopPropagation()}>แผนที่</a>
                                  )}
                                </span>
                              )}
                            </div>
                            {/* Row 3: farmer + location + actions */}
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
                                        className="shrink-0 text-primary hover:underline" onClick={(e) => e.stopPropagation()}>แผนที่</a>
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
              <div className="space-y-3">
                {loadIssues.rewardQueue && (
                  <AlertBanner message={loadIssues.rewardQueue} tone="info" title="บอร์ดคำขอรางวัลยังไม่พร้อม" />
                )}
                {!isLoading && approvedReadyToSchedule.length > 0 && (
                  <SortHeaderBar
                    cols={[
                      { key: 'requested_at' as const, label: 'วันที่ขอแลก', dirLabels: ['เก่าก่อน', 'ใหม่ก่อน'] },
                      { key: 'requested_points' as const, label: 'แต้ม', dirLabels: ['น้อยก่อน', 'มากก่อน'] },
                      { key: 'reward_name' as const, label: 'ชื่อรางวัล', dirLabels: ['ก→ฮ', 'ฮ→ก'] },
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
                          <div className="space-y-2">
                            {/* Row 1: name + points badge */}
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[15px] font-bold text-on-surface leading-tight truncate">
                                {item.reward_name_th ?? 'รางวัล'}
                              </p>
                              <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-700">
                                {Number(item.requested_points).toLocaleString('th-TH')} แต้ม
                              </span>
                            </div>
                            {/* Row 2: qty + date chips */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                                {Number(item.quantity).toLocaleString('th-TH')} ชิ้น
                              </span>
                              <span className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                                <CalendarRange className="h-3 w-3 text-stone-400" />
                                วันส่งคำขอแลก {formatDateTime(item.requested_at)}
                              </span>
                            </div>
                            {/* Row 3: farmer + location (dimmed) */}
                            {(item.farmer_display_name || item.pickup_location_text) && (
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-stone-400">
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
                                        className="shrink-0 text-primary hover:underline" onClick={(e) => e.stopPropagation()}>แผนที่</a>
                                    )}
                                  </span>
                                )}
                              </div>
                            )}
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
              <div className="space-y-3">
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
                    const handleCopy = () => {
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
                            </div>
                          }
                        >
                          <div className="space-y-2">
                            {/* Row 1: name + status */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                {isOnRoute && (
                                  <span className="relative flex h-2 w-2 shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                                  </span>
                                )}
                                <p className="text-[15px] font-bold text-on-surface leading-tight truncate">
                                  {item.reward_name_th ?? 'รางวัล'}
                                </p>
                              </div>
                              <StatusBadge status={item.status} label={formatDeliveryStatus(item.status)} size="sm" />
                            </div>
                            {/* Row 2: qty + date chips */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
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
                                        className="shrink-0 text-primary hover:underline" onClick={(e) => e.stopPropagation()}>แผนที่</a>
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
