'use client';

import { useMemo, useState } from 'react';
import { CalendarRange, CheckCircle2, Clock, Coins, MapPin, Package, User, XCircle } from 'lucide-react';
import EmptyState from '@/app/_components/EmptyState';
import { SkeletonCard } from '@/app/_components/Skeleton';
import SortHeaderBar, { type SortDir } from '@/app/_components/SortHeaderBar';
import { type WarehousePendingRequestItem } from '@/app/_lib/api';
import { formatDateTime } from '@/app/_lib/utils';
import RequestCard from './RequestCard';

type HistoryFilter = 'all' | 'approved' | 'rejected';

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
        <div className="flex items-center justify-between gap-2">
          <p className="text-[15px] font-bold text-on-surface leading-tight truncate">
            {item.reward_name_th ?? 'รางวัลที่เลือก'}
          </p>
          <span className={`flex items-center gap-1 text-xs font-bold shrink-0 ${verdictColor}`}>
            <VerdictIcon className="h-3.5 w-3.5" />
            {verdictLabel}
          </span>
        </div>
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

interface Props {
  answeredRequests: WarehousePendingRequestItem[];
  isLoading: boolean;
  expandedId: string | null;
  onToggle: (id: string) => void;
}

export default function AnsweredTab({ answeredRequests, isLoading, expandedId, onToggle }: Props) {
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
