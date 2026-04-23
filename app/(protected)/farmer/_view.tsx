'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { ArrowDownAZ, Ban, CalendarCheck, Camera, CheckCircle2, ClipboardList, Coins, Factory, Gift, MapPin, PackagePlus, RefreshCw, Truck, User, X, XCircle, ZoomIn } from 'lucide-react';

import AlertBanner from '@/app/_components/AlertBanner';
import ConfirmDialog from '@/app/_components/ConfirmDialog';
import EmptyState from '@/app/_components/EmptyState';
import ErrorBoundary from '@/app/_components/ErrorBoundary';
import dynamic from 'next/dynamic';
const PickupLocationMapPicker = dynamic(() => import('@/app/_components/PickupLocationMapPicker'), { ssr: false });
import { SkeletonCard } from '@/app/_components/Skeleton';
import StatusBadge from '@/app/_components/StatusBadge';
import { useFarmerProfile } from '@/app/_contexts/FarmerProfileContext';
import {
  ApiError,
  farmerApi,
  hasAccessToken,
  type CreateSubmissionPayload,
  type FarmerMaterialTypeItem,
  type FarmerMeasurementUnitItem,
  type FarmerSubmissionItem,
} from '@/app/_lib/api';
import { deleteSubmissionImage, uploadSubmissionImage } from '@/app/_lib/api/storage';
import { fallbackThaiUnit, formatDate, formatDateTime } from '@/app/_lib/utils';

async function resizeImageFile(file: File, maxPx = 1600, quality = 0.85): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        resolve(blob ? new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }) : file);
      }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

const ACTIVE_STATUSES = new Set(['submitted', 'pickup_scheduled', 'picked_up', 'delivered_to_factory', 'factory_confirmed']);

const STATUS_FILTER_OPTIONS = [
  { value: 'submitted',            label: 'รอจัดคิวรถ',   Icon: ClipboardList, color: 'amber'   },
  { value: 'pickup_scheduled',     label: 'จัดคิวรถแล้ว', Icon: CalendarCheck, color: 'sky'     },
  { value: 'picked_up',           label: 'รับวัสดุแล้ว', Icon: Truck,         color: 'blue'    },
  { value: 'delivered_to_factory', label: 'ส่งถึงโรงงาน', Icon: Factory,       color: 'violet'  },
  { value: 'points_credited',      label: 'ได้แต้มแล้ว',  Icon: Coins,         color: 'emerald' },
  { value: 'cancelled',            label: 'ถูกยกเลิก',    Icon: Ban,           color: 'rose'    },
] as const;

const TAB_ACTIVE_CLASSES: Record<string, string> = {
  amber:   'bg-amber-500  text-white border-amber-500',
  sky:     'bg-sky-500    text-white border-sky-500',
  blue:    'bg-blue-500   text-white border-blue-500',
  violet:  'bg-violet-500 text-white border-violet-500',
  indigo:  'bg-indigo-500 text-white border-indigo-500',
  emerald: 'bg-emerald-500 text-white border-emerald-500',
  rose:    'bg-rose-500   text-white border-rose-500',
};
const TAB_COUNT_ACTIVE: Record<string, string> = {
  amber: 'bg-amber-400', sky: 'bg-sky-400', blue: 'bg-blue-400',
  violet: 'bg-violet-400', indigo: 'bg-indigo-400', emerald: 'bg-emerald-400',
  rose: 'bg-rose-400',
};

type StatusGroup = (typeof STATUS_FILTER_OPTIONS)[number]['value'] | 'all';
type SortKey = 'date_desc' | 'date_asc' | 'material';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'date_desc', label: 'ล่าสุดก่อน' },
  { key: 'date_asc',  label: 'เก่าสุดก่อน' },
  { key: 'material',  label: 'ชื่อวัสดุ ก-ฮ' },
];

function formatSubmissionStatus(status: string): string {
  const map: Record<string, string> = {
    submitted: 'รอจัดคิวรถ',
    pickup_scheduled: 'จัดคิวรถแล้ว',
    picked_up: 'รับวัสดุแล้ว',
    delivered_to_factory: 'ส่งถึงโรงงานแล้ว',
    factory_confirmed: 'โรงงานยืนยันแล้ว',
    points_credited: 'ได้รับแต้มแล้ว',
    cancelled: 'ถูกยกเลิก',
  };
  return map[status] ?? status;
}

