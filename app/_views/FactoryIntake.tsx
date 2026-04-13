'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CheckCircle2, ChevronDown, Factory, MapPin, RefreshCw, Scale, ShieldCheck, Warehouse } from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import EmptyState from '@/app/_components/EmptyState';
import ErrorBoundary from '@/app/_components/ErrorBoundary';
import {
  ApiError,
  factoryApi,
  type FactoryConfirmedIntakeItem,
  type FactoryIntakeSummary,
  type FactoryPendingIntakeItem,
} from '@/app/_lib/apiClient';

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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function inferMessageTone(message: string | null): 'info' | 'success' | 'error' {
  if (!message) return 'info';
  if (message.includes('ไม่สำเร็จ') || message.includes('กรุณา') || message.includes('ยังไม่')) return 'error';
  if (message.includes('สำเร็จ')) return 'success';
  return 'info';
}

// ─── Stat pill ───────────────────────────────────────────────────────────────
function StatPill({
  label, value, sub, accent,
}: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent}`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {sub ? <p className="mt-0.5 text-xs opacity-60">{sub}</p> : null}
    </div>
  );
}

// ─── Confirmed history row ────────────────────────────────────────────────────
function ConfirmedRow({ item, reduceMotion }: { item: FactoryConfirmedIntakeItem; reduceMotion: boolean | null }) {
  const [open, setOpen] = useState(false);
  const materialName = item.material_name_th ?? formatMaterial(item.material_type);

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-stone-50"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
        <div className="min-w-0 flex-1">
          <span className="font-medium text-stone-800">{materialName}</span>
          <span className="ml-2 text-sm text-stone-400">{item.measured_weight_kg.toLocaleString('th-TH', { maximumFractionDigits: 2 })} กก.</span>
        </div>
        <span className="shrink-0 text-xs text-stone-400">{formatDateTime(item.confirmed_at)}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="detail"
            initial={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            animate={reduceMotion ? undefined : { height: 'auto', opacity: 1 }}
            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-stone-100 px-4 py-3">
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────
export default function FactoryIntake() {
  const [queue, setQueue] = useState<FactoryPendingIntakeItem[]>([]);
  const [confirmed, setConfirmed] = useState<FactoryConfirmedIntakeItem[]>([]);
  const [summary, setSummary] = useState<FactoryIntakeSummary | null>(null);
  const [weightByJobId, setWeightByJobId] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [confirmingJobId, setConfirmingJobId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const loadQueue = async (forceRefresh = false) => {
    if (!hasAccessToken()) {
      setMessage('ยังไม่พบโทเคน AREX_ACCESS_TOKEN กรุณาเข้าสู่ระบบที่หน้าเลือกผู้ใช้งาน');
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

  return (
    <ErrorBoundary>
      <div className="space-y-8">

        {/* ─── Header ─── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">โรงงาน</p>
            <h1 className="mt-0.5 text-4xl font-light tracking-tight text-on-surface">ตรวจรับวัสดุ</h1>
            <p className="mt-1 text-sm text-on-surface-variant">ชั่งน้ำหนักจริงและยืนยันรับเข้าเพื่อออกแต้มให้เกษตรกร</p>
          </div>
          <button
            type="button"
            onClick={() => void loadQueue(true)}
            disabled={isLoading}
            aria-label="รีเฟรชข้อมูล"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition hover:bg-stone-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {message ? <AlertBanner message={message} tone={inferMessageTone(message)} /> : null}

        {/* ─── Stats ─── */}
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-stone-100" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatPill
              label="รอยืนยันตอนนี้"
              value={(summary?.arrived_count ?? queue.length).toLocaleString('th-TH')}
              sub="รายการที่มาถึงโรงงานแล้ว"
              accent="border-amber-200 bg-amber-50 text-amber-900"
            />
            <StatPill
              label="น้ำหนักประมาณการ"
              value={`${(summary?.arrived_estimated_weight_kg_total ?? 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })} กก.`}
              sub={`แปลงได้ ${(summary?.arrived_convertible_count ?? 0)} รายการ`}
              accent="border-sky-200 bg-sky-50 text-sky-900"
            />
            <StatPill
              label="ยืนยันแล้ว"
              value={(summary?.confirmed_count ?? confirmed.length).toLocaleString('th-TH')}
              sub="รายการที่ปิดงานสำเร็จ"
              accent="border-emerald-200 bg-emerald-50 text-emerald-900"
            />
            <StatPill
              label="น้ำหนักรวมที่ยืนยัน"
              value={`${(summary?.confirmed_weight_kg_total ?? 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })} กก.`}
              sub={`${(summary?.confirmed_weight_ton_total ?? 0).toLocaleString('th-TH', { maximumFractionDigits: 3 })} ตัน`}
              accent="border-violet-200 bg-violet-50 text-violet-900"
            />
          </div>
        )}

        {/* ─── Pending queue ─── */}
        <div>
          <div className="mb-4 flex items-center gap-2">
            <div className="h-1 w-6 rounded-full bg-amber-400" />
            <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">คิวที่ต้องยืนยันตอนนี้</p>
            {queue.length > 0 && (
              <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">{queue.length}</span>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-44 animate-pulse rounded-3xl bg-stone-100" />
              ))}
            </div>
          ) : queue.length === 0 ? (
            <EmptyState
              title="ยังไม่มีงานที่รอยืนยัน"
              description="เมื่อรถส่งวัสดุมาถึงโรงงาน รายการจะขึ้นที่นี่เพื่อให้บันทึกน้ำหนักจริง"
              icon={Factory}
            />
          ) : (
            <div className="space-y-4">
              {queue.map((item) => {
                const materialName = item.material_name_th ?? formatMaterial(item.material_type);
                const estimatedKg = quantityToKg(Number(item.quantity_value), item.quantity_to_kg_factor);
                const arrivalTime = item.delivered_factory_at ?? item.planned_pickup_at;
                const isConfirming = confirmingJobId === item.pickup_job_id;

                return (
                  <motion.article
                    key={item.pickup_job_id}
                    layout
                    initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
                    animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-sm"
                  >
                    {/* Accent bar */}
                    <div className="h-1 w-full bg-amber-400" />

                    <div className="p-5">
                      {/* Top row */}
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-lg font-semibold text-stone-900">{materialName}</p>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-stone-400">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span>{item.pickup_location_text}</span>
                          </div>
                        </div>
                        <div className="text-right text-xs text-stone-400">
                          <p>มาถึง</p>
                          <p className="font-medium text-stone-600">{formatDateTime(arrivalTime)}</p>
                        </div>
                      </div>

                      {/* Info + action row */}
                      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
                        {/* Declared quantity */}
                        <div className="flex-1 rounded-2xl bg-stone-50 px-4 py-3">
                          <p className="text-xs text-stone-400">ปริมาณที่แจ้งมา</p>
                          <p className="mt-1 text-base font-semibold text-stone-800">
                            {Number(item.quantity_value).toLocaleString('th-TH')} {fallbackThaiUnit(item.quantity_unit)}
                          </p>
                          <p className="mt-0.5 text-xs text-stone-500">
                            {estimatedKg !== null
                              ? `≈ ${estimatedKg.toLocaleString('th-TH', { maximumFractionDigits: 2 })} กก. (ประมาณการ)`
                              : 'หน่วยนี้แปลงเป็น กก. อัตโนมัติไม่ได้'}
                          </p>
                        </div>

                        {/* Weight input + confirm */}
                        <div className="flex flex-1 items-end gap-3">
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
                          <button
                            type="button"
                            onClick={() => void handleConfirm(item)}
                            disabled={isConfirming}
                            className="flex min-h-[48px] shrink-0 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
                          >
                            <ShieldCheck className="h-4 w-4" />
                            {isConfirming ? 'กำลังยืนยัน…' : 'ยืนยันรับเข้า'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Confirmed history ─── */}
        {(confirmed.length > 0 || !isLoading) && (
          <div>
            <div className="mb-4 flex items-center gap-2">
              <div className="h-1 w-6 rounded-full bg-emerald-500" />
              <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">ประวัติที่ยืนยันแล้ว</p>
              {confirmed.length > 0 && (
                <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">{confirmed.length}</span>
              )}
            </div>

            {confirmed.length === 0 ? (
              <EmptyState
                title="ยังไม่มีประวัติ"
                description="เมื่อยืนยันรับเข้าแต่ละงาน ประวัติจะย้ายมาอยู่ส่วนนี้"
                icon={ShieldCheck}
              />
            ) : (
              <div className="space-y-2">
                {confirmed.map((item) => (
                  <ConfirmedRow key={item.intake_id} item={item} reduceMotion={reduceMotion} />
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </ErrorBoundary>
  );
}
