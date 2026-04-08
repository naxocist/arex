import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import StatusBadge from '@/src/components/StatusBadge';
import {
  ApiError,
  logisticsApi,
  type LogisticsApprovedRewardRequestItem,
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

export default function LogisticsTracking() {
  const [pickupQueue, setPickupQueue] = useState<LogisticsPickupQueueItem[]>([]);
  const [pickupJobs, setPickupJobs] = useState<LogisticsPickupJobItem[]>([]);
  const [approvedRewardRequests, setApprovedRewardRequests] = useState<LogisticsApprovedRewardRequestItem[]>([]);
  const [rewardDeliveryJobs, setRewardDeliveryJobs] = useState<LogisticsRewardDeliveryJobItem[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [schedulingSubmissionId, setSchedulingSubmissionId] = useState<string | null>(null);
  const [updatingPickupJobId, setUpdatingPickupJobId] = useState<string | null>(null);
  const [schedulingRewardRequestId, setSchedulingRewardRequestId] = useState<string | null>(null);
  const [updatingDeliveryJobId, setUpdatingDeliveryJobId] = useState<string | null>(null);

  const submittedQueue = useMemo(
    () => pickupQueue.filter((item) => item.status === 'submitted'),
    [pickupQueue],
  );

  const activeRewardDeliveryJobs = useMemo(
    () => rewardDeliveryJobs.filter((item) => item.status === 'reward_delivery_scheduled' || item.status === 'out_for_delivery'),
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

  const loadAll = async () => {
    if (!hasAccessToken()) {
      setMessage('ยังไม่พบโทเคน AREX_ACCESS_TOKEN กรุณาเข้าสู่ระบบที่หน้าเลือกผู้ใช้งาน');
      return;
    }

    setIsLoading(true);
    try {
      const [queueResponse, pickupJobsResponse, approvedResponse, deliveryJobsResponse] = await Promise.all([
        logisticsApi.getPickupQueue(),
        logisticsApi.getPickupJobs(),
        logisticsApi.getApprovedRewardRequests(),
        logisticsApi.getRewardDeliveryJobs(),
      ]);

      setPickupQueue(queueResponse.queue);
      setPickupJobs(pickupJobsResponse.jobs);
      setApprovedRewardRequests(approvedResponse.queue);
      setRewardDeliveryJobs(deliveryJobsResponse.jobs);
      setMessage(null);
    } catch (error) {
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
    setSchedulingSubmissionId(submissionId);
    setMessage(null);
    try {
      await logisticsApi.schedulePickup(submissionId, {
        planned_pickup_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        notes: 'จัดคิวโดยฝ่ายขนส่ง',
      });
      setMessage('จัดคิวรับวัสดุสำเร็จแล้ว');
      await loadAll();
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
      await loadAll();
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
      await loadAll();
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
    setSchedulingRewardRequestId(requestId);
    setMessage(null);
    try {
      await logisticsApi.scheduleRewardDelivery(requestId, {
        planned_delivery_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        notes: 'จัดรอบส่งโดยฝ่ายขนส่ง',
      });
      setMessage('จัดรอบส่งรางวัลสำเร็จแล้ว');
      await loadAll();
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
      await loadAll();
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
      await loadAll();
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

  return (
    <div className="space-y-6">
      <section className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-on-surface">หน้าทำงานฝ่ายขนส่ง</h1>
          <p className="text-sm text-on-surface-variant mt-1">จัดคิวรับวัสดุ, ส่งถึงโรงงาน, และจัดส่งของรางวัล</p>
          {message && <p className="text-sm text-on-surface-variant mt-2 bg-surface-container-high px-3 py-2 rounded-lg w-fit">{message}</p>}
        </div>
        <button
          type="button"
          onClick={() => void loadAll()}
          disabled={isLoading}
          className="px-4 py-2 rounded-full bg-primary text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> รีเฟรช
        </button>
      </section>

      <section className="bg-white border border-outline-variant/20 rounded-xl p-4">
        <h2 className="text-base font-semibold">ลำดับงานในกระบวนการ</h2>
        <p className="text-sm text-on-surface-variant mt-1">Step 2 จัดคิวรับวัสดุ, Step 3 ขนส่งถึงโรงงาน, และ Step 8 ส่งมอบรางวัลหลังคลังอนุมัติ</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant">คิวรับวัสดุใหม่</p>
          <p className="text-3xl font-semibold mt-2">{submittedQueue.length.toLocaleString('th-TH')}</p>
        </div>
        <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant">งานขนส่งวัสดุ</p>
          <p className="text-3xl font-semibold mt-2">{pickupJobs.length.toLocaleString('th-TH')}</p>
        </div>
        <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant">คำขอรางวัลพร้อมจัดส่ง</p>
          <p className="text-3xl font-semibold mt-2">{approvedReadyToSchedule.length.toLocaleString('th-TH')}</p>
        </div>
        <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant">งานส่งรางวัลที่กำลังดำเนินการ</p>
          <p className="text-3xl font-semibold mt-2">{activeRewardDeliveryJobs.length.toLocaleString('th-TH')}</p>
        </div>
      </section>

      <section className="bg-white border border-outline-variant/20 rounded-xl p-4">
        <h2 className="text-lg font-semibold mb-3">คิวรับวัสดุใหม่ (submitted)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-on-surface-variant">
                <th className="py-2">เวลา</th>
                <th className="py-2">วัสดุ</th>
                <th className="py-2">ปริมาณ</th>
                <th className="py-2">สถานที่นัดรับ</th>
                <th className="py-2">สถานะ</th>
                <th className="py-2">การจัดคิว</th>
              </tr>
            </thead>
            <tbody>
              {submittedQueue.map((item) => (
                <tr key={item.id} className="border-t border-outline-variant/10">
                  <td className="py-2">{new Date(item.created_at).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="py-2">{formatMaterial(item.material_type)}</td>
                  <td className="py-2">{Number(item.quantity_value).toLocaleString('th-TH')} {item.quantity_unit}</td>
                  <td className="py-2">{item.pickup_location_text}</td>
                  <td className="py-2">
                    <StatusBadge status={item.status} label={formatSubmissionStatus(item.status)} />
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => void handleSchedulePickup(item.id)}
                      disabled={schedulingSubmissionId === item.id}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold bg-surface-container-high hover:bg-primary hover:text-white disabled:opacity-60"
                    >
                      {schedulingSubmissionId === item.id ? 'กำลังจัดคิว...' : 'จัดคิวรับงาน'}
                    </button>
                  </td>
                </tr>
              ))}
              {submittedQueue.length === 0 && (
                <tr>
                  <td className="py-3 text-on-surface-variant" colSpan={6}>ไม่มีคิวใหม่ในสถานะ submitted</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white border border-outline-variant/20 rounded-xl p-4">
        <h2 className="text-lg font-semibold mb-3">งานขนส่งวัสดุ (pickup jobs)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-on-surface-variant">
                <th className="py-2">งาน</th>
                <th className="py-2">วัสดุ</th>
                <th className="py-2">สถานะ</th>
                <th className="py-2">สถานที่</th>
                <th className="py-2">การอัปเดต</th>
              </tr>
            </thead>
            <tbody>
              {pickupJobs.map((item) => (
                <tr key={item.id} className="border-t border-outline-variant/10">
                  <td className="py-2">{item.id.slice(0, 8)}</td>
                  <td className="py-2">{formatMaterial(item.material_type)} • {Number(item.quantity_value).toLocaleString('th-TH')} {item.quantity_unit}</td>
                  <td className="py-2">
                    <StatusBadge status={item.status} label={formatPickupJobStatus(item.status)} />
                  </td>
                  <td className="py-2">{item.pickup_location_text}</td>
                  <td className="py-2 flex items-center gap-2">
                    {item.status === 'pickup_scheduled' && (
                      <button
                        type="button"
                        onClick={() => void handleMarkPickedUp(item.id)}
                        disabled={updatingPickupJobId === item.id}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold bg-surface-container-high hover:bg-primary hover:text-white disabled:opacity-60"
                      >
                        {updatingPickupJobId === item.id ? 'กำลังอัปเดต...' : 'ยืนยันรับวัสดุ'}
                      </button>
                    )}
                    {(item.status === 'pickup_scheduled' || item.status === 'picked_up') && (
                      <button
                        type="button"
                        onClick={() => void handleMarkDeliveredToFactory(item.id)}
                        disabled={updatingPickupJobId === item.id}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold bg-surface-container-high hover:bg-primary hover:text-white disabled:opacity-60"
                      >
                        {updatingPickupJobId === item.id ? 'กำลังอัปเดต...' : 'ยืนยันส่งถึงโรงงาน'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {pickupJobs.length === 0 && (
                <tr>
                  <td className="py-3 text-on-surface-variant" colSpan={5}>ยังไม่มี pickup jobs ของผู้ขนส่งคนนี้</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
          <h2 className="text-lg font-semibold mb-3">คำขอรางวัลที่พร้อมจัดรอบส่ง</h2>
          <div className="space-y-3">
            {approvedReadyToSchedule.map((item) => (
              <div key={item.id} className="border border-outline-variant/15 rounded-lg p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Request {item.id.slice(0, 8)}</p>
                  <div className="mt-1">
                    <StatusBadge status={item.status} label="คลังอนุมัติแล้ว" />
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1">จำนวน {Number(item.quantity).toLocaleString('th-TH')} • {Number(item.requested_points).toLocaleString('th-TH')} คะแนน</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleScheduleRewardDelivery(item.id)}
                  disabled={schedulingRewardRequestId === item.id}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-surface-container-high hover:bg-primary hover:text-white disabled:opacity-60"
                >
                  {schedulingRewardRequestId === item.id ? 'กำลังจัดรอบ...' : 'จัดรอบส่ง'}
                </button>
              </div>
            ))}
            {approvedReadyToSchedule.length === 0 && <p className="text-sm text-on-surface-variant">ไม่มีคำขอที่ต้องจัดรอบส่งเพิ่ม</p>}
          </div>
        </div>

        <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
          <h2 className="text-lg font-semibold mb-3">งานส่งรางวัลที่กำลังดำเนินการ</h2>
          <div className="space-y-3">
            {activeRewardDeliveryJobs.map((item) => (
              <div key={item.id} className="border border-outline-variant/15 rounded-lg p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.reward_name_th ?? `Reward ${item.reward_id ?? '-'}`}</p>
                    <p className="text-xs text-on-surface-variant">Job {item.id.slice(0, 8)}</p>
                    <div className="mt-1">
                      <StatusBadge status={item.status} label={formatDeliveryStatus(item.status)} />
                    </div>
                  </div>
                  <p className="text-xs text-on-surface-variant">{Number(item.quantity).toLocaleString('th-TH')} ชิ้น</p>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {item.status === 'reward_delivery_scheduled' && (
                    <button
                      type="button"
                      onClick={() => void handleMarkOutForDelivery(item.id)}
                      disabled={updatingDeliveryJobId === item.id}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold bg-surface-container-high hover:bg-primary hover:text-white disabled:opacity-60"
                    >
                      {updatingDeliveryJobId === item.id ? 'กำลังอัปเดต...' : 'เริ่มนำส่ง'}
                    </button>
                  )}
                  {item.status === 'out_for_delivery' && (
                    <button
                      type="button"
                      onClick={() => void handleMarkDelivered(item.id)}
                      disabled={updatingDeliveryJobId === item.id}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold bg-surface-container-high hover:bg-primary hover:text-white disabled:opacity-60"
                    >
                      {updatingDeliveryJobId === item.id ? 'กำลังอัปเดต...' : 'ยืนยันส่งมอบ'}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {activeRewardDeliveryJobs.length === 0 && <p className="text-sm text-on-surface-variant">ยังไม่มีงานส่งรางวัลที่กำลังดำเนินการ</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
