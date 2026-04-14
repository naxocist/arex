'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  CheckCheck,
  ChevronDown,
  Clock3,
  Coins,
  Gift,
  MapPin,
  RefreshCw,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import Image from 'next/image';
import AlertBanner from '@/app/_components/AlertBanner';
import ConfirmDialog from '@/app/_components/ConfirmDialog';
import EmptyState from '@/app/_components/EmptyState';
import ErrorBoundary from '@/app/_components/ErrorBoundary';
import dynamic from 'next/dynamic';
const PickupLocationMapPicker = dynamic(() => import('@/app/_components/PickupLocationMapPicker'), { ssr: false });
import { SkeletonCard } from '@/app/_components/Skeleton';
import StatusBadge from '@/app/_components/StatusBadge';
import {
  ApiError,
  farmerApi,
  type FarmerRewardItem,
  type FarmerRewardRequestItem,
} from '@/app/_lib/apiClient';

function hasAccessToken(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem('AREX_ACCESS_TOKEN'));
}

function formatRewardRequestStatus(status: string): string {
  const map: Record<string, string> = {
    requested: 'รอคลังตรวจสอบ',
    warehouse_approved: 'คลังอนุมัติแล้ว',
    warehouse_rejected: 'คลังปฏิเสธ',
    cancelled: 'ยกเลิกแล้ว',
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
  if (!dateTime) return '-';
  return new Date(dateTime).toLocaleString('th-TH', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function inferMessageTone(message: string | null): 'info' | 'success' | 'error' {
  if (!message) return 'info';
  if (message.includes('ไม่สำเร็จ') || message.includes('แต้มไม่พอ') || message.includes('ยังไม่')) return 'error';
  if (message.includes('สำเร็จ')) return 'success';
  return 'info';
}

/* ── Reward image with graceful fallback ── */
function RewardImage({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  const [errored, setErrored] = useState(false);
  if (src && !errored) {
    return (
      <div className={`relative overflow-hidden bg-stone-100 ${className ?? ''}`}>
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          className="object-cover"
          onError={() => setErrored(true)}
          sizes="(max-width: 768px) 50vw, 200px"
        />
      </div>
    );
  }
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br from-emerald-50 to-stone-100 ${className ?? ''}`}>
      <Gift className="h-8 w-8 text-emerald-200" />
    </div>
  );
}

/* ── Delivery progress tracker ── */
function DeliveryProgress({
  deliveryJob,
}: {
  deliveryJob: NonNullable<FarmerRewardRequestItem['reward_delivery_jobs']>[0];
}) {
  const steps = [
    { status: 'reward_delivery_scheduled', label: 'จัดรอบส่ง', time: deliveryJob.planned_delivery_at },
    { status: 'out_for_delivery', label: 'กำลังนำส่ง', time: deliveryJob.out_for_delivery_at },
    { status: 'reward_delivered', label: 'ส่งมอบแล้ว', time: deliveryJob.delivered_at },
  ];
  const currentIdx = steps.findIndex((s) => s.status === deliveryJob.status);
  const isDelivered = deliveryJob.status === 'reward_delivered';

  return (
    <div className="rounded-2xl bg-stone-50 px-4 py-3.5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-400">ติดตามการจัดส่ง</p>
      <div className="flex items-center justify-between">
        {steps.map((step, i) => {
          const done = i <= currentIdx;
          const current = i === currentIdx && !isDelivered;
          return (
            <React.Fragment key={step.status}>
              <div className="flex flex-1 flex-col items-center gap-1.5">
                <div className={`relative flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  isDelivered && i === steps.length - 1
                    ? 'bg-emerald-500 text-white'
                    : done ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-stone-100 text-stone-300'
                }`}>
                  {isDelivered && i === steps.length - 1
                    ? <CheckCheck className="h-4 w-4" />
                    : <span>{i + 1}</span>}
                  {current && (
                    <span className="absolute -bottom-0.5 h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                  )}
                </div>
                <span className={`text-center text-[0.65rem] font-medium leading-tight ${done ? 'text-stone-600' : 'text-stone-300'}`}>
                  {step.label}
                </span>
                {step.time && (
                  <span className="text-center text-[0.6rem] leading-tight text-stone-400">{formatDateTime(step.time)}</span>
                )}
              </div>
              {i < steps.length - 1 && (
                <div className={`-mt-7 h-0.5 flex-1 rounded-full ${i < currentIdx ? 'bg-emerald-300' : 'bg-stone-200'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

const FILTER_OPTIONS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'active', label: 'กำลังดำเนินการ' },
  { value: 'done', label: 'เสร็จสิ้น' },
] as const;
type FilterValue = (typeof FILTER_OPTIONS)[number]['value'];

const ACTIVE_REQUEST_STATUSES = new Set(['requested', 'warehouse_approved']);

export default function FarmerRewards() {
  const reduceMotion = useReducedMotion();

  const [availablePoints, setAvailablePoints] = useState(0);
  const [rewardsCatalog, setRewardsCatalog] = useState<FarmerRewardItem[]>([]);
  const [rewardRequests, setRewardRequests] = useState<FarmerRewardRequestItem[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [requestingRewardId, setRequestingRewardId] = useState<string | null>(null);
  const [cancellingRewardRequestId, setCancellingRewardRequestId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  type ReqSortCol = 'date' | 'points' | 'status';
  type ReqSortDir = 'asc' | 'desc';
  const [reqSortCol, setReqSortCol] = useState<ReqSortCol>('date');
  const [reqSortDir, setReqSortDir] = useState<ReqSortDir>('desc');

  // Detail sheet
  const [selectedReward, setSelectedReward] = useState<FarmerRewardItem | null>(null);
  const [rewardQty, setRewardQty] = useState(1);

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; message: string; fields?: { label: string; value: string }[]; onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const [locationPicker, setLocationPicker] = useState<{
    open: boolean; reward: FarmerRewardItem | null; locationText: string; lat: number | null; lng: number | null;
  }>({ open: false, reward: null, locationText: '', lat: null, lng: null });

  const rewardNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const reward of rewardsCatalog) map[reward.id] = reward.name_th;
    return map;
  }, [rewardsCatalog]);

  const filteredRequests = useMemo(() => {
    let list = rewardRequests;
    if (filter === 'active') list = list.filter((r) => ACTIVE_REQUEST_STATUSES.has(r.status));
    else if (filter === 'done') list = list.filter((r) => !ACTIVE_REQUEST_STATUSES.has(r.status));
    const dir = reqSortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (reqSortCol === 'points') return ((Number(a.requested_points) || 0) - (Number(b.requested_points) || 0)) * dir;
      if (reqSortCol === 'status') return (a.status.localeCompare(b.status)) * dir;
      return (new Date(a.requested_at ?? 0).getTime() - new Date(b.requested_at ?? 0).getTime()) * dir;
    });
  }, [rewardRequests, filter, reqSortCol, reqSortDir]);

  const activeCount = useMemo(
    () => rewardRequests.filter((r) => ACTIVE_REQUEST_STATUSES.has(r.status)).length,
    [rewardRequests],
  );

  const loadRewards = async (forceRefresh = false) => {
    if (!hasAccessToken()) {
      setMessage('ยังไม่พบโทเคน AREX_ACCESS_TOKEN กรุณาเข้าสู่ระบบที่หน้าเลือกผู้ใช้งาน');
      return;
    }
    setIsLoading(true);
    try {
      const [pointsRes, rewardsRes, requestsRes] = await Promise.all([
        farmerApi.getPoints({ forceRefresh }),
        farmerApi.listRewards({ forceRefresh }),
        farmerApi.listRewardRequests({ forceRefresh }),
      ]);
      setAvailablePoints(pointsRes.available_points);
      setRewardsCatalog(rewardsRes.rewards);
      setRewardRequests(requestsRes.requests);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof ApiError ? `โหลดข้อมูลไม่สำเร็จ: ${error.message}` : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadRewards(); }, []);

  const handleCreateRewardRequest = (reward: FarmerRewardItem, qty: number) => {
    if (!hasAccessToken()) { setMessage('ยังไม่พบโทเคน AREX_ACCESS_TOKEN สำหรับเชื่อมต่อ FastAPI'); return; }
    const pts = Number(reward.points_cost) || 0;
    if (availablePoints < pts * qty) { setMessage(`แต้มไม่พอสำหรับ ${reward.name_th}`); return; }
    setLocationPicker({ open: true, reward, locationText: '', lat: null, lng: null });
  };

  const handleLocationConfirmed = (locationText: string, lat: number | null, lng: number | null) => {
    const reward = locationPicker.reward;
    if (!reward) return;
    setLocationPicker((prev) => ({ ...prev, open: false }));
    const pts = Number(reward.points_cost) || 0;
    const totalCost = pts * rewardQty;
    const after = availablePoints - totalCost;
    setConfirmDialog({
      open: true,
      title: 'ยืนยันการขอแลกรางวัล',
      message: '',
      fields: [
        { label: 'ของรางวัล', value: reward.name_th },
        { label: 'จำนวน', value: `${rewardQty} ชิ้น` },
        { label: 'แต้มที่ใช้', value: `${totalCost.toLocaleString('th-TH')} PMUC Coin` },
        { label: 'แต้มคงเหลือหลังแลก', value: `${after.toLocaleString('th-TH')} PMUC Coin` },
        { label: 'สถานที่รับ', value: locationText || '(ไม่ระบุ)' },
      ],
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, open: false }));
        await submitRewardRequest(reward, rewardQty, locationText, lat, lng);
      },
    });
  };

  const submitRewardRequest = async (
    reward: FarmerRewardItem,
    qty: number,
    deliveryLocationText: string,
    deliveryLat: number | null,
    deliveryLng: number | null,
  ) => {
    setRequestingRewardId(reward.id);
    setMessage(null);
    try {
      await farmerApi.createRewardRequest({
        reward_id: reward.id,
        quantity: qty,
        delivery_location_text: deliveryLocationText || null,
        delivery_lat: deliveryLat,
        delivery_lng: deliveryLng,
      });
      setMessage(`ส่งคำขอแลกรางวัล ${reward.name_th} สำเร็จแล้ว`);
      await loadRewards(true);
    } catch (error) {
      setMessage(error instanceof ApiError ? `ส่งคำขอแลกรางวัลไม่สำเร็จ: ${error.message}` : 'ส่งคำขอแลกรางวัลไม่สำเร็จ');
    } finally {
      setRequestingRewardId(null);
    }
  };

  const handleCancelRewardRequest = async (requestId: string) => {
    if (!hasAccessToken()) { setMessage('ยังไม่พบโทเคน AREX_ACCESS_TOKEN สำหรับเชื่อมต่อ FastAPI'); return; }
    setCancellingRewardRequestId(requestId);
    setMessage(null);
    try {
      await farmerApi.cancelRewardRequest(requestId);
      setMessage('ยกเลิกคำขอแลกรางวัลสำเร็จแล้ว และคืนแต้มที่จองไว้เรียบร้อย');
      await loadRewards(true);
    } catch (error) {
      setMessage(error instanceof ApiError ? `ยกเลิกคำขอไม่สำเร็จ: ${error.message}` : 'ยกเลิกคำขอไม่สำเร็จ');
    } finally {
      setCancellingRewardRequestId(null);
    }
  };

  return (
    <ErrorBoundary>
      <div className="space-y-5 pb-10">

        {/* ── Hero coin banner ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-emerald-600 px-5 py-5 shadow-md shadow-primary/15">
          <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute -bottom-6 right-12 h-20 w-20 rounded-full bg-white/5" />
          <div className="relative flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white/70">PMUC Coin คงเหลือ</p>
              <div className="mt-1 flex items-end gap-1.5">
                <span className="text-5xl font-light tabular-nums text-white">
                  {availablePoints.toLocaleString('th-TH')}
                </span>
                <span className="mb-1.5 text-base font-medium text-white/70">แต้ม</span>
              </div>
              {activeCount > 0 && (
                <p className="mt-1.5 text-sm text-white/70">
                  คำขอที่กำลังดำเนินการ{' '}
                  <span className="font-bold text-white">{activeCount} รายการ</span>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => void loadRewards(true)}
              disabled={isLoading}
              aria-label="รีเฟรชข้อมูล"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 disabled:opacity-50"
            >
              <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── Alert ── */}
        <AnimatePresence>
          {message && (
            <motion.div key="alert"
              initial={reduceMotion ? {} : { opacity: 0, y: -8 }}
              animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
              exit={reduceMotion ? {} : { opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <AlertBanner message={message} tone={inferMessageTone(message)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Catalog ── */}
        <section>
          <h2 className="mb-3 text-base font-bold text-stone-800">เลือกของรางวัล</h2>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl bg-stone-100" style={{ height: 200 }} />
              ))}
            </div>
          ) : rewardsCatalog.length === 0 ? (
            <EmptyState title="ยังไม่มีรางวัลในระบบ" description="เมื่อมีรายการรางวัลเปิดใช้งาน ระบบจะแสดงตัวเลือกที่นี่" icon={Gift} />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {rewardsCatalog.map((reward) => {
                const pts = Number(reward.points_cost) || 0;
                const stock = Number(reward.stock_qty) || 0;
                const outOfStock = stock <= 0;
                const unavailable = !reward.active || outOfStock;
                const insufficient = availablePoints < pts;
                const canApply = !insufficient && !unavailable;
                const lowStock = stock <= 10 && stock > 0;

                return (
                  <motion.button
                    key={reward.id}
                    type="button"
                    onClick={() => { setSelectedReward(reward); setRewardQty(1); }}
                    whileTap={reduceMotion ? {} : { scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className={`group flex flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-shadow ${
                      unavailable
                        ? 'border-stone-100 opacity-60'
                        : canApply
                          ? 'border-stone-200 hover:shadow-md'
                          : 'border-stone-100'
                    }`}
                  >
                    {/* Image area */}
                    <RewardImage
                      src={reward.image_url}
                      alt={reward.name_th}
                      className="h-28 w-full sm:h-32"
                    />

                    {/* Content */}
                    <div className="flex flex-1 flex-col gap-1.5 p-3">
                      <p className={`text-sm font-bold leading-snug ${unavailable ? 'text-stone-400' : 'text-stone-900'}`}>
                        {reward.name_th}
                      </p>

                      {/* Cost chip */}
                      <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                        canApply ? 'bg-primary/10 text-primary' : 'bg-stone-100 text-stone-400'
                      }`}>
                        <Coins className="h-3 w-3" />
                        {pts.toLocaleString('th-TH')} แต้ม
                      </span>

                      {/* Stock / shortage */}
                      <p className={`text-[11px] leading-tight ${
                        outOfStock ? 'text-stone-400'
                          : lowStock ? 'font-semibold text-amber-500'
                          : insufficient ? 'font-semibold text-red-400'
                          : 'text-stone-400'
                      }`}>
                        {outOfStock
                          ? 'หมดสต็อก'
                          : insufficient
                            ? `ขาดอีก ${(pts - availablePoints).toLocaleString('th-TH')} แต้ม`
                            : `เหลือ ${stock} ชิ้น${lowStock ? ' ⚠' : ''}`}
                      </p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Request history ── */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-base font-bold text-stone-800">ติดตามคำขอ</h2>
            {rewardRequests.length > 0 && (
              <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-bold text-stone-500">
                {rewardRequests.length}
              </span>
            )}
          </div>

          {/* Filter tabs */}
          <div className="mb-3 grid grid-cols-3 gap-1.5 rounded-2xl border border-stone-100 bg-stone-50 p-1.5">
            {FILTER_OPTIONS.map((opt) => {
              const count =
                opt.value === 'all' ? rewardRequests.length
                : opt.value === 'active' ? rewardRequests.filter((r) => ACTIVE_REQUEST_STATUSES.has(r.status)).length
                : rewardRequests.filter((r) => !ACTIVE_REQUEST_STATUSES.has(r.status)).length;
              const isActive = filter === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFilter(opt.value)}
                  className={`flex min-h-[48px] flex-col items-center justify-center rounded-xl px-2 py-2 text-sm font-semibold transition-all ${
                    isActive ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400'
                  }`}
                >
                  {opt.label}
                  {count > 0 && (
                    <span className={`mt-0.5 rounded-full px-2 py-0.5 text-xs font-bold ${
                      isActive ? 'bg-primary/10 text-primary' : 'bg-stone-200 text-stone-400'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
          ) : filteredRequests.length === 0 ? (
            <EmptyState
              title="ยังไม่มีคำขอในกลุ่มนี้"
              description="กดขอแลกรางวัลจากรายการด้านบน ระบบจะแสดงสถานะที่นี่ทันที"
              icon={Truck}
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${filter}-${reqSortCol}-${reqSortDir}`}
                className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
                initial={reduceMotion ? {} : { opacity: 0 }}
                animate={reduceMotion ? {} : { opacity: 1 }}
                exit={reduceMotion ? {} : { opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {/* Sort hint */}
                <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-4 py-2">
                  <span className="text-sm">💡</span>
                  <p className="text-xs text-amber-700">กดชื่อคอลัมน์เพื่อเรียงลำดับ</p>
                </div>
                {/* Column headers */}
                {(() => {
                  const handleSort = (col: ReqSortCol) => {
                    if (reqSortCol === col) setReqSortDir((d) => d === 'asc' ? 'desc' : 'asc');
                    else { setReqSortCol(col); setReqSortDir(col === 'date' ? 'desc' : 'asc'); }
                  };
                  const Pill = ({ col, labels }: { col: ReqSortCol; labels: [string, string] }) =>
                    reqSortCol === col
                      ? <span className="ml-1 whitespace-nowrap rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary leading-none">{reqSortDir === 'desc' ? labels[0] : labels[1]}</span>
                      : null;
                  return (
                    <div className="grid grid-cols-[1fr_4.5rem_8rem] items-center border-b border-stone-100 bg-stone-50/60 px-4 py-2 text-xs font-semibold text-stone-400">
                      <button type="button" onClick={() => handleSort('date')} className="flex items-center gap-0.5 text-left hover:text-stone-600 transition-colors">
                        ขอแลกเมื่อ<Pill col="date" labels={['ล่าสุดก่อน', 'เก่าสุดก่อน']} />
                      </button>
                      <button type="button" onClick={() => handleSort('points')} className="flex items-center justify-end gap-0.5 pr-3 hover:text-stone-600 transition-colors">
                        แต้ม<Pill col="points" labels={['มากก่อน', 'น้อยก่อน']} />
                      </button>
                      <button type="button" onClick={() => handleSort('status')} className="flex items-center justify-end gap-0.5 hover:text-stone-600 transition-colors">
                        สถานะ<Pill col="status" labels={['ก→ฮ', 'ฮ→ก']} />
                      </button>
                    </div>
                  );
                })()}
                <div className="divide-y divide-stone-100">
                {filteredRequests.map((request) => {
                  const deliveryJob = request.reward_delivery_jobs?.[0] ?? null;
                  const rewardName = rewardNameById[request.reward_id] ?? 'รางวัลที่เลือก';
                  const rewardImg = rewardsCatalog.find((r) => r.id === request.reward_id)?.image_url ?? null;
                  const canCancel = request.status === 'requested';
                  const hasDelivery = deliveryJob && deliveryJob.status !== 'cancelled';
                  const isExpanded = expandedRequestId === request.id;
                  const isPending = request.status === 'requested';
                  const isApproved = request.status === 'warehouse_approved';
                  const isDelivered = deliveryJob?.status === 'reward_delivered';

                  return (
                    <article key={request.id}>
                      <button
                        type="button"
                        onClick={() => setExpandedRequestId(isExpanded ? null : request.id)}
                        className={`grid w-full grid-cols-[1fr_4.5rem_8rem] items-center gap-2 px-4 py-3.5 text-left transition-colors ${
                          isExpanded ? 'bg-stone-50' : 'hover:bg-stone-50/60 active:bg-stone-50'
                        }`}
                      >
                        {/* Col 1: thumbnail + name + date */}
                        <div className="min-w-0 flex items-center gap-3">
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl">
                            {rewardImg ? (
                              <Image src={rewardImg} alt={rewardName} fill unoptimized className="object-cover" sizes="40px" />
                            ) : (
                              <div className={`flex h-full w-full items-center justify-center rounded-xl ${
                                isPending ? 'bg-amber-50' : isDelivered ? 'bg-emerald-50' : 'bg-stone-50'
                              }`}>
                                {isPending ? (
                                  <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
                                  </span>
                                ) : isDelivered ? (
                                  <CheckCheck className="h-4 w-4 text-emerald-500" />
                                ) : (
                                  <Gift className={`h-4 w-4 ${isApproved ? 'text-sky-400' : 'text-stone-300'}`} />
                                )}
                              </div>
                            )}
                            {rewardImg && isPending && (
                              <span className="absolute right-0.5 top-0.5 flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-stone-900">{rewardName}</p>
                            <p className="text-xs text-stone-400">ขอแลกเมื่อ {formatDateTime(request.requested_at)}</p>
                          </div>
                        </div>

                        {/* Col 2: points */}
                        <div className="pr-3 text-right">
                          <p className="text-sm font-semibold tabular-nums text-stone-700">
                            {Number(request.requested_points).toLocaleString('th-TH')}
                          </p>
                          <p className="text-xs text-stone-400">แต้ม</p>
                        </div>

                        {/* Col 3: status + chevron */}
                        <div className="flex flex-col items-end gap-1 min-w-0">
                          <StatusBadge status={request.status} label={formatRewardRequestStatus(request.status)} size="sm" />
                          <motion.span
                            animate={reduceMotion ? {} : { rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.18 }}
                            style={{ display: 'inline-flex' }}
                            className="text-stone-300"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </motion.span>
                        </div>
                      </button>

                      {/* Expanded detail */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            key="detail"
                            initial={reduceMotion ? {} : { height: 0, opacity: 0 }}
                            animate={reduceMotion ? {} : { height: 'auto', opacity: 1 }}
                            exit={reduceMotion ? {} : { height: 0, opacity: 0 }}
                            transition={{ duration: 0.26, ease: 'easeInOut' }}
                            style={{ overflow: 'hidden' }}
                          >
                            <div className="space-y-3 border-t border-stone-100 px-4 pb-4 pt-3">
                              {/* Location */}
                              {request.delivery_location_text ? (
                                <div className="flex items-start gap-2">
                                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                  <div>
                                    <p className="text-xs font-semibold text-stone-400">สถานที่รับของ</p>
                                    <p className="text-sm text-stone-800">{request.delivery_location_text}</p>
                                    {request.delivery_lat != null && request.delivery_lng != null && (
                                      <a
                                        href={`https://www.google.com/maps?q=${request.delivery_lat},${request.delivery_lng}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                                      >
                                        ดูแผนที่
                                      </a>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <p className="flex items-center gap-1.5 text-sm text-stone-400">
                                  <MapPin className="h-4 w-4 shrink-0" />
                                  ยังไม่ได้ระบุสถานที่รับของ
                                </p>
                              )}

                              {isApproved && !hasDelivery && (
                                <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-3">
                                  <Clock3 className="h-5 w-5 shrink-0 text-amber-500" />
                                  <span className="text-sm font-semibold text-amber-700">รอฝ่ายขนส่งจัดรอบส่งของ</span>
                                </div>
                              )}

                              {hasDelivery && <DeliveryProgress deliveryJob={deliveryJob} />}

                              {hasDelivery && (
                                <p className="text-sm text-stone-500">
                                  สถานะจัดส่ง:{' '}
                                  <span className={`font-bold ${isDelivered ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {formatDeliveryStatus(deliveryJob.status)}
                                  </span>
                                </p>
                              )}

                              {canCancel && (
                                <button
                                  type="button"
                                  onClick={() => void handleCancelRewardRequest(request.id)}
                                  disabled={cancellingRewardRequestId === request.id}
                                  className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 text-sm font-bold text-red-500 transition hover:bg-red-100 disabled:opacity-50 active:scale-95"
                                >
                                  <XCircle className="h-4 w-4" />
                                  {cancellingRewardRequestId === request.id ? 'กำลังยกเลิก...' : 'ยกเลิกคำขอนี้'}
                                </button>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </article>
                  );
                })}
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </section>
      </div>

      {/* ── Reward detail bottom sheet ── */}
      <AnimatePresence>
        {selectedReward && (() => {
          const reward = selectedReward;
          const pts = Number(reward.points_cost) || 0;
          const stock = Number(reward.stock_qty) || 0;
          const outOfStock = stock <= 0;
          const unavailable = !reward.active || outOfStock;
          const insufficient = availablePoints < pts * rewardQty;
          const canApply = !insufficient && !unavailable;
          return (
            <>
              <motion.div
                key="detail-backdrop"
                className="fixed inset-0 z-40 bg-black/50"
                initial={reduceMotion ? {} : { opacity: 0 }}
                animate={reduceMotion ? {} : { opacity: 1 }}
                exit={reduceMotion ? {} : { opacity: 0 }}
                onClick={() => setSelectedReward(null)}
              />
              <motion.div
                key="detail-sheet"
                className="fixed inset-x-0 bottom-0 z-50 overflow-hidden rounded-t-3xl bg-white shadow-2xl"
                initial={reduceMotion ? {} : { y: '100%' }}
                animate={reduceMotion ? {} : { y: 0 }}
                exit={reduceMotion ? {} : { y: '100%' }}
                transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              >
                {/* Hero image — tall, edge-to-edge */}
                <div className="relative h-52 w-full bg-gradient-to-br from-emerald-50 to-stone-100">
                  {reward.image_url ? (
                    <Image
                      src={reward.image_url}
                      alt={reward.name_th}
                      fill
                      unoptimized
                      className="object-cover"
                      sizes="100vw"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Gift className="h-20 w-20 text-emerald-200" />
                    </div>
                  )}
                  {/* Close button floated over image */}
                  <button
                    type="button"
                    onClick={() => setSelectedReward(null)}
                    className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition hover:bg-black/50"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  {/* Insufficient overlay badge */}
                  {insufficient && !unavailable && (
                    <div className="absolute bottom-3 left-4 rounded-full bg-red-500/90 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">
                      แต้มไม่พอ — ขาดอีก {(pts * rewardQty - availablePoints).toLocaleString('th-TH')} แต้ม
                    </div>
                  )}
                  {outOfStock && (
                    <div className="absolute bottom-3 left-4 rounded-full bg-stone-700/80 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">
                      หมดสต็อก
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="space-y-4 px-5 pb-8 pt-5">
                  <div>
                    <h3 className="text-xl font-bold text-stone-900">{reward.name_th}</h3>
                    {reward.description_th && (
                      <p className="mt-1 text-sm text-stone-500">{reward.description_th}</p>
                    )}
                  </div>

                  {/* Interactive quantity + coin math */}
                  {(() => {
                    const totalCost = pts * rewardQty;
                    const afterBalance = availablePoints - totalCost;
                    const insufficientQty = afterBalance < 0;
                    const maxQty = outOfStock ? 0 : Math.min(10, stock, pts > 0 && availablePoints > 0 ? Math.floor(availablePoints / pts) : 0);
                    const canBuy = !unavailable && !insufficientQty && rewardQty >= 1;
                    return (
                      <div className="space-y-3">
                        {/* Quantity picker */}
                        <div className="flex items-center justify-between rounded-2xl bg-stone-50 px-4 py-3">
                          <span className="text-sm font-semibold text-stone-600">จำนวน</span>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setRewardQty((q) => Math.max(1, q - 1))}
                              disabled={rewardQty <= 1}
                              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-stone-200 text-xl font-bold text-stone-600 transition disabled:opacity-30 active:scale-90"
                            >−</button>
                            <span className="w-8 text-center text-xl font-bold text-stone-900">{rewardQty}</span>
                            <button
                              type="button"
                              onClick={() => setRewardQty((q) => Math.min(maxQty, q + 1))}
                              disabled={rewardQty >= maxQty}
                              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-stone-200 text-xl font-bold text-stone-600 transition disabled:opacity-30 active:scale-90"
                            >+</button>
                          </div>
                        </div>

                        {/* Coin math card */}
                        <div className="rounded-2xl border border-stone-100 overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-3">
                            <span className="text-sm text-stone-400">ราคา/ชิ้น</span>
                            <span className="text-sm font-semibold text-stone-700">{pts.toLocaleString('th-TH')} แต้ม</span>
                          </div>
                          <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50 px-4 py-3">
                            <span className="text-sm text-stone-400">รวมที่ใช้</span>
                            <span className={`text-base font-bold ${insufficientQty ? 'text-red-500' : 'text-stone-800'}`}>
                              {totalCost.toLocaleString('th-TH')} แต้ม
                            </span>
                          </div>
                          <div className="flex items-center justify-between border-t border-stone-100 px-4 py-3">
                            <span className="text-sm text-stone-400">แต้มของคุณ</span>
                            <div className="flex items-center gap-2 text-sm font-semibold">
                              <span className="text-stone-500">{availablePoints.toLocaleString('th-TH')}</span>
                              <span className="text-stone-300">→</span>
                              <span className={insufficientQty ? 'text-red-500 font-bold' : 'text-emerald-600 font-bold'}>
                                {afterBalance.toLocaleString('th-TH')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {insufficientQty && (
                          <p className="text-center text-xs font-semibold text-red-500">
                            แต้มไม่พอ — ขาดอีก {(totalCost - availablePoints).toLocaleString('th-TH')} แต้ม
                          </p>
                        )}
                        {outOfStock && (
                          <p className="text-center text-xs font-semibold text-stone-400">สินค้าหมดสต็อก</p>
                        )}
                      </div>
                    );
                  })()}

                  <button
                    type="button"
                    onClick={() => { setSelectedReward(null); void handleCreateRewardRequest(reward, rewardQty); }}
                    disabled={unavailable || availablePoints < pts * rewardQty || requestingRewardId === reward.id}
                    className="flex w-full min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-white shadow-md shadow-primary/20 transition hover:opacity-90 active:scale-95 disabled:opacity-40"
                  >
                    <Gift className="h-5 w-5" />
                    {requestingRewardId === reward.id ? 'กำลังส่งคำขอ...' : 'ขอแลกรางวัลนี้'}
                  </button>
                </div>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        fields={confirmDialog.fields}
        confirmLabel="ยืนยัน"
        cancelLabel="ยกเลิก"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
      />

      {/* ── Location picker bottom sheet ── */}
      <AnimatePresence>
        {locationPicker.open && (
          <>
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-50 bg-black/40"
              initial={reduceMotion ? {} : { opacity: 0 }}
              animate={reduceMotion ? {} : { opacity: 1 }}
              exit={reduceMotion ? {} : { opacity: 0 }}
              onClick={() => setLocationPicker({ open: false, reward: null, locationText: '', lat: null, lng: null })}
            />
            <motion.div
              key="sheet"
              className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl"
              initial={reduceMotion ? {} : { y: '100%' }}
              animate={reduceMotion ? {} : { y: 0 }}
              exit={reduceMotion ? {} : { y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-100 bg-white px-5 py-4">
                <div>
                  <p className="text-base font-bold text-stone-900">ระบุสถานที่รับของรางวัล</p>
                  <p className="text-xs text-stone-400">{locationPicker.reward?.name_th}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setLocationPicker({ open: false, reward: null, locationText: '', lat: null, lng: null })}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 px-5 pb-8 pt-5">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-stone-700">สถานที่รับของ</label>
                  <input
                    type="text"
                    value={locationPicker.locationText}
                    onChange={(e) => setLocationPicker((prev) => ({ ...prev, locationText: e.target.value }))}
                    placeholder="เช่น หน้าบ้าน / หน้าวัด"
                    className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3.5 text-base text-stone-900 outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
                  />
                </div>

                <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  ปักหมุดบนแผนที่เพื่อให้ขนส่งนำทางได้ถูกต้อง
                </div>

                <PickupLocationMapPicker
                  lat={locationPicker.lat}
                  lng={locationPicker.lng}
                  onChange={({ lat, lng }) => setLocationPicker((prev) => ({ ...prev, lat, lng }))}
                  onAddressResolved={(address) => setLocationPicker((prev) => ({ ...prev, locationText: address }))}
                  mapHeightClassName="h-[260px] w-full overflow-hidden rounded-2xl"
                />

                <button
                  type="button"
                  onClick={() => handleLocationConfirmed(locationPicker.locationText, locationPicker.lat, locationPicker.lng)}
                  className="flex w-full min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-white shadow-md shadow-primary/20 transition hover:opacity-90 active:scale-95"
                >
                  <Gift className="h-5 w-5" />
                  ยืนยันสถานที่และขอแลกรางวัล
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </ErrorBoundary>
  );
}
