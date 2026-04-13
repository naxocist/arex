'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, useSpring, useTransform } from 'motion/react';
import Link from 'next/link';
import { ChevronDown, Coins, Gift, PackagePlus, RefreshCw, Route, Sprout, Truck } from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import ConfirmDialog from '@/app/_components/ConfirmDialog';
import EmptyState from '@/app/_components/EmptyState';
import ErrorBoundary from '@/app/_components/ErrorBoundary';
import dynamic from 'next/dynamic';
const PickupLocationMapPicker = dynamic(() => import('@/app/_components/PickupLocationMapPicker'), { ssr: false });
import { SkeletonCard, SkeletonStatCard } from '@/app/_components/Skeleton';
import StatCard from '@/app/_components/StatCard';
import StatusBadge from '@/app/_components/StatusBadge';
import StatusStepper from '@/app/_components/StatusStepper';
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
type SortMode = 'newest' | 'oldest' | 'status';

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
    points_credited: 'ได้รับ PMUC Coin แล้ว',
  };
  return map[status] ?? status;
}

function formatDate(dateTime: string | null | undefined): string {
  if (!dateTime) return '-';
  return new Date(dateTime).toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'short',
  });
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

/* Animated integer counter */
function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(0, { stiffness: 60, damping: 18 });
  const display = useTransform(spring, (v) => Math.round(v).toLocaleString('th-TH'));
  useEffect(() => { spring.set(value); }, [spring, value]);
  return <motion.span>{display}</motion.span>;
}

