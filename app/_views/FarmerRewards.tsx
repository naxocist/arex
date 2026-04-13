'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, useSpring, useTransform } from 'motion/react';
import {
  ChevronDown,
  Clock3,
  Coins,
  Gift,
  MapPin,
  RefreshCw,
  Ticket,
  Truck,
  XCircle,
} from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import ConfirmDialog from '@/app/_components/ConfirmDialog';
import EmptyState from '@/app/_components/EmptyState';
import ErrorBoundary from '@/app/_components/ErrorBoundary';
import dynamic from 'next/dynamic';
const PickupLocationMapPicker = dynamic(() => import('@/app/_components/PickupLocationMapPicker'), { ssr: false });
import { SkeletonCard } from '@/app/_components/Skeleton';
import StatCard from '@/app/_components/StatCard';
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
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function inferMessageTone(message: string | null): 'info' | 'success' | 'error' {
  if (!message) return 'info';
  if (message.includes('ไม่สำเร็จ') || message.includes('แต้มไม่พอ') || message.includes('ยังไม่')) return 'error';
  if (message.includes('สำเร็จ')) return 'success';
  return 'info';
}

/* Animated integer counter */
function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(0, { stiffness: 60, damping: 18 });
  const display = useTransform(spring, (v) => Math.round(v).toLocaleString('th-TH'));
  useEffect(() => { spring.set(value); }, [spring, value]);
  return <motion.span>{display}</motion.span>;
}

