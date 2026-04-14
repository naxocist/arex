'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { ChevronDown, Coins, Gift, Kanban, LayoutList, PackagePlus, RefreshCw, Route, Sprout, Truck, User, X } from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import ConfirmDialog from '@/app/_components/ConfirmDialog';
import EmptyState from '@/app/_components/EmptyState';
import ErrorBoundary from '@/app/_components/ErrorBoundary';
import dynamic from 'next/dynamic';
const PickupLocationMapPicker = dynamic(() => import('@/app/_components/PickupLocationMapPicker'), { ssr: false });
import { SkeletonCard } from '@/app/_components/Skeleton';
import StatusBadge from '@/app/_components/StatusBadge';
import StatusStepper from '@/app/_components/StatusStepper';
import { useFarmerProfile } from '@/app/_contexts/FarmerProfileContext';
import {
  ApiError,
  farmerApi,
  type CreateSubmissionPayload,
  type FarmerMaterialTypeItem,
  type FarmerMeasurementUnitItem,
  type FarmerSubmissionItem,
} from '@/app/_lib/apiClient';

const ACTIVE_STATUSES = new Set(['submitted', 'pickup_scheduled', 'picked_up', 'delivered_to_factory', 'factory_confirmed']);
const LIVE_DOT_STATUSES = new Set(['pickup_scheduled', 'picked_up']);

const STATUS_GROUP_OPTIONS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'active', label: 'กำลังดำเนินการ' },
  { value: 'done', label: 'เสร็จสิ้น' },
] as const;

type StatusGroup = (typeof STATUS_GROUP_OPTIONS)[number]['value'];
type SortCol = 'date' | 'qty' | 'status';
type SortDir = 'asc' | 'desc';

const STATUS_ORDER: Record<string, number> = {
  pickup_scheduled: 0,
  picked_up: 1,
  delivered_to_factory: 2,
  submitted: 3,
  factory_confirmed: 4,
  points_credited: 5,
};

function hasAccessToken(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem('AREX_ACCESS_TOKEN'));
}

function formatSubmissionStatus(status: string): string {
  const map: Record<string, string> = {
    submitted: 'รอจัดคิวรถ',
    pickup_scheduled: 'จัดคิวรถแล้ว',
    picked_up: 'รับวัสดุแล้ว',
    delivered_to_factory: 'ส่งถึงโรงงานแล้ว',
    factory_confirmed: 'โรงงานยืนยันแล้ว',
    points_credited: 'ได้รับแต้มแล้ว',
  };
  return map[status] ?? status;
}

function formatDate(dateTime: string | null | undefined): string {
  if (!dateTime) return '-';
  return new Date(dateTime).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });
}

function formatDateTime(dateTime: string | null | undefined): string {
  if (!dateTime) return '-';
  return new Date(dateTime).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatPickupWindow(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) return 'รอนัดหมาย';
  const startStr = formatDate(start);
  if (!end) return startStr;
  const endStr = formatDate(end);
  return startStr === endStr ? startStr : `${startStr} – ${endStr}`;
}

function fallbackThaiUnit(unitCode: string): string {
  const map: Record<string, string> = { kg: 'กิโลกรัม', ton: 'ตัน' };
  return map[unitCode] ?? unitCode;
}

function inferMessageTone(message: string | null): 'info' | 'success' | 'error' {
  if (!message) return 'info';
  if (message.includes('ไม่สำเร็จ') || message.includes('กรุณา') || message.includes('ยังไม่')) return 'error';
  if (message.includes('สำเร็จ')) return 'success';
  return 'info';
}

/* ── Status dot ── */
function StatusDot({ status }: { status: string }) {
  const isLive = LIVE_DOT_STATUSES.has(status);
  const isActive = ACTIVE_STATUSES.has(status);
  if (isLive) {
    return (
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
      </span>
    );
  }
  if (status === 'points_credited') return <span className="h-3 w-3 rounded-full bg-emerald-300" />;
  if (isActive) return <span className="h-3 w-3 rounded-full bg-amber-400" />;
  return <span className="h-3 w-3 rounded-full bg-stone-200" />;
}