export default function FarmerHome() {
  const reduceMotion = useReducedMotion();

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
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  // track filter/sort changes to re-key list for exit/enter animations
  const listKey = `${statusGroup}-${sortMode}`;

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
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
    waitingPickup: submissions.filter((item) => item.status === 'submitted' || item.status === 'pickup_scheduled').length,
    inTransit: submissions.filter((item) => item.status === 'picked_up' || item.status === 'delivered_to_factory').length,
    completed: submissions.filter((item) => item.status === 'points_credited').length,
  }), [submissions]);

  const filteredSubmissions = useMemo(() => {
    let list = submissions;
    if (statusGroup === 'active') list = list.filter((s) => ACTIVE_STATUSES.has(s.status));
    else if (statusGroup === 'done') list = list.filter((s) => s.status === 'points_credited');

    return [...list].sort((a, b) => {
      if (sortMode === 'status') {
        const diff = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
        if (diff !== 0) return diff;
      }
      const ta = new Date(a.created_at ?? 0).getTime();
      const tb = new Date(b.created_at ?? 0).getTime();
      return sortMode === 'oldest' ? ta - tb : tb - ta;
    });
  }, [submissions, statusGroup, sortMode]);

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
      if (nextMaterialTypes.length > 0 && !nextMaterialTypes.some((material) => material.code === materialType)) {
        setMaterialType(nextMaterialTypes[0].code);
      }

      const nextUnits = unitsResponse.units || [];
      setMeasurementUnits(nextUnits);
      if (nextUnits.length > 0 && !nextUnits.some((unit) => unit.code === quantityUnit)) {
        setQuantityUnit(nextUnits[0].code);
      }
      setMessage(null);
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(`โหลดข้อมูลไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('โหลดข้อมูลไม่สำเร็จ');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const handleSubmitMaterial = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!hasAccessToken()) {
      setMessage('ยังไม่พบโทเคน AREX_ACCESS_TOKEN สำหรับเชื่อมต่อ FastAPI');
      return;
    }

    const parsedQuantity = Number(quantityValue);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setMessage('กรุณาระบุปริมาณมากกว่า 0');
      return;
    }
    if (!quantityUnit) { setMessage('กรุณาเลือกหน่วย'); return; }
    if (!materialType) { setMessage('กรุณาเลือกชนิดวัสดุ'); return; }
    if (pickupLat === null || pickupLng === null) {
      setMessage('กรุณาเลือกจุดนัดรับบนแผนที่ก่อนส่งรายการ');
      return;
    }

    const materialLabel = materialNameByCode[materialType] ?? materialType;
    const unitLabel = unitNameByCode[quantityUnit] ?? fallbackThaiUnit(quantityUnit);

    setConfirmDialog({
      open: true,
      title: 'ยืนยันการส่งรายการวัสดุ',
      message: `วัสดุ: ${materialLabel}\nปริมาณ: ${parsedQuantity.toLocaleString('th-TH')} ${unitLabel}\nจุดนัดรับ: ${pickupLocation}`,
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
      if (error instanceof ApiError) {
        setMessage(`ส่งรายการไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('ส่งรายการไม่สำเร็จ กรุณาลองใหม่');
      }
    } finally {
      setIsSubmittingMaterial(false);
    }
  };

  /* ── animation variants ── */
  const fadeUp = reduceMotion
    ? {}
    : { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

  const listItem = reduceMotion
    ? {}
    : {
        hidden: { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.25, 0, 0, 1] as [number, number, number, number] } },
        exit: { opacity: 0, y: -6, transition: { duration: 0.15 } },
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
            <h1 className="mt-0.5 text-3xl font-light tracking-tight text-on-surface sm:text-4xl">ส่งวัสดุเกษตร</h1>
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
              {availablePoints === null ? (
                <span className="h-4 w-12 animate-pulse rounded-full bg-white/30" />
              ) : (
                <span className="text-sm font-bold text-white">
                  PMUC Coin <AnimatedNumber value={availablePoints} /> แต้ม
                </span>
              )}
            </motion.div>

            <motion.button
              type="button"
              onClick={() => void loadDashboard(true)}
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

        {/* ── Desktop bento layout ── */}
        <motion.div
          variants={fadeUp}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="grid gap-6 xl:grid-cols-[1fr,340px]"
        >
          {/* Left column */}
          <div className="space-y-6">

            {/* ── Submission history ── */}
            <motion.section
              className="rounded-2xl border border-outline-variant/10 bg-white shadow-sm"
              variants={fadeUp}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              {/* Section header */}
              <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 sm:px-6">
                <h2 className="text-base font-semibold text-on-surface sm:text-lg">รายการวัสดุ</h2>

                {/* Sort segmented control */}
                <div className="flex items-center gap-0.5 rounded-xl border border-outline-variant/20 bg-stone-50 p-0.5">
                  {([['newest', 'ล่าสุดก่อน'], ['oldest', 'เก่าสุดก่อน'], ['status', 'ตามสถานะ']] as [SortMode, string][]).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setSortMode(val)}
                      className={`relative rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                        sortMode === val
                          ? 'bg-white text-on-surface shadow-sm'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grouped tabs */}
              <div className="flex gap-1 border-b border-outline-variant/10 px-5 sm:px-6">
                {STATUS_GROUP_OPTIONS.map((opt) => {
                  const count =
                    opt.value === 'all' ? submissions.length
                    : opt.value === 'active' ? submissions.filter((s) => ACTIVE_STATUSES.has(s.status)).length
                    : submissions.filter((s) => s.status === 'points_credited').length;
                  const isActive = statusGroup === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStatusGroup(opt.value)}
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
                ) : filteredSubmissions.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={reduceMotion ? {} : { opacity: 0 }}
                    animate={reduceMotion ? {} : { opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <EmptyState
                      title="ไม่พบรายการตามตัวกรองนี้"
                      description="ลองสลับสถานะด้านบน หรือสร้างรายการวัสดุใหม่"
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key={listKey}
                    className="divide-y divide-outline-variant/8"
                    initial={reduceMotion ? {} : { opacity: 0 }}
                    animate={reduceMotion ? {} : { opacity: 1 }}
                    transition={{ duration: 0.18 }}
                  >
                    {filteredSubmissions.map((item) => {
                      const isExpanded = expandedId === item.id;
                      const isActiveStatus = ACTIVE_STATUSES.has(item.status);
                      const isLive = LIVE_DOT_STATUSES.has(item.status);
                      return (
                        <motion.article
                          key={item.id}
                          variants={listItem}
                          initial="hidden"
                          animate="show"
                          exit="exit"
                          layout
                        >
                          {/* Compact row */}
                          <motion.button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : item.id)}
                            className="flex w-full items-center gap-3 px-1 py-4 text-left"
                            whileHover={reduceMotion ? {} : { backgroundColor: 'rgba(245,245,244,0.6)' }}
                            whileTap={reduceMotion ? {} : { scale: 0.995 }}
                            transition={{ duration: 0.12 }}
                          >
                            {/* Status dot */}
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                              {isLive ? (
                                <span className="relative flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                                </span>
                              ) : (
                                <span className={`h-2.5 w-2.5 rounded-full ${isActiveStatus ? 'bg-amber-400' : 'bg-stone-200'}`} />
                              )}
                            </span>

                            {/* Main info */}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-base font-semibold text-on-surface">
                                {materialNameByCode[item.material_type] ?? item.material_type}
                              </p>
                              <p className="mt-0.5 text-sm text-on-surface-variant">
                                ปริมาณ {Number(item.quantity_value).toLocaleString('th-TH')}{' '}
                                {unitNameByCode[item.quantity_unit] ?? fallbackThaiUnit(item.quantity_unit)}
                              </p>
                              <p className="text-xs text-stone-400">
                                ส่งรายการเมื่อ {formatDateTime(item.created_at)}
                              </p>
                            </div>

                            <div className="flex shrink-0 flex-col items-end gap-1.5">
                              <StatusBadge status={item.status} label={formatSubmissionStatus(item.status)} size="sm" />
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

                          {/* Expanded details — animated height */}
                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                key="details"
                                initial={reduceMotion ? {} : { height: 0, opacity: 0 }}
                                animate={reduceMotion ? {} : { height: 'auto', opacity: 1 }}
                                exit={reduceMotion ? {} : { height: 0, opacity: 0 }}
                                transition={{ duration: 0.28, ease: 'easeInOut' }}
                                style={{ overflow: 'hidden' }}
                              >
                                <div className="mb-3 ml-9 space-y-2.5 rounded-xl border border-outline-variant/10 bg-stone-50/60 px-4 py-3">
                                  {item.pickup_location_text && (
                                    <p className="text-sm text-on-surface-variant">
                                      <span className="font-semibold text-on-surface">จุดนัดรับ: </span>{item.pickup_location_text}
                                    </p>
                                  )}
                                  <p className="text-sm text-on-surface-variant">
                                    <span className="font-semibold text-on-surface">วันที่ส่งรายการ: </span>
                                    {formatDateTime(item.created_at)}
                                  </p>
                                  <p className="text-sm text-on-surface-variant">
                                    <span className="font-semibold text-on-surface">วันนัดรับวัสดุ: </span>
                                    {formatPickupWindow(item.pickup_window_start_at, item.pickup_window_end_at)}
                                  </p>
                                  {isActiveStatus && <StatusStepper currentStatus={item.status} />}
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

            {/* ── Submit form (collapsible) ── */}
            <motion.section
              className="rounded-2xl border border-outline-variant/10 bg-white shadow-sm"
              variants={fadeUp}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <motion.button
                type="button"
                onClick={() => setShowForm((v) => !v)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left sm:px-6"
                whileTap={reduceMotion ? {} : { scale: 0.995 }}
              >
                <div className="flex items-center gap-3">
                  <motion.div
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10"
                    animate={reduceMotion ? {} : { rotate: showForm ? 15 : 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  >
                    <PackagePlus className="h-5 w-5 text-primary" />
                  </motion.div>
                  <div>
                    <p className="text-base font-semibold text-on-surface">ส่งรายการวัสดุใหม่</p>
                    <p className="text-xs text-on-surface-variant">กรอกข้อมูลและปักหมุดจุดนัดรับบนแผนที่</p>
                  </div>
                </div>
                <motion.span
                  animate={reduceMotion ? {} : { rotate: showForm ? 180 : 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  style={{ display: 'inline-flex' }}
                >
                  <ChevronDown className="h-5 w-5 text-on-surface-variant" />
                </motion.span>
              </motion.button>

              <AnimatePresence initial={false}>
                {showForm && (
                  <motion.div
                    key="form"
                    initial={reduceMotion ? {} : { height: 0, opacity: 0 }}
                    animate={reduceMotion ? {} : { height: 'auto', opacity: 1 }}
                    exit={reduceMotion ? {} : { height: 0, opacity: 0 }}
                    transition={{ duration: 0.32, ease: 'easeInOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className="border-t border-outline-variant/10 px-5 pb-6 pt-5 sm:px-6">
                      <form className="space-y-5" onSubmit={handleSubmitMaterial}>
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="space-y-4">
                            <label className="block space-y-1.5">
                              <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">ชนิดวัสดุ</span>
                              <select
                                value={materialType}
                                onChange={(event) => setMaterialType(event.target.value)}
                                className="w-full rounded-xl border-none bg-surface-container-high px-4 py-3 text-base text-on-surface outline-none focus:ring-2 focus:ring-primary/20 min-h-[52px]"
                                required
                              >
                                {materialTypes.length === 0 ? <option value="">เลือกชนิดวัสดุ</option> : null}
                                {materialTypes.map((material) => (
                                  <option key={material.code} value={material.code}>
                                    {material.name_th}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <div className="grid gap-3 sm:grid-cols-[1fr,10rem]">
                              <label className="block space-y-1.5">
                                <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">ปริมาณ</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={quantityValue}
                                  onChange={(event) => setQuantityValue(event.target.value)}
                                  placeholder="เช่น 120"
                                  className="w-full rounded-xl border-none bg-surface-container-high px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/20 min-h-[52px]"
                                />
                              </label>
                              <label className="block space-y-1.5">
                                <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">หน่วย</span>
                                <select
                                  value={quantityUnit}
                                  onChange={(event) => setQuantityUnit(event.target.value)}
                                  className="w-full rounded-xl border-none bg-surface-container-high px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/20 min-h-[52px]"
                                  required
                                >
                                  {measurementUnits.length === 0 ? <option value="">หน่วย</option> : null}
                                  {measurementUnits.map((unit) => (
                                    <option key={unit.code} value={unit.code}>
                                      {unit.name_th}{unit.to_kg_factor != null && unit.to_kg_factor !== 1 ? ` (1 ${unit.name_th} = ${unit.to_kg_factor.toLocaleString('th-TH')} กก.)` : unit.to_kg_factor === 1 ? ' (= กิโลกรัม)' : ''}
                                    </option>
                                  ))}
                                </select>
                                {(() => {
                                  const qty = parseFloat(quantityValue);
                                  const selectedUnit = measurementUnits.find((u) => u.code === quantityUnit);
                                  if (!selectedUnit || !Number.isFinite(qty) || qty <= 0) return null;
                                  if (selectedUnit.to_kg_factor == null) return (
                                    <p className="mt-1 text-xs text-stone-400">หน่วยนี้ยังไม่มีค่าแปลงเป็น กก. — โรงงานจะชั่งจริงอีกครั้ง</p>
                                  );
                                  const approxKg = qty * selectedUnit.to_kg_factor;
                                  return (
                                    <p className="mt-1 text-xs text-emerald-600 font-medium">
                                      ≈ {approxKg.toLocaleString('th-TH', { maximumFractionDigits: 2 })} กิโลกรัม (ประมาณการ)
                                    </p>
                                  );
                                })()}
                              </label>
                            </div>

                            <label className="block space-y-1.5">
                              <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">สถานที่นัดรับ</span>
                              <input
                                type="text"
                                value={pickupLocation}
                                onChange={(event) => setPickupLocation(event.target.value)}
                                placeholder="เช่น หน้าวัด / จุดสังเกต"
                                className="w-full rounded-xl border-none bg-surface-container-high px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/20 min-h-[52px]"
                                required
                              />
                            </label>

                            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700 ring-1 ring-emerald-100">
                              ปักหมุดบนแผนที่ ระบบจะกรอกที่อยู่นัดรับให้อัตโนมัติ
                            </div>
                          </div>

                          <div className="space-y-3">
                            <PickupLocationMapPicker
                              lat={pickupLat}
                              lng={pickupLng}
                              onChange={({ lat, lng }) => {
                                setPickupLat(lat);
                                setPickupLng(lng);
                              }}
                              onAddressResolved={(address) => {
                                setPickupLocation(address);
                              }}
                              mapHeightClassName="h-[240px] w-full overflow-hidden rounded-2xl sm:h-[300px]"
                            />
                            <div className="rounded-xl bg-stone-50 px-4 py-2.5 text-sm text-stone-500">
                              พิกัด:{' '}
                              {pickupLat !== null && pickupLng !== null
                                ? `${pickupLat.toFixed(6)}, ${pickupLng.toFixed(6)}`
                                : 'ยังไม่ได้เลือก'}
                            </div>
                          </div>
                        </div>

                        <motion.button
                          type="submit"
                          disabled={
                            isSubmittingMaterial ||
                            measurementUnits.length === 0 ||
                            materialTypes.length === 0 ||
                            !quantityValue.trim() ||
                            !quantityUnit
                          }
                          className="inline-flex w-full min-h-[52px] items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-base font-semibold text-white shadow-md shadow-primary/20 transition hover:opacity-90 disabled:opacity-50 sm:w-auto"
                          whileTap={reduceMotion ? {} : { scale: 0.97 }}
                          whileHover={reduceMotion ? {} : { scale: 1.02 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        >
                          <PackagePlus className="h-5 w-5" />
                          <span>
                            {isSubmittingMaterial
                              ? 'กำลังส่งรายการ...'
                              : !quantityValue.trim()
                              ? 'กรุณากรอกปริมาณ'
                              : !quantityUnit
                              ? 'กรุณาเลือกหน่วย'
                              : !materialType
                              ? 'กรุณาเลือกวัสดุ'
                              : 'ส่งรายการวัสดุ'}
                          </span>
                        </motion.button>
                      </form>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>

            {/* ── Stats ── */}
            <motion.section
              variants={fadeUp}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">สรุปภาพรวม</p>
              {isLoading ? (
                <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
                </div>
              ) : (
                <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
                  <StatCard label="รายการทั้งหมด" value={stats.all.toLocaleString('th-TH')} detail="ทุกคำขอในบัญชีนี้" icon={Sprout} tone="emerald" />
                  <StatCard label="รอรับวัสดุ" value={stats.waitingPickup.toLocaleString('th-TH')} detail="รอจัดคิวหรือรอรถเข้ารับ" icon={Truck} tone="amber" />
                  <StatCard label="ระหว่างขนส่ง" value={stats.inTransit.toLocaleString('th-TH')} detail="รถรับแล้วหรือกำลังส่งโรงงาน" icon={Route} tone="sky" />
                  <StatCard label="ปิดงานแล้ว" value={stats.completed.toLocaleString('th-TH')} detail="ได้รับ PMUC Coin เรียบร้อย" icon={Coins} tone="violet" />
                </div>
              )}
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
                {availablePoints === null ? (
                  <div className="h-10 w-28 animate-pulse rounded-full bg-stone-100" />
                ) : (
                  <>
                    <span className="text-4xl font-light text-primary">
                      <AnimatedNumber value={availablePoints} />
                    </span>
                    <span className="mb-1 text-sm text-on-surface-variant">แต้ม</span>
                  </>
                )}
              </div>
              <p className="mt-2 text-xs text-on-surface-variant">ใช้แลกรางวัลได้ทันที</p>
            </motion.div>

            {/* Redeem link */}
            <motion.div
              whileHover={reduceMotion ? {} : { y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}
              transition={{ duration: 0.2 }}
            >
              <Link
                href="/farmer/rewards"
                className="flex min-h-[56px] items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-5 py-4 transition hover:bg-primary/10"
              >
                <div className="flex items-center gap-3">
                  <Gift className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-semibold text-primary">แลกรางวัล</p>
                    <p className="text-xs text-on-surface-variant">ดูของรางวัลที่แลกได้</p>
                  </div>
                </div>
                <span className="text-lg text-primary">›</span>
              </Link>
            </motion.div>

            {/* Submit CTA */}
            <motion.button
              type="button"
              onClick={() => {
                setShowForm(true);
                document.getElementById('submit-form-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="flex w-full min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-primary/20"
              whileHover={reduceMotion ? {} : { scale: 1.02, opacity: 0.95 }}
              whileTap={reduceMotion ? {} : { scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            >
              <PackagePlus className="h-4 w-4" />
              ส่งรายการวัสดุใหม่
            </motion.button>
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
    </ErrorBoundary>
  );
}
