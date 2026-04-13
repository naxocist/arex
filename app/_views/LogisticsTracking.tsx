'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  CalendarRange,
  CheckCheck,
  ChevronDown,
  ClipboardCopy,
  Download,
  Factory,
  MapPin,
  PackageCheck,
  RefreshCw,
  Route,
  Truck,
} from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import DateRangePicker, { type DateRangeValue } from '@/app/_components/DateRangePicker';
import { generatePickupJobPdf, generateDeliveryJobPdf } from '@/app/_lib/pdfGenerator';
import EmptyState from '@/app/_components/EmptyState';
import ErrorBoundary from '@/app/_components/ErrorBoundary';
import { SkeletonCard } from '@/app/_components/Skeleton';
import StatCard from '@/app/_components/StatCard';
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
    pickup_scheduled: 'จัดคิวรับแล้ว',
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
  const accentBar: Record<string, string> = {
    amber: 'bg-amber-400',
    sky: 'bg-sky-400',
    violet: 'bg-violet-400',
    emerald: 'bg-emerald-400',
  };

  return (
    <motion.div
      layout
      className="overflow-hidden rounded-xl border border-outline-variant/10 bg-white shadow-sm"
    >
      {/* Accent bar */}
      {accent && <div className={`h-0.5 w-full ${accentBar[accent]}`} />}

      {/* Summary row — tap to expand */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-4 text-left"
      >
        <div className="min-w-0 flex-1">{children}</div>
        <motion.span
          animate={reduceMotion ? {} : { rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.22 }}
          style={{ display: 'inline-flex' }}
          className="shrink-0 text-stone-400"
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
            <div className="border-t border-outline-variant/10 px-4 pb-4 pt-3">
              {expandedContent}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
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

  const tabs: { id: LogisticsTab; label: string; count: number; tone: string }[] = [
    { id: 'pickupQueue', label: 'คิวรับวัสดุ', count: submittedQueue.length, tone: 'amber' },
    { id: 'pickupJobs', label: 'งานขนส่ง', count: pickupJobs.length, tone: 'sky' },
    { id: 'rewardQueue', label: 'รางวัลรอส่ง', count: approvedReadyToSchedule.length, tone: 'violet' },
    { id: 'deliveryJobs', label: 'งานส่งรางวัล', count: activeRewardDeliveryJobs.length, tone: 'emerald' },
  ];

  const fadeUp = reduceMotion ? {} : { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };
  const listItem = reduceMotion ? {} : {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.25, 0, 0, 1] as [number, number, number, number] } },
  };

  return (
    <ErrorBoundary>
      <motion.div
        className="space-y-6 pb-10"
        initial="hidden"
        animate="show"
        variants={reduceMotion ? {} : { hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
      >
        {/* ── Header ── */}
        <motion.div
          variants={fadeUp}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="flex items-start justify-between gap-4"
        >
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
        </motion.div>

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

        {/* ── Stats ── */}
        <motion.div
          variants={fadeUp}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="grid grid-cols-2 gap-4 sm:grid-cols-4"
        >
          <StatCard label="คิวรับวัสดุใหม่" value={submittedQueue.length.toLocaleString('th-TH')} detail="รอจัดคิว" icon={CalendarRange} tone="amber" />
          <StatCard label="งานขนส่งวัสดุ" value={pickupJobs.length.toLocaleString('th-TH')} detail="ทุกสถานะ" icon={Truck} tone="sky" />
          <StatCard label="รางวัลรอจัดส่ง" value={approvedReadyToSchedule.length.toLocaleString('th-TH')} detail="คำขอ" icon={PackageCheck} tone="teal" />
          <StatCard label="กำลังส่งรางวัล" value={activeRewardDeliveryJobs.length.toLocaleString('th-TH')} detail="งาน" icon={Route} tone="violet" />
        </motion.div>

        {/* ── Tab bar ── */}
        <motion.div
          variants={fadeUp}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="rounded-2xl border border-outline-variant/10 bg-white shadow-sm"
        >
          <div className="flex overflow-x-auto no-scrollbar">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => { setActiveTab(tab.id); setExpandedId(null); }}
                  className={`relative flex flex-1 shrink-0 items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold transition-colors ${
                    isActive ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {tab.label}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    isActive ? 'bg-primary/10 text-primary' : 'bg-stone-100 text-stone-500'
                  }`}>
                    {tab.count}
                  </span>
                  {isActive && (
                    <motion.span
                      layoutId="tab-indicator"
                      className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>

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
                {isLoading ? (
                  <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
                ) : submittedQueue.length === 0 ? (
                  <EmptyState
                    title={loadIssues.pickupQueue ? 'ยังแสดงคิวรับวัสดุใหม่ไม่ได้' : 'ไม่มีคิวใหม่ในตอนนี้'}
                    description={loadIssues.pickupQueue ? 'โปรดกดรีเฟรชอีกครั้ง' : 'เมื่อเกษตรกรส่งคำขอใหม่ รายการจะมาปรากฏในบอร์ดนี้ทันที'}
                    icon={Truck}
                  />
                ) : (
                  submittedQueue.map((item) => {
                    const selFactoryId = destinationFactoryBySubmissionId[item.id] || '';
                    const selFactory = factoryOptions.find((f) => f.id === selFactoryId);
                    const canSchedule = pickupRangeBySubmissionId[item.id]?.from && pickupRangeBySubmissionId[item.id]?.to && selFactoryId;
                    const isExp = expandedId === item.id;
                    return (
                      <motion.div key={item.id} variants={listItem} initial="hidden" animate="show">
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
                                onClick={() => void handleSchedulePickup(item.id)}
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
                            <p className="text-base font-semibold text-on-surface">
                              {item.material_name_th || formatMaterial(item.material_type)}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-on-surface-variant">
                              <span className="font-medium text-amber-600">
                                {Number(item.quantity_value).toLocaleString('th-TH')} {fallbackThaiUnit(item.quantity_unit)}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate max-w-[12rem]">{item.pickup_location_text}</span>
                                {hasValidCoordinates(item.pickup_lat, item.pickup_lng) && (
                                  <a href={buildGoogleMapsUrl(item.pickup_lat as number, item.pickup_lng as number)} target="_blank" rel="noopener noreferrer"
                                    className="ml-1 text-primary hover:underline" onClick={(e) => e.stopPropagation()}>แผนที่</a>
                                )}
                              </span>
                              <span className="text-xs text-stone-400">{formatDateTime(item.created_at)}</span>
                            </div>
                          </div>
                        </JobCard>
                      </motion.div>
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
                {isLoading ? (
                  <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
                ) : pickupJobs.length === 0 ? (
                  <EmptyState
                    title={loadIssues.pickupJobs ? 'ยังแสดงงานขนส่งวัสดุไม่ได้' : 'ยังไม่มีงานขนส่งวัสดุ'}
                    description={loadIssues.pickupJobs ? 'โปรดกดรีเฟรชอีกครั้ง' : 'เมื่อมีการจัดคิวรับวัสดุ รายการจะเริ่มแสดงในบอร์ดนี้'}
                    icon={Route}
                  />
                ) : (
                  pickupJobs.map((item) => {
                    const isExp = expandedId === item.id;
                    const isBusy = updatingPickupJobId === item.id;
                    const isLive = item.status === 'picked_up';
                    const handleCopy = () => {
                      const lines = [
                        `วัสดุ: ${item.material_name_th || formatMaterial(item.material_type)} ${Number(item.quantity_value).toLocaleString('th-TH')} ${fallbackThaiUnit(item.quantity_unit)}`,
                        `จุดรับ: ${item.pickup_location_text}`,
                        hasValidCoordinates(item.pickup_lat, item.pickup_lng) ? `แผนที่จุดรับ: ${buildGoogleMapsUrl(item.pickup_lat as number, item.pickup_lng as number)}` : null,
                        `นัดรับ: ${formatDateRange(item.planned_pickup_at, item.pickup_window_end_at)}`,
                        item.destination_factory_name_th ? `โรงงาน: ${item.destination_factory_name_th}` : null,
                        hasValidCoordinates(item.destination_factory_lat, item.destination_factory_lng) ? `แผนที่โรงงาน: ${buildGoogleMapsUrl(item.destination_factory_lat as number, item.destination_factory_lng as number)}` : null,
                      ].filter(Boolean).join('\n');
                      void copyToClipboard(lines).then(() => { setCopiedId(item.id); setTimeout(() => setCopiedId(null), 1500); });
                    };
                    return (
                      <motion.div key={item.id} variants={listItem} initial="hidden" animate="show">
                        <JobCard
                          isExpanded={isExp}
                          onToggle={() => toggleExpand(item.id)}
                          accent={isLive ? 'sky' : item.status === 'delivered_to_factory' ? 'emerald' : 'sky'}
                          expandedContent={
                            <div className="space-y-3">
                              {/* Factory row */}
                              {item.destination_factory_name_th && (
                                <div className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2.5">
                                  <Factory className="h-4 w-4 shrink-0 text-stone-400" />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-on-surface">{item.destination_factory_name_th}</p>
                                    {item.destination_factory_location_text && (
                                      <p className="truncate text-xs text-on-surface-variant">{item.destination_factory_location_text}</p>
                                    )}
                                  </div>
                                  {item.destination_factory_is_focal_point && (
                                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Focal Point</span>
                                  )}
                                  {hasValidCoordinates(item.destination_factory_lat, item.destination_factory_lng) && (
                                    <a href={buildGoogleMapsUrl(item.destination_factory_lat as number, item.destination_factory_lng as number)} target="_blank" rel="noopener noreferrer"
                                      className="shrink-0 text-sm text-primary hover:underline">แผนที่</a>
                                  )}
                                </div>
                              )}
                              {/* Actions */}
                              <div className="flex flex-wrap gap-2">
                                {item.status === 'pickup_scheduled' && (
                                  <motion.button type="button" onClick={() => void handleMarkPickedUp(item.id)} disabled={isBusy}
                                    className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-40"
                                    whileTap={reduceMotion ? {} : { scale: 0.97 }}>
                                    <Truck className="h-4 w-4" />
                                    {isBusy ? 'กำลังอัปเดต...' : 'ยืนยันรับวัสดุแล้ว'}
                                  </motion.button>
                                )}
                                {(item.status === 'pickup_scheduled' || item.status === 'picked_up') && (
                                  <motion.button type="button" onClick={() => void handleMarkDeliveredToFactory(item.id)} disabled={isBusy}
                                    className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-outline-variant/20 bg-white px-4 text-sm font-semibold text-on-surface disabled:opacity-40"
                                    whileTap={reduceMotion ? {} : { scale: 0.97 }}>
                                    <Factory className="h-4 w-4" />
                                    {isBusy ? 'กำลังอัปเดต...' : 'ส่งถึงโรงงานแล้ว'}
                                  </motion.button>
                                )}
                                <button type="button" onClick={handleCopy} disabled={copiedId === item.id}
                                  className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-outline-variant/20 bg-white px-3 text-sm text-on-surface-variant hover:bg-stone-50 disabled:opacity-40">
                                  {copiedId === item.id ? <CheckCheck className="h-4 w-4 text-emerald-500" /> : <ClipboardCopy className="h-4 w-4" />}
                                  {copiedId === item.id ? 'คัดลอกแล้ว' : 'คัดลอก'}
                                </button>
                                <button type="button" onClick={() => generatePickupJobPdf(item)}
                                  className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-outline-variant/20 bg-white px-3 text-sm text-on-surface-variant hover:bg-stone-50">
                                  <Download className="h-4 w-4" /> PDF
                                </button>
                              </div>
                            </div>
                          }
                        >
                          {/* Summary */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {isLive && (
                                <span className="relative flex h-2.5 w-2.5 shrink-0">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-500" />
                                </span>
                              )}
                              <p className="text-base font-semibold text-on-surface">
                                {item.material_name_th || formatMaterial(item.material_type)}
                              </p>
                              <StatusBadge status={item.status} label={formatPickupJobStatus(item.status)} size="sm" />
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-on-surface-variant">
                              <span className="font-medium text-amber-600">
                                {Number(item.quantity_value).toLocaleString('th-TH')} {fallbackThaiUnit(item.quantity_unit)}
                              </span>
                              <span className="flex items-center gap-1">
                                <CalendarRange className="h-3 w-3" />
                                {formatDateRange(item.planned_pickup_at, item.pickup_window_end_at)}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate max-w-[10rem]">{item.pickup_location_text}</span>
                                {hasValidCoordinates(item.pickup_lat, item.pickup_lng) && (
                                  <a href={buildGoogleMapsUrl(item.pickup_lat as number, item.pickup_lng as number)} target="_blank" rel="noopener noreferrer"
                                    className="ml-1 text-primary hover:underline" onClick={(e) => e.stopPropagation()}>แผนที่</a>
                                )}
                              </span>
                            </div>
                          </div>
                        </JobCard>
                      </motion.div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── Reward Queue ── */}
            {activeTab === 'rewardQueue' && (
              <div className="space-y-3">
                {loadIssues.rewardQueue && (
                  <AlertBanner message={loadIssues.rewardQueue} tone="info" title="บอร์ดคำขอรางวัลยังไม่พร้อม" />
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
                  approvedReadyToSchedule.map((item) => {
                    const isExp = expandedId === item.id;
                    const canSchedule = deliveryRangeByRequestId[item.id]?.from && deliveryRangeByRequestId[item.id]?.to;
                    return (
                      <motion.div key={item.id} variants={listItem} initial="hidden" animate="show">
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
                                onClick={() => void handleScheduleRewardDelivery(item.id)}
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
                            <p className="text-base font-semibold text-on-surface">{item.reward_name_th ?? 'รางวัล'}</p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-on-surface-variant">
                              <span className="font-medium text-violet-600">{Number(item.requested_points).toLocaleString('th-TH')} แต้ม</span>
                              <span className="text-stone-500">{Number(item.quantity).toLocaleString('th-TH')} ชิ้น</span>
                              {item.pickup_location_text && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  <span className="truncate max-w-[10rem]">{item.pickup_location_text}</span>
                                  {hasValidCoordinates(item.pickup_lat, item.pickup_lng) && (
                                    <a href={buildGoogleMapsUrl(item.pickup_lat as number, item.pickup_lng as number)} target="_blank" rel="noopener noreferrer"
                                      className="ml-1 text-primary hover:underline" onClick={(e) => e.stopPropagation()}>แผนที่</a>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </JobCard>
                      </motion.div>
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
                {isLoading ? (
                  <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
                ) : activeRewardDeliveryJobs.length === 0 ? (
                  <EmptyState
                    title={loadIssues.deliveryJobs ? 'ยังแสดงงานส่งรางวัลไม่ได้' : 'ยังไม่มีงานส่งรางวัลที่กำลังดำเนินการ'}
                    description={loadIssues.deliveryJobs ? 'โปรดกดรีเฟรชอีกครั้ง' : 'เมื่อจัดรอบส่งแล้ว งานจะย้ายเข้าบอร์ดนี้เพื่อติดตามจนส่งมอบสำเร็จ'}
                    icon={PackageCheck}
                  />
                ) : (
                  activeRewardDeliveryJobs.map((item) => {
                    const isExp = expandedId === item.id;
                    const isBusy = updatingDeliveryJobId === item.id;
                    const isOnRoute = item.status === 'out_for_delivery';
                    const handleCopy = () => {
                      const lines = [
                        `รางวัล: ${item.reward_name_th ?? 'รางวัล'}`,
                        `จำนวน: ${Number(item.quantity).toLocaleString('th-TH')} ชิ้น`,
                        `จุดส่ง: ${item.pickup_location_text || '-'}`,
                        hasValidCoordinates(item.pickup_lat, item.pickup_lng) ? `แผนที่: ${buildGoogleMapsUrl(item.pickup_lat as number, item.pickup_lng as number)}` : null,
                        `นัดส่ง: ${formatDateRange(item.planned_delivery_at, item.delivery_window_end_at)}`,
                      ].filter(Boolean).join('\n');
                      void copyToClipboard(lines).then(() => { setCopiedId(item.id); setTimeout(() => setCopiedId(null), 1500); });
                    };
                    return (
                      <motion.div key={item.id} variants={listItem} initial="hidden" animate="show">
                        <JobCard
                          isExpanded={isExp}
                          onToggle={() => toggleExpand(item.id)}
                          accent={isOnRoute ? 'emerald' : 'violet'}
                          expandedContent={
                            <div className="space-y-3">
                              <div className="flex flex-wrap gap-2">
                                {item.status === 'reward_delivery_scheduled' && (
                                  <motion.button type="button" onClick={() => void handleMarkOutForDelivery(item.id)} disabled={isBusy}
                                    className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-40"
                                    whileTap={reduceMotion ? {} : { scale: 0.97 }}>
                                    <Truck className="h-4 w-4" />
                                    {isBusy ? 'กำลังอัปเดต...' : 'ยืนยันออกนำส่งแล้ว'}
                                  </motion.button>
                                )}
                                {item.status === 'out_for_delivery' && (
                                  <motion.button type="button" onClick={() => void handleMarkDelivered(item.id)} disabled={isBusy}
                                    className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-40"
                                    whileTap={reduceMotion ? {} : { scale: 0.97 }}>
                                    <CheckCheck className="h-4 w-4" />
                                    {isBusy ? 'กำลังอัปเดต...' : 'ยืนยันส่งมอบสำเร็จ'}
                                  </motion.button>
                                )}
                                <button type="button" onClick={handleCopy} disabled={copiedId === item.id}
                                  className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-outline-variant/20 bg-white px-3 text-sm text-on-surface-variant hover:bg-stone-50 disabled:opacity-40">
                                  {copiedId === item.id ? <CheckCheck className="h-4 w-4 text-emerald-500" /> : <ClipboardCopy className="h-4 w-4" />}
                                  {copiedId === item.id ? 'คัดลอกแล้ว' : 'คัดลอก'}
                                </button>
                                <button type="button" onClick={() => generateDeliveryJobPdf(item)}
                                  className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-outline-variant/20 bg-white px-3 text-sm text-on-surface-variant hover:bg-stone-50">
                                  <Download className="h-4 w-4" /> PDF
                                </button>
                              </div>
                            </div>
                          }
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {isOnRoute && (
                                <span className="relative flex h-2.5 w-2.5 shrink-0">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                </span>
                              )}
                              <p className="text-base font-semibold text-on-surface">{item.reward_name_th ?? 'รางวัล'}</p>
                              <StatusBadge status={item.status} label={formatDeliveryStatus(item.status)} size="sm" />
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-on-surface-variant">
                              <span className="text-stone-500">{Number(item.quantity).toLocaleString('th-TH')} ชิ้น</span>
                              <span className="flex items-center gap-1">
                                <CalendarRange className="h-3 w-3" />
                                {formatDateRange(item.planned_delivery_at, item.delivery_window_end_at)}
                              </span>
                              {item.pickup_location_text && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  <span className="truncate max-w-[10rem]">{item.pickup_location_text}</span>
                                  {hasValidCoordinates(item.pickup_lat, item.pickup_lng) && (
                                    <a href={buildGoogleMapsUrl(item.pickup_lat as number, item.pickup_lng as number)} target="_blank" rel="noopener noreferrer"
                                      className="ml-1 text-primary hover:underline" onClick={(e) => e.stopPropagation()}>แผนที่</a>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </JobCard>
                      </motion.div>
                    );
                  })
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </motion.div>
    </ErrorBoundary>
  );
}
