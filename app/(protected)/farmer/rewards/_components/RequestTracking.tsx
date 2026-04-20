'use client';

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CalendarRange, CheckCheck, ChevronDown, Clock3, Coins, Gift, MapPin, Truck, XCircle } from 'lucide-react';
import Image from 'next/image';
import { SkeletonCard } from '@/app/_components/Skeleton';
import StatusBadge from '@/app/_components/StatusBadge';
import EmptyState from '@/app/_components/EmptyState';
import { type FarmerRewardItem, type FarmerRewardRequestItem } from '@/app/_lib/api';
import { formatDateTime } from '@/app/_lib/utils';

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

function DeliveryProgress({ deliveryJob }: { deliveryJob: NonNullable<FarmerRewardRequestItem['reward_delivery_jobs']>[0] }) {
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
                  isDelivered && i === steps.length - 1 ? 'bg-emerald-500 text-white' : done ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-300'
                }`}>
                  {isDelivered && i === steps.length - 1 ? <CheckCheck className="h-4 w-4" /> : <span>{i + 1}</span>}
                  {current && <span className="absolute -bottom-0.5 h-2 w-2 animate-pulse rounded-full bg-amber-400" />}
                </div>
                <span className={`text-center text-[0.65rem] font-medium leading-tight ${done ? 'text-stone-600' : 'text-stone-300'}`}>{step.label}</span>
                {step.time && <span className="text-center text-[0.6rem] leading-tight text-stone-400">{formatDateTime(step.time)}</span>}
              </div>
              {i < steps.length - 1 && <div className={`-mt-7 h-0.5 flex-1 rounded-full ${i < currentIdx ? 'bg-emerald-300' : 'bg-stone-200'}`} />}
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

type SortCol = 'date' | 'points' | 'status';

interface Props {
  rewardRequests: FarmerRewardRequestItem[];
  rewardsCatalog: FarmerRewardItem[];
  isLoading: boolean;
  cancellingRewardRequestId: string | null;
  onCancel: (requestId: string) => void;
}

export default function RequestTracking({ rewardRequests, rewardsCatalog, isLoading, cancellingRewardRequestId, onCancel }: Props) {
  const reduceMotion = useReducedMotion();

  const [filter, setFilter] = useState<FilterValue>('all');
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<SortCol>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const rewardNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of rewardsCatalog) map[r.id] = r.name_th;
    return map;
  }, [rewardsCatalog]);

  const filteredRequests = useMemo(() => {
    let list = rewardRequests;
    if (filter === 'active') list = list.filter((r) => ACTIVE_REQUEST_STATUSES.has(r.status));
    else if (filter === 'done') list = list.filter((r) => !ACTIVE_REQUEST_STATUSES.has(r.status));
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortCol === 'points') return ((Number(a.requested_points) || 0) - (Number(b.requested_points) || 0)) * dir;
      if (sortCol === 'status') return a.status.localeCompare(b.status) * dir;
      return (new Date(a.requested_at ?? 0).getTime() - new Date(b.requested_at ?? 0).getTime()) * dir;
    });
  }, [rewardRequests, filter, sortCol, sortDir]);

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir(col === 'date' ? 'desc' : 'asc'); }
  };

  const Pill = ({ col, labels }: { col: SortCol; labels: [string, string] }) =>
    sortCol === col
      ? <span className="ml-1 whitespace-nowrap rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary leading-none">{sortDir === 'desc' ? labels[0] : labels[1]}</span>
      : null;

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-base font-bold text-stone-800">ติดตามคำขอ</h2>
        {rewardRequests.length > 0 && (
          <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-bold text-stone-500">{rewardRequests.length}</span>
        )}
      </div>

      <div className="mb-3 grid grid-cols-3 gap-1.5 rounded-2xl border border-stone-100 bg-stone-50 p-1.5">
        {FILTER_OPTIONS.map((opt) => {
          const count = opt.value === 'all' ? rewardRequests.length
            : opt.value === 'active' ? rewardRequests.filter((r) => ACTIVE_REQUEST_STATUSES.has(r.status)).length
            : rewardRequests.filter((r) => !ACTIVE_REQUEST_STATUSES.has(r.status)).length;
          const isActive = filter === opt.value;
          return (
            <button key={opt.value} type="button" onClick={() => setFilter(opt.value)}
              className={`flex min-h-[48px] flex-col items-center justify-center rounded-xl px-2 py-2 text-sm font-semibold transition-all ${isActive ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400'}`}>
              {opt.label}
              {count > 0 && (
                <span className={`mt-0.5 rounded-full px-2 py-0.5 text-xs font-bold ${isActive ? 'bg-primary/10 text-primary' : 'bg-stone-200 text-stone-400'}`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : filteredRequests.length === 0 ? (
        <EmptyState title="ยังไม่มีคำขอในกลุ่มนี้" description="กดขอแลกรางวัลจากรายการด้านบน ระบบจะแสดงสถานะที่นี่ทันที" icon={Truck} />
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={`${filter}-${sortCol}-${sortDir}`}
            className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
            initial={reduceMotion ? {} : { opacity: 0 }} animate={reduceMotion ? {} : { opacity: 1 }} exit={reduceMotion ? {} : { opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/60 px-4 py-1.5 text-xs font-semibold text-stone-400">
              <button type="button" onClick={() => handleSort('date')} className="flex items-center hover:text-stone-600 transition-colors">
                วันที่<Pill col="date" labels={['ล่าสุด', 'เก่าสุด']} />
              </button>
              <span className="text-stone-200">·</span>
              <button type="button" onClick={() => handleSort('points')} className="flex items-center hover:text-stone-600 transition-colors">
                แต้ม<Pill col="points" labels={['มาก', 'น้อย']} />
              </button>
              <span className="text-stone-200">·</span>
              <button type="button" onClick={() => handleSort('status')} className="flex items-center hover:text-stone-600 transition-colors">
                สถานะ<Pill col="status" labels={['ก→ฮ', 'ฮ→ก']} />
              </button>
            </div>
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
                    <button type="button" onClick={() => setExpandedRequestId(isExpanded ? null : request.id)}
                      className={`flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors ${isExpanded ? 'bg-stone-50' : 'hover:bg-stone-50/60 active:bg-stone-50'}`}>
                      <div className="relative mt-0.5 h-9 w-9 shrink-0 overflow-hidden rounded-xl">
                        {rewardImg ? (
                          <Image src={rewardImg} alt={rewardName} fill unoptimized className="object-cover" sizes="36px" />
                        ) : (
                          <div className={`flex h-full w-full items-center justify-center rounded-xl ${isPending ? 'bg-amber-50' : isDelivered ? 'bg-emerald-50' : 'bg-stone-50'}`}>
                            {isPending ? (
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
                              </span>
                            ) : isDelivered ? <CheckCheck className="h-4 w-4 text-emerald-500" /> : <Gift className={`h-4 w-4 ${isApproved ? 'text-sky-400' : 'text-stone-300'}`} />}
                          </div>
                        )}
                        {rewardImg && isPending && (
                          <span className="absolute right-0.5 top-0.5 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-baseline gap-2">
                          <p className="truncate text-sm font-bold text-stone-900">{rewardName}</p>
                          <span className="shrink-0 text-xs text-stone-400">ขอเมื่อ {formatDateTime(request.requested_at)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-stone-600">
                            <Coins className="h-3 w-3" />{Number(request.requested_points).toLocaleString('th-TH')} แต้ม
                          </span>
                          {isApproved && hasDelivery ? (
                            <StatusBadge status={deliveryJob.status} label={formatDeliveryStatus(deliveryJob.status)} size="sm" />
                          ) : isApproved && !hasDelivery ? (
                            <StatusBadge status="pickup_scheduled" label="รอจัดส่ง" size="sm" />
                          ) : (
                            <StatusBadge status={request.status} label={formatRewardRequestStatus(request.status)} size="sm" />
                          )}
                        </div>
                      </div>
                      <motion.span animate={reduceMotion ? {} : { rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.18 }} style={{ display: 'inline-flex' }} className="mt-1 shrink-0 text-stone-300">
                        <ChevronDown className="h-3.5 w-3.5" />
                      </motion.span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div key="detail"
                          initial={reduceMotion ? {} : { height: 0, opacity: 0 }} animate={reduceMotion ? {} : { height: 'auto', opacity: 1 }} exit={reduceMotion ? {} : { height: 0, opacity: 0 }}
                          transition={{ duration: 0.26, ease: 'easeInOut' }} style={{ overflow: 'hidden' }}
                        >
                          <div className="space-y-3 border-t border-stone-100 px-4 pb-4 pt-3">
                            {request.delivery_location_text ? (
                              <div className="flex items-start gap-2">
                                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                <div>
                                  <p className="text-xs font-semibold text-stone-400">สถานที่รับของ</p>
                                  <p className="text-sm text-stone-800">{request.delivery_location_text}</p>
                                  {request.delivery_lat != null && request.delivery_lng != null && (
                                    <a href={`https://www.google.com/maps?q=${request.delivery_lat},${request.delivery_lng}`} target="_blank" rel="noopener noreferrer"
                                      className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">ดูแผนที่</a>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <p className="flex items-center gap-1.5 text-sm text-stone-400"><MapPin className="h-4 w-4 shrink-0" />ยังไม่ได้ระบุสถานที่รับของ</p>
                            )}
                            {isApproved && !hasDelivery && (
                              <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-3">
                                <Clock3 className="h-5 w-5 shrink-0 text-amber-500" />
                                <span className="text-sm font-semibold text-amber-700">รอฝ่ายขนส่งจัดรอบส่งของ</span>
                              </div>
                            )}
                            {hasDelivery && <DeliveryProgress deliveryJob={deliveryJob} />}
                            {hasDelivery && (
                              <p className="text-sm text-stone-500">สถานะจัดส่ง:{' '}
                                <span className={`font-bold ${isDelivered ? 'text-emerald-600' : 'text-amber-600'}`}>{formatDeliveryStatus(deliveryJob.status)}</span>
                              </p>
                            )}
                            {canCancel && (
                              <button type="button" onClick={() => onCancel(request.id)} disabled={cancellingRewardRequestId === request.id}
                                className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 text-sm font-bold text-red-500 transition hover:bg-red-100 disabled:opacity-50 active:scale-95">
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
  );
}
