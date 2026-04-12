'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  PackagePlus,
  Route,
  Sprout,
  Truck,
} from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import ConfirmDialog from '@/app/_components/ConfirmDialog';
import EmptyState from '@/app/_components/EmptyState';
import dynamic from 'next/dynamic';
const PickupLocationMapPicker = dynamic(() => import('@/app/_components/PickupLocationMapPicker'), { ssr: false });
import SectionCard from '@/app/_components/SectionCard';
import StatCard from '@/app/_components/StatCard';
import StatusBadge from '@/app/_components/StatusBadge';
import {
  ApiError,
  farmerApi,
  type CreateSubmissionPayload,
  type FarmerMaterialTypeItem,
  type FarmerMeasurementUnitItem,
  type FarmerSubmissionItem,
} from '@/app/_lib/apiClient';

const SUBMISSION_STATUS_OPTIONS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'submitted', label: 'ส่งคำขอแล้ว' },
  { value: 'pickup_scheduled', label: 'จัดคิวรถแล้ว' },
  { value: 'picked_up', label: 'รับวัสดุแล้ว' },
  { value: 'delivered_to_factory', label: 'ส่งถึงโรงงานแล้ว' },
  { value: 'factory_confirmed', label: 'โรงงานยืนยันแล้ว' },
  { value: 'points_credited', label: 'ได้รับ PMUC Coin แล้ว' },
] as const;

function hasAccessToken(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return Boolean(localStorage.getItem('AREX_ACCESS_TOKEN'));
}

function formatSubmissionStatus(status: string): string {
  const map: Record<string, string> = {
    submitted: 'ส่งคำขอแล้ว',
    pickup_scheduled: 'จัดคิวรถแล้ว',
    picked_up: 'รับวัสดุแล้ว',
    delivered_to_factory: 'ส่งถึงโรงงานแล้ว',
    factory_confirmed: 'โรงงานยืนยันแล้ว',
    points_credited: 'ได้รับ PMUC Coin แล้ว',
  };
  return map[status] ?? status;
}

