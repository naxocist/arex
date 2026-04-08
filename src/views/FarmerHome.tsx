import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, RefreshCw, Truck, XCircle } from 'lucide-react';
import StatusBadge from '@/src/components/StatusBadge';
import {
  ApiError,
  farmerApi,
  type CreateSubmissionPayload,
  type FarmerRewardItem,
  type FarmerRewardRequestItem,
  type FarmerSubmissionItem,
} from '@/src/lib/apiClient';

const MATERIAL_OPTIONS: Array<{
  value: CreateSubmissionPayload['material_type'];
  label: string;
}> = [
  { value: 'rice_straw', label: 'ฟางข้าว' },
  { value: 'cassava_root', label: 'เหง้ามันสำปะหลัง' },
  { value: 'sugarcane_bagasse', label: 'ชานอ้อย' },
  { value: 'corn_stover', label: 'ตอซังข้าวโพด' },
];

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

function formatSubmissionStatus(status: string): string {
  const map: Record<string, string> = {
    submitted: 'ส่งคำขอแล้ว',
    pickup_scheduled: 'จัดคิวรถแล้ว',
    picked_up: 'รับวัสดุแล้ว',
    delivered_to_factory: 'ส่งถึงโรงงานแล้ว',
    factory_confirmed: 'โรงงานยืนยันแล้ว',
    points_credited: 'ได้รับคะแนนแล้ว',
  };
  return map[status] ?? status;
}

