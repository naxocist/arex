'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowUpDown,
  CalendarRange,
  ChevronDown,
  Factory,
  MapPin,
  RefreshCw,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import EmptyState from '@/app/_components/EmptyState';
import ErrorBoundary from '@/app/_components/ErrorBoundary';
import { SkeletonCard } from '@/app/_components/Skeleton';
import StatusBadge from '@/app/_components/StatusBadge';
import {
  ApiError,
  factoryApi,
  type FactoryConfirmedIntakeItem,
  type FactoryIntakeSummary,
  type FactoryPendingIntakeItem,
} from '@/app/_lib/api';

function hasAccessToken(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem('AREX_ACCESS_TOKEN'));
}

function formatMaterial(materialType: string): string {
  const map: Record<string, string> = {
    rice_straw: 'ฟางข้าว',
    cassava_root: 'เหง้ามันสำปะหลัง',
    sugarcane_bagasse: 'ชานอ้อย',
    corn_stover: 'ตอซังข้าวโพด',
    plastic_waste: 'พลาสติก',
  };
  return map[materialType] ?? materialType;
}

function quantityToKg(quantityValue: number, toKgFactor: number | null | undefined): number | null {
  if (typeof toKgFactor === 'number' && Number.isFinite(toKgFactor) && toKgFactor > 0) {
    return quantityValue * toKgFactor;
  }
  return null;
}

function fallbackThaiUnit(unitCode: string): string {
  const map: Record<string, string> = { kg: 'กก.', ton: 'ตัน' };
  return map[unitCode] ?? unitCode;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });
}

