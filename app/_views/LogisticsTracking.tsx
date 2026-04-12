'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarRange,
  Factory,
  MapPin,
  PackageCheck,
  RefreshCw,
  Route,
  Truck,
} from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import DateRangePicker, { type DateRangeValue } from '@/app/_components/DateRangePicker';
import EmptyState from '@/app/_components/EmptyState';
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

function hasAccessToken(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return Boolean(localStorage.getItem('AREX_ACCESS_TOKEN'));
}

function formatMaterial(materialType: string): string {
  const map: Record<string, string> = {
    rice_straw: 'ฟางข้าว',
    cassava_root: 'เหง้ามันสำปะหลัง',
    sugarcane_bagasse: 'ชานอ้อย',
    corn_stover: 'ตอซังข้าวโพด',
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
  if (!dateTime) {
    return '-';
  }
  return new Date(dateTime).toLocaleString('th-TH', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function dateOnlyToStartIso(dateValue: string): string {
  return new Date(`${dateValue}T00:00:00`).toISOString();
}

function dateOnlyToEndIso(dateValue: string): string {
  return new Date(`${dateValue}T23:59:59`).toISOString();
}

function fallbackThaiUnit(unitCode: string): string {
  const map: Record<string, string> = {
    kg: 'กิโลกรัม',
    ton: 'ตัน',
    m3: 'ลูกบาศก์เมตร',
  };
  return map[unitCode] ?? unitCode;
}

function hasValidCoordinates(lat: number | null | undefined, lng: number | null | undefined): boolean {
  return typeof lat === 'number' && Number.isFinite(lat) && typeof lng === 'number' && Number.isFinite(lng);
}

function buildGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function inferMessageTone(message: string | null): 'info' | 'success' | 'error' {
  if (!message) {
    return 'info';
  }
  if (message.includes('ไม่สำเร็จ') || message.includes('กรุณา') || message.includes('ยังไม่')) {
    return 'error';
  }
  if (message.includes('สำเร็จ')) {
    return 'success';
  }
  return 'info';
}

type LogisticsTab = 'pickupQueue' | 'pickupJobs' | 'rewardQueue' | 'deliveryJobs';
type LogisticsLoadIssueKey = 'pickupQueue' | 'pickupJobs' | 'rewardQueue' | 'deliveryJobs' | 'factories';

function isConnectivityErrorMessage(message: string): boolean {
  return (
    message.includes('เชื่อมต่อข้อมูลไม่สำเร็จ') ||
    message.includes('กรุณาลองใหม่อีกครั้ง')
  );
}

function formatLoadIssue(label: string, error: unknown): string {
  if (error instanceof ApiError) {
    if (isConnectivityErrorMessage(error.message)) {
      return `ยังโหลด${label}ไม่สำเร็จในขณะนี้ โปรดกดรีเฟรชอีกครั้ง`;
    }
    return `ยังโหลด${label}ไม่สำเร็จ: ${error.message}`;
  }
  return `ยังโหลด${label}ไม่สำเร็จในขณะนี้ โปรดกดรีเฟรชอีกครั้ง`;
}

export default function LogisticsTracking() {
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

  const submittedQueue = useMemo(
    () => pickupQueue.filter((item) => item.status === 'submitted'),
    [pickupQueue],
  );

  const activeRewardDeliveryJobs = useMemo(
    () =>
      rewardDeliveryJobs.filter(
        (item) => item.status === 'reward_delivery_scheduled' || item.status === 'out_for_delivery',
      ),
    [rewardDeliveryJobs],
  );

  const rewardRequestIdsInDelivery = useMemo(
    () => new Set(activeRewardDeliveryJobs.map((item) => item.reward_request_id)),
    [activeRewardDeliveryJobs],
  );

  const approvedReadyToSchedule = useMemo(
    () => approvedRewardRequests.filter((item) => !rewardRequestIdsInDelivery.has(item.id)),
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
      const [queueResponse, pickupJobsResponse, approvedResponse, deliveryJobsResponse, factoriesResponse] = await Promise.allSettled([
        logisticsApi.getPickupQueue({ forceRefresh }),
        logisticsApi.getPickupJobs({ forceRefresh }),
        logisticsApi.getApprovedRewardRequests({ forceRefresh }),
        logisticsApi.getRewardDeliveryJobs({ forceRefresh }),
        logisticsApi.listFactories({ forceRefresh }),
      ]);

      const nextLoadIssues: Partial<Record<LogisticsLoadIssueKey, string>> = {};
      let succeededCount = 0;

      if (queueResponse.status === 'fulfilled') {
        setPickupQueue(queueResponse.value.queue);
        succeededCount += 1;
      } else {
        nextLoadIssues.pickupQueue = formatLoadIssue('คิวรับวัสดุใหม่', queueResponse.reason);
      }

      if (pickupJobsResponse.status === 'fulfilled') {
        setPickupJobs(pickupJobsResponse.value.jobs);
        succeededCount += 1;
      } else {
        nextLoadIssues.pickupJobs = formatLoadIssue('งานขนส่งวัสดุ', pickupJobsResponse.reason);
      }

      if (approvedResponse.status === 'fulfilled') {
        setApprovedRewardRequests(approvedResponse.value.queue);
        succeededCount += 1;
      } else {
        nextLoadIssues.rewardQueue = formatLoadIssue('คำขอรางวัลที่รอจัดส่ง', approvedResponse.reason);
      }

      if (deliveryJobsResponse.status === 'fulfilled') {
        setRewardDeliveryJobs(deliveryJobsResponse.value.jobs);
        succeededCount += 1;
      } else {
        nextLoadIssues.deliveryJobs = formatLoadIssue('งานส่งรางวัล', deliveryJobsResponse.reason);
      }

      if (factoriesResponse.status === 'fulfilled') {
        setFactoryOptions(factoriesResponse.value.factories);
        succeededCount += 1;
      } else {
        nextLoadIssues.factories = formatLoadIssue('รายชื่อโรงงานปลายทาง', factoriesResponse.reason);
      }

      if (queueResponse.status === 'fulfilled' && factoriesResponse.status === 'fulfilled') {
        setDestinationFactoryBySubmissionId((prev) => {
          const next = { ...prev };
          const defaultFactoryId = factoriesResponse.value.factories[0]?.id;
          for (const item of queueResponse.value.queue) {
            if (item.status !== 'submitted') {
              continue;
            }
            const selectedFactoryId = next[item.id];
            const stillExists = selectedFactoryId
              ? factoriesResponse.value.factories.some((factory) => factory.id === selectedFactoryId)
              : false;
            if (!stillExists && defaultFactoryId) {
              next[item.id] = defaultFactoryId;
            }
          }
          return next;
        });
      }

      setLoadIssues(nextLoadIssues);

      if (succeededCount === 0) {
        setMessage('ยังโหลดข้อมูลศูนย์ปฏิบัติการขนส่งไม่สำเร็จ โปรดลองรีเฟรชอีกครั้ง');
      } else {
        setMessage((current) =>
          current === 'ยังโหลดข้อมูลศูนย์ปฏิบัติการขนส่งไม่สำเร็จ โปรดลองรีเฟรชอีกครั้ง'
            ? null
            : current,
        );
      }
    } catch (error) {
      setLoadIssues({});
      if (error instanceof ApiError) {
        setMessage(`โหลดข้อมูลไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('โหลดข้อมูลไม่สำเร็จ');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const handleSchedulePickup = async (submissionId: string) => {
    const dateRange = pickupRangeBySubmissionId[submissionId] || { from: null, to: null };
    const startDate = dateRange.from || '';
    const endDate = dateRange.to || '';

    if (!startDate || !endDate) {
      setMessage('กรุณาระบุช่วงวันนัดรับให้ครบทั้งวันเริ่มและวันสิ้นสุด');
      return;
    }

    if (new Date(endDate).getTime() < new Date(startDate).getTime()) {
      setMessage('วันสิ้นสุดของช่วงนัดรับต้องไม่น้อยกว่าวันเริ่มต้น');
      return;
    }

    const destinationFactoryId = destinationFactoryBySubmissionId[submissionId];
    if (!destinationFactoryId) {
      setMessage('กรุณาเลือกโรงงานปลายทางก่อนจัดคิวรับวัสดุ');
      return;
    }

    setSchedulingSubmissionId(submissionId);
    setMessage(null);
    try {
      await logisticsApi.schedulePickup(submissionId, {
        pickup_window_start_at: dateOnlyToStartIso(startDate),
        pickup_window_end_at: dateOnlyToEndIso(endDate),
        destination_factory_id: destinationFactoryId,
        notes: 'จัดคิวโดยฝ่ายขนส่ง',
      });
      setMessage('จัดคิวรับวัสดุสำเร็จแล้ว');
      await loadAll(true);
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(`จัดคิวรับวัสดุไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('จัดคิวรับวัสดุไม่สำเร็จ');
      }
    } finally {
      setSchedulingSubmissionId(null);
    }
  };

  const handleMarkPickedUp = async (pickupJobId: string) => {
    setUpdatingPickupJobId(pickupJobId);
    setMessage(null);
    try {
      await logisticsApi.markPickedUp(pickupJobId);
      setMessage('อัปเดตสถานะเป็นรับวัสดุแล้ว');
      await loadAll(true);
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(`อัปเดตสถานะไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('อัปเดตสถานะไม่สำเร็จ');
      }
    } finally {
      setUpdatingPickupJobId(null);
    }
  };

  const handleMarkDeliveredToFactory = async (pickupJobId: string) => {
    setUpdatingPickupJobId(pickupJobId);
    setMessage(null);
    try {
      await logisticsApi.markDeliveredToFactory(pickupJobId);
      setMessage('อัปเดตสถานะเป็นส่งถึงโรงงานแล้ว');
      await loadAll(true);
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(`อัปเดตสถานะไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('อัปเดตสถานะไม่สำเร็จ');
      }
    } finally {
      setUpdatingPickupJobId(null);
    }
  };

  const handleScheduleRewardDelivery = async (requestId: string) => {
    const dateRange = deliveryRangeByRequestId[requestId] || { from: null, to: null };
    const startAt = dateRange.from || '';
    const endAt = dateRange.to || '';

    if (!startAt || !endAt) {
      setMessage('กรุณาระบุช่วงวันนำส่งให้ครบทั้งวันเริ่มและวันสิ้นสุด');
      return;
    }

    if (new Date(endAt).getTime() < new Date(startAt).getTime()) {
      setMessage('วันสิ้นสุดของช่วงนำส่งต้องไม่น้อยกว่าวันเริ่มต้น');
      return;
    }

    setSchedulingRewardRequestId(requestId);
    setMessage(null);
    try {
      await logisticsApi.scheduleRewardDelivery(requestId, {
        delivery_window_start_at: dateOnlyToStartIso(startAt),
        delivery_window_end_at: dateOnlyToEndIso(endAt),
        notes: 'จัดรอบส่งโดยฝ่ายขนส่ง',
      });
      setMessage('จัดรอบส่งรางวัลสำเร็จแล้ว');
      await loadAll(true);
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(`จัดรอบส่งรางวัลไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('จัดรอบส่งรางวัลไม่สำเร็จ');
      }
    } finally {
      setSchedulingRewardRequestId(null);
    }
  };

  const handleMarkOutForDelivery = async (deliveryJobId: string) => {
    setUpdatingDeliveryJobId(deliveryJobId);
    setMessage(null);
    try {
      await logisticsApi.markRewardOutForDelivery(deliveryJobId);
      setMessage('อัปเดตสถานะรางวัลเป็นกำลังนำส่งแล้ว');
      await loadAll(true);
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(`อัปเดตสถานะรางวัลไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('อัปเดตสถานะรางวัลไม่สำเร็จ');
      }
    } finally {
      setUpdatingDeliveryJobId(null);
    }
  };

  const handleMarkDelivered = async (deliveryJobId: string) => {
    setUpdatingDeliveryJobId(deliveryJobId);
    setMessage(null);
    try {
      await logisticsApi.markRewardDelivered(deliveryJobId);
      setMessage('ยืนยันส่งมอบรางวัลสำเร็จแล้ว');
      await loadAll(true);
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(`ยืนยันส่งมอบรางวัลไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('ยืนยันส่งมอบรางวัลไม่สำเร็จ');
      }
    } finally {
      setUpdatingDeliveryJobId(null);
    }
  };

  const tabs: { id: LogisticsTab; label: string; count: number }[] = [
    { id: 'pickupQueue', label: 'คิวรับวัสดุใหม่', count: submittedQueue.length },
    { id: 'pickupJobs', label: 'งานขนส่งวัสดุ', count: pickupJobs.length },
    { id: 'rewardQueue', label: 'ของรางวัลรอจัดส่ง', count: approvedReadyToSchedule.length },
    { id: 'deliveryJobs', label: 'งานส่งรางวัล', count: activeRewardDeliveryJobs.length },
  ];

  // Shared row class: flat flex-wrap, all data inline, wraps gracefully on mobile
  const rowCls = 'flex flex-wrap items-center gap-x-2.5 gap-y-1.5 px-3 py-2 text-xs';
  const nameCls = 'text-sm font-semibold text-stone-900 shrink-0';
  const badgeCls = 'rounded-full px-2 py-0.5 font-medium shrink-0';
  const mutedCls = 'text-stone-400 shrink-0';
  const locCls = 'flex items-center gap-1 text-stone-500 min-w-0';
  const actionBtnCls = 'rounded-lg bg-stone-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-40 shrink-0';
  const outlineBtnCls = 'rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40 shrink-0';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <section className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
          <StatCard label="คิวรับวัสดุ" value={submittedQueue.length.toLocaleString('th-TH')} detail="ใหม่" icon={CalendarRange} tone="amber" />
          <StatCard label="ขนส่งวัสดุ" value={pickupJobs.length.toLocaleString('th-TH')} detail="งาน" icon={Truck} tone="sky" />
          <StatCard label="รางวัลรอส่ง" value={approvedReadyToSchedule.length.toLocaleString('th-TH')} detail="คำขอ" icon={PackageCheck} tone="teal" />
          <StatCard label="กำลังส่งรางวัล" value={activeRewardDeliveryJobs.length.toLocaleString('th-TH')} detail="งาน" icon={Route} tone="violet" />
        </section>
        <button
          type="button"
          onClick={() => void loadAll(true)}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'กำลังรีเฟรช...' : 'รีเฟรช'}
        </button>
      </div>

      {message ? <AlertBanner message={message} tone={inferMessageTone(message)} /> : null}
      {loadIssueMessages.length > 0 ? (
        <AlertBanner message={loadIssueMessages.join(' ')} tone="info" title="บางส่วนของข้อมูลยังโหลดไม่ครบ" />
      ) : null}

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
              activeTab === tab.id
                ? 'bg-stone-950 text-white'
                : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${activeTab === tab.id ? 'bg-white/20' : 'bg-stone-100 text-stone-500'}`}>
              {tab.count.toLocaleString('th-TH')}
            </span>
          </button>
        ))}
      </div>

      {/* ── Pickup Queue ── */}
      {activeTab === 'pickupQueue' ? (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          {loadIssues.pickupQueue ? (
            <AlertBanner message={loadIssues.pickupQueue} tone="info" title="บอร์ดคิวรับวัสดุยังไม่พร้อม" className="m-3" />
          ) : null}
          {submittedQueue.length === 0 ? (
            <EmptyState
              title={loadIssues.pickupQueue ? 'ยังแสดงคิวรับวัสดุใหม่ไม่ได้' : 'ไม่มีคิวใหม่ในตอนนี้'}
              description={
                loadIssues.pickupQueue
                  ? 'โปรดกดรีเฟรชอีกครั้ง เมื่อระบบเชื่อมต่อได้แล้วคิวใหม่จะกลับมาแสดงตามปกติ'
                  : 'เมื่อเกษตรกรส่งคำขอใหม่ รายการจะมาปรากฏในบอร์ดนี้ทันทีพร้อมข้อมูลจุดรับ'
              }
              icon={Truck}
            />
          ) : (
            <div className="divide-y divide-stone-100">
              {submittedQueue.map((item) => {
                const selectedFactoryId = destinationFactoryBySubmissionId[item.id] || '';
                const canSchedule = pickupRangeBySubmissionId[item.id]?.from && pickupRangeBySubmissionId[item.id]?.to && destinationFactoryBySubmissionId[item.id];
                return (
                  <div key={item.id} className={rowCls}>
                    {/* data */}
                    <span className={nameCls}>{formatMaterial(item.material_type)}</span>
                    <span className={`${badgeCls} bg-amber-50 text-amber-700`}>
                      {Number(item.quantity_value).toLocaleString('th-TH')} {fallbackThaiUnit(item.quantity_unit)}
                    </span>
                    <span className={mutedCls}>{formatDateTime(item.created_at)}</span>
                    <span className={locCls}>
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate max-w-[8rem] sm:max-w-[14rem]">{item.pickup_location_text}</span>
                      {hasValidCoordinates(item.pickup_lat, item.pickup_lng) && (
                        <a href={buildGoogleMapsUrl(item.pickup_lat as number, item.pickup_lng as number)} target="_blank" rel="noopener noreferrer" className="shrink-0 text-primary hover:underline">แผนที่</a>
                      )}
                    </span>
                    {/* controls — wrap to line 2 on narrow screens */}
                    <span className="grow" />
                    <select
                      value={selectedFactoryId}
                      onChange={(event) => setDestinationFactoryBySubmissionId((prev) => ({ ...prev, [item.id]: event.target.value }))}
                      className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs outline-none focus:border-primary shrink-0"
                    >
                      <option value="">เลือกโรงงาน</option>
                      {factoryOptions.map((factory) => (
                        <option key={factory.id} value={factory.id}>{factory.name_th}</option>
                      ))}
                    </select>
                    <DateRangePicker
                      value={pickupRangeBySubmissionId[item.id] || { from: null, to: null }}
                      onChange={(nextRange) => setPickupRangeBySubmissionId((prev) => ({ ...prev, [item.id]: nextRange }))}
                      minDate={new Date()}
                      placeholder="ช่วงวัน"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSchedulePickup(item.id)}
                      disabled={schedulingSubmissionId === item.id || !canSchedule}
                      className={actionBtnCls}
                    >
                      {schedulingSubmissionId === item.id ? '...' : 'จัดคิว'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* ── Pickup Jobs ── */}
      {activeTab === 'pickupJobs' ? (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          {loadIssues.pickupJobs ? (
            <AlertBanner message={loadIssues.pickupJobs} tone="info" title="บอร์ดงานขนส่งวัสดุยังไม่พร้อม" className="m-3" />
          ) : null}
          {pickupJobs.length === 0 ? (
            <EmptyState
              title={loadIssues.pickupJobs ? 'ยังแสดงงานขนส่งวัสดุไม่ได้' : 'ยังไม่มี pickup jobs ของผู้ขนส่งคนนี้'}
              description={
                loadIssues.pickupJobs
                  ? 'โปรดกดรีเฟรชอีกครั้ง เมื่อระบบเชื่อมต่อได้แล้วงานขนส่งจะกลับมาแสดงตามปกติ'
                  : 'เมื่อมีการจัดคิวรับวัสดุ รายการจะเริ่มแสดงในบอร์ดนี้พร้อมการอัปเดตสถานะ'
              }
              icon={Route}
            />
          ) : (
            <div className="divide-y divide-stone-100">
              {pickupJobs.map((item) => (
                <div key={item.id} className={rowCls}>
                  <StatusBadge status={item.status} label={formatPickupJobStatus(item.status)} size="sm" />
                  <span className={nameCls}>{formatMaterial(item.material_type)}</span>
                  <span className={`${badgeCls} bg-amber-50 text-amber-700`}>
                    {Number(item.quantity_value).toLocaleString('th-TH')} {fallbackThaiUnit(item.quantity_unit)}
                  </span>
                  <span className={`${mutedCls} flex items-center gap-1`}>
                    <CalendarRange className="h-3 w-3" />
                    {formatDateTime(item.planned_pickup_at)}
                  </span>
                  <span className={locCls}>
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate max-w-[7rem] sm:max-w-[12rem]">{item.pickup_location_text}</span>
                    {hasValidCoordinates(item.pickup_lat, item.pickup_lng) && (
                      <a href={buildGoogleMapsUrl(item.pickup_lat as number, item.pickup_lng as number)} target="_blank" rel="noopener noreferrer" className="shrink-0 text-primary hover:underline">แผนที่</a>
                    )}
                  </span>
                  {item.destination_factory_name_th ? (
                    <span className="flex items-center gap-1 text-stone-400 shrink-0">
                      <Factory className="h-3 w-3 shrink-0" />
                      {item.destination_factory_name_th}
                      {item.destination_factory_location_text ? (
                        <span className="text-stone-300">·</span>
                      ) : null}
                      {item.destination_factory_location_text ? (
                        <span className="truncate max-w-[7rem] sm:max-w-[12rem]">{item.destination_factory_location_text}</span>
                      ) : null}
                    </span>
                  ) : null}
                  <span className="grow" />
                  {item.status === 'pickup_scheduled' && (
                    <button type="button" onClick={() => void handleMarkPickedUp(item.id)} disabled={updatingPickupJobId === item.id} className={actionBtnCls}>
                      {updatingPickupJobId === item.id ? '...' : 'รับแล้ว'}
                    </button>
                  )}
                  {(item.status === 'pickup_scheduled' || item.status === 'picked_up') && (
                    <button type="button" onClick={() => void handleMarkDeliveredToFactory(item.id)} disabled={updatingPickupJobId === item.id} className={outlineBtnCls}>
                      {updatingPickupJobId === item.id ? '...' : 'ถึงโรงงาน'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* ── Reward Queue ── */}
      {activeTab === 'rewardQueue' ? (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          {loadIssues.rewardQueue ? (
            <AlertBanner message={loadIssues.rewardQueue} tone="info" title="บอร์ดคำขอรางวัลยังไม่พร้อม" className="m-3" />
          ) : null}
          {approvedReadyToSchedule.length === 0 ? (
            <EmptyState
              title={loadIssues.rewardQueue ? 'ยังแสดงคำขอรางวัลที่รอจัดส่งไม่ได้' : 'ไม่มีคำขอที่ต้องจัดรอบส่งเพิ่ม'}
              description={
                loadIssues.rewardQueue
                  ? 'โปรดกดรีเฟรชอีกครั้ง เมื่อระบบเชื่อมต่อได้แล้วคำขอที่รอจัดส่งจะกลับมาแสดงตามปกติ'
                  : 'เมื่อฝ่ายคลังอนุมัติคำขอใหม่ รายการจะปรากฏที่นี่เพื่อให้กำหนดช่วงวันส่ง'
              }
              icon={PackageCheck}
            />
          ) : (
            <div className="divide-y divide-stone-100">
              {approvedReadyToSchedule.map((item) => {
                const canSchedule = deliveryRangeByRequestId[item.id]?.from && deliveryRangeByRequestId[item.id]?.to;
                return (
                  <div key={item.id} className={rowCls}>
                    <span className={nameCls}>{item.reward_name_th ?? 'รางวัล'}</span>
                    <span className={`${badgeCls} bg-amber-50 text-amber-700`}>{Number(item.quantity).toLocaleString('th-TH')} ชิ้น</span>
                    <span className={`${badgeCls} bg-violet-50 text-violet-700`}>{Number(item.requested_points).toLocaleString('th-TH')} แต้ม</span>
                    <span className={locCls}>
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate max-w-[8rem] sm:max-w-[14rem]">{item.pickup_location_text || '-'}</span>
                      {hasValidCoordinates(item.pickup_lat, item.pickup_lng) && (
                        <a href={buildGoogleMapsUrl(item.pickup_lat as number, item.pickup_lng as number)} target="_blank" rel="noopener noreferrer" className="shrink-0 text-primary hover:underline">แผนที่</a>
                      )}
                    </span>
                    <span className="grow" />
                    <DateRangePicker
                      value={deliveryRangeByRequestId[item.id] || { from: null, to: null }}
                      onChange={(nextRange) => setDeliveryRangeByRequestId((prev) => ({ ...prev, [item.id]: nextRange }))}
                      minDate={new Date()}
                      placeholder="ช่วงส่ง"
                    />
                    <button
                      type="button"
                      onClick={() => void handleScheduleRewardDelivery(item.id)}
                      disabled={schedulingRewardRequestId === item.id || !canSchedule}
                      className={actionBtnCls}
                    >
                      {schedulingRewardRequestId === item.id ? '...' : 'จัดส่ง'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* ── Delivery Jobs ── */}
      {activeTab === 'deliveryJobs' ? (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          {loadIssues.deliveryJobs ? (
            <AlertBanner message={loadIssues.deliveryJobs} tone="info" title="บอร์ดงานส่งรางวัลยังไม่พร้อม" className="m-3" />
          ) : null}
          {activeRewardDeliveryJobs.length === 0 ? (
            <EmptyState
              title={loadIssues.deliveryJobs ? 'ยังแสดงงานส่งรางวัลไม่ได้' : 'ยังไม่มีงานส่งรางวัลที่กำลังดำเนินการ'}
              description={
                loadIssues.deliveryJobs
                  ? 'โปรดกดรีเฟรชอีกครั้ง เมื่อระบบเชื่อมต่อได้แล้วงานส่งรางวัลจะกลับมาแสดงตามปกติ'
                  : 'เมื่อจัดรอบส่งแล้ว งานจะย้ายเข้าบอร์ดนี้เพื่อให้ติดตามจนส่งมอบสำเร็จ'
              }
              icon={PackageCheck}
            />
          ) : (
            <div className="divide-y divide-stone-100">
              {activeRewardDeliveryJobs.map((item) => (
                <div key={item.id} className={rowCls}>
                  <StatusBadge status={item.status} label={formatDeliveryStatus(item.status)} size="sm" />
                  <span className={nameCls}>{item.reward_name_th ?? 'รางวัล'}</span>
                  <span className={`${badgeCls} bg-amber-50 text-amber-700`}>{Number(item.quantity).toLocaleString('th-TH')} ชิ้น</span>
                  <span className={`${mutedCls} flex items-center gap-1`}>
                    <CalendarRange className="h-3 w-3" />
                    {formatDateTime(item.planned_delivery_at)}
                  </span>
                  <span className={locCls}>
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate max-w-[8rem] sm:max-w-[14rem]">{item.pickup_location_text || '-'}</span>
                    {hasValidCoordinates(item.pickup_lat, item.pickup_lng) && (
                      <a href={buildGoogleMapsUrl(item.pickup_lat as number, item.pickup_lng as number)} target="_blank" rel="noopener noreferrer" className="shrink-0 text-primary hover:underline">แผนที่</a>
                    )}
                  </span>
                  <span className="grow" />
                  {item.status === 'reward_delivery_scheduled' && (
                    <button type="button" onClick={() => void handleMarkOutForDelivery(item.id)} disabled={updatingDeliveryJobId === item.id} className={actionBtnCls}>
                      {updatingDeliveryJobId === item.id ? '...' : 'เริ่มส่ง'}
                    </button>
                  )}
                  {item.status === 'out_for_delivery' && (
                    <button type="button" onClick={() => void handleMarkDelivered(item.id)} disabled={updatingDeliveryJobId === item.id} className={outlineBtnCls}>
                      {updatingDeliveryJobId === item.id ? '...' : 'ส่งแล้ว'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
