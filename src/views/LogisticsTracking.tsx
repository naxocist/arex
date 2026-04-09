import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarRange,
  Factory,
  MapPin,
  PackageCheck,
  Route,
  Truck,
} from 'lucide-react';
import AlertBanner from '@/src/components/AlertBanner';
import DateRangePicker, { type DateRangeValue } from '@/src/components/DateRangePicker';
import EmptyState from '@/src/components/EmptyState';
import PageHeader from '@/src/components/PageHeader';
import SectionCard from '@/src/components/SectionCard';
import StatCard from '@/src/components/StatCard';
import StatusBadge from '@/src/components/StatusBadge';
import {
  ApiError,
  logisticsApi,
  type LogisticsApprovedRewardRequestItem,
  type LogisticsFactoryOptionItem,
  type LogisticsPickupJobItem,
  type LogisticsPickupQueueItem,
  type LogisticsRewardDeliveryJobItem,
} from '@/src/lib/apiClient';

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

function formatSubmissionStatus(status: string): string {
  const map: Record<string, string> = {
    submitted: 'รอจัดคิว',
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

function buildOpenStreetMapUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
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

  const factoryOptionById = useMemo(() => {
    const map: Record<string, LogisticsFactoryOptionItem> = {};
    for (const factory of factoryOptions) {
      map[factory.id] = factory;
    }
    return map;
  }, [factoryOptions]);

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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Logistics Control"
        title="ศูนย์ปฏิบัติการขนส่งที่แยกงานเป็นคิวตัดสินใจชัดเจน"
        description="ฝ่ายขนส่งต้องเห็นทั้งคิวใหม่ งานระหว่างทาง และงานส่งรางวัลพร้อมกัน แต่ไม่ควรปะปนกันจนอ่านยาก หน้านี้จึงแบ่งเป็นบอร์ดงานตามจังหวะการทำงานจริง"
        actions={[
          {
            label: isLoading ? 'กำลังรีเฟรช...' : 'รีเฟรชข้อมูล',
            onClick: () => void loadAll(true),
          },
        ]}
      />

      {message ? <AlertBanner message={message} tone={inferMessageTone(message)} /> : null}
      {loadIssueMessages.length > 0 ? (
        <AlertBanner
          message={loadIssueMessages.join(' ')}
          tone="info"
          title="บางส่วนของข้อมูลยังโหลดไม่ครบ"
        />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="คิวรับวัสดุใหม่" value={submittedQueue.length.toLocaleString('th-TH')} detail="คำขอใหม่ที่ยังไม่ได้จัดรอบรับ" icon={CalendarRange} tone="amber" />
        <StatCard label="งานขนส่งวัสดุ" value={pickupJobs.length.toLocaleString('th-TH')} detail="งานที่กำลังวิ่งอยู่ในสายส่งเข้าโรงงาน" icon={Truck} tone="sky" />
        <StatCard label="ของรางวัลพร้อมจัดส่ง" value={approvedReadyToSchedule.length.toLocaleString('th-TH')} detail="คำขอที่คลังอนุมัติแล้วและรอเลือกช่วงส่ง" icon={PackageCheck} tone="teal" />
        <StatCard label="งานส่งรางวัลที่กำลังดำเนินการ" value={activeRewardDeliveryJobs.length.toLocaleString('th-TH')} detail="รถที่กำลังนำของรางวัลไปส่งเกษตรกร" icon={Route} tone="violet" />
      </section>

      <SectionCard
        title="ลำดับงานของฝ่ายขนส่ง"
        description="คิวนี้ครอบคลุมทั้ง Step 2 จัดคิวรับวัสดุ, Step 3 ส่งถึงโรงงาน และ Step 8 ส่งมอบของรางวัลหลังคลังอนุมัติ"
      >
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? 'bg-stone-950 text-white'
                  : 'border border-line bg-surface-muted text-stone-600'
              }`}
            >
              {tab.label} ({tab.count.toLocaleString('th-TH')})
            </button>
          ))}
        </div>
      </SectionCard>

      {activeTab === 'pickupQueue' ? (
        <SectionCard
          title="คิวรับวัสดุใหม่"
          description="งานที่ต้องตัดสินใจหลักคือเลือกโรงงานปลายทางและกำหนดช่วงนัดรับให้ชัดก่อนปล่อยรถออกงาน"
        >
          {loadIssues.pickupQueue ? (
            <AlertBanner
              message={loadIssues.pickupQueue}
              tone="info"
              title="บอร์ดคิวรับวัสดุยังไม่พร้อม"
              className="mb-4"
            />
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
            <div className="space-y-4">
              {submittedQueue.map((item) => {
                const selectedFactoryId = destinationFactoryBySubmissionId[item.id] || '';
                const selectedFactory = selectedFactoryId ? factoryOptionById[selectedFactoryId] : null;

                return (
                  <article key={item.id} className="rounded-[1.7rem] border border-line bg-surface-muted p-4">
                    <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-stone-900">
                            {formatMaterial(item.material_type)} • {Number(item.quantity_value).toLocaleString('th-TH')} {fallbackThaiUnit(item.quantity_unit)}
                          </p>
                          <StatusBadge status={item.status} label={formatSubmissionStatus(item.status)} size="sm" />
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-stone-700">
                            <p className="font-semibold text-stone-900">เวลาสร้างรายการ</p>
                            <p className="mt-1">{formatDateTime(item.created_at)}</p>
                          </div>
                          <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-stone-700">
                            <p className="font-semibold text-stone-900">สถานที่นัดรับ</p>
                            <p className="mt-1">{item.pickup_location_text}</p>
                            {hasValidCoordinates(item.pickup_lat, item.pickup_lng) ? (
                              <a
                                href={buildOpenStreetMapUrl(item.pickup_lat as number, item.pickup_lng as number)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-stone-900 underline underline-offset-2"
                              >
                                <MapPin className="h-4 w-4" />
                                ดูบนแผนที่
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="rounded-2xl border border-line bg-white px-4 py-3">
                          <label className="block space-y-2">
                            <span className="text-sm font-medium text-stone-700">เลือกโรงงานปลายทาง</span>
                            <select
                              value={selectedFactoryId}
                              onChange={(event) =>
                                setDestinationFactoryBySubmissionId((prev) => ({
                                  ...prev,
                                  [item.id]: event.target.value,
                                }))
                              }
                              className="w-full rounded-2xl border border-line bg-surface-muted px-4 py-3 text-sm outline-none"
                            >
                              <option value="">เลือกโรงงานปลายทาง</option>
                              {factoryOptions.map((factory) => (
                                <option key={factory.id} value={factory.id}>
                                  {factory.name_th}
                                </option>
                              ))}
                            </select>
                          </label>
                          <p className="mt-2 text-sm leading-6 text-stone-600">
                            {selectedFactory?.location_text || 'เมื่อเลือกโรงงานแล้ว ระบบจะแสดงที่อยู่เพื่อช่วยตรวจความถูกต้อง'}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-line bg-white px-4 py-3">
                          <p className="text-sm font-medium text-stone-700">ช่วงวันนัดรับ</p>
                          <div className="mt-2">
                            <DateRangePicker
                              value={pickupRangeBySubmissionId[item.id] || { from: null, to: null }}
                              onChange={(nextRange) =>
                                setPickupRangeBySubmissionId((prev) => ({
                                  ...prev,
                                  [item.id]: nextRange,
                                }))
                              }
                              minDate={new Date()}
                              placeholder="เลือกช่วงวันนัดรับ"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleSchedulePickup(item.id)}
                          disabled={
                            schedulingSubmissionId === item.id ||
                            !pickupRangeBySubmissionId[item.id]?.from ||
                            !pickupRangeBySubmissionId[item.id]?.to ||
                            !destinationFactoryBySubmissionId[item.id]
                          }
                          className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-800 disabled:opacity-60"
                        >
                          <CalendarRange className="h-4 w-4" />
                          <span>{schedulingSubmissionId === item.id ? 'กำลังจัดคิว...' : 'ยืนยันจัดคิวรับงาน'}</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </SectionCard>
      ) : null}

      {activeTab === 'pickupJobs' ? (
        <SectionCard
          title="งานขนส่งวัสดุ"
          description="ติดตามงานที่ออกจากคิวใหม่แล้วและอัปเดตสถานะจากรับวัสดุจนถึงส่งถึงโรงงาน"
        >
          {loadIssues.pickupJobs ? (
            <AlertBanner
              message={loadIssues.pickupJobs}
              tone="info"
              title="บอร์ดงานขนส่งวัสดุยังไม่พร้อม"
              className="mb-4"
            />
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
            <div className="space-y-4">
              {pickupJobs.map((item) => (
                <article key={item.id} className="rounded-[1.6rem] border border-line bg-surface-muted p-4">
                  <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-stone-900">
                          {formatMaterial(item.material_type)} • {Number(item.quantity_value).toLocaleString('th-TH')} {fallbackThaiUnit(item.quantity_unit)}
                        </p>
                        <StatusBadge status={item.status} label={formatPickupJobStatus(item.status)} size="sm" />
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-stone-700">
                          <p className="font-semibold text-stone-900">โรงงานปลายทาง</p>
                          <p className="mt-1">{item.destination_factory_name_th || '-'}</p>
                          <p className="mt-1 text-stone-500">{item.destination_factory_location_text || 'ยังไม่มีข้อมูลที่อยู่โรงงาน'}</p>
                        </div>
                        <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-stone-700">
                          <p className="font-semibold text-stone-900">ช่วงนัดรับ</p>
                          <p className="mt-1">
                            {formatDateTime(item.planned_pickup_at)} - {formatDateTime(item.pickup_window_end_at ?? null)}
                          </p>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-stone-700">
                        <p className="font-semibold text-stone-900">สถานที่รับวัสดุ</p>
                        <p className="mt-1">{item.pickup_location_text}</p>
                        {hasValidCoordinates(item.pickup_lat, item.pickup_lng) ? (
                          <a
                            href={buildOpenStreetMapUrl(item.pickup_lat as number, item.pickup_lng as number)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-stone-900 underline underline-offset-2"
                          >
                            <MapPin className="h-4 w-4" />
                            ดูบนแผนที่
                          </a>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-2xl border border-line bg-white px-4 py-3">
                        <p className="text-sm font-semibold text-stone-900">สิ่งที่ต้องทำถัดไป</p>
                        <p className="mt-2 text-sm leading-6 text-stone-600">
                          {item.status === 'pickup_scheduled'
                            ? 'หลังรับวัสดุขึ้นรถแล้ว ให้กดอัปเดตเป็นรับวัสดุแล้ว'
                            : item.status === 'picked_up'
                              ? 'เมื่อส่งถึงโรงงานแล้ว ให้ยืนยันการส่งถึงโรงงานเพื่อส่งต่องานให้ฝ่ายโรงงาน'
                              : 'งานนี้ส่งถึงโรงงานแล้ว รอฝ่ายโรงงานยืนยันน้ำหนักจริง'}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {item.status === 'pickup_scheduled' ? (
                          <button
                            type="button"
                            onClick={() => void handleMarkPickedUp(item.id)}
                            disabled={updatingPickupJobId === item.id}
                            className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-800 disabled:opacity-60"
                          >
                            <Truck className="h-4 w-4" />
                            <span>{updatingPickupJobId === item.id ? 'กำลังอัปเดต...' : 'ยืนยันรับวัสดุ'}</span>
                          </button>
                        ) : null}
                        {(item.status === 'pickup_scheduled' || item.status === 'picked_up') ? (
                          <button
                            type="button"
                            onClick={() => void handleMarkDeliveredToFactory(item.id)}
                            disabled={updatingPickupJobId === item.id}
                            className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-surface-muted disabled:opacity-60"
                          >
                            <Factory className="h-4 w-4" />
                            <span>{updatingPickupJobId === item.id ? 'กำลังอัปเดต...' : 'ยืนยันส่งถึงโรงงาน'}</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}

      {activeTab === 'rewardQueue' ? (
        <SectionCard
          title="คำขอรางวัลที่พร้อมจัดรอบส่ง"
          description="หลังคลังอนุมัติแล้ว งานของฝ่ายขนส่งคือเลือกช่วงวันส่งให้เหมาะกับแต่ละคำขอ"
        >
          {loadIssues.rewardQueue ? (
            <AlertBanner
              message={loadIssues.rewardQueue}
              tone="info"
              title="บอร์ดคำขอรางวัลยังไม่พร้อม"
              className="mb-4"
            />
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
            <div className="space-y-4">
              {approvedReadyToSchedule.map((item) => (
                <article key={item.id} className="rounded-[1.6rem] border border-line bg-surface-muted p-4">
                  <div className="grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-stone-900">
                          {item.reward_name_th ?? `รหัสรางวัล ${item.reward_id.slice(0, 8)}`}
                        </p>
                        <StatusBadge status={item.status} label="คลังอนุมัติแล้ว" size="sm" />
                      </div>
                      <p className="text-sm leading-6 text-stone-600">
                        {item.reward_description_th || 'ไม่มีรายละเอียดเพิ่มเติม'}
                      </p>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-stone-700">
                          <p className="font-semibold text-stone-900">รายละเอียดคำขอ</p>
                          <p className="mt-1">จำนวน {Number(item.quantity).toLocaleString('th-TH')} ชิ้น</p>
                          <p className="mt-1">ใช้ {Number(item.requested_points).toLocaleString('th-TH')} PMUC Coin</p>
                        </div>
                        <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-stone-700">
                          <p className="font-semibold text-stone-900">จุดส่งมอบ</p>
                          <p className="mt-1">{item.pickup_location_text || '-'}</p>
                          {hasValidCoordinates(item.pickup_lat, item.pickup_lng) ? (
                            <a
                              href={buildOpenStreetMapUrl(item.pickup_lat as number, item.pickup_lng as number)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-stone-900 underline underline-offset-2"
                            >
                              <MapPin className="h-4 w-4" />
                              ดูบนแผนที่
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-2xl border border-line bg-white px-4 py-3">
                        <p className="text-sm font-medium text-stone-700">เลือกช่วงวันนำส่ง</p>
                        <div className="mt-2">
                          <DateRangePicker
                            value={deliveryRangeByRequestId[item.id] || { from: null, to: null }}
                            onChange={(nextRange) =>
                              setDeliveryRangeByRequestId((prev) => ({
                                ...prev,
                                [item.id]: nextRange,
                              }))
                            }
                            minDate={new Date()}
                            placeholder="เลือกช่วงวันนำส่ง"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleScheduleRewardDelivery(item.id)}
                        disabled={
                          schedulingRewardRequestId === item.id ||
                          !deliveryRangeByRequestId[item.id]?.from ||
                          !deliveryRangeByRequestId[item.id]?.to
                        }
                        className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-800 disabled:opacity-60"
                      >
                        <CalendarRange className="h-4 w-4" />
                        <span>{schedulingRewardRequestId === item.id ? 'กำลังจัดรอบ...' : 'จัดรอบส่งรางวัล'}</span>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}

      {activeTab === 'deliveryJobs' ? (
        <SectionCard
          title="งานส่งรางวัลที่กำลังดำเนินการ"
          description="อัปเดตจังหวะการส่งจากจัดรอบแล้ว ไปจนถึงส่งมอบสำเร็จ เพื่อให้เกษตรกรและทีมหลังบ้านเห็นสถานะเดียวกัน"
        >
          {loadIssues.deliveryJobs ? (
            <AlertBanner
              message={loadIssues.deliveryJobs}
              tone="info"
              title="บอร์ดงานส่งรางวัลยังไม่พร้อม"
              className="mb-4"
            />
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
            <div className="space-y-4">
              {activeRewardDeliveryJobs.map((item) => (
                <article key={item.id} className="rounded-[1.6rem] border border-line bg-surface-muted p-4">
                  <div className="grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-stone-900">
                          {item.reward_name_th ?? `Reward ${item.reward_id ?? '-'}`}
                        </p>
                        <StatusBadge status={item.status} label={formatDeliveryStatus(item.status)} size="sm" />
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-stone-700">
                          <p className="font-semibold text-stone-900">ช่วงนำส่ง</p>
                          <p className="mt-1">
                            {formatDateTime(item.planned_delivery_at)} - {formatDateTime(item.delivery_window_end_at ?? null)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-stone-700">
                          <p className="font-semibold text-stone-900">จำนวน</p>
                          <p className="mt-1">{Number(item.quantity).toLocaleString('th-TH')} ชิ้น</p>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-stone-700">
                        <p className="font-semibold text-stone-900">ที่อยู่ส่งมอบ</p>
                        <p className="mt-1">{item.pickup_location_text || '-'}</p>
                        {hasValidCoordinates(item.pickup_lat, item.pickup_lng) ? (
                          <a
                            href={buildOpenStreetMapUrl(item.pickup_lat as number, item.pickup_lng as number)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-stone-900 underline underline-offset-2"
                          >
                            <MapPin className="h-4 w-4" />
                            ดูบนแผนที่
                          </a>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-2xl border border-line bg-white px-4 py-3">
                        <p className="text-sm font-semibold text-stone-900">สถานะปัจจุบัน</p>
                        <p className="mt-2 text-sm leading-6 text-stone-600">
                          {item.status === 'reward_delivery_scheduled'
                            ? 'งานนี้จัดรอบแล้ว รอเริ่มนำส่ง'
                            : 'งานนี้อยู่ระหว่างนำส่ง เมื่อส่งถึงปลายทางแล้วให้กดยืนยันส่งมอบ'}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {item.status === 'reward_delivery_scheduled' ? (
                          <button
                            type="button"
                            onClick={() => void handleMarkOutForDelivery(item.id)}
                            disabled={updatingDeliveryJobId === item.id}
                            className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-800 disabled:opacity-60"
                          >
                            <Truck className="h-4 w-4" />
                            <span>{updatingDeliveryJobId === item.id ? 'กำลังอัปเดต...' : 'เริ่มนำส่ง'}</span>
                          </button>
                        ) : null}
                        {item.status === 'out_for_delivery' ? (
                          <button
                            type="button"
                            onClick={() => void handleMarkDelivered(item.id)}
                            disabled={updatingDeliveryJobId === item.id}
                            className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-surface-muted disabled:opacity-60"
                          >
                            <PackageCheck className="h-4 w-4" />
                            <span>{updatingDeliveryJobId === item.id ? 'กำลังอัปเดต...' : 'ยืนยันส่งมอบสำเร็จ'}</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}
    </div>
  );
}
