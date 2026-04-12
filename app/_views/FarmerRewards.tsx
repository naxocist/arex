'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  Gift,
  Ticket,
  Truck,
  XCircle,
} from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import ConfirmDialog from '@/app/_components/ConfirmDialog';
import EmptyState from '@/app/_components/EmptyState';
import SectionCard from '@/app/_components/SectionCard';
import StatCard from '@/app/_components/StatCard';
import StatusBadge from '@/app/_components/StatusBadge';
import {
  ApiError,
  farmerApi,
  type FarmerRewardItem,
  type FarmerRewardRequestItem,
} from '@/app/_lib/apiClient';

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
    cancelled: 'ยกเลิก',
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

function DeliveryTimeline({ deliveryJob }: { deliveryJob: NonNullable<FarmerRewardRequestItem['reward_delivery_jobs']>[0] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const steps = [
    { status: 'reward_delivery_scheduled', label: 'จัดรอบส่ง', time: deliveryJob.planned_delivery_at },
    { status: 'out_for_delivery', label: 'กำลังนำส่ง', time: deliveryJob.out_for_delivery_at },
    { status: 'reward_delivered', label: 'ส่งมอบสำเร็จ', time: deliveryJob.delivered_at },
  ];

  const currentStatusIndex = steps.findIndex(s => s.status === deliveryJob.status);
  const isDelivered = deliveryJob.status === 'reward_delivered';
  const statusLabel = isDelivered ? 'ส่งมอบสำเร็จ' : formatDeliveryStatus(deliveryJob.status);

  return (
    <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/50">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left transition hover:bg-emerald-50"
      >
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-medium text-stone-700">สถานะจัดส่ง</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            isDelivered ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {statusLabel}
          </span>
        </div>
        <span className={`text-xs text-stone-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      {isExpanded && (
        <div className="border-t border-emerald-100 px-4 pb-4 pt-3">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const isCompleted = index <= currentStatusIndex;
              const isCurrent = index === currentStatusIndex;
              return (
                <React.Fragment key={step.status}>
                  <div className="flex flex-1 flex-col items-center">
                    <div className={`relative flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                      isDelivered && index === steps.length - 1
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : isCompleted
                          ? 'border-emerald-500 bg-white text-emerald-600'
                          : 'border-stone-200 bg-white text-stone-300'
                    }`}>
                      {isDelivered && index === steps.length - 1 ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="text-xs font-bold">{index + 1}</span>
                      )}
                      {isCurrent && !isDelivered && (
                        <span className="absolute -bottom-1 h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                      )}
                    </div>
                    <span className={`mt-2 text-xs font-medium ${isCompleted ? 'text-stone-700' : 'text-stone-400'}`}>
                      {step.label}
                    </span>
                    {step.time && (
                      <span className="mt-0.5 text-[0.65rem] text-stone-400">
                        {formatDateTime(step.time)}
                      </span>
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`relative top-4 h-0.5 flex-1 ${index < currentStatusIndex ? 'bg-emerald-400' : 'bg-stone-200'}`}>
                      {index < currentStatusIndex && (
                        <div className="absolute inset-0 bg-emerald-400" />
                      )}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
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

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

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
    setConfirmDialog({
      open: true,
      title: 'ยืนยันการขอแลกรางวัล',
      message: `ของรางวัล: ${reward.name_th}\nจำนวน: 1\nแต้มที่ใช้: ${rewardPoints.toLocaleString('th-TH')} PMUC Coin\nแต้มคงเหลือหลังแลก: ${pointsAfterExchange.toLocaleString('th-TH')} PMUC Coin`,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, open: false }));
        await submitRewardRequest(reward);
      },
    });
  };

  const submitRewardRequest = async (reward: FarmerRewardItem) => {
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
    <div className="space-y-4">
      <div className="flex gap-2">
        <a href="/farmer" className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700">กลับ</a>
        <button onClick={() => void loadRewards(true)} disabled={isLoading} className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700">
          {isLoading ? '...' : 'รีเฟรช'}
        </button>
      </div>

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
            <div className="space-y-2">
              {rewardsCatalog.map((reward) => {
                const rewardPoints = Number(reward.points_cost) || 0;
                const stockQty = Number(reward.stock_qty) || 0;
                const isInsufficientPoints = availablePoints < rewardPoints;
                const isUnavailable = !reward.active || stockQty <= 0;
                const canApply = !isInsufficientPoints && !isUnavailable;

                return (
                  <div key={reward.id} className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-white p-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="whitespace-nowrap font-semibold text-stone-900">{reward.name_th}</span>
                      <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${isInsufficientPoints ? 'bg-stone-100 text-stone-400' : 'bg-violet-50 text-violet-700'}`}>
                        {rewardPoints.toLocaleString('th-TH')} แต้ม
                      </span>
                      <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${stockQty <= 10 ? 'bg-amber-50 text-amber-600' : 'bg-stone-100 text-stone-500'}`}>
                        {stockQty.toLocaleString('th-TH')} ชิ้น
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCreateRewardRequest(reward)}
                      disabled={requestingRewardId === reward.id || !canApply}
                      className="rounded-lg bg-stone-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-40"
                    >
                      {requestingRewardId === reward.id
                        ? '...'
                        : isUnavailable
                          ? 'ไม่ได้'
                          : isInsufficientPoints
                            ? 'แต้มไม่พอ'
                            : 'ขอแลก'}
                    </button>
                  </div>
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
            <div className="space-y-2">
              {filteredRewardRequests.map((request) => {
                const deliveryJob = request.reward_delivery_jobs?.[0] ?? null;
                const rewardName = rewardNameById[request.reward_id] ?? 'รางวัลที่เลือก';
                const canCancel = request.status === 'requested';
                const hasDeliveryJob = deliveryJob && deliveryJob.status !== 'cancelled';

                return (
                  <div key={request.id} className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-stone-900">
                          {rewardName}
                          <span className="ml-2 text-stone-500">{Number(request.quantity)} ชิ้น • {Number(request.requested_points).toLocaleString('th-TH')} แต้ม</span>
                        </p>
                        <p className="truncate text-xs text-stone-500">
                          {formatRewardRequestStatus(request.status)} • {formatDateTime(request.requested_at)}
                        </p>
                      </div>
                      {canCancel && (
                        <button
                          type="button"
                          onClick={() => void handleCancelRewardRequest(request.id)}
                          disabled={cancellingRewardRequestId === request.id}
                          className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700"
                        >
                          ยกเลิก
                        </button>
                      )}
                      <StatusBadge status={request.status} label={formatRewardRequestStatus(request.status)} size="sm" />
                    </div>
                    {request.status === 'warehouse_approved' && !hasDeliveryJob && (
                      <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2">
                        <Clock3 className="h-4 w-4 text-amber-600" />
                        <span className="text-xs font-medium text-amber-700">รอฝ่ายขนส่งจัดรอบส่ง</span>
                      </div>
                    )}
                    {hasDeliveryJob && (
                      <DeliveryTimeline deliveryJob={deliveryJob} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="ยืนยัน"
        cancelLabel="ยกเลิก"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