function formatRewardRequestStatus(status: string): string {
  const map: Record<string, string> = {
    requested: 'รอคลังตรวจสอบ',
    warehouse_approved: 'คลังอนุมัติแล้ว',
    warehouse_rejected: 'คลังปฏิเสธ',
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

export default function FarmerHome() {
  const [materialType, setMaterialType] = useState<CreateSubmissionPayload['material_type']>('rice_straw');
  const [quantityValue, setQuantityValue] = useState('');
  const [pickupLocation, setPickupLocation] = useState('ต.นาเฉลียง อ.หนองไผ่ จ.เพชรบูรณ์');

  const [isSubmittingMaterial, setIsSubmittingMaterial] = useState(false);
  const [requestingRewardId, setRequestingRewardId] = useState<string | null>(null);

  const [submissions, setSubmissions] = useState<FarmerSubmissionItem[]>([]);
  const [availablePoints, setAvailablePoints] = useState<number>(0);
  const [rewardsCatalog, setRewardsCatalog] = useState<FarmerRewardItem[]>([]);
  const [rewardRequests, setRewardRequests] = useState<FarmerRewardRequestItem[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const stats = useMemo(() => {
    const pendingRewards = rewardRequests.filter((item) => item.status === 'requested').length;
    return {
      submissions: submissions.length,
      pendingRewards,
    };
  }, [submissions, rewardRequests]);

  const rewardNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const reward of rewardsCatalog) {
      map[reward.id] = reward.name_th;
    }
    return map;
  }, [rewardsCatalog]);

  const loadDashboard = async () => {
    if (!hasAccessToken()) {
      setMessage('ยังไม่พบโทเคน AREX_ACCESS_TOKEN กรุณาเข้าสู่ระบบที่หน้าเลือกผู้ใช้งาน');
      return;
    }

    setIsLoading(true);
    try {
      const [submissionsResponse, pointsResponse, rewardsResponse, rewardRequestsResponse] = await Promise.all([
        farmerApi.listSubmissions(),
        farmerApi.getPoints(),
        farmerApi.listRewards(),
        farmerApi.listRewardRequests(),
      ]);

      setSubmissions(submissionsResponse.submissions);
      setAvailablePoints(pointsResponse.available_points);
      setRewardsCatalog(rewardsResponse.rewards);
      setRewardRequests(rewardRequestsResponse.requests);
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
    void loadDashboard();
  }, []);

  const handleSubmitMaterial = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!hasAccessToken()) {
      setMessage('ยังไม่พบโทเคน AREX_ACCESS_TOKEN สำหรับเชื่อมต่อ FastAPI');
      return;
    }

    const parsedQuantity = Number(quantityValue);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setMessage('กรุณาระบุปริมาณมากกว่า 0');
      return;
    }

    setIsSubmittingMaterial(true);
    setMessage(null);
    try {
      await farmerApi.createSubmission({
        material_type: materialType,
        quantity_value: parsedQuantity,
        quantity_unit: 'ton',
        pickup_location_text: pickupLocation,
      });
      setQuantityValue('');
      setMessage('ส่งรายการวัสดุสำเร็จแล้ว');
      await loadDashboard();
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(`ส่งรายการไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('ส่งรายการไม่สำเร็จ กรุณาลองใหม่');
      }
    } finally {
      setIsSubmittingMaterial(false);
    }
  };

  const handleCreateRewardRequest = async (reward: FarmerRewardItem) => {
    if (!hasAccessToken()) {
      setMessage('ยังไม่พบโทเคน AREX_ACCESS_TOKEN สำหรับเชื่อมต่อ FastAPI');
      return;
    }

    setRequestingRewardId(reward.id);
    setMessage(null);
    try {
      await farmerApi.createRewardRequest({ reward_id: reward.id, quantity: 1 });
      setMessage(`ส่งคำขอแลกรางวัล ${reward.name_th} สำเร็จแล้ว`);
      await loadDashboard();
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(`ส่งคำขอแลกรางวัลไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('ส่งคำขอแลกรางวัลไม่สำเร็จ');
      }
    } finally {
      setRequestingRewardId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-on-surface">หน้าทำงานเกษตรกร</h1>
          <p className="text-sm text-on-surface-variant mt-1">แจ้งส่งวัสดุ, ยื่นขอแลกรางวัล, และติดตามผลแบบเรียลไทม์</p>
          {message && <p className="text-sm text-on-surface-variant mt-2 bg-surface-container-high px-3 py-2 rounded-lg w-fit">{message}</p>}
        </div>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          disabled={isLoading}
          className="px-4 py-2 rounded-full bg-primary text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> รีเฟรช
        </button>
      </section>

      <section className="bg-white border border-outline-variant/20 rounded-xl p-4">
        <h2 className="text-base font-semibold">ลำดับงานในกระบวนการ</h2>
        <p className="text-sm text-on-surface-variant mt-1">Step 1 แจ้งชนิด/ปริมาณวัสดุ และ Step 6 ยื่นคำขอแลกรางวัล หลังคะแนนถูกเครดิตจากโรงงาน</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant">คะแนนคงเหลือ</p>
          <p className="text-3xl font-semibold mt-2">{availablePoints.toLocaleString('th-TH')}</p>
        </div>
        <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant">รายการวัสดุทั้งหมด</p>
          <p className="text-3xl font-semibold mt-2">{stats.submissions.toLocaleString('th-TH')}</p>
        </div>
        <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant">คำขอรอคลังตรวจสอบ</p>
          <p className="text-3xl font-semibold mt-2">{stats.pendingRewards.toLocaleString('th-TH')}</p>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
            <h2 className="text-lg font-semibold mb-3">แจ้งส่งวัสดุใหม่</h2>
            <form className="grid grid-cols-1 gap-3" onSubmit={handleSubmitMaterial}>
              <select
                value={materialType}
                onChange={(event) => setMaterialType(event.target.value as CreateSubmissionPayload['material_type'])}
                className="bg-surface-container-high rounded-lg px-3 py-2 outline-none"
              >
                {MATERIAL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                value={quantityValue}
                onChange={(event) => setQuantityValue(event.target.value)}
                placeholder="ปริมาณ (ตัน)"
                className="bg-surface-container-high rounded-lg px-3 py-2 outline-none"
              />
              <input
                type="text"
                value={pickupLocation}
                onChange={(event) => setPickupLocation(event.target.value)}
                placeholder="สถานที่นัดรับ"
                className="bg-surface-container-high rounded-lg px-3 py-2 outline-none"
              />
              <button
                type="submit"
                disabled={isSubmittingMaterial}
                className="px-4 py-2 rounded-lg bg-primary text-white font-semibold disabled:opacity-60"
              >
                {isSubmittingMaterial ? 'กำลังส่ง...' : 'ส่งรายการวัสดุ'}
              </button>
            </form>
          </div>

          <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
            <h2 className="text-lg font-semibold mb-3">รายการวัสดุล่าสุด</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-on-surface-variant">
                    <th className="py-2">เวลา</th>
                    <th className="py-2">วัสดุ</th>
                    <th className="py-2">ปริมาณ</th>
                    <th className="py-2">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.slice(0, 8).map((item) => (
                    <tr key={item.id} className="border-t border-outline-variant/10">
                      <td className="py-2">{new Date(item.created_at).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="py-2">{formatMaterial(item.material_type)}</td>
                      <td className="py-2">{Number(item.quantity_value).toLocaleString('th-TH')} {item.quantity_unit}</td>
                      <td className="py-2">
                        <StatusBadge status={item.status} label={formatSubmissionStatus(item.status)} />
                      </td>
                    </tr>
                  ))}
                  {submissions.length === 0 && (
                    <tr>
                      <td className="py-3 text-on-surface-variant" colSpan={4}>ยังไม่มีรายการวัสดุ</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
            <h2 className="text-lg font-semibold mb-3">แคตตาล็อกรางวัล</h2>
            <div className="space-y-3">
              {rewardsCatalog.slice(0, 6).map((reward) => (
                <div key={reward.id} className="border border-outline-variant/15 rounded-lg p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{reward.name_th}</p>
                    <p className="text-xs text-on-surface-variant">{Number(reward.points_cost).toLocaleString('th-TH')} คะแนน</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCreateRewardRequest(reward)}
                    disabled={requestingRewardId === reward.id}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold bg-surface-container-high hover:bg-primary hover:text-white disabled:opacity-60"
                  >
                    {requestingRewardId === reward.id ? 'กำลังส่ง...' : 'ขอแลก'}
                  </button>
                </div>
              ))}
              {rewardsCatalog.length === 0 && <p className="text-sm text-on-surface-variant">ยังไม่มีรางวัลในระบบ</p>}
            </div>
          </div>

          <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
            <h2 className="text-lg font-semibold mb-3">สถานะคำขอแลกรางวัล</h2>
            <div className="space-y-3">
              {rewardRequests.slice(0, 8).map((request) => {
                const deliveryJob = request.reward_delivery_jobs?.[0] ?? null;
                const rewardName = rewardNameById[request.reward_id] ?? 'รางวัลที่เลือก';
                return (
                  <div key={request.id} className="border border-outline-variant/15 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{rewardName}</p>
                        <p className="text-xs text-on-surface-variant">ใช้ {Number(request.requested_points).toLocaleString('th-TH')} คะแนน • จำนวน {Number(request.quantity).toLocaleString('th-TH')}</p>
                      </div>
                      <p className="text-xs text-on-surface-variant">
                        {new Date(request.requested_at).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <div className="mt-2 text-sm flex items-center gap-2">
                      {request.status === 'warehouse_rejected' ? (
                        <XCircle className="w-4 h-4 text-red-600" />
                      ) : request.status === 'warehouse_approved' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Clock3 className="w-4 h-4 text-amber-600" />
                      )}
                      <StatusBadge status={request.status} label={formatRewardRequestStatus(request.status)} />
                    </div>

                    {deliveryJob && (
                      <div className="mt-1 text-sm flex items-center gap-2">
                        <Truck className="w-4 h-4" />
                        <StatusBadge status={deliveryJob.status} label={formatDeliveryStatus(deliveryJob.status)} />
                      </div>
                    )}

                    {request.rejection_reason && (
                      <p className="mt-2 text-xs text-red-700">เหตุผลที่ปฏิเสธ: {request.rejection_reason}</p>
                    )}
                  </div>
                );
              })}
              {rewardRequests.length === 0 && <p className="text-sm text-on-surface-variant">ยังไม่มีคำขอแลกรางวัล</p>}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
