'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { PackageCheck, RefreshCw, Truck } from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import ErrorBoundary from '@/app/_components/ErrorBoundary';
import {
  ApiError,
  hasAccessToken,
  logisticsApi,
  type LogisticsApprovedRewardRequestItem,
  type LogisticsFactoryOptionItem,
  type LogisticsInfoItem,
  type LogisticsPickupJobItem,
  type LogisticsPickupQueueItem,
  type LogisticsRewardDeliveryJobItem,
} from '@/app/_lib/api';
import { type DateRangeValue } from '@/app/_components/DateRangePicker';
import PickupQueueTab from './_components/PickupQueueTab';
import PickupJobsTab from './_components/PickupJobsTab';
import RewardQueueTab from './_components/RewardQueueTab';
import DeliveryJobsTab from './_components/DeliveryJobsTab';

type LogisticsTab = 'pickupQueue' | 'pickupJobs' | 'rewardQueue' | 'deliveryJobs';
type LogisticsLoadIssueKey = 'pickupQueue' | 'pickupJobs' | 'rewardQueue' | 'deliveryJobs' | 'factories';

function inferMessageTone(message: string | null): 'info' | 'success' | 'error' {
  if (!message) return 'info';
  if (message.includes('ไม่สำเร็จ') || message.includes('กรุณา') || message.includes('ยังไม่')) return 'error';
  if (message.includes('สำเร็จ')) return 'success';
  return 'info';
}

function isConnectivityError(message: string): boolean {
  return message.includes('เชื่อมต่อข้อมูลไม่สำเร็จ') || message.includes('กรุณาลองใหม่อีกครั้ง');
}

function extractWorkflowMessage(raw: string): string {
  try {
    const match = raw.match(/'message':\s*'([^']+)'/);
    if (match) return match[1];
  } catch { /* ignore */ }
  return raw;
}

function formatLoadIssue(label: string, error: unknown): string {
  if (error instanceof ApiError) {
    if (isConnectivityError(error.message)) return `ยังโหลด${label}ไม่สำเร็จในขณะนี้ โปรดกดรีเฟรชอีกครั้ง`;
    return `ยังโหลด${label}ไม่สำเร็จ: ${error.message}`;
  }
  return `ยังโหลด${label}ไม่สำเร็จในขณะนี้ โปรดกดรีเฟรชอีกครั้ง`;
}

