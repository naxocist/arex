import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, RefreshCw, Truck, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import StatusBadge from '@/src/components/StatusBadge';
import {
  ApiError,
  farmerApi,
  type FarmerRewardItem,
  type FarmerRewardRequestItem,
} from '@/src/lib/apiClient';

function hasAccessToken(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return Boolean(localStorage.getItem('AREX_ACCESS_TOKEN'));
}

function formatRewardRequestStatus(status: string): string {
  const map: Record<string, string> = {
    requested: 'รอคลังตรวจสอบ',
    warehouse_approved: 'คลังอนุมัติแล้ว',
    warehouse_rejected: 'คลังปฏิเสธ',
    cancelled: 'ยกเลิกโดยเกษตรกร',
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

const REWARD_REQUEST_STATUS_OPTIONS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'requested', label: 'รอคลังตรวจสอบ' },
  { value: 'warehouse_approved', label: 'คลังอนุมัติแล้ว' },
  { value: 'warehouse_rejected', label: 'คลังปฏิเสธ' },
  { value: 'cancelled', label: 'ยกเลิกโดยเกษตรกร' },
] as const;

export default function FarmerRewards() {
  const [availablePoints, setAvailablePoints] = useState(0);
  const [rewardsCatalog, setRewardsCatalog] = useState<FarmerRewardItem[]>([]);
  const [rewardRequests, setRewardRequests] = useState<FarmerRewardRequestItem[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [requestingRewardId, setRequestingRewardId] = useState<string | null>(null);
  const [cancellingRewardRequestId, setCancellingRewardRequestId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<(typeof REWARD_REQUEST_STATUS_OPTIONS)[number]['value']>('all');

  const rewardNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const reward of rewardsCatalog) {
      map[reward.id] = reward.name_th;
    }
    return map;
  }, [rewardsCatalog]);

  const filteredRewardRequests = useMemo(() => {
    if (statusFilter === 'all') {
      return rewardRequests;
    }
    return rewardRequests.filter((request) => request.status === statusFilter);
  }, [rewardRequests, statusFilter]);

  const stats = useMemo(() => {
    return {
      allRequests: rewardRequests.length,
      waitingReview: rewardRequests.filter((request) => request.status === 'requested').length,
      approved: rewardRequests.filter((request) => request.status === 'warehouse_approved').length,
      delivered: rewardRequests.filter((request) =>
        request.reward_delivery_jobs?.some((job) => job.status === 'reward_delivered'),
      ).length,
    };
  }, [rewardRequests]);

  const loadRewards = async (forceRefresh = false) => {
    if (!hasAccessToken()) {
      setMessage('ยังไม่พบโทเคน AREX_ACCESS_TOKEN กรุณาเข้าสู่ระบบที่หน้าเลือกผู้ใช้งาน');
      return;
    }

    setIsLoading(true);
    try {
      const [pointsResponse, rewardsResponse, rewardRequestsResponse] = await Promise.all([
        farmerApi.getPoints({ forceRefresh }),
        farmerApi.listRewards({ forceRefresh }),
        farmerApi.listRewardRequests({ forceRefresh }),
      ]);

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
    void loadRewards();
  }, []);

  const handleCreateRewardRequest = async (reward: FarmerRewardItem) => {
    if (!hasAccessToken()) {
      setMessage('ยังไม่พบโทเคน AREX_ACCESS_TOKEN สำหรับเชื่อมต่อ FastAPI');
      return;
    }

    const rewardPoints = Number(reward.points_cost) || 0;
    if (availablePoints < rewardPoints) {
      return;
    }

    const pointsAfterExchange = availablePoints - rewardPoints;
    const confirmed =
      typeof window === 'undefined'
        ? true
        : window.confirm(
            [
              'ยืนยันการขอแลกรางวัล',
              `ของรางวัล: ${reward.name_th}`,
              'จำนวน: 1',
              `แต้มที่ใช้: ${rewardPoints.toLocaleString('th-TH')} PMUC Coin`,
              `แต้มคงเหลือหลังแลก: ${pointsAfterExchange.toLocaleString('th-TH')} PMUC Coin`,
            ].join('\n'),
          );

    if (!confirmed) {
      return;
    }

    setRequestingRewardId(reward.id);
    setMessage(null);
    try {
      await farmerApi.createRewardRequest({ reward_id: reward.id, quantity: 1 });
      setMessage(`ส่งคำขอแลกรางวัล ${reward.name_th} สำเร็จแล้ว`);
      await loadRewards(true);
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

  const handleCancelRewardRequest = async (requestId: string) => {
    if (!hasAccessToken()) {
      setMessage('ยังไม่พบโทเคน AREX_ACCESS_TOKEN สำหรับเชื่อมต่อ FastAPI');
      return;
    }

    setCancellingRewardRequestId(requestId);
    setMessage(null);
    try {
      await farmerApi.cancelRewardRequest(requestId);
      setMessage('ยกเลิกคำขอแลกรางวัลสำเร็จแล้ว และคืนแต้มที่จองไว้เรียบร้อย');
      await loadRewards(true);
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(`ยกเลิกคำขอไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('ยกเลิกคำขอไม่สำเร็จ');
      }
    } finally {
      setCancellingRewardRequestId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-on-surface">หน้าการแลกของรางวัล</h1>
          <p className="text-sm text-on-surface-variant mt-1">จัดการการแลกแต้ม, ติดตามสถานะการอนุมัติ และติดตามการนำส่ง</p>
          {message && <p className="text-sm text-on-surface-variant mt-2 bg-surface-container-high px-3 py-2 rounded-lg w-fit">{message}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="px-4 py-2 rounded-full bg-surface-container-high text-on-surface text-sm font-medium"
          >
            กลับไปงานวัสดุ
          </Link>
          <button
            type="button"
            onClick={() => void loadRewards(true)}
            disabled={isLoading}
            className="px-4 py-2 rounded-full bg-primary text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> รีเฟรช
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant">PMUC Coin คงเหลือ</p>
          <p className="text-3xl font-semibold mt-2">{availablePoints.toLocaleString('th-TH')}</p>
        </div>
        <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant">คำขอทั้งหมด</p>
          <p className="text-3xl font-semibold mt-2">{stats.allRequests.toLocaleString('th-TH')}</p>
        </div>
        <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant">รอตรวจสอบ</p>
          <p className="text-3xl font-semibold mt-2">{stats.waitingReview.toLocaleString('th-TH')}</p>
        </div>
        <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant">ส่งมอบสำเร็จ</p>
          <p className="text-3xl font-semibold mt-2">{stats.delivered.toLocaleString('th-TH')}</p>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white border border-outline-variant/20 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-3">แคตตาล็อกรางวัล</h2>
          <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
            {rewardsCatalog.map((reward) => {
              const rewardPoints = Number(reward.points_cost) || 0;
              const isInsufficientPoints = availablePoints < rewardPoints;

              return (
                <div key={reward.id} className="border border-outline-variant/15 rounded-lg p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{reward.name_th}</p>
                    <p className="text-xs text-on-surface-variant">{rewardPoints.toLocaleString('th-TH')} PMUC Coin</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCreateRewardRequest(reward)}
                    disabled={requestingRewardId === reward.id || isInsufficientPoints}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold bg-surface-container-high hover:bg-primary hover:text-white disabled:opacity-60 disabled:hover:bg-surface-container-high disabled:hover:text-on-surface"
                  >
                    {requestingRewardId === reward.id
                      ? 'กำลังส่ง...'
                      : isInsufficientPoints
                        ? 'แต้มไม่พอ'
                        : 'ขอแลก'}
                  </button>
                </div>
              );
            })}
            {rewardsCatalog.length === 0 && <p className="text-sm text-on-surface-variant">ยังไม่มีรางวัลในระบบ</p>}
          </div>
        </div>

        <div className="bg-white border border-outline-variant/20 rounded-xl p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
            <h2 className="text-lg font-semibold">สถานะคำขอแลกรางวัล</h2>
            <div className="flex items-center gap-2">
              <label htmlFor="rewardStatusFilter" className="text-sm text-on-surface-variant">กรองสถานะ</label>
              <select
                id="rewardStatusFilter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as (typeof REWARD_REQUEST_STATUS_OPTIONS)[number]['value'])}
                className="bg-surface-container-high rounded-lg px-3 py-2 outline-none text-sm"
              >
                {REWARD_REQUEST_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-xs text-on-surface-variant mb-3">
            แสดง {filteredRewardRequests.length.toLocaleString('th-TH')} จาก {rewardRequests.length.toLocaleString('th-TH')} รายการ
          </p>

          <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
            {filteredRewardRequests.map((request) => {
              const deliveryJob = request.reward_delivery_jobs?.[0] ?? null;
              const rewardName = rewardNameById[request.reward_id] ?? 'รางวัลที่เลือก';
              return (
                <div key={request.id} className="border border-outline-variant/15 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{rewardName}</p>
                      <p className="text-xs text-on-surface-variant">
                        ใช้ {Number(request.requested_points).toLocaleString('th-TH')} PMUC Coin • จำนวน {Number(request.quantity).toLocaleString('th-TH')}
                      </p>
                    </div>
                    <p className="text-xs text-on-surface-variant">
                      {new Date(request.requested_at).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="text-sm flex items-center gap-2">
                      {request.status === 'warehouse_rejected' || request.status === 'cancelled' ? (
                        <XCircle className="w-4 h-4 text-red-600" />
                      ) : request.status === 'warehouse_approved' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Clock3 className="w-4 h-4 text-amber-600" />
                      )}
                      <StatusBadge status={request.status} label={formatRewardRequestStatus(request.status)} />
                    </div>

                    {request.status === 'requested' && (
                      <button
                        type="button"
                        onClick={() => void handleCancelRewardRequest(request.id)}
                        disabled={cancellingRewardRequestId === request.id}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-red-300 bg-red-50 text-red-800 hover:bg-red-100 disabled:opacity-60"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        {cancellingRewardRequestId === request.id ? 'กำลังยกเลิกคำขอ...' : 'ยกเลิกคำขอนี้'}
                      </button>
                    )}
                  </div>

                  {deliveryJob && (
                    <div className="mt-1 space-y-1">
                      <div className="text-sm flex items-center gap-2">
                        <Truck className="w-4 h-4" />
                        <StatusBadge status={deliveryJob.status} label={formatDeliveryStatus(deliveryJob.status)} />
                      </div>
                      <p className="text-xs text-on-surface-variant">
                        ช่วงนำส่ง: {formatDateTime(deliveryJob.planned_delivery_at)} - {formatDateTime(deliveryJob.delivery_window_end_at ?? null)}
                      </p>
                    </div>
                  )}

                  {request.status === 'warehouse_rejected' && request.rejection_reason && (
                    <p className="mt-2 text-xs text-red-700">เหตุผลที่ปฏิเสธ: {request.rejection_reason}</p>
                  )}
                </div>
              );
            })}
            {filteredRewardRequests.length === 0 && (
              <p className="text-sm text-on-surface-variant">ไม่พบคำขอตามสถานะที่เลือก</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