function formatDateTime(dateTime: string | null | undefined): string {
  if (!dateTime) {
    return '-';
  }
  return new Date(dateTime).toLocaleString('th-TH', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fallbackThaiUnit(unitCode: string): string {
  const map: Record<string, string> = {
    kg: 'กิโลกรัม',
    ton: 'ตัน',
    m3: 'ลูกบาศก์เมตร',
  };
  return map[unitCode] ?? unitCode;
}

function buildGoogleMapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function inferMessageTone(message: string | null): 'info' | 'success' | 'error' {
  if (!message) {
    return 'info';
  }
  if (message.includes('ไม่สำเร็จ') || message.includes('กรุณา') || message.includes('ยังไม่')) {
    return 'error';
  }
  if (message.includes('สำเร็จ')) {
    return 'success';
  }
  return 'info';
}

export default function FarmerHome() {
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
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<(typeof SUBMISSION_STATUS_OPTIONS)[number]['value']>('all');

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const unitNameByCode = useMemo(() => {
    const map: Record<string, string> = {};
    for (const unit of measurementUnits) {
      map[unit.code] = unit.name_th;
    }
    return map;
  }, [measurementUnits]);

  const materialNameByCode = useMemo(() => {
    const map: Record<string, string> = {};
    for (const material of materialTypes) {
      map[material.code] = material.name_th;
    }
    return map;
  }, [materialTypes]);

  const stats = useMemo(() => {
    return {
      all: submissions.length,
      waitingPickup: submissions.filter((item) => item.status === 'submitted' || item.status === 'pickup_scheduled').length,
      inTransit: submissions.filter((item) => item.status === 'picked_up' || item.status === 'delivered_to_factory').length,
      completed: submissions.filter((item) => item.status === 'points_credited').length,
    };
  }, [submissions]);

  const filteredSubmissions = useMemo(() => {
    if (statusFilter === 'all') {
      return submissions;
    }
    return submissions.filter((item) => item.status === statusFilter);
  }, [submissions, statusFilter]);

  const loadDashboard = async (forceRefresh = false) => {
    if (!hasAccessToken()) {
      setMessage('ยังไม่พบโทเคน AREX_ACCESS_TOKEN กรุณาเข้าสู่ระบบที่หน้าเลือกผู้ใช้งาน');
      return;
    }

    setIsLoading(true);
    try {
      const [submissionsResponse, materialTypesResponse, unitsResponse] = await Promise.all([
        farmerApi.listSubmissions({ forceRefresh }),
        farmerApi.listMaterialTypes({ forceRefresh }),
        farmerApi.listMeasurementUnits({ forceRefresh }),
      ]);
      setSubmissions(submissionsResponse.submissions);

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

  const handleSubmitMaterial = async (event: React.FormEvent<HTMLFormElement>) => {
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

    if (!quantityUnit) {
      setMessage('กรุณาเลือกหน่วย');
      return;
    }

    if (!materialType) {
      setMessage('กรุณาเลือกชนิดวัสดุ');
      return;
    }

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

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <a href="/farmer/rewards" className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700">ไปหน้าแลกรางวัล</a>
        <button onClick={() => void loadDashboard(true)} disabled={isLoading} className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700">
          {isLoading ? '...' : 'รีเฟรช'}
        </button>
      </div>

      {message ? <AlertBanner message={message} tone={inferMessageTone(message)} /> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="รายการทั้งหมด" value={stats.all.toLocaleString('th-TH')} detail="ทุกคำขอที่เคยส่งในบัญชีนี้" icon={Sprout} tone="emerald" />
        <StatCard label="รอรับวัสดุ" value={stats.waitingPickup.toLocaleString('th-TH')} detail="กำลังรอจัดคิวหรือรอรถเข้ารับ" icon={Truck} tone="amber" />
        <StatCard label="อยู่ระหว่างขนส่ง" value={stats.inTransit.toLocaleString('th-TH')} detail="งานที่รถรับแล้วหรือกำลังส่งถึงโรงงาน" icon={Route} tone="sky" />
        <StatCard label="ปิดงานแล้ว" value={stats.completed.toLocaleString('th-TH')} detail="รายการที่ได้รับ PMUC Coin เรียบร้อย" icon={ArrowRight} tone="violet" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.08fr,0.92fr]">
        <SectionCard
          title="ส่งรายการวัสดุใหม่"
          description="กรอกข้อมูลหลักให้ครบ แล้วปักหมุดตำแหน่งนัดรับบนแผนที่ ระบบจะช่วยดึงข้อความที่อยู่ตามตำแหน่งให้โดยอัตโนมัติ"
          className="border border-emerald-200 shadow-lg shadow-primary/10"
        >
          <form className="space-y-5" onSubmit={handleSubmitMaterial}>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
                <div>
                  <p className="text-sm font-semibold tracking-wide text-emerald-800">ข้อมูลหลักของรายการ</p>
                  <p className="mt-1 text-sm text-emerald-600">เลือกวัสดุและระบุปริมาณก่อน จากนั้นค่อยปักหมุดจุดนัดรับทางด้านขวา</p>
                </div>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-stone-700">ชนิดวัสดุ</span>
                  <select
                    value={materialType}
                    onChange={(event) => setMaterialType(event.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-on-surface outline-none"
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

                <div className="grid gap-4 sm:grid-cols-[1fr,12rem]">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-stone-700">ปริมาณ</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={quantityValue}
                      onChange={(event) => setQuantityValue(event.target.value)}
                      placeholder="เช่น 120"
                      className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-on-surface outline-none"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-stone-700">หน่วย</span>
                    <select
                      value={quantityUnit}
                      onChange={(event) => setQuantityUnit(event.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-on-surface outline-none"
                      required
                    >
                      {measurementUnits.length === 0 ? <option value="">เลือกหน่วย</option> : null}
                      {measurementUnits.map((unit) => (
                        <option key={unit.code} value={unit.code}>
                          {unit.name_th}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700 ring-1 ring-emerald-100">
                  คำแนะนำ: ถ้าปักหมุดแล้ว ระบบจะอัปเดตรายละเอียดที่นัดรับให้เอง และคุณสามารถแก้ไขรายละเอียดสถานที่นัดรับได้หลังจากปักหมุดแผนที่
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-emerald-100 bg-white p-4">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-stone-700">สถานที่นัดรับ</span>
                  <input
                    type="text"
                    value={pickupLocation}
                    onChange={(event) => setPickupLocation(event.target.value)}
                    placeholder="เช่น หน้าวัด / จุดสังเกต"
                    className="w-full rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 outline-none"
                    required
                  />
                </label>

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
                  mapHeightClassName="h-[260px] w-full overflow-hidden rounded-[1.5rem] sm:h-[320px] xl:h-[400px]"
                />

                <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-stone-600">
                  พิกัดที่เลือก:{' '}
                  {pickupLat !== null && pickupLng !== null ? `${pickupLat.toFixed(6)}, ${pickupLng.toFixed(6)}` : 'ยังไม่ได้เลือก'}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={
                isSubmittingMaterial ||
                measurementUnits.length === 0 ||
                materialTypes.length === 0 ||
                !quantityValue.trim() ||
                !quantityUnit
              }
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-container disabled:opacity-60"
            >
              <PackagePlus className="h-4 w-4" />
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
            </button>
          </form>
        </SectionCard>

        <SectionCard
          title="ประวัติรายการวัสดุ"
          description="ย้อนดูรายการของคุณทั้งหมดได้จากตารางเดียว"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-stone-600">
              แสดง {filteredSubmissions.length.toLocaleString('th-TH')} จาก {submissions.length.toLocaleString('th-TH')} รายการ
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUBMISSION_STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatusFilter(option.value)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                    statusFilter === option.value
                      ? 'bg-stone-900 text-white'
                      : 'border border-stone-200 bg-white text-stone-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {filteredSubmissions.length === 0 ? (
            <EmptyState
              title="ไม่พบรายการตามตัวกรองนี้"
              description="ลองสลับสถานะด้านบน หรือสร้างรายการวัสดุใหม่เพื่อเริ่มต้นใช้งาน"
            />
          ) : (
            <div className="space-y-2">
              {filteredSubmissions.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-xl bg-stone-50 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-stone-900">
                      {materialNameByCode[item.material_type] ?? item.material_type}
                      <span className="ml-2 text-stone-500">
                        {Number(item.quantity_value).toLocaleString('th-TH')} {unitNameByCode[item.quantity_unit] ?? fallbackThaiUnit(item.quantity_unit)}
                      </span>
                    </p>
                    <p className="truncate text-xs text-stone-500">
                      {item.pickup_location_text || '-'} • {item.pickup_window_start_at ? formatDateTime(item.pickup_window_start_at) : 'รอนัด'}
                    </p>
                  </div>
                  <StatusBadge status={item.status} label={formatSubmissionStatus(item.status)} size="sm" />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="ยืนยัน"
        cancelLabel="ยกเลิก"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