function dateOnlyToStartIso(d: string): string { return new Date(`${d}T00:00:00`).toISOString(); }
function dateOnlyToEndIso(d: string): string { return new Date(`${d}T23:59:59`).toISOString(); }

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
  const [activeTab, setActiveTab] = useState<LogisticsTab>('pickupQueue');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmPending, setConfirmPending] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const [schedulingSubmissionId, setSchedulingSubmissionId] = useState<string | null>(null);
  const [updatingPickupJobId, setUpdatingPickupJobId] = useState<string | null>(null);
  const [reschedulingPickupJobId, setReschedulingPickupJobId] = useState<string | null>(null);
  const [schedulingRewardRequestId, setSchedulingRewardRequestId] = useState<string | null>(null);
  const [updatingDeliveryJobId, setUpdatingDeliveryJobId] = useState<string | null>(null);
  const [reschedulingDeliveryJobId, setReschedulingDeliveryJobId] = useState<string | null>(null);

  const submittedQueue = useMemo(() => pickupQueue.filter((i) => i.status === 'submitted'), [pickupQueue]);
  const activePickupJobs = useMemo(() => pickupJobs.filter((i) => i.status !== 'delivered_to_factory'), [pickupJobs]);
  const activeDeliveryJobs = useMemo(
    () => rewardDeliveryJobs.filter((i) => i.status === 'reward_delivery_scheduled' || i.status === 'out_for_delivery'),
    [rewardDeliveryJobs],
  );
  const rewardRequestIdsInDelivery = useMemo(() => new Set(activeDeliveryJobs.map((i) => i.reward_request_id)), [activeDeliveryJobs]);
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

      if (factoriesRes.status === 'fulfilled') { setFactoryOptions(factoriesRes.value.factories); ok++; }
      else nextIssues.factories = formatLoadIssue('รายชื่อโรงงานปลายทาง', factoriesRes.reason);

      if (myInfoRes.status === 'fulfilled') setMyInfo(myInfoRes.value);

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

  const handleSchedulePickup = async (submissionId: string, range: DateRangeValue, factoryId: string) => {
    if (!range.from || !range.to) { setMessage('กรุณาระบุช่วงวันนัดรับให้ครบทั้งวันเริ่มและวันสิ้นสุด'); return; }
    if (new Date(range.to).getTime() < new Date(range.from).getTime()) { setMessage('วันสิ้นสุดของช่วงนัดรับต้องไม่น้อยกว่าวันเริ่มต้น'); return; }
    if (!factoryId) { setMessage('กรุณาเลือกโรงงานปลายทางก่อนจัดคิวรับวัสดุ'); return; }
    setSchedulingSubmissionId(submissionId); setMessage(null);
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
    catch (error) {
      await loadAll(true);
      setMessage(error instanceof ApiError ? `อัปเดตสถานะไม่สำเร็จ: ${extractWorkflowMessage(error.message)}` : 'อัปเดตสถานะไม่สำเร็จ');
    }
    finally { setUpdatingPickupJobId(null); }
  };

  const handleMarkDeliveredToFactory = async (jobId: string) => {
    setUpdatingPickupJobId(jobId); setMessage(null);
    try { await logisticsApi.markDeliveredToFactory(jobId); setMessage('อัปเดตสถานะเป็นส่งถึงโรงงานแล้ว'); await loadAll(true); }
    catch (error) {
      await loadAll(true);
      setMessage(error instanceof ApiError ? `อัปเดตสถานะไม่สำเร็จ: ${extractWorkflowMessage(error.message)}` : 'อัปเดตสถานะไม่สำเร็จ');
    }
    finally { setUpdatingPickupJobId(null); }
  };

  const handleReschedulePickup = async (jobId: string, range: DateRangeValue, factoryId: string) => {
    if (!range.from || !range.to) { setMessage('กรุณาระบุช่วงวันนัดรับให้ครบ'); return; }
    if (!factoryId) { setMessage('กรุณาเลือกโรงงานปลายทาง'); return; }
    setReschedulingPickupJobId(jobId); setMessage(null);
    try {
      await logisticsApi.reschedulePickup(jobId, {
        pickup_window_start_at: dateOnlyToStartIso(range.from),
        pickup_window_end_at: dateOnlyToEndIso(range.to),
        destination_factory_id: factoryId,
      });
      setMessage('แก้ไขตารางรับวัสดุสำเร็จแล้ว');
      await loadAll(true);
    } catch (error) {
      await loadAll(true);
      setMessage(error instanceof ApiError ? `แก้ไขไม่สำเร็จ: ${extractWorkflowMessage(error.message)}` : 'แก้ไขไม่สำเร็จ');
    } finally { setReschedulingPickupJobId(null); }
  };

  const handleScheduleRewardDelivery = async (requestId: string, range: DateRangeValue) => {
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
    catch (error) {
      await loadAll(true);
      setMessage(error instanceof ApiError ? `อัปเดตสถานะรางวัลไม่สำเร็จ: ${extractWorkflowMessage(error.message)}` : 'อัปเดตสถานะรางวัลไม่สำเร็จ');
    }
    finally { setUpdatingDeliveryJobId(null); }
  };

  const handleMarkDelivered = async (jobId: string) => {
    setUpdatingDeliveryJobId(jobId); setMessage(null);
    try { await logisticsApi.markRewardDelivered(jobId); setMessage('ยืนยันส่งมอบรางวัลสำเร็จแล้ว'); await loadAll(true); }
    catch (error) {
      await loadAll(true);
      setMessage(error instanceof ApiError ? `ยืนยันส่งมอบรางวัลไม่สำเร็จ: ${extractWorkflowMessage(error.message)}` : 'ยืนยันส่งมอบรางวัลไม่สำเร็จ');
    }
    finally { setUpdatingDeliveryJobId(null); }
  };

  const handleRescheduleDelivery = async (jobId: string, range: DateRangeValue) => {
    if (!range.from || !range.to) { setMessage('กรุณาระบุช่วงวันนำส่งให้ครบ'); return; }
    setReschedulingDeliveryJobId(jobId); setMessage(null);
    try {
      await logisticsApi.rescheduleDeliveryJob(jobId, {
        delivery_window_start_at: dateOnlyToStartIso(range.from),
        delivery_window_end_at: dateOnlyToEndIso(range.to),
      });
      setMessage('แก้ไขตารางส่งรางวัลสำเร็จแล้ว');
      await loadAll(true);
    } catch (error) {
      setMessage(error instanceof ApiError ? `แก้ไขไม่สำเร็จ: ${error.message}` : 'แก้ไขไม่สำเร็จ');
    } finally { setReschedulingDeliveryJobId(null); }
  };

  const toggleExpand = (id: string) => setExpandedId((cur) => cur === id ? null : id);
  const confirm = (message: string, onConfirm: () => void) => setConfirmPending({ message, onConfirm });

  const tabs = [
    { id: 'pickupQueue' as const, label: 'วัสดุรอจัดรอบ', sublabel: 'รอจัดรอบ', count: submittedQueue.length },
    { id: 'pickupJobs' as const, label: 'วัสดุกำลังขนส่ง', sublabel: 'กำลังขนส่ง', count: activePickupJobs.length },
    { id: 'rewardQueue' as const, label: 'รางวัลรอจัดรอบ', sublabel: 'รอจัดรอบ', count: approvedReadyToSchedule.length },
    { id: 'deliveryJobs' as const, label: 'รางวัลกำลังขนส่ง', sublabel: 'กำลังขนส่ง', count: activeDeliveryJobs.length },
  ];

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

        <div className="flex rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-1 flex-col">
            <div className="flex items-center gap-1.5 border-b border-stone-100 px-4 pt-2.5 pb-2">
              <Truck className="h-3 w-3 text-amber-400 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500">วัสดุ</span>
            </div>
            <div className="flex flex-1">
              {tabs.slice(0, 2).map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button key={tab.id} type="button"
                    onClick={() => { setActiveTab(tab.id); setExpandedId(null); }}
                    className={`flex flex-1 items-center justify-center gap-2 px-3 py-3 text-sm font-semibold transition-colors ${isActive ? 'text-amber-700 bg-amber-50/60' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50'}`}
                  >
                    <span>{tab.sublabel}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none ${isActive ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-400'}`}>{tab.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="w-px bg-stone-200 shrink-0" />
          <div className="flex flex-1 flex-col">
            <div className="flex items-center gap-1.5 border-b border-stone-100 px-4 pt-2.5 pb-2">
              <PackageCheck className="h-3 w-3 text-violet-400 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-violet-500">รางวัล</span>
            </div>
            <div className="flex flex-1">
              {tabs.slice(2).map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button key={tab.id} type="button"
                    onClick={() => { setActiveTab(tab.id); setExpandedId(null); }}
                    className={`flex flex-1 items-center justify-center gap-2 px-3 py-3 text-sm font-semibold transition-colors ${isActive ? 'text-violet-700 bg-violet-50/60' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50'}`}
                  >
                    <span>{tab.sublabel}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none ${isActive ? 'bg-violet-100 text-violet-700' : 'bg-stone-100 text-stone-400'}`}>{tab.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={reduceMotion ? {} : { opacity: 0, y: 8 }}
            animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
            exit={reduceMotion ? {} : { opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'pickupQueue' && (
              <PickupQueueTab
                items={submittedQueue}
                factoryOptions={factoryOptions}
                myInfo={myInfo}
                isLoading={isLoading}
                loadIssue={loadIssues.pickupQueue}
                expandedId={expandedId}
                onToggle={toggleExpand}
                schedulingId={schedulingSubmissionId}
                onSchedule={handleSchedulePickup}
                confirm={confirm}
              />
            )}
            {activeTab === 'pickupJobs' && (
              <PickupJobsTab
                items={pickupJobs}
                factoryOptions={factoryOptions}
                myInfo={myInfo}
                isLoading={isLoading}
                loadIssue={loadIssues.pickupJobs}
                expandedId={expandedId}
                onToggle={toggleExpand}
                updatingId={updatingPickupJobId}
                reschedulingId={reschedulingPickupJobId}
                onMarkPickedUp={(id) => void handleMarkPickedUp(id)}
                onMarkDeliveredToFactory={(id) => void handleMarkDeliveredToFactory(id)}
                onReschedule={(id, range, factoryId) => void handleReschedulePickup(id, range, factoryId)}
                confirm={confirm}
              />
            )}
            {activeTab === 'rewardQueue' && (
              <RewardQueueTab
                items={approvedReadyToSchedule}
                myInfo={myInfo}
                isLoading={isLoading}
                loadIssue={loadIssues.rewardQueue}
                expandedId={expandedId}
                onToggle={toggleExpand}
                schedulingId={schedulingRewardRequestId}
                onSchedule={(id, range) => void handleScheduleRewardDelivery(id, range)}
                confirm={confirm}
              />
            )}
            {activeTab === 'deliveryJobs' && (
              <DeliveryJobsTab
                items={activeDeliveryJobs}
                myInfo={myInfo}
                isLoading={isLoading}
                loadIssue={loadIssues.deliveryJobs}
                expandedId={expandedId}
                onToggle={toggleExpand}
                updatingId={updatingDeliveryJobId}
                reschedulingId={reschedulingDeliveryJobId}
                onMarkOutForDelivery={(id) => void handleMarkOutForDelivery(id)}
                onMarkDelivered={(id) => void handleMarkDelivered(id)}
                onReschedule={(id, range) => void handleRescheduleDelivery(id, range)}
                confirm={confirm}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}
