'use client';

import { motion, useReducedMotion } from 'motion/react';
import { CalendarRange, CheckCircle2, Coins, MapPin, Package, PackageSearch, Phone, User, XCircle } from 'lucide-react';
import EmptyState from '@/app/_components/EmptyState';
import { SkeletonCard } from '@/app/_components/Skeleton';
import StatusBadge from '@/app/_components/StatusBadge';
import { type WarehousePendingRequestItem } from '@/app/_lib/api';
import { formatDateTime } from '@/app/_lib/utils';
import RequestCard from './RequestCard';

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

          <textarea
            value={reasons[item.id] || ''}
            onChange={(e) => onReasonChange(item.id, e.target.value)}
            placeholder="เหตุผลในการปฏิเสธ (ถ้ามี)"
            className="w-full resize-none rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
            rows={2}
          />

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
        <div className="flex items-center justify-between gap-2">
          <p className="text-[15px] font-bold text-on-surface leading-tight truncate">
            {item.reward_name_th ?? 'รางวัลที่เลือก'}
          </p>
          <StatusBadge status={item.status} label="รอตรวจสอบ" size="sm" />
        </div>
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
          {item.farmer_province && <span>{item.farmer_province}</span>}
        </div>
      </div>
    </RequestCard>
  );
}

interface Props {
  items: WarehousePendingRequestItem[];
  isLoading: boolean;
  expandedId: string | null;
  onToggle: (id: string) => void;
  processingRequestId: string | null;
  reasons: Record<string, string>;
  onReasonChange: (id: string, value: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export default function PendingTab({ items, isLoading, expandedId, onToggle, processingRequestId, reasons, onReasonChange, onApprove, onReject }: Props) {
  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          title="ยังไม่มีคำขอที่รอตรวจสอบ"
          description="เมื่อมีคำขอรออนุมัติจากเกษตรกร ระบบจะนำเข้ากล่องงานนี้ให้โดยอัตโนมัติ"
          icon={PackageSearch}
        />
      ) : (
        items.map((item) => (
          <div key={item.id}>
            <PendingRequestCard
              item={item}
              isExpanded={expandedId === item.id}
              onToggle={() => onToggle(item.id)}
              processingRequestId={processingRequestId}
              reasons={reasons}
              onReasonChange={onReasonChange}
              onApprove={onApprove}
              onReject={onReject}
            />
          </div>
        ))
      )}
    </div>
  );
}
