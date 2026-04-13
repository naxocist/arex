'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, useSpring, useTransform } from 'motion/react';
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Coins,
  Gift,
  MapPin,
  Package,
  PackageSearch,
  Phone,
  RefreshCw,
  ShieldCheck,
  User,
  XCircle,
} from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import EmptyState from '@/app/_components/EmptyState';
import ErrorBoundary from '@/app/_components/ErrorBoundary';
import { SkeletonCard } from '@/app/_components/Skeleton';
import StatCard from '@/app/_components/StatCard';
import StatusBadge from '@/app/_components/StatusBadge';
import { ApiError, warehouseApi, type WarehousePendingRequestItem } from '@/app/_lib/apiClient';

/* ── helpers ── */
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

function formatDateTime(dateTime: string | null | undefined): string {
  if (!dateTime) return '-';
  return new Date(dateTime).toLocaleString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function inferMessageTone(message: string | null): 'info' | 'success' | 'error' {
  if (!message) return 'info';
  if (message.includes('ไม่สำเร็จ') || message.includes('ยังไม่')) return 'error';
  if (message.includes('สำเร็จ')) return 'success';
  return 'info';
}

/* ── AnimatedNumber ── */
function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(0, { stiffness: 60, damping: 18 });
  const display = useTransform(spring, (v) => Math.round(v).toLocaleString('th-TH'));
  const hasMounted = useRef(false);
  useEffect(() => {
    if (!hasMounted.current) { spring.set(0); hasMounted.current = true; }
    spring.set(value);
  }, [value, spring]);
  return <motion.span>{display}</motion.span>;
}

/* ── listItem variants ── */
const listItem = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: [0.25, 0, 0, 1] as [number, number, number, number] },
  },
};