export default function FarmerHome() {
  const reduceMotion = useReducedMotion();
  const { openProfile } = useFarmerProfile();

  const [materialType, setMaterialType] = useState<CreateSubmissionPayload['material_type']>('');
  const [quantityValue, setQuantityValue] = useState('');
  const [quantityUnit, setQuantityUnit] = useState('');
  const [pickupLocation, setPickupLocation] = useState<string>('');
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);

  const [isSubmittingMaterial, setIsSubmittingMaterial] = useState(false);
  const [submissions, setSubmissions] = useState<FarmerSubmissionItem[]>([]);
  const [materialTypes, setMaterialTypes] = useState<FarmerMaterialTypeItem[]>([]);
  const [measurementUnits, setMeasurementUnits] = useState<FarmerMeasurementUnitItem[]>([]);
  const [availablePoints, setAvailablePoints] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [statusGroup, setStatusGroup] = useState<StatusGroup>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [boardExpandedId, setBoardExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [sortCol, setSortCol] = useState<SortCol>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; message: string; fields?: { label: string; value: string }[]; onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const unitNameByCode = useMemo(() => {
    const map: Record<string, string> = {};
    for (const unit of measurementUnits) map[unit.code] = unit.name_th;
    return map;
  }, [measurementUnits]);

  const materialNameByCode = useMemo(() => {
    const map: Record<string, string> = {};
    for (const material of materialTypes) map[material.code] = material.name_th;
    return map;
  }, [materialTypes]);

  const stats = useMemo(() => ({
    all: submissions.length,
    waitingPickup: submissions.filter((s) => s.status === 'submitted' || s.status === 'pickup_scheduled').length,
    inTransit: submissions.filter((s) => s.status === 'picked_up' || s.status === 'delivered_to_factory').length,
    completed: submissions.filter((s) => s.status === 'points_credited').length,
  }), [submissions]);

  const filteredSubmissions = useMemo(() => {
    let list = submissions;
    if (statusGroup === 'active') list = list.filter((s) => ACTIVE_STATUSES.has(s.status));
    else if (statusGroup === 'done') list = list.filter((s) => s.status === 'points_credited');
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortCol === 'status') {
        const diff = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
        if (diff !== 0) return diff * dir;
      }
      if (sortCol === 'qty') {
        const diff = (Number(a.quantity_value) || 0) - (Number(b.quantity_value) || 0);
        if (diff !== 0) return diff * dir;
      }
      const ta = new Date(a.created_at ?? 0).getTime();
      const tb = new Date(b.created_at ?? 0).getTime();
      return (ta - tb) * (sortCol === 'date' ? dir : 1);
    });
  }, [submissions, statusGroup, sortCol, sortDir]);

  const loadDashboard = async (forceRefresh = false) => {
    if (!hasAccessToken()) {
      setMessage('ยังไม่พบโทเคน AREX_ACCESS_TOKEN กรุณาเข้าสู่ระบบที่หน้าเลือกผู้ใช้งาน');
      return;
    }
    setIsLoading(true);
    try {
      const [submissionsResponse, materialTypesResponse, unitsResponse, pointsResponse] = await Promise.all([
        farmerApi.listSubmissions({ forceRefresh }),
        farmerApi.listMaterialTypes({ forceRefresh }),
        farmerApi.listMeasurementUnits({ forceRefresh }),
        farmerApi.getPoints({ forceRefresh }),
      ]);
      setSubmissions(submissionsResponse.submissions);
      setAvailablePoints(pointsResponse.available_points);
      const nextMaterialTypes = materialTypesResponse.material_types || [];
      setMaterialTypes(nextMaterialTypes);
      if (nextMaterialTypes.length > 0 && !nextMaterialTypes.some((m) => m.code === materialType)) {
        setMaterialType(nextMaterialTypes[0].code);
      }
      const nextUnits = unitsResponse.units || [];
      setMeasurementUnits(nextUnits);
      if (nextUnits.length > 0 && !nextUnits.some((u) => u.code === quantityUnit)) {
        setQuantityUnit(nextUnits[0].code);
      }
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof ApiError ? `โหลดข้อมูลไม่สำเร็จ: ${error.message}` : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadDashboard(); }, []);
  const handleSubmitMaterial = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasAccessToken()) { setMessage('ยังไม่พบโทเคน AREX_ACCESS_TOKEN สำหรับเชื่อมต่อ FastAPI'); return; }
    const parsedQuantity = Number(quantityValue);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) { setMessage('กรุณาระบุปริมาณมากกว่า 0'); return; }
    if (!quantityUnit) { setMessage('กรุณาเลือกหน่วย'); return; }
    if (!materialType) { setMessage('กรุณาเลือกชนิดวัสดุ'); return; }
    if (pickupLat === null || pickupLng === null) { setMessage('กรุณาเลือกจุดนัดรับบนแผนที่ก่อนส่งรายการ'); return; }

    const materialLabel = materialNameByCode[materialType] ?? materialType;
    const unitLabel = unitNameByCode[quantityUnit] ?? fallbackThaiUnit(quantityUnit);
    setConfirmDialog({
      open: true,
      title: 'ยืนยันการส่งรายการวัสดุ',
      message: '',
      fields: [
        { label: 'วัสดุ', value: materialLabel },
        { label: 'ปริมาณ', value: `${parsedQuantity.toLocaleString('th-TH')} ${unitLabel}` },
        { label: 'จุดนัดรับ', value: pickupLocation },
      ],
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, open: false }));
        await submitMaterial();
      },
    });
  };

  const submitMaterial = async () => {
    const parsedQuantity = Number(quantityValue);
    setIsSubmittingMaterial(true);
    setMessage(null);
    try {
      await farmerApi.createSubmission({
        material_type: materialType,
        quantity_value: parsedQuantity,
        quantity_unit: quantityUnit,
        pickup_location_text: pickupLocation,
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
      });
      setQuantityValue('');
      setMessage('ส่งรายการวัสดุสำเร็จแล้ว');
      setShowForm(false);
      await loadDashboard(true);
    } catch (error) {
      setMessage(error instanceof ApiError ? `ส่งรายการไม่สำเร็จ: ${error.message}` : 'ส่งรายการไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setIsSubmittingMaterial(false);
    }
  };

  const selectedUnit = measurementUnits.find((u) => u.code === quantityUnit);
  const approxKg = (() => {
    if (!selectedUnit || !selectedUnit.to_kg_factor) return null;
    if (['กิโลกรัม', 'ตัน'].includes(selectedUnit.name_th)) return null;
    const qty = parseFloat(quantityValue);
    return Number.isFinite(qty) && qty > 0 ? qty * selectedUnit.to_kg_factor : null;
  })();

  return (
    <ErrorBoundary>
      <div className="space-y-0 pb-28">

        {/* ── Hero coin banner ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-emerald-600 px-5 py-5 shadow-md shadow-primary/15 mb-5">
          <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute -bottom-6 right-12 h-20 w-20 rounded-full bg-white/5" />
          <div className="relative flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white/70">PMUC Coin คงเหลือ</p>
              <div className="mt-1 flex items-end gap-1.5">
                {availablePoints === null ? (
                  <div className="h-10 w-28 animate-pulse rounded-full bg-white/20" />
                ) : (
                  <>
                    <span className="text-5xl font-light tabular-nums text-white">
                      {availablePoints.toLocaleString('th-TH')}
                    </span>
                    <span className="mb-1.5 text-base font-medium text-white/70">แต้ม</span>
                  </>
                )}
              </div>
              <p className="mt-1.5 text-sm text-white/60">ใช้แลกรางวัลได้ทันที</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={() => void loadDashboard(true)}
                disabled={isLoading}
                aria-label="รีเฟรช"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={openProfile}
                className="flex items-center gap-2 rounded-full bg-white/20 border border-white/40 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/30 active:scale-95"
              >
                <User className="h-4 w-4" />
                ข้อมูลส่วนตัว
              </button>
              <Link
                href="/farmer/rewards"
                className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-emerald-800 shadow-md transition hover:bg-emerald-50 active:scale-95"
              >
                <Gift className="h-5 w-5" />
                แลกของรางวัล
              </Link>
            </div>
          </div>
        </div>

        {/* ── Alert ── */}
        <AnimatePresence>
          {message && (
            <motion.div
              key="alert"
              initial={reduceMotion ? {} : { opacity: 0, y: -8 }}
              animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
              exit={reduceMotion ? {} : { opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="mb-4"
            >
              <AlertBanner message={message} tone={inferMessageTone(message)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Stats strip (horizontal scroll on mobile) ── */}
        <div className="mb-5 -mx-1 flex gap-3 overflow-x-auto px-1 pb-1 scrollbar-hide">
          {[
            { label: 'รายการทั้งหมด', value: stats.all, icon: Sprout, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'รอรับวัสดุ', value: stats.waitingPickup, icon: Truck, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'ระหว่างขนส่ง', value: stats.inTransit, icon: Route, color: 'text-sky-600', bg: 'bg-sky-50' },
            { label: 'ได้แต้มแล้ว', value: stats.completed, icon: Coins, color: 'text-violet-600', bg: 'bg-violet-50' },
          ].map((s) => (
            <div key={s.label} className="flex shrink-0 items-center gap-2.5 rounded-2xl border border-stone-100 bg-white px-4 py-3 shadow-sm">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${s.bg}`}>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <div>
                <p className="text-xl font-bold leading-none text-stone-900">{isLoading ? '—' : s.value}</p>
                <p className="mt-0.5 text-xs text-stone-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── View toggle ── */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-stone-600">รายการวัสดุ</p>
          <div className="flex rounded-xl border border-stone-200 bg-stone-50 p-1">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${viewMode === 'list' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-400'}`}
              aria-label="มุมมองรายการ"
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${viewMode === 'board' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-400'}`}
              aria-label="มุมมองกระดาน"
            >
              <Kanban className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Board / Pipeline view ── */}
        {viewMode === 'board' && (() => {
          const STAGES: {
            statuses: string[];
            label: string;
            sublabel: string;
            icon: React.ReactNode;
            accent: string;      // tailwind text color
            accentBg: string;    // tailwind bg color (light)
            trackColor: string;  // tailwind bg for the left track bar
            live: boolean;
          }[] = [
            {
              statuses: ['submitted'],
              label: 'รอจัดคิวรถ',
              sublabel: 'ส่งรายการแล้ว รอทีมขนส่งนัดหมาย',
              icon: <PackagePlus className="h-4 w-4" />,
              accent: 'text-amber-700', accentBg: 'bg-amber-50', trackColor: 'bg-amber-400', live: false,
            },
            {
              statuses: ['pickup_scheduled', 'picked_up'],
              label: 'ขนส่งกำลังดำเนินการ',
              sublabel: 'รถอยู่ระหว่างเดินทางหรือรับวัสดุแล้ว',
              icon: <Truck className="h-4 w-4" />,
              accent: 'text-sky-700', accentBg: 'bg-sky-50', trackColor: 'bg-sky-400', live: true,
            },
            {
              statuses: ['delivered_to_factory', 'factory_confirmed'],
              label: 'ถึงโรงงานแล้ว',
              sublabel: 'รอโรงงานชั่งน้ำหนักและยืนยัน',
              icon: <Route className="h-4 w-4" />,
              accent: 'text-violet-700', accentBg: 'bg-violet-50', trackColor: 'bg-violet-400', live: false,
            },
            {
              statuses: ['points_credited'],
              label: 'เสร็จสิ้น — ได้แต้มแล้ว',
              sublabel: 'PMUC Coin เข้าบัญชีเรียบร้อย',
              icon: <Coins className="h-4 w-4" />,
              accent: 'text-emerald-700', accentBg: 'bg-emerald-50', trackColor: 'bg-emerald-400', live: false,
            },
          ];

          const totalActive = submissions.filter((s) => ACTIVE_STATUSES.has(s.status)).length;

          return (
            <div className="space-y-2">
              {/* Pipeline header */}
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-stone-800">สถานะวัสดุทั้งหมด</p>
                  <p className="text-xs text-stone-400">
                    {totalActive > 0 ? `${totalActive} รายการกำลังดำเนินการ` : 'ไม่มีรายการที่กำลังดำเนินการ'}
                  </p>
                </div>
              </div>

              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded-2xl bg-stone-100" />
                  ))}
                </div>
              ) : (
                STAGES.map((stage, si) => {
                  const items = submissions.filter((s) => stage.statuses.includes(s.status));
                  const isEmpty = items.length === 0;
                  const isLast = si === STAGES.length - 1;
                  return (
                    <div key={stage.label} className="relative flex gap-0">
                      {/* Left timeline track */}
                      <div className="flex flex-col items-center" style={{ width: 32, flexShrink: 0 }}>
                        <div className={`mt-4 h-5 w-5 rounded-full flex items-center justify-center z-10 relative ${isEmpty ? 'bg-stone-200' : stage.trackColor}`}>
                          {stage.live && !isEmpty ? (
                            <>
                              <span className={`animate-ping absolute inline-flex h-5 w-5 rounded-full opacity-40 ${stage.trackColor}`} />
                              <span className="relative h-2 w-2 rounded-full bg-white" />
                            </>
                          ) : (
                            <span className={`text-[9px] font-bold ${isEmpty ? 'text-stone-400' : 'text-white'}`}>{si + 1}</span>
                          )}
                        </div>
                        {!isLast && (
                          <div className={`w-0.5 flex-1 mt-1 ${isEmpty ? 'bg-stone-100' : stage.trackColor} opacity-40`} style={{ minHeight: 16 }} />
                        )}
                      </div>

                      {/* Stage card */}
                      <div className={`flex-1 mb-2 rounded-2xl border overflow-hidden transition-all ${
                        isEmpty ? 'border-stone-100 bg-stone-50/60' : `border-transparent ${stage.accentBg} shadow-sm`
                      }`}>
                        {/* Stage header */}
                        <div className="flex items-center gap-2.5 px-3 py-3">
                          <span className={`${isEmpty ? 'text-stone-300' : stage.accent}`}>{stage.icon}</span>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-bold leading-none ${isEmpty ? 'text-stone-400' : stage.accent}`}>{stage.label}</p>
                            {!isEmpty && <p className="mt-0.5 text-[11px] text-stone-500 leading-tight">{stage.sublabel}</p>}
                          </div>
                          {!isEmpty && (
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${stage.accentBg} ${stage.accent} border border-current border-opacity-20`}>
                              {items.length}
                            </span>
                          )}
                          {isEmpty && <span className="text-xs text-stone-300">ว่าง</span>}
                        </div>

                        {/* Item chips + inline expansion */}
                        {!isEmpty && (
                          <div className="flex flex-col gap-1.5 px-3 pb-3">
                            {items.map((item) => {
                              const isBoardExpanded = boardExpandedId === item.id;
                              const isActiveStatus = ACTIVE_STATUSES.has(item.status);
                              return (
                                <div key={item.id} className="rounded-xl bg-white/80 border border-white shadow-sm overflow-hidden">
                                  {/* Chip row */}
                                  <button
                                    type="button"
                                    onClick={() => setBoardExpandedId(isBoardExpanded ? null : item.id)}
                                    className="flex w-full items-center gap-2 px-2.5 py-2 text-left transition active:bg-stone-50"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <span className="text-xs font-bold text-stone-800">
                                        {materialNameByCode[item.material_type] ?? item.material_type}
                                      </span>
                                      <span className="mx-1.5 text-[10px] text-stone-300">·</span>
                                      <span className="text-[10px] text-stone-500">
                                        {Number(item.quantity_value).toLocaleString('th-TH')} {unitNameByCode[item.quantity_unit] ?? fallbackThaiUnit(item.quantity_unit)}
                                      </span>
                                      <span className="mx-1.5 text-[10px] text-stone-300">·</span>
                                      <span className="text-[10px] text-stone-400">ส่งเมื่อ {formatDate(item.created_at)}</span>
                                    </div>
                                    <motion.span
                                      animate={reduceMotion ? {} : { rotate: isBoardExpanded ? 180 : 0 }}
                                      transition={{ duration: 0.18 }}
                                      style={{ display: 'inline-flex' }}
                                      className="shrink-0 text-stone-300"
                                    >
                                      <ChevronDown className="h-3.5 w-3.5" />
                                    </motion.span>
                                  </button>

                                  {/* Inline detail */}
                                  <AnimatePresence initial={false}>
                                    {isBoardExpanded && (
                                      <motion.div
                                        initial={reduceMotion ? {} : { height: 0, opacity: 0 }}
                                        animate={reduceMotion ? {} : { height: 'auto', opacity: 1 }}
                                        exit={reduceMotion ? {} : { height: 0, opacity: 0 }}
                                        transition={{ duration: 0.22, ease: 'easeInOut' }}
                                        style={{ overflow: 'hidden' }}
                                      >
                                        <div className="space-y-2 border-t border-stone-100 px-3 pb-3 pt-2.5">
                                          {item.pickup_location_text && (
                                            <p className="text-xs text-stone-600">
                                              <span className="font-semibold">จุดนัดรับ: </span>
                                              {item.pickup_location_text}
                                            </p>
                                          )}
                                          {item.pickup_lat != null && item.pickup_lng != null && (
                                            <a
                                              href={`https://www.google.com/maps?q=${item.pickup_lat},${item.pickup_lng}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700"
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                                              เปิดแผนที่
                                            </a>
                                          )}
                                          {isActiveStatus && (
                                            <StatusStepper
                                              currentStatus={item.status}
                                              createdAt={formatDateTime(item.created_at)}
                                              pickupWindow={formatPickupWindow(item.pickup_window_start_at, item.pickup_window_end_at)}
                                            />
                                          )}
                                          {!isActiveStatus && (
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                              <div>
                                                <p className="text-stone-400">ส่งรายการ</p>
                                                <p className="font-semibold text-stone-700">{formatDateTime(item.created_at)}</p>
                                              </div>
                                              <div>
                                                <p className="text-stone-400">วันนัดรับ</p>
                                                <p className="font-semibold text-stone-700">{formatPickupWindow(item.pickup_window_start_at, item.pickup_window_end_at)}</p>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          );
        })()}

        {/* ── Submission table view ── */}
        {viewMode === 'list' && (() => {
          // Sort toggle helper
          const handleColSort = (col: SortCol) => {
            if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
            else { setSortCol(col); setSortDir(col === 'date' ? 'desc' : 'asc'); }
          };
          const SortArrow = ({ col }: { col: SortCol }) => {
            if (sortCol !== col) return null;
            const label = col === 'date'
              ? (sortDir === 'desc' ? 'ล่าสุดก่อน' : 'เก่าสุดก่อน')
              : col === 'qty'
              ? (sortDir === 'desc' ? 'มากก่อน' : 'น้อยก่อน')
              : (sortDir === 'asc' ? 'ตามขั้นตอน' : 'ย้อนกลับ');
            return <span className="ml-1 whitespace-nowrap rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary leading-none">{label}</span>;
          };

          const countAll = submissions.length;
          const countActive = submissions.filter((s) => ACTIVE_STATUSES.has(s.status)).length;
          const countDone = submissions.filter((s) => s.status === 'points_credited').length;

          return (
            <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">

              {/* Filter + count header */}
              <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-4 py-3">
                {/* Segmented filter */}
                <div className="flex rounded-xl bg-stone-100 p-0.5 gap-0.5">
                  {([
                    ['all', 'ทั้งหมด', countAll],
                    ['active', 'กำลังดำเนินการ', countActive],
                    ['done', 'เสร็จสิ้น', countDone],
                  ] as [StatusGroup, string, number][]).map(([val, label, count]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setStatusGroup(val)}
                      className={`flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-semibold transition-all ${
                        statusGroup === val
                          ? 'bg-white text-stone-900 shadow-sm'
                          : 'text-stone-500 hover:text-stone-700'
                      }`}
                    >
                      {label}
                      {count > 0 && (
                        <span className={`rounded-full min-w-[18px] text-center px-1 py-0.5 text-[10px] font-bold leading-none ${
                          statusGroup === val ? 'bg-primary/10 text-primary' : 'bg-stone-200 text-stone-400'
                        }`}>{count}</span>
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-stone-400 shrink-0">{filteredSubmissions.length} รายการ</p>
              </div>

              {/* Sort hint — permanent small note */}
              {!isLoading && filteredSubmissions.length > 0 && (
                <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-4 py-2">
                  <span className="text-sm">💡</span>
                  <p className="text-xs text-amber-700">กดชื่อคอลัมน์เพื่อเรียงลำดับ</p>
                </div>
              )}

              {/* Column headers — clickable for sort */}
              {!isLoading && filteredSubmissions.length > 0 && (
                <div className="grid grid-cols-[1fr_5rem_9rem] items-center border-b border-stone-100 bg-stone-50/60 px-4 py-2 text-xs font-semibold text-stone-400">
                  <button type="button" onClick={() => handleColSort('date')} className="flex items-center gap-0.5 text-left hover:text-stone-600 transition-colors">
                    ส่งเมื่อ<SortArrow col="date" />
                  </button>
                  <button type="button" onClick={() => handleColSort('qty')} className="flex items-center justify-end gap-0.5 pr-4 hover:text-stone-600 transition-colors">
                    ปริมาณ<SortArrow col="qty" />
                  </button>
                  <button type="button" onClick={() => handleColSort('status')} className="flex items-center justify-end gap-0.5 hover:text-stone-600 transition-colors">
                    สถานะ<SortArrow col="status" />
                  </button>
                </div>
              )}

              {/* Rows */}
              <div>
                {isLoading ? (
                  <div className="divide-y divide-stone-100">
                    {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
                  </div>
                ) : filteredSubmissions.length === 0 ? (
                  <div className="px-4 py-10">
                    <EmptyState
                      title="ไม่พบรายการ"
                      description="ลองสลับตัวกรองด้านบน หรือกดปุ่มเพื่อส่งรายการวัสดุใหม่"
                    />
                  </div>
                ) : (
                  <motion.div
                    key={`${statusGroup}-${sortCol}-${sortDir}`}
                    className="divide-y divide-stone-100"
                    initial={reduceMotion ? {} : { opacity: 0 }}
                    animate={reduceMotion ? {} : { opacity: 1 }}
                    transition={{ duration: 0.15 }}
                  >
                    {filteredSubmissions.map((item) => {
                      const isExpanded = expandedId === item.id;
                      const isActiveStatus = ACTIVE_STATUSES.has(item.status);
                      return (
                        <article key={item.id}>
                          {/* Table row */}
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : item.id)}
                            className={`grid w-full grid-cols-[1fr_5rem_9rem] items-center gap-2 px-4 py-3.5 text-left transition-colors ${
                              isExpanded ? 'bg-stone-50' : 'hover:bg-stone-50/60 active:bg-stone-50'
                            }`}
                          >
                            {/* Col 1: material + date */}
                            <div className="min-w-0 flex items-center gap-3">
                              <StatusDot status={item.status} />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-stone-900">
                                  {materialNameByCode[item.material_type] ?? item.material_type}
                                </p>
                                <p className="text-xs text-stone-400">ส่งเมื่อ {formatDateTime(item.created_at)}</p>
                              </div>
                            </div>

                            {/* Col 2: quantity */}
                            <div className="pr-4 text-right">
                              <p className="text-sm font-semibold tabular-nums text-stone-700">
                                {Number(item.quantity_value).toLocaleString('th-TH')}
                              </p>
                              <p className="text-xs text-stone-400">{unitNameByCode[item.quantity_unit] ?? fallbackThaiUnit(item.quantity_unit)}</p>
                            </div>

                            {/* Col 3: status badge + chevron — right-aligned, fixed width */}
                            <div className="flex flex-col items-end gap-1 min-w-0">
                              <StatusBadge status={item.status} label={formatSubmissionStatus(item.status)} size="sm" />
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
                                transition={{ duration: 0.24, ease: 'easeInOut' }}
                                style={{ overflow: 'hidden' }}
                              >
                                <div className="mx-4 mb-4 mt-1 space-y-2.5 rounded-2xl bg-stone-50 px-4 py-3.5">
                                  {item.pickup_location_text && (
                                    <p className="text-sm text-stone-600">
                                      <span className="font-semibold text-stone-800">จุดนัดรับ: </span>
                                      {item.pickup_location_text}
                                    </p>
                                  )}
                                  {item.pickup_lat != null && item.pickup_lng != null && (
                                    <a
                                      href={`https://www.google.com/maps?q=${item.pickup_lat},${item.pickup_lng}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                                      เปิดแผนที่
                                    </a>
                                  )}
                                  {isActiveStatus && (
                                    <StatusStepper
                                      currentStatus={item.status}
                                      createdAt={formatDateTime(item.created_at)}
                                      pickupWindow={formatPickupWindow(item.pickup_window_start_at, item.pickup_window_end_at)}
                                    />
                                  )}
                                  {!isActiveStatus && (
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                      <div>
                                        <p className="text-xs text-stone-400">วันที่ส่งรายการ</p>
                                        <p className="font-medium text-stone-800">ส่งเมื่อ {formatDateTime(item.created_at)}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-stone-400">วันนัดรับวัสดุ</p>
                                        <p className="font-medium text-stone-800">{formatPickupWindow(item.pickup_window_start_at, item.pickup_window_end_at)}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </article>
                      );
                    })}
                  </motion.div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── Submit form sheet ── */}
        <AnimatePresence>
          {showForm && (
            <>
              {/* Backdrop */}
              <motion.div
                key="backdrop"
                className="fixed inset-0 z-40 bg-black/40"
                initial={reduceMotion ? {} : { opacity: 0 }}
                animate={reduceMotion ? {} : { opacity: 1 }}
                exit={reduceMotion ? {} : { opacity: 0 }}
                onClick={() => setShowForm(false)}
              />
              {/* Bottom sheet */}
              <motion.div
                key="sheet"
                className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl"
                initial={reduceMotion ? {} : { y: '100%' }}
                animate={reduceMotion ? {} : { y: 0 }}
                exit={reduceMotion ? {} : { y: '100%' }}
                transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              >
                {/* Handle */}
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-100 bg-white px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                      <PackagePlus className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-stone-900">ส่งรายการวัสดุใหม่</p>
                      <p className="text-xs text-stone-400">กรอกข้อมูลแล้วกดยืนยัน</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-500"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form className="space-y-5 px-5 pb-8 pt-5" onSubmit={handleSubmitMaterial}>
                  {/* Material type */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-stone-700">ชนิดวัสดุ</label>
                    <select
                      value={materialType}
                      onChange={(e) => setMaterialType(e.target.value)}
                      className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3.5 text-base text-stone-900 outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
                      required
                    >
                      {materialTypes.length === 0 ? <option value="">เลือกชนิดวัสดุ</option> : null}
                      {materialTypes.map((m) => (
                        <option key={m.code} value={m.code}>{m.name_th}</option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity + unit */}
                  <div className="grid grid-cols-[1fr,10rem] gap-3">
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-stone-700">ปริมาณ</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={quantityValue}
                        onChange={(e) => setQuantityValue(e.target.value)}
                        placeholder="เช่น 120"
                        className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3.5 text-base text-stone-900 outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-stone-700">หน่วย</label>
                      <select
                        value={quantityUnit}
                        onChange={(e) => setQuantityUnit(e.target.value)}
                        className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3.5 text-base text-stone-900 outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
                        required
                      >
                        {measurementUnits.length === 0 ? <option value="">หน่วย</option> : null}
                        {measurementUnits.map((u) => (
                          <option key={u.code} value={u.code}>{u.name_th}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {approxKg !== null && (
                    <p className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
                      ≈ {approxKg.toLocaleString('th-TH', { maximumFractionDigits: 2 })} กิโลกรัม
                    </p>
                  )}

                  {/* Pickup location */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-stone-700">สถานที่นัดรับ</label>
                    <input
                      type="text"
                      value={pickupLocation}
                      onChange={(e) => setPickupLocation(e.target.value)}
                      placeholder="เช่น หน้าวัด / จุดสังเกต"
                      className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3.5 text-base text-stone-900 outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
                      required
                    />
                  </div>

                  {/* Map hint */}
                  <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    ปักหมุดบนแผนที่ด้านล่าง — ระบบจะกรอกที่อยู่ให้อัตโนมัติ
                  </div>

                  {/* Map */}
                  <PickupLocationMapPicker
                    lat={pickupLat}
                    lng={pickupLng}
                    onChange={({ lat, lng }) => { setPickupLat(lat); setPickupLng(lng); }}
                    onAddressResolved={(address) => setPickupLocation(address)}
                    mapHeightClassName="h-[280px] w-full overflow-hidden rounded-2xl"
                    currentLocationButtonLabel="ใช้ตำแหน่งปัจจุบัน"
                  />

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isSubmittingMaterial || !quantityValue.trim() || !quantityUnit || !materialType}
                    className="flex w-full min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-white shadow-md shadow-primary/20 transition hover:opacity-90 disabled:opacity-50"
                  >
                    <PackagePlus className="h-5 w-5" />
                    {isSubmittingMaterial ? 'กำลังส่งรายการ...' : 'ส่งรายการวัสดุ'}
                  </button>
                </form>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* ── Floating action button ── */}
      <div className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2">
        <motion.button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex min-h-[56px] items-center gap-2.5 rounded-full bg-primary px-7 text-base font-bold text-white shadow-lg shadow-primary/30 transition active:scale-95"
          whileHover={reduceMotion ? {} : { scale: 1.04 }}
          whileTap={reduceMotion ? {} : { scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        >
          <PackagePlus className="h-5 w-5" />
          ส่งรายการวัสดุใหม่
        </motion.button>
      </div>

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
    </ErrorBoundary>
  );
}
