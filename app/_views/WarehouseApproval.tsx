'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowUpDown,
  CalendarRange,
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
  User,
  XCircle,
} from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import EmptyState from '@/app/_components/EmptyState';
import ErrorBoundary from '@/app/_components/ErrorBoundary';
import { SkeletonCard } from '@/app/_components/Skeleton';
import StatusBadge from '@/app/_components/StatusBadge';
import { ApiError, warehouseApi, type WarehousePendingRequestItem } from '@/app/_lib/apiClient';

/* ── helpers ── */
function hasAccessToken(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem('AREX_ACCESS_TOKEN'));
}

function formatDate(dateTime: string | null | undefined): string {
  if (!dateTime) return '-';
  return new Date(dateTime).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });
}

function formatDateTime(dateTime: string | null | undefined): string {
  if (!dateTime) return '-';
  return new Date(dateTime).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function inferMessageTone(message: string | null): 'info' | 'success' | 'error' {
  if (!message) return 'info';
  if (message.includes('ไม่สำเร็จ') || message.includes('ยังไม่')) return 'error';
  if (message.includes('สำเร็จ')) return 'success';
  return 'info';
}

type SortDir = 'asc' | 'desc';

function SortHeaderBar<T extends string>({
  cols,
  sort,
  onSort,
}: {
  cols: { key: T; label: string; dirLabels?: [string, string] }[];
  sort: { key: T; dir: SortDir };
  onSort: (key: T) => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-stone-100 bg-stone-50/70 px-4 py-2 rounded-t-xl -mb-1 flex-wrap">
      {cols.map((col) => {
        const active = sort.key === col.key;
        const [ascLabel, descLabel] = col.dirLabels ?? ['ก่อน', 'หลัง'];
        return (
          <button
            key={col.key}
            type="button"
            onClick={() => onSort(col.key)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
              active ? 'text-primary' : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            {col.label}
            {active ? (
              <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold bg-primary/10 text-primary">
                {sort.dir === 'asc' ? ascLabel : descLabel}
              </span>
            ) : (
              <ArrowUpDown className="h-3 w-3 opacity-40" />
            )}
          </button>
        );
      })}
      <span className="ml-auto text-[10px] text-stone-300 hidden sm:inline">💡 กดชื่อคอลัมน์เพื่อเรียงลำดับ</span>
    </div>
  );
}

/* ── Expandable card wrapper ── */
function RequestCard({
  children,
  expandedContent,
  isExpanded,
  onToggle,
  borderColor,
}: {
  children: React.ReactNode;
  expandedContent: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  borderColor: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div className={`overflow-hidden rounded-xl border border-stone-200/80 border-l-4 ${borderColor} bg-white shadow-sm`}>
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-3 px-5 py-4 text-left">
        <div className="min-w-0 flex-1">{children}</div>
        <motion.span
          animate={reduceMotion ? {} : { rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.22 }}
          style={{ display: 'inline-flex' }}
          className="mt-0.5 shrink-0 text-stone-400"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="expanded"
            initial={reduceMotion ? {} : { height: 0, opacity: 0 }}
            animate={reduceMotion ? {} : { height: 'auto', opacity: 1 }}
            exit={reduceMotion ? {} : { height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="border-t border-stone-100 bg-stone-50/60 px-5 pb-5 pt-4">
              {expandedContent}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Pending card ── */
function PendingRequestCard({
  item,
  isExpanded,
  onToggle,
  processingRequestId,
  reasons,
  onReasonChange,
  onApprove,
  onReject,
}: {
  item: WarehousePendingRequestItem;
  isExpanded: boolean;
  onToggle: () => void;
  processingRequestId: string | null;
  reasons: Record<string, string>;
  onReasonChange: (id: string, value: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const isProcessing = processingRequestId === item.id;
  const hasMapLink = item.delivery_lat != null && item.delivery_lng != null;

  return (
    <RequestCard
      isExpanded={isExpanded}
      onToggle={onToggle}
      borderColor="border-l-amber-400"
      expandedContent={
        <div className="space-y-3">
          {/* Location detail */}
          {item.delivery_location_text ? (
            <div className="rounded-xl bg-white border border-stone-100 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-1">สถานที่รับของรางวัล</p>
              <p className="text-sm text-stone-700 leading-relaxed">{item.delivery_location_text}</p>
              {hasMapLink && (
                <a
                  href={`https://www.google.com/maps?q=${item.delivery_lat},${item.delivery_lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <MapPin className="h-3 w-3" /> ดูบนแผนที่
                </a>
              )}
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-stone-400">
              <MapPin className="h-3.5 w-3.5 shrink-0" /> ยังไม่ได้ระบุสถานที่รับของ
            </p>
          )}

          {/* Reject reason textarea */}
          <textarea
            value={reasons[item.id] || ''}
            onChange={(e) => onReasonChange(item.id, e.target.value)}
            placeholder="เหตุผลในการปฏิเสธ (ถ้ามี)"
            className="w-full resize-none rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
            rows={2}
          />

          {/* Action buttons */}
          <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
            <motion.button
              type="button"
              onClick={() => onApprove(item.id)}
              disabled={isProcessing}
              whileTap={reduceMotion ? {} : { scale: 0.97 }}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {isProcessing ? 'กำลังดำเนินการ…' : 'อนุมัติคำขอ'}
            </motion.button>
            <motion.button
              type="button"
              onClick={() => onReject(item.id)}
              disabled={isProcessing}
              whileTap={reduceMotion ? {} : { scale: 0.97 }}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              ปฏิเสธ
            </motion.button>
          </div>
        </div>
      }
    >
      <div className="space-y-2">
        {/* Row 1: reward name + status badge */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-[15px] font-bold text-on-surface leading-tight truncate">
            {item.reward_name_th ?? 'รางวัลที่เลือก'}
          </p>
          <StatusBadge status={item.status} label="รอตรวจสอบ" size="sm" />
        </div>
        {/* Row 2: points + qty + date chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 rounded-md bg-primary/8 px-2 py-0.5 text-xs font-bold text-primary">
            <Coins className="h-3 w-3" />
            {Number(item.requested_points).toLocaleString('th-TH')} แต้ม
          </span>
          <span className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
            <Package className="h-3 w-3 text-stone-400" />
            {Number(item.quantity)} ชิ้น
          </span>
          <span className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
            <CalendarRange className="h-3 w-3 text-stone-400" />
            ขอแลกเมื่อ {formatDateTime(item.requested_at)}
          </span>
        </div>
        {/* Row 3: farmer info (dimmed) */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-stone-400">
          {item.farmer_display_name && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />{item.farmer_display_name}
            </span>
          )}
          {item.farmer_phone && (
            <a href={`tel:${item.farmer_phone}`} className="flex items-center gap-1 text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
              <Phone className="h-3 w-3" />{item.farmer_phone}
            </a>
          )}
          {item.farmer_province && (
            <span>{item.farmer_province}</span>
          )}
        </div>
      </div>
    </RequestCard>
  );
}

/* ── Answered card ── */
function AnsweredRequestCard({
  item,
  isExpanded,
  onToggle,
}: {
  item: WarehousePendingRequestItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isApproved = item.status === 'warehouse_approved';
  const isRejected = item.status === 'warehouse_rejected';
  const hasMapLink = item.delivery_lat != null && item.delivery_lng != null;

  const borderColor = isApproved ? 'border-l-emerald-400' : isRejected ? 'border-l-red-300' : 'border-l-stone-300';
  const verdictColor = isApproved ? 'text-emerald-700' : isRejected ? 'text-red-600' : 'text-stone-500';
  const VerdictIcon = isApproved ? CheckCircle2 : isRejected ? XCircle : Clock;
  const verdictLabel = isApproved ? 'อนุมัติแล้ว' : isRejected ? 'ปฏิเสธแล้ว' : 'รอดำเนินการ';

  return (
    <RequestCard
      isExpanded={isExpanded}
      onToggle={onToggle}
      borderColor={borderColor}
      expandedContent={
        <div className="space-y-2.5">
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
          {item.delivery_location_text ? (
            <div className="flex items-start gap-2 rounded-xl bg-white border border-stone-100 px-3 py-2.5">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-0.5">สถานที่รับของรางวัล</p>
                <p className="text-sm leading-relaxed text-stone-600">{item.delivery_location_text}</p>
                {hasMapLink && (
                  <a
                    href={`https://www.google.com/maps?q=${item.delivery_lat},${item.delivery_lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    ดูบนแผนที่
                  </a>
                )}
              </div>
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-stone-400">
              <MapPin className="h-3.5 w-3.5 shrink-0" /> ไม่ได้ระบุสถานที่รับของ
            </p>
          )}
        </div>
      }
    >
      <div className="space-y-2">
        {/* Row 1: reward name + verdict status */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-[15px] font-bold text-on-surface leading-tight truncate">
            {item.reward_name_th ?? 'รางวัลที่เลือก'}
          </p>
          <span className={`flex items-center gap-1 text-xs font-bold shrink-0 ${verdictColor}`}>
            <VerdictIcon className="h-3.5 w-3.5" />
            {verdictLabel}
          </span>
        </div>
        {/* Row 2: points + qty + decision date chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${
            isApproved ? 'bg-emerald-50 text-emerald-700' : isRejected ? 'bg-red-50 text-red-600' : 'bg-stone-100 text-stone-600'
          }`}>
            <Coins className="h-3 w-3" />
            {Number(item.requested_points).toLocaleString('th-TH')} แต้ม
          </span>
          <span className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
            <Package className="h-3 w-3 text-stone-400" />
            {Number(item.quantity)} ชิ้น
          </span>
          {item.warehouse_decision_at && (
            <span className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
              <CalendarRange className="h-3 w-3 text-stone-400" />
              ตัดสินเมื่อ {formatDateTime(item.warehouse_decision_at)}
            </span>
          )}
        </div>
        {/* Row 3: farmer + rejection reason (dimmed) */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-stone-400">
          {item.farmer_display_name && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />{item.farmer_display_name}
            </span>
          )}
          {item.farmer_province && <span>{item.farmer_province}</span>}
          {isRejected && item.rejection_reason && (
            <span className="text-red-400 truncate max-w-[200px]">"{item.rejection_reason}"</span>
          )}
        </div>
      </div>
    </RequestCard>
  );
}

/* ── Answered tab with filter + sort ── */
type HistoryFilter = 'all' | 'approved' | 'rejected';

function AnsweredTab({
  answeredRequests,
  isLoading,
  expandedId,
  onToggle,
}: {
  answeredRequests: WarehousePendingRequestItem[];
  isLoading: boolean;
  expandedId: string | null;
  onToggle: (id: string) => void;
}) {
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [sort, setSort] = useState<{ key: 'decision_at' | 'reward'; dir: SortDir }>({ key: 'decision_at', dir: 'desc' });

  const approvedCount = answeredRequests.filter((r) => r.status === 'warehouse_approved').length;
  const rejectedCount = answeredRequests.filter((r) => r.status === 'warehouse_rejected').length;

  function toggleSort(key: 'decision_at' | 'reward') {
    setSort((cur) => cur.key === key ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
  }

  const filtered = useMemo(() => {
    const base = filter === 'approved'
      ? answeredRequests.filter((r) => r.status === 'warehouse_approved')
      : filter === 'rejected'
        ? answeredRequests.filter((r) => r.status === 'warehouse_rejected')
        : answeredRequests;
    return [...base].sort((a, b) => {
      const mul = sort.dir === 'asc' ? 1 : -1;
      if (sort.key === 'reward') return mul * (a.reward_name_th ?? '').localeCompare(b.reward_name_th ?? '');
      return mul * (new Date(a.warehouse_decision_at ?? a.requested_at).getTime() - new Date(b.warehouse_decision_at ?? b.requested_at).getTime());
    });
  }, [answeredRequests, filter, sort]);

  const filterOptions: { value: HistoryFilter; label: string; count: number }[] = [
    { value: 'all', label: 'ทั้งหมด', count: answeredRequests.length },
    { value: 'approved', label: 'อนุมัติ', count: approvedCount },
    { value: 'rejected', label: 'ปฏิเสธ', count: rejectedCount },
  ];

  return (
    <div className="space-y-3">
      {/* Filter pills */}
      {!isLoading && answeredRequests.length > 0 && (
        <div className="flex rounded-xl bg-stone-100 p-0.5 gap-0.5">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] px-3 py-2 text-sm font-semibold transition-all ${
                filter === opt.value ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {opt.label}
              {opt.count > 0 && (
                <span className={`rounded-full min-w-[18px] text-center px-1 py-0.5 text-[10px] font-bold leading-none ${
                  filter === opt.value ? 'bg-primary/10 text-primary' : 'bg-stone-200 text-stone-400'
                }`}>{opt.count}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Sort header */}
      {!isLoading && filtered.length > 0 && (
        <SortHeaderBar
          cols={[
            { key: 'decision_at' as const, label: 'วันตัดสินใจ', dirLabels: ['เก่าก่อน', 'ใหม่ก่อน'] },
            { key: 'reward' as const, label: 'ชื่อรางวัล', dirLabels: ['ก→ฮ', 'ฮ→ก'] },
          ]}
          sort={sort}
          onSort={toggleSort}
        />
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : answeredRequests.length === 0 ? (
        <EmptyState title="ยังไม่มีประวัติคำขอ" description="คำขอที่อนุมัติหรือปฏิเสธแล้วจะแสดงที่นี่" icon={CheckCircle2} />
      ) : filtered.length === 0 ? (
        <EmptyState title="ไม่มีรายการในกลุ่มนี้" description="ลองเปลี่ยนตัวกรอง" icon={CheckCircle2} />
      ) : (
        filtered.map((item) => (
          <div key={item.id}>
            <AnsweredRequestCard
              item={item}
              isExpanded={expandedId === item.id}
              onToggle={() => onToggle(item.id)}
            />
          </div>
        ))
      )}
    </div>
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const summary = useMemo(() => {
    const totalPoints = pendingRequests.reduce((sum, item) => sum + Number(item.requested_points || 0), 0);
    const approvedCount = answeredRequests.filter((r) => r.status === 'warehouse_approved').length;
    const rejectedCount = answeredRequests.filter((r) => r.status === 'warehouse_rejected').length;
    return { totalPoints, approvedCount, rejectedCount };
  }, [pendingRequests, answeredRequests]);

  const loadPendingRequests = async (forceRefresh = false) => {
    if (!hasAccessToken()) {
      setMessage('ยังไม่พบโทเคน กรุณาเข้าสู่ระบบก่อน');
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

  function toggleExpand(id: string) {
    setExpandedId((cur) => cur === id ? null : id);
  }

  const tabs: { id: WarehouseTab; label: string; count: number }[] = [
    { id: 'pending', label: 'รอตรวจสอบ', count: pendingRequests.length },
    { id: 'answered', label: 'ประวัติ', count: answeredRequests.length },
  ];

  return (
    <ErrorBoundary>
      <div className="space-y-6 pb-10">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">คลังพัสดุ</p>
            <h1 className="mt-0.5 text-3xl font-light tracking-tight text-on-surface sm:text-4xl">อนุมัติรางวัล</h1>
            <p className="mt-1 text-sm text-stone-400">ตรวจสอบและอนุมัติคำขอแลกรางวัลของเกษตรกร</p>
          </div>
          <motion.button
            type="button"
            onClick={() => {
              if (activeTab === 'pending') void loadPendingRequests(true);
              else void loadAnsweredRequests(true);
            }}
            disabled={isLoading}
            whileTap={reduceMotion ? {} : { scale: 0.88 }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-outline-variant/20 bg-white text-on-surface-variant transition hover:bg-stone-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </motion.button>
        </div>

        {message && <AlertBanner message={message} tone={inferMessageTone(message)} />}

        {/* Stats strip */}
        {!isLoading && (
          <div className="flex flex-wrap gap-2">
            <span className="flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
              <Gift className="h-3.5 w-3.5" />
              รอตรวจสอบ {pendingRequests.length} คำขอ · {summary.totalPoints.toLocaleString('th-TH')} แต้ม
            </span>
            <span className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              อนุมัติแล้ว {summary.approvedCount.toLocaleString('th-TH')} คำขอ
            </span>
            <span className="flex items-center gap-1.5 rounded-md bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600">
              <XCircle className="h-3.5 w-3.5" />
              ปฏิเสธแล้ว {summary.rejectedCount.toLocaleString('th-TH')} คำขอ
            </span>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex rounded-xl bg-stone-100 p-0.5 gap-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActiveTab(tab.id); setExpandedId(null); }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] px-4 py-2 text-sm font-semibold transition-all ${
                activeTab === tab.id ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {tab.label}
              {!isLoading && tab.count > 0 && (
                <span className={`rounded-full min-w-[18px] text-center px-1 py-0.5 text-[10px] font-bold leading-none ${
                  activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-stone-200 text-stone-400'
                }`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Pending tab */}
        {activeTab === 'pending' && (
          <div className="space-y-3">
            {isLoading ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
            ) : pendingRequests.length === 0 ? (
              <EmptyState
                title="ยังไม่มีคำขอที่รอตรวจสอบ"
                description="เมื่อมีคำขอรออนุมัติจากเกษตรกร ระบบจะนำเข้ากล่องงานนี้ให้โดยอัตโนมัติ"
                icon={PackageSearch}
              />
            ) : (
              pendingRequests.map((item) => (
                <div key={item.id}>
                  <PendingRequestCard
                    item={item}
                    isExpanded={expandedId === item.id}
                    onToggle={() => toggleExpand(item.id)}
                    processingRequestId={processingRequestId}
                    reasons={reasons}
                    onReasonChange={(id, value) => setReasons((prev) => ({ ...prev, [id]: value }))}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                </div>
              ))
            )}
          </div>
        )}

        {/* Answered tab */}
        {activeTab === 'answered' && (
          <AnsweredTab
            answeredRequests={answeredRequests}
            isLoading={isLoading}
            expandedId={expandedId}
            onToggle={toggleExpand}
          />
        )}

      </div>
    </ErrorBoundary>
  );
}