/* ── PendingRequestCard ── */
function PendingRequestCard({
  item,
  processingRequestId,
  reasons,
  onReasonChange,
  onApprove,
  onReject,
}: {
  item: WarehousePendingRequestItem;
  processingRequestId: string | null;
  reasons: Record<string, string>;
  onReasonChange: (id: string, value: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const reduceMotion = useReducedMotion();
  const isProcessing = processingRequestId === item.id;

  const hasLocation = Boolean(item.delivery_location_text);
  const hasMapLink = item.delivery_lat != null && item.delivery_lng != null;

  return (
    <motion.article
      variants={listItem}
      initial="hidden"
      animate="show"
      layout
      className="overflow-hidden rounded-2xl border border-outline-variant/10 bg-white shadow-sm"
    >
      {/* Accent bar */}
      <div className="h-1 w-full bg-amber-400" />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50">
            <Gift className="h-5 w-5 text-amber-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold leading-tight text-on-surface">
              {item.reward_name_th ?? 'รางวัลที่เลือก'}
            </p>
            {item.reward_description_th && (
              <p className="mt-0.5 text-sm leading-snug text-stone-400">{item.reward_description_th}</p>
            )}
            <p className="mt-0.5 text-xs text-stone-400">ขอแลกเมื่อ {formatDateTime(item.requested_at)}</p>
          </div>
          <StatusBadge status={item.status} label={formatRewardRequestStatus(item.status)} size="sm" className="shrink-0" />
        </div>

        {/* Points + qty row */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/8 px-3 py-1 text-sm font-semibold text-primary">
            <Coins className="h-3.5 w-3.5" />
            {Number(item.requested_points).toLocaleString('th-TH')} PMUC Coin
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1 text-sm font-medium text-stone-600">
            <Package className="h-3.5 w-3.5" />
            {Number(item.quantity)} ชิ้น
          </span>
        </div>

        {/* Farmer info — always visible */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {item.farmer_display_name && (
            <span className="flex items-center gap-1.5 text-sm text-on-surface">
              <User className="h-4 w-4 shrink-0 text-stone-400" />
              {item.farmer_display_name}
            </span>
          )}
          {item.farmer_phone && (
            <a
              href={`tel:${item.farmer_phone}`}
              className="flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <Phone className="h-4 w-4 shrink-0" />
              {item.farmer_phone}
            </a>
          )}
          {item.farmer_province && (
            <span className="text-sm text-stone-400">{item.farmer_province}</span>
          )}
        </div>

        {/* Location — always visible */}
        {hasLocation ? (
          <div className="mt-2.5 flex items-start gap-1.5">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">สถานที่รับของรางวัล</p>
              <p className="mt-0.5 text-sm leading-relaxed text-on-surface">{item.delivery_location_text}</p>
              {hasMapLink && (
                <a
                  href={`https://www.google.com/maps?q=${item.delivery_lat},${item.delivery_lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
                >
                  ดูบนแผนที่
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-2.5 flex items-center gap-1.5 text-sm text-stone-400">
            <MapPin className="h-4 w-4 shrink-0" />
            <span>ยังไม่ได้ระบุสถานที่รับของ</span>
          </div>
        )}


        {/* Action area */}
        <div className="mt-4 space-y-3">
          <textarea
            value={reasons[item.id] || ''}
            onChange={(e) => onReasonChange(item.id, e.target.value)}
            placeholder="เหตุผลในการปฏิเสธ (ถ้ามี)"
            className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm outline-none transition focus:border-amber-300 focus:bg-white"
            rows={2}
          />
          <div className="flex gap-3">
            <motion.button
              type="button"
              onClick={() => onApprove(item.id)}
              disabled={isProcessing}
              whileTap={reduceMotion ? {} : { scale: 0.97 }}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              อนุมัติคำขอ
            </motion.button>
            <motion.button
              type="button"
              onClick={() => onReject(item.id)}
              disabled={isProcessing}
              whileTap={reduceMotion ? {} : { scale: 0.97 }}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              ปฏิเสธ
            </motion.button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

/* ── AnsweredRequestCard ── */
function AnsweredRequestCard({ item }: { item: WarehousePendingRequestItem }) {
  const [expanded, setExpanded] = useState(false);
  const reduceMotion = useReducedMotion();

  const isApproved = item.status === 'warehouse_approved';
  const isRejected = item.status === 'warehouse_rejected';
  const hasLocation = Boolean(item.delivery_location_text);
  const hasMapLink = item.delivery_lat != null && item.delivery_lng != null;

  // Visual system: approved = emerald tint, rejected = red tint
  const cardBg = isApproved ? 'bg-emerald-50/40' : isRejected ? 'bg-red-50/30' : 'bg-white';
  const leftBorder = isApproved ? 'border-l-emerald-400' : isRejected ? 'border-l-red-300' : 'border-l-stone-200';
  const verdictColor = isApproved ? 'text-emerald-700' : isRejected ? 'text-red-600' : 'text-stone-500';
  const verdictBg = isApproved ? 'bg-emerald-100' : isRejected ? 'bg-red-100' : 'bg-stone-100';
  const verdictLabel = isApproved ? 'อนุมัติแล้ว' : isRejected ? 'ปฏิเสธแล้ว' : 'รอดำเนินการ';
  const VerdictIcon = isApproved ? CheckCircle2 : isRejected ? XCircle : Clock;

  return (
    <motion.article
      variants={listItem}
      initial="hidden"
      animate="show"
      layout
      className={`overflow-hidden rounded-2xl border border-stone-200/70 border-l-4 ${leftBorder} ${cardBg} shadow-sm`}
    >
      {/* Always-visible summary — everything needed at a glance */}
      <div className="px-4 pt-4 pb-3">
        {/* Row 1: verdict badge + reward name */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Verdict — dominant signal, first thing eyes land on */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <VerdictIcon className={`h-4 w-4 shrink-0 ${verdictColor}`} />
              <span className={`text-sm font-bold ${verdictColor}`}>{verdictLabel}</span>
              {item.warehouse_decision_at && (
                <span className="text-xs text-stone-400">· ตัดสินเมื่อ {formatDateTime(item.warehouse_decision_at)}</span>
              )}
            </div>
            {/* Reward — bold, what was decided on */}
            <p className="text-base font-semibold leading-snug text-on-surface">
              {item.reward_name_th ?? 'รางวัลที่เลือก'}
            </p>
            {item.reward_description_th && (
              <p className="mt-0.5 text-xs text-stone-400 leading-snug">{item.reward_description_th}</p>
            )}
          </div>
          {/* Points — prominent secondary */}
          <div className={`shrink-0 rounded-xl px-3 py-1.5 text-center ${verdictBg}`}>
            <p className={`text-base font-bold tabular-nums ${verdictColor}`}>
              {Number(item.requested_points).toLocaleString('th-TH')}
            </p>
            <p className={`text-[10px] font-medium ${verdictColor} opacity-70`}>แต้ม</p>
          </div>
        </div>

        {/* Row 2: farmer + rejection reason — critical secondary info */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {item.farmer_display_name && (
            <span className="flex items-center gap-1 text-sm font-medium text-stone-600">
              <User className="h-3.5 w-3.5 text-stone-400" />
              {item.farmer_display_name}
            </span>
          )}
          {item.farmer_province && (
            <span className="text-xs text-stone-400">{item.farmer_province}</span>
          )}
          {item.farmer_phone && (
            <a href={`tel:${item.farmer_phone}`} className="text-xs font-medium text-primary hover:underline">
              {item.farmer_phone}
            </a>
          )}
        </div>

        {/* Rejection reason — always visible, prominent on rejection */}
        {isRejected && item.rejection_reason && (
          <div className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-red-100 px-3 py-2">
            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
            <p className="text-sm font-medium text-red-700 leading-snug">{item.rejection_reason}</p>
          </div>
        )}

        {/* Expand toggle — only if there's more to show */}
        {(hasLocation || item.requested_at) && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-2.5 flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            <motion.span
              animate={reduceMotion ? {} : { rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'inline-flex' }}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </motion.span>
            {expanded ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียดเพิ่มเติม'}
          </button>
        )}
      </div>

      {/* Expanded: audit detail + delivery location */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="detail"
            initial={reduceMotion ? {} : { height: 0, opacity: 0 }}
            animate={reduceMotion ? {} : { height: 'auto', opacity: 1 }}
            exit={reduceMotion ? {} : { height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="space-y-2.5 border-t border-stone-100 px-4 pb-4 pt-3">
              {/* Timestamps */}
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">ยื่นคำขอเมื่อ</p>
                  <p className="text-xs text-stone-500">{formatDateTime(item.requested_at)}</p>
                </div>
                {item.warehouse_decision_at && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">ตัดสินใจเมื่อ</p>
                    <p className="text-xs text-stone-500">{formatDateTime(item.warehouse_decision_at)}</p>
                  </div>
                )}
              </div>

              {/* Delivery location */}
              {hasLocation ? (
                <div className="flex items-start gap-2 rounded-xl bg-white px-3 py-2.5 border border-stone-100">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-0.5">สถานที่รับของรางวัล</p>
                    <p className="text-sm leading-relaxed text-stone-600">{item.delivery_location_text}</p>
                    {hasMapLink && (
                      <a
                        href={`https://www.google.com/maps?q=${item.delivery_lat},${item.delivery_lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        ดูบนแผนที่
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <p className="flex items-center gap-1.5 text-xs text-stone-400">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  ไม่ได้ระบุสถานที่รับของ
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

/* ── AnsweredTab with filter ── */
type HistoryFilter = 'all' | 'approved' | 'rejected';

function AnsweredTab({
  answeredRequests,
  isLoading,
  reduceMotion,
}: {
  answeredRequests: WarehousePendingRequestItem[];
  isLoading: boolean;
  reduceMotion: boolean;
}) {
  const [filter, setFilter] = useState<HistoryFilter>('all');

  const approvedCount = answeredRequests.filter((r) => r.status === 'warehouse_approved').length;
  const rejectedCount = answeredRequests.filter((r) => r.status === 'warehouse_rejected').length;

  const filtered = useMemo(() => {
    if (filter === 'approved') return answeredRequests.filter((r) => r.status === 'warehouse_approved');
    if (filter === 'rejected') return answeredRequests.filter((r) => r.status === 'warehouse_rejected');
    return answeredRequests;
  }, [answeredRequests, filter]);

  const options: { value: HistoryFilter; label: string; count: number; color: string; activeColor: string }[] = [
    { value: 'all', label: 'ทั้งหมด', count: answeredRequests.length, color: 'bg-stone-200 text-stone-500', activeColor: 'bg-stone-700 text-white' },
    { value: 'approved', label: 'อนุมัติ', count: approvedCount, color: 'bg-stone-200 text-stone-500', activeColor: 'bg-emerald-600 text-white' },
    { value: 'rejected', label: 'ปฏิเสธ', count: rejectedCount, color: 'bg-stone-200 text-stone-500', activeColor: 'bg-red-500 text-white' },
  ];

  return (
    <motion.div
      key="answered"
      initial={reduceMotion ? {} : { opacity: 0, y: 6 }}
      animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
      exit={reduceMotion ? {} : { opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="space-y-3"
    >
      {/* Filter pills */}
      {!isLoading && answeredRequests.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-stone-100 bg-stone-50 p-1.5">
          {options.map((opt) => {
            const isActive = filter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilter(opt.value)}
                className={`flex min-h-[44px] flex-col items-center justify-center rounded-xl px-2 py-1.5 text-xs font-semibold transition-all ${
                  isActive ? `${opt.activeColor} shadow-sm` : 'text-stone-400 hover:text-stone-600'
                }`}
              >
                <span>{opt.label}</span>
                <span className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  isActive ? 'bg-white/20 text-inherit' : 'bg-stone-200 text-stone-400'
                }`}>
                  {opt.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} className="h-20 rounded-2xl" />)
      ) : answeredRequests.length === 0 ? (
        <EmptyState
          title="ยังไม่มีประวัติคำขอ"
          description="คำขอที่อนุมัติหรือปฏิเสธแล้วจะแสดงที่นี่"
          icon={CheckCircle2}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="ไม่มีรายการในกลุ่มนี้"
          description="ลองเปลี่ยนตัวกรอง"
          icon={CheckCircle2}
        />
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={filter}
            className="space-y-2.5"
            initial={reduceMotion ? {} : { opacity: 0 }}
            animate={reduceMotion ? {} : { opacity: 1 }}
            exit={reduceMotion ? {} : { opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {filtered.map((item) => (
              <AnsweredRequestCard key={item.id} item={item} />
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </motion.div>
  );
}

/* ── Main ── */
type WarehouseTab = 'pending' | 'answered';

export default function WarehouseApproval() {
  const [activeTab, setActiveTab] = useState<WarehouseTab>('pending');
  const [pendingRequests, setPendingRequests] = useState<WarehousePendingRequestItem[]>([]);
  const [answeredRequests, setAnsweredRequests] = useState<WarehousePendingRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const reduceMotion = useReducedMotion();

  const summary = useMemo(() => {
    const totalPoints = pendingRequests.reduce((sum, item) => sum + Number(item.requested_points || 0), 0);
    const approvedCount = answeredRequests.filter((r) => r.status === 'warehouse_approved').length;
    const rejectedCount = answeredRequests.filter((r) => r.status === 'warehouse_rejected').length;
    return { totalPoints, approvedCount, rejectedCount };
  }, [pendingRequests, answeredRequests]);

  const loadPendingRequests = async (forceRefresh = false) => {
    if (!hasAccessToken()) {
      setMessage('ยังไม่พบโทเคนสำหรับเรียก API กรุณาเข้าสู่ระบบที่หน้าเลือกผู้ใช้งาน');
      return;
    }
    setIsLoading(true);
    try {
      const response = await warehouseApi.listPendingRewardRequests({ forceRefresh });
      setPendingRequests(response.requests);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof ApiError ? `โหลดรายการรออนุมัติไม่สำเร็จ: ${error.message}` : 'โหลดรายการรออนุมัติไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAnsweredRequests = async (forceRefresh = false) => {
    if (!hasAccessToken()) return;
    setIsLoading(true);
    try {
      const response = await warehouseApi.listAnsweredRewardRequests({ forceRefresh });
      setAnsweredRequests(response.requests);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof ApiError ? `โหลดประวัติคำขอไม่สำเร็จ: ${error.message}` : 'โหลดประวัติคำขอไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPendingRequests();
    void loadAnsweredRequests();
  }, []);

  useEffect(() => {
    if (activeTab === 'pending') void loadPendingRequests();
    else void loadAnsweredRequests();
  }, [activeTab]);

  const handleApprove = async (requestId: string) => {
    setProcessingRequestId(requestId);
    setMessage(null);
    try {
      await warehouseApi.approveRewardRequest(requestId);
      setMessage('อนุมัติคำขอสำเร็จแล้ว');
      await loadPendingRequests(true);
    } catch (error) {
      setMessage(error instanceof ApiError ? `อนุมัติคำขอไม่สำเร็จ: ${error.message}` : 'อนุมัติคำขอไม่สำเร็จ');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessingRequestId(requestId);
    setMessage(null);
    const reason = (reasons[requestId] || '').trim();
    try {
      await warehouseApi.rejectRewardRequest(requestId, { reason });
      setMessage('ปฏิเสธคำขอสำเร็จแล้ว');
      await loadPendingRequests(true);
    } catch (error) {
      setMessage(error instanceof ApiError ? `ปฏิเสธคำขอไม่สำเร็จ: ${error.message}` : 'ปฏิเสธคำขอไม่สำเร็จ');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const tabs: { id: WarehouseTab; label: string; count: number }[] = [
    { id: 'pending', label: 'รอตรวจสอบ', count: pendingRequests.length },
    { id: 'answered', label: 'ประวัติ', count: answeredRequests.length },
  ];

  return (
    <ErrorBoundary>
      <div className="space-y-6">

        {/* Header */}
        <motion.div
          initial={reduceMotion ? {} : { opacity: 0, y: -8 }}
          animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="flex items-start justify-between gap-4"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">คลังพัสดุ</p>
            <h1 className="mt-1 text-3xl font-light tracking-tight text-on-surface sm:text-4xl">อนุมัติรางวัล</h1>
            <p className="mt-1 text-sm text-on-surface-variant">ตรวจสอบและอนุมัติคำขอแลกรางวัลของเกษตรกร</p>
          </div>
          <motion.button
            type="button"
            onClick={() => {
              if (activeTab === 'pending') void loadPendingRequests(true);
              else void loadAnsweredRequests(true);
            }}
            disabled={isLoading}
            whileTap={reduceMotion ? {} : { scale: 0.94 }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 shadow-sm transition hover:border-stone-300 hover:bg-stone-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </motion.button>
        </motion.div>

        {message ? <AlertBanner message={message} tone={inferMessageTone(message)} /> : null}

        {/* Stats — always visible */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="PMUC Coin ในคิว"
            value={summary.totalPoints.toLocaleString('th-TH')}
            detail="รอการอนุมัติ"
            icon={ShieldCheck}
            tone="violet"
          />
          <StatCard
            label="อนุมัติแล้ว"
            value={summary.approvedCount.toLocaleString('th-TH')}
            detail="คำขอ"
            icon={CheckCircle2}
            tone="emerald"
          />
          <StatCard
            label="ปฏิเสธแล้ว"
            value={summary.rejectedCount.toLocaleString('th-TH')}
            detail="คำขอ"
            icon={PackageSearch}
            tone="default"
          />
        </div>

        {/* Tab bar */}
        <motion.div
          initial={reduceMotion ? {} : { opacity: 0 }}
          animate={reduceMotion ? {} : { opacity: 1 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className="relative border-b border-outline-variant/10"
        >
          <div className="flex gap-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-1.5 px-3 pb-2.5 pt-1 text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-primary'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {tab.label}
                  <motion.span
                    layout
                    className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                      isActive ? 'bg-primary/10 text-primary' : 'bg-stone-100 text-stone-500'
                    }`}
                  >
                    {tab.count}
                  </motion.span>
                  {isActive && (
                    <motion.span
                      layoutId="tab-indicator-warehouse"
                      className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'pending' ? (
            <motion.div
              key="pending"
              initial={reduceMotion ? {} : { opacity: 0, y: 6 }}
              animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
              exit={reduceMotion ? {} : { opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="space-y-4"
            >
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} className="h-64 rounded-2xl" />)
              ) : pendingRequests.length === 0 ? (
                <EmptyState
                  title="ยังไม่มีคำขอที่รอตรวจสอบ"
                  description="เมื่อมีคำขอรออนุมัติจากเกษตรกร ระบบจะนำเข้ากล่องงานนี้ให้โดยอัตโนมัติ"
                  icon={PackageSearch}
                />
              ) : (
                pendingRequests.map((item) => (
                  <PendingRequestCard
                    key={item.id}
                    item={item}
                    processingRequestId={processingRequestId}
                    reasons={reasons}
                    onReasonChange={(id, value) => setReasons((prev) => ({ ...prev, [id]: value }))}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                ))
              )}
            </motion.div>
          ) : (
            <AnsweredTab
              answeredRequests={answeredRequests}
              isLoading={isLoading}
              reduceMotion={!!reduceMotion}
            />
          )}
        </AnimatePresence>

      </div>
    </ErrorBoundary>
  );
}