function formatPickupWindow(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) return 'รอนัดหมาย';
  const startStr = formatDate(start);
  if (!end) return startStr;
  const endStr = formatDate(end);
  return startStr === endStr ? startStr : `${startStr} - ${endStr}`;
}

function Toast({ tone, message, onDone }: { tone: 'success' | 'error'; message: string; onDone: () => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    timerRef.current = setTimeout(() => onDoneRef.current(), 3000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);
  const success = tone === 'success';
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      className={`fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border px-5 py-3.5 shadow-lg backdrop-blur-sm ${success ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}
    >
      {success ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" /> : <XCircle className="h-5 w-5 shrink-0 text-red-400" />}
      <span className={`text-sm font-medium ${success ? 'text-emerald-700' : 'text-red-700'}`}>{message}</span>
    </motion.div>
  );
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
  const [submissionImagePreview, setSubmissionImagePreview] = useState<string | null>(null);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [isSubmittingMaterial, setIsSubmittingMaterial] = useState(false);
  const [submissions, setSubmissions] = useState<FarmerSubmissionItem[]>([]);
  const [materialTypes, setMaterialTypes] = useState<FarmerMaterialTypeItem[]>([]);
  const [measurementUnits, setMeasurementUnits] = useState<FarmerMeasurementUnitItem[]>([]);
  const [availablePoints, setAvailablePoints] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string; id: number } | null>(null);
  const toastId = useRef(0);
  const [statusGroup, setStatusGroup] = useState<StatusGroup>('submitted');
  const [sortKey, setSortKey] = useState<SortKey>('date_desc');
  const [showForm, setShowForm] = useState(false);

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

  const filteredSubmissions = useMemo(() => {
    let list = statusGroup !== 'all' ? submissions.filter((s) => s.status === statusGroup) : submissions;
    return [...list].sort((a, b) => {
      if (sortKey === 'material') return (materialNameByCode[a.material_type] ?? a.material_type).localeCompare(materialNameByCode[b.material_type] ?? b.material_type, 'th');
      const ta = new Date(a.created_at ?? 0).getTime();
      const tb = new Date(b.created_at ?? 0).getTime();
      return sortKey === 'date_asc' ? ta - tb : tb - ta;
    });
  }, [submissions, statusGroup, sortKey, materialNameByCode]);

  const loadDashboard = async (forceRefresh = false) => {
    if (!hasAccessToken()) {
      setError('ยังไม่พบโทเคน AREX_ACCESS_TOKEN กรุณาเข้าสู่ระบบที่หน้าเลือกผู้ใช้งาน');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [submissionsResponse, materialTypesResponse, unitsResponse, pointsResponse] = await Promise.all([
        farmerApi.listSubmissions({ forceRefresh }),
        farmerApi.listMaterialTypes({ forceRefresh }),
        farmerApi.listMeasurementUnits({ forceRefresh }),
        farmerApi.getPoints({ forceRefresh }),
      ]);
      const subs = submissionsResponse.submissions;
      setSubmissions(subs);
      const firstTabWithItems = STATUS_FILTER_OPTIONS.find((opt) => subs.some((s) => s.status === opt.value));
      if (firstTabWithItems) setStatusGroup(firstTabWithItems.value);
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
    } catch (err) {
      setError(err instanceof ApiError ? `โหลดข้อมูลไม่สำเร็จ: ${err.message}` : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadDashboard(); }, []);
  const handleSubmitMaterial = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasAccessToken()) { setToast({ tone: 'error', message: 'ยังไม่พบโทเคน AREX_ACCESS_TOKEN สำหรับเชื่อมต่อ FastAPI', id: ++toastId.current }); return; }
    const parsedQuantity = Number(quantityValue);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) { setToast({ tone: 'error', message: 'กรุณาระบุปริมาณมากกว่า 0', id: ++toastId.current }); return; }
    if (!quantityUnit) { setToast({ tone: 'error', message: 'กรุณาเลือกหน่วย', id: ++toastId.current }); return; }
    if (!materialType) { setToast({ tone: 'error', message: 'กรุณาเลือกชนิดวัสดุ', id: ++toastId.current }); return; }
    if (pickupLat === null || pickupLng === null) { setToast({ tone: 'error', message: 'กรุณาเลือกจุดนัดรับบนแผนที่ก่อนส่งรายการ', id: ++toastId.current }); return; }

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

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input so re-selecting the same file fires onChange again
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (!file) return;
    if (pendingImageUrl) { void deleteSubmissionImage(pendingImageUrl); setPendingImageUrl(null); }
    const previewUrl = URL.createObjectURL(file);
    setSubmissionImagePreview(previewUrl);
    setIsUploadingImage(true);
    try {
      const resized = await resizeImageFile(file);
      const url = await uploadSubmissionImage(resized);
      setPendingImageUrl(url);
    } catch {
      // Keep preview so user can see what they picked; just show the error
      setToast({ tone: 'error', message: 'อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่', id: ++toastId.current });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const resetForm = () => {
    setQuantityValue('');
    setPickupLocation('');
    setPickupLat(null);
    setPickupLng(null);
    setSubmissionImagePreview(null);
    if (pendingImageUrl) { void deleteSubmissionImage(pendingImageUrl); setPendingImageUrl(null); }
  };

  const submitMaterial = async () => {
    const parsedQuantity = Number(quantityValue);
    setIsSubmittingMaterial(true);
    try {
      await farmerApi.createSubmission({
        material_type: materialType,
        quantity_value: parsedQuantity,
        quantity_unit: quantityUnit,
        pickup_location_text: pickupLocation,
        pickup_lat: pickupLat!,
        pickup_lng: pickupLng!,
        image_url: pendingImageUrl ?? undefined,
      });
      setPendingImageUrl(null);
      setSubmissionImagePreview(null);
      setQuantityValue('');
      setToast({ tone: 'success', message: 'ส่งรายการวัสดุสำเร็จแล้ว', id: ++toastId.current });
      setShowForm(false);
      await loadDashboard(true);
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof ApiError ? `ส่งรายการไม่สำเร็จ: ${err.message}` : 'ส่งรายการไม่สำเร็จ กรุณาลองใหม่', id: ++toastId.current });
    } finally {
      setIsSubmittingMaterial(false);
    }
  };

  const handleCancelSubmission = (item: FarmerSubmissionItem) => {
    setConfirmDialog({
      open: true,
      title: 'ยืนยันการยกเลิก',
      message: `ต้องการยกเลิกรายการ "${materialNameByCode[item.material_type] ?? item.material_type}" ใช่หรือไม่?`,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, open: false }));
        try {
          await farmerApi.deleteSubmission(item.id);
          setToast({ tone: 'success', message: 'ยกเลิกรายการเรียบร้อยแล้ว', id: ++toastId.current });
          await loadDashboard(true);
        } catch (err) {
          setToast({ tone: 'error', message: err instanceof ApiError ? `ยกเลิกรายการไม่สำเร็จ: ${err.message}` : 'ยกเลิกรายการไม่สำเร็จ', id: ++toastId.current });
        }
      },
    });
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

        {error && <AlertBanner message={error} tone="error" />}

        {/* ── Submissions list ── */}
        <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">

          {/* Status filter tabs — horizontal scroll with snap */}
          <div className="overflow-x-auto scrollbar-hide border-b border-stone-100">
            <div className="flex gap-2 px-3 py-3" style={{ width: 'max-content' }}>
              {STATUS_FILTER_OPTIONS.map(({ value, label, Icon, color }) => {
                const count = submissions.filter((s) => s.status === value).length;
                const isActive = statusGroup === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStatusGroup(value)}
                    className={`flex flex-col items-start justify-between rounded-2xl border px-3.5 py-3 transition-all active:scale-95 ${
                      isActive
                        ? TAB_ACTIVE_CLASSES[color]
                        : 'bg-white border-stone-200 text-stone-600'
                    }`}
                    style={{ minWidth: 100, minHeight: 80 }}
                  >
                    <div className="flex w-full items-start justify-between gap-2">
                      <Icon className={`h-5 w-5 ${isActive ? 'text-white' : count > 0 ? 'text-stone-600' : 'text-stone-300'}`} />
                      <span className={`min-w-[22px] text-center rounded-full text-xs font-black px-1.5 py-0.5 leading-none ${
                        isActive
                          ? `${TAB_COUNT_ACTIVE[color]} text-white`
                          : count > 0 ? 'bg-stone-100 text-stone-700' : 'bg-stone-50 text-stone-300'
                      }`}>
                        {count}
                      </span>
                    </div>
                    <span className={`mt-2 text-xs font-semibold leading-tight text-left ${isActive ? 'text-white' : count > 0 ? 'text-stone-700' : 'text-stone-400'}`}>
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sort strip */}
          <div className="flex items-center gap-2 px-3 py-2.5 bg-stone-50/60 border-b border-stone-100">
            <ArrowDownAZ className="h-4 w-4 text-stone-400 shrink-0" />
            <span className="text-xs text-stone-400 font-medium">เรียง:</span>
            {SORT_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setSortKey(key)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                  sortKey === key ? 'bg-stone-700 text-white' : 'text-stone-400 hover:text-stone-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Cards */}
          <div>
            {isLoading ? (
              <div className="divide-y divide-stone-100">
                {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="px-4 py-10">
                <EmptyState
                  title="ไม่มีรายการในสถานะนี้"
                  description={statusGroup === 'submitted' ? 'กดปุ่มด้านล่างเพื่อส่งรายการวัสดุใหม่' : 'ยังไม่มีรายการที่ถึงขั้นตอนนี้'}
                />
              </div>
            ) : (
              <motion.div
                key={`${statusGroup}-${sortKey}`}
                className="divide-y divide-stone-100"
                initial={reduceMotion ? {} : { opacity: 0 }}
                animate={reduceMotion ? {} : { opacity: 1 }}
                transition={{ duration: 0.15 }}
              >
                {filteredSubmissions.map((item) => {
                  const isActiveStatus = ACTIVE_STATUSES.has(item.status);
                  const isCredited = item.status === 'points_credited';
                  const hasMap = item.pickup_lat != null && item.pickup_lng != null;
                  const pickupWindow = formatPickupWindow(item.pickup_window_start_at, item.pickup_window_end_at);
                  const showPickupDate = isActiveStatus && item.pickup_window_start_at && item.status !== 'delivered_to_factory' && item.status !== 'factory_confirmed';

                  const stripeColor: Record<string, string> = {
                    submitted: 'border-l-amber-400',
                    pickup_scheduled: 'border-l-sky-400',
                    picked_up: 'border-l-blue-400',
                    delivered_to_factory: 'border-l-violet-400',
                    factory_confirmed: 'border-l-violet-300',
                    points_credited: 'border-l-emerald-400',
                    cancelled: 'border-l-stone-300',
                  };

                  return (
                    <article key={item.id} className={`border-l-4 ${stripeColor[item.status] ?? 'border-l-stone-300'} px-4 py-2.5 ${isCredited ? 'bg-emerald-50/30' : ''}`}>
                      <div className="flex items-start gap-2.5">

                        {/* Main content */}
                        <div className="min-w-0 flex-1 space-y-1">
                          {/* Row 1: name + submitted date + map button */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-baseline gap-2 min-w-0">
                              <p className="text-sm font-bold text-stone-900 leading-snug truncate">
                                {materialNameByCode[item.material_type] ?? item.material_type}
                              </p>
                              <span className="text-xs text-stone-400 shrink-0">ส่งเมื่อ {formatDateTime(item.created_at)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {item.image_url && (
                                <button
                                  type="button"
                                  onClick={() => setLightboxUrl(item.image_url!)}
                                  className="relative h-10 w-10 overflow-hidden rounded-lg border border-stone-200 bg-stone-100 hover:opacity-80 transition"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={item.image_url} alt="ภาพวัสดุ" className="h-full w-full object-cover" />
                                  <div className="absolute inset-0 flex items-end justify-end p-0.5">
                                    <ZoomIn className="h-2.5 w-2.5 text-white drop-shadow" />
                                  </div>
                                </button>
                              )}
                              {hasMap && (
                                <a
                                  href={`https://www.google.com/maps?q=${item.pickup_lat},${item.pickup_lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                                >
                                  <MapPin className="h-3 w-3" />
                                  จุดนัดรับ
                                </a>
                              )}
                            </div>
                          </div>

                          {/* Row 2: qty + badge/points + pickup window + cancel */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs text-stone-700 font-semibold">
                              {Number(item.quantity_value).toLocaleString('th-TH')} {unitNameByCode[item.quantity_unit] ?? fallbackThaiUnit(item.quantity_unit)}
                            </span>
                            {isCredited && item.credited_points != null ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-black tabular-nums text-emerald-700">
                                <Coins className="h-3 w-3" />
                                +{item.credited_points.toLocaleString('th-TH')} แต้ม
                              </span>
                            ) : (
                              <StatusBadge status={item.status} label={formatSubmissionStatus(item.status)} size="sm" />
                            )}
                            {showPickupDate && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-200 px-2 py-0.5 text-xs font-semibold text-sky-700">
                                🗒 นัดรับ {pickupWindow}
                              </span>
                            )}
                            {item.status === 'submitted' && (
                              <button
                                type="button"
                                onClick={() => handleCancelSubmission(item)}
                                className="ml-auto flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition"
                              >
                                <X className="h-3 w-3" />
                                ยกเลิก
                              </button>
                            )}
                          </div>

                          {/* pickup location text (no coords) */}
                          {!hasMap && item.pickup_location_text && (
                            <p className="flex items-center gap-1 text-xs text-stone-400">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {item.pickup_location_text}
                            </p>
                          )}

                          {/* Cancellation reason */}
                          {item.status === 'cancelled' && item.cancel_reason && (
                            <p className="flex items-start gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700">
                              <X className="h-3 w-3 shrink-0 mt-0.5" />
                              <span><span className="font-semibold">เหตุผลที่ยกเลิก:</span> {item.cancel_reason}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </motion.div>
            )}
          </div>
        </div>

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
                onClick={() => { resetForm(); setShowForm(false); }}
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
                    onClick={() => { resetForm(); setShowForm(false); }}
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

                  {/* Image upload */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-stone-700">
                      ภาพถ่ายวัสดุ
                    </label>
                    {submissionImagePreview ? (
                      <div className="relative w-full overflow-hidden rounded-2xl border border-stone-200 bg-stone-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={submissionImagePreview} alt="ภาพวัสดุ" className="w-full object-contain max-h-[60dvh]" />
                        {isUploadingImage && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => { setSubmissionImagePreview(null); if (pendingImageUrl) { void deleteSubmissionImage(pendingImageUrl); setPendingImageUrl(null); } }}
                          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50 py-8 transition hover:border-primary/40 hover:bg-primary/5">
                        <Camera className="h-8 w-8 text-stone-300" />
                        <span className="text-sm font-medium text-stone-400">แตะเพื่อถ่ายภาพหรือเลือกไฟล์</span>
                        <input
                          ref={imageInputRef}
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={handleImageChange}
                        />
                      </label>
                    )}
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isSubmittingMaterial || isUploadingImage || !quantityValue.trim() || !quantityUnit || !materialType || !pendingImageUrl}
                    className="flex w-full min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-white shadow-md shadow-primary/20 transition hover:opacity-90 disabled:opacity-50"
                  >
                    <PackagePlus className="h-5 w-5" />
                    {isUploadingImage ? 'กำลังอัปโหลดภาพ...' : isSubmittingMaterial ? 'กำลังส่งรายการ...' : 'ส่งรายการวัสดุ'}
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

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            key="lightbox"
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
            initial={reduceMotion ? {} : { opacity: 0 }}
            animate={reduceMotion ? {} : { opacity: 1 }}
            exit={reduceMotion ? {} : { opacity: 0 }}
            onClick={() => setLightboxUrl(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt="ภาพวัสดุ"
              className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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

      <AnimatePresence>
        {toast && <Toast key={toast.id} tone={toast.tone} message={toast.message} onDone={() => setToast(null)} />}
      </AnimatePresence>
    </ErrorBoundary>
  );
}
