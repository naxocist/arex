import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  Gift,
  Ticket,
  Truck,
  XCircle,
} from 'lucide-react';
import AlertBanner from '@/src/components/AlertBanner';
import EmptyState from '@/src/components/EmptyState';
import PageHeader from '@/src/components/PageHeader';
import SectionCard from '@/src/components/SectionCard';
import StatCard from '@/src/components/StatCard';
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

function inferMessageTone(message: string | null): 'info' | 'success' | 'error' {
  if (!message) {
    return 'info';
  }
  if (message.includes('ไม่สำเร็จ') || message.includes('แต้มไม่พอ') || message.includes('ยังไม่')) {
    return 'error';
  }
  if (message.includes('สำเร็จ')) {
    return 'success';
  }
  return 'info';
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
      setMessage(`แต้มไม่พอสำหรับ ${reward.name_th}`);
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
      <PageHeader
        eyebrow="Rewards"
        title="ใช้ PMUC Coin กับรางวัลที่พร้อมแลก และติดตามการจัดส่งได้ในหน้าเดียว"
        description="พื้นที่นี้ถูกออกแบบให้เกษตรกรเห็นแต้มคงเหลือก่อน แล้วค่อยตัดสินใจเลือกรางวัลที่เหมาะสม พร้อมติดตามคำขอและสถานะการจัดส่งได้ทันที"
        actions={[
          {
            label: 'กลับไปงานวัสดุ',
            to: '/',
            variant: 'secondary',
          },
          {
            label: isLoading ? 'กำลังรีเฟรช...' : 'รีเฟรชข้อมูล',
            onClick: () => void loadRewards(true),
          },
        ]}
      />

      {message ? <AlertBanner message={message} tone={inferMessageTone(message)} /> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="PMUC Coin คงเหลือ" value={availablePoints.toLocaleString('th-TH')} detail="แต้มที่พร้อมใช้แลกของรางวัลได้ทันที" icon={Ticket} tone="violet" />
        <StatCard label="คำขอทั้งหมด" value={stats.allRequests.toLocaleString('th-TH')} detail="รวมทุกสถานะที่เคยยื่นคำขอ" icon={Gift} tone="default" />
        <StatCard label="รอตรวจสอบ" value={stats.waitingReview.toLocaleString('th-TH')} detail="คำขอที่กำลังรอฝ่ายคลังตัดสินใจ" icon={Clock3} tone="amber" />
        <StatCard label="ส่งมอบสำเร็จ" value={stats.delivered.toLocaleString('th-TH')} detail="รางวัลที่ส่งถึงมือเกษตรกรแล้ว" icon={Truck} tone="emerald" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.96fr,1.04fr]">
        <SectionCard
          title="เลือกของรางวัล"
          description="แคตตาล็อกนี้เน้นให้เห็นแต้มที่ต้องใช้และสต็อกคงเหลืออย่างชัดเจนก่อนกดขอแลก"
        >
          {rewardsCatalog.length === 0 ? (
            <EmptyState
              title="ยังไม่มีรางวัลในระบบ"
              description="เมื่อมีรายการรางวัลเปิดใช้งาน ระบบจะแสดงตัวเลือกที่นี่พร้อมแต้มที่ต้องใช้"
              icon={Gift}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {rewardsCatalog.map((reward) => {
                const rewardPoints = Number(reward.points_cost) || 0;
                const stockQty = Number(reward.stock_qty) || 0;
                const isInsufficientPoints = availablePoints < rewardPoints;
                const isUnavailable = !reward.active || stockQty <= 0;

                return (
                  <article key={reward.id} className="rounded-xl bg-surface-container-low p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-stone-900">{reward.name_th}</p>
                        <p className="mt-2 text-sm leading-6 text-stone-600">
                          {reward.description_th || 'ไม่มีรายละเอียดเพิ่มเติม'}
                        </p>
                      </div>
                      <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-700">
                        {rewardPoints.toLocaleString('th-TH')} แต้ม
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                      <div className="rounded-xl bg-white px-3 py-2 text-stone-700">
                        สต็อกคงเหลือ {stockQty.toLocaleString('th-TH')}
                      </div>
                      <StatusBadge
                        status={isUnavailable ? 'cancelled' : isInsufficientPoints ? 'requested' : 'warehouse_approved'}
                        label={isUnavailable ? 'ของหมด / ปิดใช้งาน' : isInsufficientPoints ? 'แต้มไม่พอ' : 'พร้อมขอแลก'}
                        size="sm"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleCreateRewardRequest(reward)}
                      disabled={requestingRewardId === reward.id || isInsufficientPoints || isUnavailable}
                      className="mt-4 inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Gift className="h-4 w-4" />
                      <span>
                        {requestingRewardId === reward.id
                          ? 'กำลังส่งคำขอ...'
                          : isUnavailable
                            ? 'ยังแลกไม่ได้'
                            : isInsufficientPoints
                              ? 'แต้มไม่พอ'
                              : 'ขอแลกรางวัลนี้'}
                      </span>
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="ติดตามคำขอแลกรางวัล"
          description="ดูคำขอที่รอคลังพิจารณา ตรวจสถานะการจัดส่ง และยกเลิกคำขอที่ยังไม่ผ่านการอนุมัติได้จากตรงนี้"
          actions={
            <div className="flex flex-wrap gap-2">
              {REWARD_REQUEST_STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatusFilter(option.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    statusFilter === option.value
                      ? 'bg-stone-950 text-white'
                      : 'border border-line bg-surface-muted text-stone-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          }
        >
          {filteredRewardRequests.length === 0 ? (
            <EmptyState
              title="ยังไม่มีคำขอตามตัวกรองนี้"
              description="เมื่อคุณกดขอแลกรางวัล ประวัติและสถานะการจัดส่งจะเริ่มแสดงที่นี่ทันที"
              icon={Truck}
            />
          ) : (
            <div className="space-y-4">
              {filteredRewardRequests.map((request) => {
                const deliveryJob = request.reward_delivery_jobs?.[0] ?? null;
                const rewardName = rewardNameById[request.reward_id] ?? 'รางวัลที่เลือก';
                const canCancel = request.status === 'requested';

                return (
                  <article key={request.id} className="rounded-xl bg-surface-container-low p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-stone-900">{rewardName}</p>
                          <StatusBadge status={request.status} label={formatRewardRequestStatus(request.status)} size="sm" />
                        </div>
                        <p className="mt-2 text-sm leading-6 text-stone-600">
                          ใช้ {Number(request.requested_points).toLocaleString('th-TH')} PMUC Coin • จำนวน{' '}
                          {Number(request.quantity).toLocaleString('th-TH')} ชิ้น
                        </p>
                        <p className="mt-1 text-sm text-stone-500">ยื่นคำขอเมื่อ {formatDateTime(request.requested_at)}</p>
                      </div>

                      {canCancel ? (
                        <button
                          type="button"
                          onClick={() => void handleCancelRewardRequest(request.id)}
                          disabled={cancellingRewardRequestId === request.id}
                          className="inline-flex items-center gap-2 rounded-full border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 transition hover:bg-red-100 disabled:opacity-60"
                        >
                          <XCircle className="h-4 w-4" />
                          <span>{cancellingRewardRequestId === request.id ? 'กำลังยกเลิก...' : 'ยกเลิกคำขอ'}</span>
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl bg-white px-4 py-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                          {request.status === 'warehouse_rejected' || request.status === 'cancelled' ? (
                            <XCircle className="h-4 w-4 text-red-600" />
                          ) : request.status === 'warehouse_approved' ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Clock3 className="h-4 w-4 text-amber-600" />
                          )}
                          <span>สถานะคำขอ</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-stone-600">{formatRewardRequestStatus(request.status)}</p>
                        {request.status === 'warehouse_rejected' && request.rejection_reason ? (
                          <p className="mt-2 text-sm leading-6 text-red-700">เหตุผลที่ปฏิเสธ: {request.rejection_reason}</p>
                        ) : null}
                      </div>

                      <div className="rounded-xl bg-white px-4 py-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                          <Truck className="h-4 w-4" />
                          <span>สถานะการจัดส่ง</span>
                        </div>
                        {deliveryJob ? (
                          <>
                            <div className="mt-2">
                              <StatusBadge status={deliveryJob.status} label={formatDeliveryStatus(deliveryJob.status)} size="sm" />
                            </div>
                            <p className="mt-2 text-sm leading-6 text-stone-600">
                              ช่วงนำส่ง {formatDateTime(deliveryJob.planned_delivery_at)} -{' '}
                              {formatDateTime(deliveryJob.delivery_window_end_at ?? null)}
                            </p>
                          </>
                        ) : (
                          <p className="mt-2 text-sm leading-6 text-stone-600">ยังไม่มีการจัดรอบส่งสำหรับคำขอนี้</p>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

    </div>
  );
}