/* Delivery timeline — expandable */
function DeliveryTimeline({
  deliveryJob,
}: {
  deliveryJob: NonNullable<FarmerRewardRequestItem['reward_delivery_jobs']>[0];
}) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);

  const steps = [
    { status: 'reward_delivery_scheduled', label: 'จัดรอบส่ง', time: deliveryJob.planned_delivery_at },
    { status: 'out_for_delivery', label: 'กำลังนำส่ง', time: deliveryJob.out_for_delivery_at },
    { status: 'reward_delivered', label: 'ส่งมอบสำเร็จ', time: deliveryJob.delivered_at },
  ];
  const currentIdx = steps.findIndex((s) => s.status === deliveryJob.status);
  const isDelivered = deliveryJob.status === 'reward_delivered';

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-emerald-100 bg-emerald-50/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-semibold text-on-surface">สถานะการจัดส่ง</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            isDelivered ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {formatDeliveryStatus(deliveryJob.status)}
          </span>
        </div>
        <motion.span
          animate={reduceMotion ? {} : { rotate: open ? 180 : 0 }}
          transition={{ duration: 0.22 }}
          style={{ display: 'inline-flex' }}
        >
          <ChevronDown className="h-4 w-4 text-stone-400" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="timeline"
            initial={reduceMotion ? {} : { height: 0, opacity: 0 }}
            animate={reduceMotion ? {} : { height: 'auto', opacity: 1 }}
            exit={reduceMotion ? {} : { height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="border-t border-emerald-100 px-4 pb-4 pt-3">
              <div className="flex items-center justify-between gap-0">
                {steps.map((step, i) => {
                  const done = i <= currentIdx;
                  const current = i === currentIdx;
                  return (
                    <React.Fragment key={step.status}>
                      <div className="flex flex-1 flex-col items-center gap-1.5">
                        <div className={`relative flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition ${
                          isDelivered && i === steps.length - 1
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : done
                              ? 'border-emerald-400 bg-white text-emerald-600'
                              : 'border-stone-200 bg-white text-stone-300'
                        }`}>
                          {isDelivered && i === steps.length - 1 ? (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <span>{i + 1}</span>
                          )}
                          {current && !isDelivered && (
                            <span className="absolute -bottom-1 h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                          )}
                        </div>
                        <span className={`text-center text-xs font-medium leading-tight ${done ? 'text-on-surface' : 'text-stone-400'}`}>
                          {step.label}
                        </span>
                        {step.time && (
                          <span className="text-center text-[0.65rem] text-stone-400">{formatDateTime(step.time)}</span>
                        )}
                      </div>
                      {i < steps.length - 1 && (
                        <div className={`relative -mt-4 h-0.5 flex-1 ${i < currentIdx ? 'bg-emerald-400' : 'bg-stone-200'}`} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const REQUEST_GROUP_OPTIONS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'active', label: 'กำลังดำเนินการ' },
  { value: 'done', label: 'เสร็จสิ้น' },
] as const;
type RequestGroup = (typeof REQUEST_GROUP_OPTIONS)[number]['value'];

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
  const [requestGroup, setRequestGroup] = useState<RequestGroup>('all');
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const [locationPicker, setLocationPicker] = useState<{
    open: boolean;
    reward: FarmerRewardItem | null;
    locationText: string;
    lat: number | null;
    lng: number | null;
  }>({ open: false, reward: null, locationText: '', lat: null, lng: null });

  const rewardNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const reward of rewardsCatalog) map[reward.id] = reward.name_th;
    return map;
  }, [rewardsCatalog]);

  const filteredRequests = useMemo(() => {
    if (requestGroup === 'active') return rewardRequests.filter((r) => ACTIVE_REQUEST_STATUSES.has(r.status));
    if (requestGroup === 'done') return rewardRequests.filter((r) => !ACTIVE_REQUEST_STATUSES.has(r.status));
    return rewardRequests;
  }, [rewardRequests, requestGroup]);

  const stats = useMemo(() => ({
    allRequests: rewardRequests.length,
    waitingReview: rewardRequests.filter((r) => r.status === 'requested').length,
    approved: rewardRequests.filter((r) => r.status === 'warehouse_approved').length,
    delivered: rewardRequests.filter((r) =>
      r.reward_delivery_jobs?.some((j) => j.status === 'reward_delivered'),
    ).length,
  }), [rewardRequests]);

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

  const handleCreateRewardRequest = (reward: FarmerRewardItem) => {
    if (!hasAccessToken()) { setMessage('ยังไม่พบโทเคน AREX_ACCESS_TOKEN สำหรับเชื่อมต่อ FastAPI'); return; }
    const pts = Number(reward.points_cost) || 0;
    if (availablePoints < pts) { setMessage(`แต้มไม่พอสำหรับ ${reward.name_th}`); return; }
    setLocationPicker({ open: true, reward, locationText: '', lat: null, lng: null });
  };

  const handleLocationConfirmed = (locationText: string, lat: number | null, lng: number | null) => {
    const reward = locationPicker.reward;
    if (!reward) return;
    setLocationPicker((prev) => ({ ...prev, open: false }));
    const pts = Number(reward.points_cost) || 0;
    const after = availablePoints - pts;
    setConfirmDialog({
      open: true,
      title: 'ยืนยันการขอแลกรางวัล',
      message: `ของรางวัล: ${reward.name_th}\nจำนวน: 1 ชิ้น\nแต้มที่ใช้: ${pts.toLocaleString('th-TH')} PMUC Coin\nแต้มคงเหลือหลังแลก: ${after.toLocaleString('th-TH')} PMUC Coin\nสถานที่รับ: ${locationText || '(ไม่ระบุ)'}`,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, open: false }));
        await submitRewardRequest(reward, locationText, lat, lng);
      },
    });
  };

  const submitRewardRequest = async (
    reward: FarmerRewardItem,
    deliveryLocationText: string,
    deliveryLat: number | null,
    deliveryLng: number | null,
  ) => {
    setRequestingRewardId(reward.id);
    setMessage(null);
    try {
      await farmerApi.createRewardRequest({
        reward_id: reward.id,
        quantity: 1,
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

  /* animation variants */
  const fadeUp = reduceMotion
    ? {}
    : { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

  const listItem = reduceMotion
    ? {}
    : {
        hidden: { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.25, 0, 0, 1] as [number, number, number, number] } },
        exit: { opacity: 0, y: -4, transition: { duration: 0.15 } },
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
            <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">แดชบอร์ด</p>
            <h1 className="mt-0.5 text-3xl font-light tracking-tight text-on-surface sm:text-4xl">แลกรางวัล</h1>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Points pill */}
            <motion.div
              className="primary-gradient flex items-center gap-1.5 rounded-full px-3.5 py-2 shadow-sm"
              initial={reduceMotion ? {} : { scale: 0.85, opacity: 0 }}
              animate={reduceMotion ? {} : { scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4, type: 'spring', stiffness: 200, damping: 18 }}
            >
              <Coins className="h-4 w-4 text-white" />
              <span className="text-sm font-bold text-white">
                PMUC Coin <AnimatedNumber value={availablePoints} /> แต้ม
              </span>
            </motion.div>

            <motion.button
              type="button"
              onClick={() => void loadRewards(true)}
              disabled={isLoading}
              aria-label="รีเฟรชข้อมูล"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant/20 bg-white text-on-surface-variant transition hover:bg-stone-50 disabled:opacity-50"
              whileTap={reduceMotion ? {} : { scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </motion.button>
          </div>
        </motion.div>

        {/* ── Alert ── */}
        <AnimatePresence>
          {message && (
            <motion.div
              key="alert"
              initial={reduceMotion ? {} : { opacity: 0, y: -8, scale: 0.98 }}
              animate={reduceMotion ? {} : { opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? {} : { opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.22 }}
            >
              <AlertBanner message={message} tone={inferMessageTone(message)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Main bento ── */}
        <motion.div
          variants={fadeUp}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="grid gap-6 xl:grid-cols-[1fr,340px]"
        >
          {/* ── Left: catalog + request history ── */}
          <div className="space-y-6">

            {/* Catalog */}
            <motion.section
              className="rounded-2xl border border-outline-variant/10 bg-white shadow-sm"
              variants={fadeUp}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <div className="border-b border-outline-variant/10 px-5 py-4 sm:px-6">
                <h2 className="text-base font-semibold text-on-surface sm:text-lg">เลือกของรางวัล</h2>
                <p className="mt-0.5 text-sm text-on-surface-variant">
                  แต้มคงเหลือ{' '}
                  <span className="font-semibold text-primary">
                    <AnimatedNumber value={availablePoints} /> แต้ม
                  </span>
                  {' '}— กดขอแลกเพื่อเริ่มกระบวนการ
                </p>
              </div>

              <div className="px-5 pb-5 pt-4 sm:px-6">
                {isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
                  </div>
                ) : rewardsCatalog.length === 0 ? (
                  <EmptyState
                    title="ยังไม่มีรางวัลในระบบ"
                    description="เมื่อมีรายการรางวัลเปิดใช้งาน ระบบจะแสดงตัวเลือกที่นี่พร้อมแต้มที่ต้องใช้"
                    icon={Gift}
                  />
                ) : (
                  <div className="space-y-3">
                    {rewardsCatalog.map((reward, i) => {
                      const pts = Number(reward.points_cost) || 0;
                      const stock = Number(reward.stock_qty) || 0;
                      const insufficient = availablePoints < pts;
                      const outOfStock = stock <= 0;
                      const unavailable = !reward.active || outOfStock;
                      const canApply = !insufficient && !unavailable;
                      const lowStock = stock <= 10 && stock > 0;

                      return (
                        <motion.div
                          key={reward.id}
                          variants={listItem}
                          initial="hidden"
                          animate="show"
                          custom={i}
                          layout
                          className={`rounded-2xl border p-4 transition ${
                            unavailable
                              ? 'border-outline-variant/10 bg-stone-50/50 opacity-60'
                              : insufficient
                                ? 'border-outline-variant/10 bg-white'
                                : 'border-outline-variant/15 bg-white hover:border-primary/30 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            {/* Info */}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-base font-semibold text-on-surface">{reward.name_th}</p>
                                {outOfStock && (
                                  <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-500">หมดสต็อค</span>
                                )}
                                {!reward.active && !outOfStock && (
                                  <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-500">ปิดชั่วคราว</span>
                                )}
                              </div>
                              {reward.description_th && (
                                <p className="mt-0.5 line-clamp-2 text-sm text-on-surface-variant">{reward.description_th}</p>
                              )}
                              <div className="mt-2.5 flex flex-wrap gap-2">
                                <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ${
                                  insufficient ? 'bg-stone-100 text-stone-400' : 'bg-primary/10 text-primary'
                                }`}>
                                  <Coins className="h-3.5 w-3.5" />
                                  {pts.toLocaleString('th-TH')} แต้ม
                                </span>
                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                  lowStock ? 'bg-amber-50 text-amber-600' : 'bg-stone-100 text-stone-500'
                                }`}>
                                  คงเหลือ {stock.toLocaleString('th-TH')} ชิ้น
                                  {lowStock && ' (ใกล้หมด)'}
                                </span>
                                {insufficient && !unavailable && (
                                  <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-500">
                                    แต้มไม่พอ (ขาดอีก {(pts - availablePoints).toLocaleString('th-TH')})
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* CTA */}
                            <motion.button
                              type="button"
                              onClick={() => void handleCreateRewardRequest(reward)}
                              disabled={requestingRewardId === reward.id || !canApply}
                              className="shrink-0 min-h-[44px] rounded-2xl bg-primary px-5 text-sm font-semibold text-white shadow-sm shadow-primary/20 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                              whileTap={reduceMotion ? {} : { scale: 0.96 }}
                              whileHover={reduceMotion || !canApply ? {} : { scale: 1.04 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                            >
                              {requestingRewardId === reward.id
                                ? 'กำลังส่ง...'
                                : outOfStock
                                  ? 'หมดสต็อค'
                                  : !reward.active
                                    ? 'ปิดชั่วคราว'
                                    : insufficient
                                      ? 'แต้มไม่พอ'
                                      : 'ขอแลก'}
                            </motion.button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.section>

            {/* Request history */}
            <motion.section
              className="rounded-2xl border border-outline-variant/10 bg-white shadow-sm"
              variants={fadeUp}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              {/* Header */}
              <div className="px-5 pt-4 pb-3 sm:px-6">
                <h2 className="text-base font-semibold text-on-surface sm:text-lg">ติดตามคำขอแลกรางวัล</h2>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  {filteredRequests.length.toLocaleString('th-TH')} จาก {rewardRequests.length.toLocaleString('th-TH')} รายการ
                </p>
              </div>

              {/* Grouped tabs */}
              <div className="flex gap-1 border-b border-outline-variant/10 px-5 sm:px-6">
                {REQUEST_GROUP_OPTIONS.map((opt) => {
                  const count =
                    opt.value === 'all' ? rewardRequests.length
                    : opt.value === 'active' ? rewardRequests.filter((r) => ACTIVE_REQUEST_STATUSES.has(r.status)).length
                    : rewardRequests.filter((r) => !ACTIVE_REQUEST_STATUSES.has(r.status)).length;
                  const isActive = requestGroup === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRequestGroup(opt.value)}
                      className={`relative flex items-center gap-1.5 px-3 pb-2.5 pt-1 text-sm font-medium transition-colors ${
                        isActive
                          ? 'text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-primary after:content-[""]'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {opt.label}
                      <motion.span
                        layout
                        className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                          isActive ? 'bg-primary/10 text-primary' : 'bg-stone-100 text-stone-500'
                        }`}
                      >
                        {count}
                      </motion.span>
                    </button>
                  );
                })}
              </div>

              {/* List */}
              <div className="px-5 pb-5 sm:px-6">
                {isLoading ? (
                  <div className="space-y-3 pt-3">
                    {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
                  </div>
                ) : filteredRequests.length === 0 ? (
                  <motion.div
                    initial={reduceMotion ? {} : { opacity: 0 }}
                    animate={reduceMotion ? {} : { opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <EmptyState
                      title="ยังไม่มีคำขอในกลุ่มนี้"
                      description="กดขอแลกรางวัลจากแคตตาล็อกด้านบน ระบบจะแสดงสถานะที่นี่ทันที"
                      icon={Truck}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key={requestGroup}
                    className="divide-y divide-outline-variant/8"
                    initial={reduceMotion ? {} : { opacity: 0 }}
                    animate={reduceMotion ? {} : { opacity: 1 }}
                    transition={{ duration: 0.18 }}
                  >
                    {filteredRequests.map((request) => {
                      const deliveryJob = request.reward_delivery_jobs?.[0] ?? null;
                      const rewardName = rewardNameById[request.reward_id] ?? 'รางวัลที่เลือก';
                      const canCancel = request.status === 'requested';
                      const hasDelivery = deliveryJob && deliveryJob.status !== 'cancelled';
                      const isExpanded = expandedRequestId === request.id;
                      const isPending = request.status === 'requested';
                      const isApproved = request.status === 'warehouse_approved';

                      return (
                        <motion.article
                          key={request.id}
                          variants={listItem}
                          initial="hidden"
                          animate="show"
                          layout
                        >
                          {/* Compact row */}
                          <motion.button
                            type="button"
                            onClick={() => setExpandedRequestId(isExpanded ? null : request.id)}
                            className="flex w-full items-center gap-3 px-1 py-4 text-left"
                            whileHover={reduceMotion ? {} : { backgroundColor: 'rgba(245,245,244,0.6)' }}
                            whileTap={reduceMotion ? {} : { scale: 0.995 }}
                            transition={{ duration: 0.12 }}
                          >
                            {/* Status dot */}
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                              {isPending ? (
                                <span className="relative flex h-2.5 w-2.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
                                </span>
                              ) : (
                                <span className={`h-2.5 w-2.5 rounded-full ${
                                  isApproved ? 'bg-emerald-400'
                                  : request.status === 'warehouse_rejected' ? 'bg-red-300'
                                  : 'bg-stone-200'
                                }`} />
                              )}
                            </span>

                            {/* Info */}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-base font-semibold text-on-surface">{rewardName}</p>
                              <p className="mt-0.5 text-sm text-on-surface-variant">
                                {Number(request.requested_points).toLocaleString('th-TH')} แต้ม · {Number(request.quantity)} ชิ้น
                              </p>
                              <p className="text-xs text-stone-400">
                                ขอแลกเมื่อ {formatDateTime(request.requested_at)}
                              </p>
                            </div>

                            <div className="flex shrink-0 flex-col items-end gap-1.5">
                              <StatusBadge status={request.status} label={formatRewardRequestStatus(request.status)} size="sm" />
                              <span className="flex items-center gap-1 text-xs text-stone-400">
                                {isExpanded ? 'ซ่อน' : 'รายละเอียด'}
                                <motion.span
                                  animate={reduceMotion ? {} : { rotate: isExpanded ? 180 : 0 }}
                                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                                  style={{ display: 'inline-flex' }}
                                >
                                  <ChevronDown className="h-3.5 w-3.5" />
                                </motion.span>
                              </span>
                            </div>
                          </motion.button>

                          {/* Expanded details */}
                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                key="detail"
                                initial={reduceMotion ? {} : { height: 0, opacity: 0 }}
                                animate={reduceMotion ? {} : { height: 'auto', opacity: 1 }}
                                exit={reduceMotion ? {} : { height: 0, opacity: 0 }}
                                transition={{ duration: 0.28, ease: 'easeInOut' }}
                                style={{ overflow: 'hidden' }}
                              >
                                <div className="mb-3 ml-9 space-y-3 rounded-xl border border-outline-variant/10 bg-stone-50/60 px-4 py-3">
                                  <p className="text-sm text-on-surface-variant">
                                    <span className="font-semibold text-on-surface">วันที่ขอแลก: </span>
                                    {formatDateTime(request.requested_at)}
                                  </p>
                                  {request.delivery_location_text ? (
                                    <div className="flex items-start gap-2">
                                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                      <div className="min-w-0">
                                        <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">สถานที่รับของรางวัล</p>
                                        <p className="mt-0.5 text-sm leading-relaxed text-on-surface">{request.delivery_location_text}</p>
                                        {request.delivery_lat != null && request.delivery_lng != null && (
                                          <a
                                            href={`https://www.google.com/maps?q=${request.delivery_lat},${request.delivery_lng}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
                                          >
                                            ดูแผนที่
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 text-sm text-stone-400">
                                      <MapPin className="h-4 w-4 shrink-0" />
                                      <span>ยังไม่ได้ระบุสถานที่รับของ</span>
                                    </div>
                                  )}

                                  {/* Waiting for delivery */}
                                  {isApproved && !hasDelivery && (
                                    <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2.5">
                                      <Clock3 className="h-4 w-4 shrink-0 text-amber-500" />
                                      <span className="text-sm font-medium text-amber-700">รอฝ่ายขนส่งจัดรอบส่งของ</span>
                                    </div>
                                  )}

                                  {/* Delivery timeline */}
                                  {hasDelivery && <DeliveryTimeline deliveryJob={deliveryJob} />}

                                  {/* Cancel */}
                                  {canCancel && (
                                    <motion.button
                                      type="button"
                                      onClick={() => void handleCancelRewardRequest(request.id)}
                                      disabled={cancellingRewardRequestId === request.id}
                                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                                      whileTap={reduceMotion ? {} : { scale: 0.97 }}
                                    >
                                      <XCircle className="h-4 w-4" />
                                      {cancellingRewardRequestId === request.id ? 'กำลังยกเลิก...' : 'ยกเลิกคำขอนี้'}
                                    </motion.button>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.article>
                      );
                    })}
                  </motion.div>
                )}
              </div>
            </motion.section>
          </div>

          {/* ── Sidebar ── */}
          <motion.div
            className="space-y-4"
            variants={fadeUp}
            transition={{ duration: 0.35, ease: 'easeOut', delay: 0.1 }}
          >
            {/* Points card */}
            <motion.div
              className="rounded-2xl border border-outline-variant/10 bg-white p-5 shadow-sm"
              whileHover={reduceMotion ? {} : { y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.07)' }}
              transition={{ duration: 0.2 }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">PMUC Coin คงเหลือ</p>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-4xl font-light text-primary">
                  <AnimatedNumber value={availablePoints} />
                </span>
                <span className="mb-1 text-sm text-on-surface-variant">แต้ม</span>
              </div>
              <p className="mt-2 text-xs text-on-surface-variant">ใช้แลกรางวัลได้ทันทีเมื่อแต้มเพียงพอ</p>
            </motion.div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="คำขอทั้งหมด" value={stats.allRequests.toLocaleString('th-TH')} icon={Gift} tone="default" />
              <StatCard label="รอตรวจสอบ" value={stats.waitingReview.toLocaleString('th-TH')} icon={Clock3} tone="amber" />
              <StatCard label="คลังอนุมัติ" value={stats.approved.toLocaleString('th-TH')} icon={Ticket} tone="sky" />
              <StatCard label="ส่งมอบแล้ว" value={stats.delivered.toLocaleString('th-TH')} icon={Truck} tone="emerald" />
            </div>
          </motion.div>
        </motion.div>
      </motion.div>

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="ยืนยัน"
        cancelLabel="ยกเลิก"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
      />

      {/* Location picker bottom sheet */}
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
              className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
              initial={reduceMotion ? {} : { y: '100%', opacity: 0 }}
              animate={reduceMotion ? {} : { y: 0, opacity: 1 }}
              exit={reduceMotion ? {} : { y: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            >
              <h2 className="mb-0.5 text-lg font-semibold text-on-surface">ระบุสถานที่รับของรางวัล</h2>
              <p className="mb-4 text-sm text-on-surface-variant">
                {locationPicker.reward?.name_th} — แตะแผนที่หรือพิมพ์ที่อยู่เพื่อให้โลจิสติกส์นำส่งถึงที่
              </p>

              <div className="mb-3">
                <input
                  type="text"
                  value={locationPicker.locationText}
                  onChange={(e) => setLocationPicker((prev) => ({ ...prev, locationText: e.target.value }))}
                  placeholder="ที่อยู่สำหรับจัดส่ง (บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด)"
                  className="w-full rounded-xl border border-outline-variant/20 bg-stone-50 px-4 py-3 text-base outline-none focus:border-primary/40 focus:bg-white min-h-[52px]"
                />
              </div>

              <PickupLocationMapPicker
                lat={locationPicker.lat}
                lng={locationPicker.lng}
                onChange={(coords) => setLocationPicker((prev) => ({ ...prev, lat: coords.lat, lng: coords.lng }))}
                onAddressResolved={(addr) => setLocationPicker((prev) => ({ ...prev, locationText: prev.locationText || addr }))}
                mapHintText="แตะแผนที่เพื่อปักหมุดสถานที่รับของ"
                mapHeightClassName="h-48 sm:h-52"
              />

              <div className="mt-4 flex gap-3">
                <motion.button
                  type="button"
                  onClick={() => setLocationPicker({ open: false, reward: null, locationText: '', lat: null, lng: null })}
                  className="flex-1 rounded-2xl border border-outline-variant/20 py-3 text-base font-semibold text-on-surface-variant"
                  whileTap={reduceMotion ? {} : { scale: 0.97 }}
                >
                  ยกเลิก
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => handleLocationConfirmed(locationPicker.locationText, locationPicker.lat, locationPicker.lng)}
                  className="flex-1 rounded-2xl bg-primary py-3 text-base font-semibold text-white shadow-sm shadow-primary/20"
                  whileTap={reduceMotion ? {} : { scale: 0.97 }}
                  whileHover={reduceMotion ? {} : { scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  ถัดไป →
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </ErrorBoundary>
  );
}