function inferMessageTone(message: string | null): 'info' | 'success' | 'error' {
  if (!message) return 'info';
  if (message.includes('ไม่สำเร็จ') || message.includes('กรุณา')) return 'error';
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
function IntakeCard({
  children,
  expandedContent,
  isExpanded,
  onToggle,
  accent = 'amber',
}: {
  children: React.ReactNode;
  expandedContent: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  accent?: 'amber' | 'emerald';
}) {
  const reduceMotion = useReducedMotion();
  const borderColor = accent === 'emerald' ? 'border-l-emerald-400' : 'border-l-amber-400';
  const hasExpanded = expandedContent !== null && expandedContent !== undefined && expandedContent !== false;
  return (
    <motion.div className={`overflow-hidden rounded-xl border border-stone-200/80 border-l-4 ${borderColor} bg-white shadow-sm`}>
      <button
        type="button"
        onClick={hasExpanded ? onToggle : undefined}
        className={`flex w-full items-start gap-3 px-5 py-4 text-left ${hasExpanded ? '' : 'cursor-default'}`}
      >
        <div className="min-w-0 flex-1">{children}</div>
        {hasExpanded && (
          <motion.span
            animate={reduceMotion ? {} : { rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.22 }}
            style={{ display: 'inline-flex' }}
            className="mt-0.5 shrink-0 text-stone-400"
          >
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        )}
      </button>
      <AnimatePresence initial={false}>
        {hasExpanded && isExpanded && (
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

function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-stone-900/40 backdrop-blur-sm px-4">
      <motion.div
        initial={reduceMotion ? {} : { opacity: 0, scale: 0.95, y: 8 }}
        animate={reduceMotion ? {} : { opacity: 1, scale: 1, y: 0 }}
        exit={reduceMotion ? {} : { opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
      >
        <p className="text-base font-semibold text-stone-800">{message}</p>
        <p className="mt-1 text-sm text-stone-500">การกระทำนี้จะอัปเดตสถานะในระบบทันที</p>
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onCancel}
            className="flex-1 rounded-xl border border-stone-200 bg-white py-2.5 text-sm font-semibold text-stone-600 hover:bg-stone-50 transition-colors">
            ยกเลิก
          </button>
          <button type="button" onClick={onConfirm}
            className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity">
            ยืนยัน
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function FactoryIntake() {
  const [queue, setQueue] = useState<FactoryPendingIntakeItem[]>([]);
  const [confirmed, setConfirmed] = useState<FactoryConfirmedIntakeItem[]>([]);
  const [summary, setSummary] = useState<FactoryIntakeSummary | null>(null);
  const [weightByJobId, setWeightByJobId] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [confirmingJobId, setConfirmingJobId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmPending, setConfirmPending] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'confirmed'>('pending');
  const [confirmedSort, setConfirmedSort] = useState<{ key: 'confirmed_at' | 'material'; dir: SortDir }>({ key: 'confirmed_at', dir: 'desc' });

  const confirm = (msg: string, onConfirm: () => void) => setConfirmPending({ message: msg, onConfirm });

  const loadQueue = async (forceRefresh = false) => {
    if (!hasAccessToken()) {
      setMessage('ยังไม่พบโทเคน กรุณาเข้าสู่ระบบก่อน');
      return;
    }
    setIsLoading(true);
    try {
      const res = await factoryApi.listPendingIntakes({ forceRefresh });
      setQueue(res.queue);
      setConfirmed(res.confirmed);
      setSummary(res.summary);
      setWeightByJobId((prev) => {
        const next = { ...prev };
        for (const item of res.queue) {
          if (!next[item.pickup_job_id]) {
            const kg = quantityToKg(Number(item.quantity_value), item.quantity_to_kg_factor);
            if (kg !== null) next[item.pickup_job_id] = String(kg);
          }
        }
        return next;
      });
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof ApiError ? `โหลดคิวรับเข้าไม่สำเร็จ: ${error.message}` : 'โหลดคิวรับเข้าไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadQueue(); }, []);

  const handleConfirm = async (item: FactoryPendingIntakeItem) => {
    const inputWeight = Number(weightByJobId[item.pickup_job_id]);
    if (!Number.isFinite(inputWeight) || inputWeight <= 0) {
      setMessage('กรุณาระบุน้ำหนักจริง (กิโลกรัม) ให้ถูกต้อง');
      return;
    }
    setConfirmingJobId(item.pickup_job_id);
    setMessage(null);
    try {
      await factoryApi.confirmIntake({ pickup_job_id: item.pickup_job_id, measured_weight_kg: inputWeight });
      setMessage('ยืนยันรับเข้าโรงงานสำเร็จแล้ว');
      await loadQueue(true);
    } catch (error) {
      setMessage(error instanceof ApiError ? `ยืนยันรับเข้าไม่สำเร็จ: ${error.message}` : 'ยืนยันรับเข้าไม่สำเร็จ');
    } finally {
      setConfirmingJobId(null);
    }
  };

  function toggleSort<T extends string>(
    current: { key: T; dir: SortDir },
    key: T,
    setter: React.Dispatch<React.SetStateAction<{ key: T; dir: SortDir }>>
  ) {
    setter(current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
  }

  const sortedConfirmed = useMemo(() => [...confirmed].sort((a, b) => {
    const mul = confirmedSort.dir === 'asc' ? 1 : -1;
    if (confirmedSort.key === 'material') return mul * (a.material_name_th ?? a.material_type).localeCompare(b.material_name_th ?? b.material_type);
    return mul * (new Date(a.confirmed_at).getTime() - new Date(b.confirmed_at).getTime());
  }), [confirmed, confirmedSort]);

  const tabs = [
    { id: 'pending' as const, label: 'รอยืนยัน', count: queue.length },
    { id: 'confirmed' as const, label: 'ยืนยันแล้ว', count: confirmed.length },
  ];

  return (
    <ErrorBoundary>
      <AnimatePresence>
        {confirmPending && (
          <ConfirmDialog
            message={confirmPending.message}
            onConfirm={() => { confirmPending.onConfirm(); setConfirmPending(null); }}
            onCancel={() => setConfirmPending(null)}
          />
        )}
      </AnimatePresence>
      <div className="space-y-6 pb-10">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">โรงงาน</p>
            <h1 className="mt-0.5 text-3xl font-light tracking-tight text-on-surface sm:text-4xl">ตรวจรับวัสดุ</h1>
            <p className="mt-1 text-sm text-stone-400">ชั่งน้ำหนักจริงและยืนยันรับเข้าเพื่อออกแต้มให้เกษตรกร</p>
          </div>
          <motion.button
            type="button"
            onClick={() => void loadQueue(true)}
            disabled={isLoading}
            aria-label="รีเฟรชข้อมูล"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant/20 bg-white text-on-surface-variant transition hover:bg-stone-50 disabled:opacity-50"
            whileTap={{ scale: 0.88 }}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </motion.button>
        </div>

        {message && <AlertBanner message={message} tone={inferMessageTone(message)} />}

        {/* Stats strip */}
        {!isLoading && summary && (
          <div className="flex flex-wrap gap-2">
            <span className="rounded-md bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
              รอยืนยัน {(summary.arrived_count ?? queue.length).toLocaleString('th-TH')} รายการ
            </span>
            <span className="rounded-md bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800">
              ประมาณ {(summary.arrived_estimated_weight_kg_total ?? 0).toLocaleString('th-TH', { maximumFractionDigits: 1 })} กก.
            </span>
            <span className="rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
              ยืนยันแล้ว {(summary.confirmed_count ?? confirmed.length).toLocaleString('th-TH')} รายการ · {(summary.confirmed_weight_kg_total ?? 0).toLocaleString('th-TH', { maximumFractionDigits: 1 })} กก.
            </span>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex rounded-xl bg-stone-100 p-0.5 gap-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
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

        {/* ── Pending tab ── */}
        {activeTab === 'pending' && (
          <div className="space-y-3">
            {isLoading ? (
              <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)}</div>
            ) : queue.length === 0 ? (
              <EmptyState
                title="ยังไม่มีงานที่รอยืนยัน"
                description="เมื่อรถส่งวัสดุมาถึงโรงงาน รายการจะขึ้นที่นี่เพื่อให้บันทึกน้ำหนักจริง"
                icon={Factory}
              />
            ) : (
              queue.map((item) => {
                const materialName = item.material_name_th ?? formatMaterial(item.material_type);
                const estimatedKg = quantityToKg(Number(item.quantity_value), item.quantity_to_kg_factor);
                const arrivalDate = item.delivered_factory_at ?? item.planned_pickup_at;
                const isConfirming = confirmingJobId === item.pickup_job_id;
                const isExp = expandedId === item.pickup_job_id;
                return (
                  <div key={item.pickup_job_id}>
                    <IntakeCard
                      accent="amber"
                      isExpanded={isExp}
                      onToggle={() => setExpandedId((cur) => cur === item.pickup_job_id ? null : item.pickup_job_id)}
                      expandedContent={
                        <div className="space-y-4">
                          {/* Weight input + confirm */}
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                            <div className="flex-1">
                              <label className="block">
                                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-stone-600">
                                  <Scale className="h-3.5 w-3.5" />
                                  น้ำหนักจริงที่ชั่งได้ (กก.)
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={weightByJobId[item.pickup_job_id] ?? ''}
                                  onChange={(e) =>
                                    setWeightByJobId((prev) => ({ ...prev, [item.pickup_job_id]: e.target.value }))
                                  }
                                  placeholder="0.00"
                                  className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-base font-semibold outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 min-h-[48px]"
                                />
                              </label>
                            </div>
                            <motion.button
                              type="button"
                              onClick={() => confirm(`ยืนยันรับเข้าโรงงาน ${Number(weightByJobId[item.pickup_job_id] || 0).toLocaleString('th-TH')} กก.?`, () => void handleConfirm(item))}
                              disabled={isConfirming}
                              className="flex min-h-[48px] shrink-0 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
                              whileTap={{ scale: 0.97 }}
                            >
                              <ShieldCheck className="h-4 w-4" />
                              {isConfirming ? 'กำลังยืนยัน…' : 'ยืนยันรับเข้า'}
                            </motion.button>
                          </div>
                          {/* Declared quantity detail */}
                          <div className="rounded-xl bg-stone-100/70 px-4 py-3 text-sm">
                            <p className="text-xs text-stone-400 mb-1">ปริมาณที่แจ้งมา</p>
                            <p className="font-semibold text-stone-800">
                              {Number(item.quantity_value).toLocaleString('th-TH')} {fallbackThaiUnit(item.quantity_unit)}
                            </p>
                            {estimatedKg !== null && (
                              <p className="mt-0.5 text-xs text-stone-500">
                                ≈ {estimatedKg.toLocaleString('th-TH', { maximumFractionDigits: 2 })} กก. (ประมาณการ)
                              </p>
                            )}
                            {estimatedKg === null && (
                              <p className="mt-0.5 text-xs text-stone-500">หน่วยนี้แปลงเป็น กก. อัตโนมัติไม่ได้</p>
                            )}
                          </div>
                        </div>
                      }
                    >
                      <div className="space-y-2">
                        {/* Row 1: name + status */}
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[15px] font-bold text-on-surface leading-tight truncate">
                            {materialName}
                          </p>
                          <StatusBadge status={item.status} label="รอยืนยัน" size="sm" />
                        </div>
                        {/* Row 2: qty + arrival date chips */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
                            {Number(item.quantity_value).toLocaleString('th-TH')} {fallbackThaiUnit(item.quantity_unit)}
                          </span>
                          <span className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                            <CalendarRange className="h-3 w-3 text-stone-400" />
                            มาถึง {formatDate(arrivalDate)}
                          </span>
                        </div>
                        {/* Row 3: location (dimmed) */}
                        {item.pickup_location_text && (
                          <div className="flex items-center gap-1 text-xs text-stone-400">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{item.pickup_location_text}</span>
                          </div>
                        )}
                      </div>
                    </IntakeCard>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Confirmed tab ── */}
        {activeTab === 'confirmed' && (
          <div className="space-y-3">
            {!isLoading && sortedConfirmed.length > 0 && (
              <SortHeaderBar
                cols={[
                  { key: 'confirmed_at' as const, label: 'วันยืนยัน', dirLabels: ['เก่าก่อน', 'ใหม่ก่อน'] },
                  { key: 'material' as const, label: 'วัสดุ', dirLabels: ['ก→ฮ', 'ฮ→ก'] },
                ]}
                sort={confirmedSort}
                onSort={(key) => toggleSort(confirmedSort, key, setConfirmedSort)}
              />
            )}
            {isLoading ? (
              <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)}</div>
            ) : sortedConfirmed.length === 0 ? (
              <EmptyState
                title="ยังไม่มีประวัติการยืนยัน"
                description="เมื่อยืนยันรับเข้าแต่ละงาน ประวัติจะย้ายมาอยู่ที่นี่"
                icon={ShieldCheck}
              />
            ) : (
              sortedConfirmed.map((item) => {
                const materialName = item.material_name_th ?? formatMaterial(item.material_type);
                const isExp = expandedId === item.intake_id;
                return (
                  <div key={item.intake_id}>
                    <IntakeCard
                      accent="emerald"
                      isExpanded={isExp}
                      onToggle={() => setExpandedId((cur) => cur === item.intake_id ? null : item.intake_id)}
                      expandedContent={
                        <div className="grid gap-3 sm:grid-cols-3 text-sm">
                          <div>
                            <p className="text-xs text-stone-400">ปริมาณที่แจ้งมา</p>
                            <p className="mt-0.5 font-medium text-stone-700">
                              {Number(item.quantity_value).toLocaleString('th-TH')} {fallbackThaiUnit(item.quantity_unit)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-stone-400">น้ำหนักจริงที่ชั่งได้</p>
                            <p className="mt-0.5 font-medium text-emerald-700">
                              {item.measured_weight_kg.toLocaleString('th-TH', { maximumFractionDigits: 2 })} กก.
                              <span className="ml-1 text-xs text-stone-400">({item.measured_weight_ton.toLocaleString('th-TH', { maximumFractionDigits: 3 })} ตัน)</span>
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-stone-400">หมายเหตุ</p>
                            <p className="mt-0.5 text-stone-600">{item.discrepancy_note ?? '—'}</p>
                          </div>
                          <div className="sm:col-span-3">
                            <p className="text-xs text-stone-400">จุดรับต้นทาง</p>
                            <p className="mt-0.5 text-stone-600">{item.pickup_location_text}</p>
                          </div>
                        </div>
                      }
                    >
                      <div className="space-y-2">
                        {/* Row 1: name + status */}
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[15px] font-bold text-on-surface leading-tight truncate">
                            {materialName}
                          </p>
                          <StatusBadge status={item.status} label="ยืนยันแล้ว" size="sm" />
                        </div>
                        {/* Row 2: weight + date chips */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                            {item.measured_weight_kg.toLocaleString('th-TH', { maximumFractionDigits: 2 })} กก.
                          </span>
                          <span className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                            <CalendarRange className="h-3 w-3 text-stone-400" />
                            ยืนยันเมื่อ {formatDate(item.confirmed_at)}
                          </span>
                        </div>
                        {/* Row 3: location (dimmed) */}
                        {item.pickup_location_text && (
                          <div className="flex items-center gap-1 text-xs text-stone-400">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{item.pickup_location_text}</span>
                          </div>
                        )}
                      </div>
                    </IntakeCard>
                  </div>
                );
              })
            )}
          </div>
        )}

      </div>
    </ErrorBoundary>
  );
}
