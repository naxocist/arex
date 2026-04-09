import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  PackagePlus,
  Route,
  Sprout,
  Truck,
} from 'lucide-react';
import AlertBanner from '@/src/components/AlertBanner';
import EmptyState from '@/src/components/EmptyState';
import PageHeader from '@/src/components/PageHeader';
import PickupLocationMapPicker from '@/src/components/PickupLocationMapPicker';
import SectionCard from '@/src/components/SectionCard';
import StatCard from '@/src/components/StatCard';
import StatusBadge from '@/src/components/StatusBadge';
import {
  ApiError,
  farmerApi,
  type CreateSubmissionPayload,
  type FarmerMaterialTypeItem,
  type FarmerMeasurementUnitItem,
  type FarmerSubmissionItem,
} from '@/src/lib/apiClient';

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

function buildOpenStreetMapLink(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
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
  const [pickupLocation, setPickupLocation] = useState('ต.นาเฉลียง อ.หนองไผ่ จ.เพชรบูรณ์');
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);

  const [isSubmittingMaterial, setIsSubmittingMaterial] = useState(false);
  const [submissions, setSubmissions] = useState<FarmerSubmissionItem[]>([]);
  const [materialTypes, setMaterialTypes] = useState<FarmerMaterialTypeItem[]>([]);
  const [measurementUnits, setMeasurementUnits] = useState<FarmerMeasurementUnitItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<(typeof SUBMISSION_STATUS_OPTIONS)[number]['value']>('all');

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
    const confirmMessage = [
      'ยืนยันการส่งรายการวัสดุ',
      '',
      `วัสดุ: ${materialLabel}`,
      `ปริมาณ: ${parsedQuantity.toLocaleString('th-TH')} ${unitLabel}`,
      `จุดนัดรับ: ${pickupLocation}`,
      '',
      'หากข้อมูลถูกต้อง กด OK เพื่อส่งรายการ',
    ].join('\n');

    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(confirmMessage);
      if (!confirmed) {
        setMessage('ยกเลิกการส่งรายการวัสดุ');
        return;
      }
    }

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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Farmer Workspace"
        title="แจ้งวัสดุใหม่และติดตามงานรับซื้อในที่เดียว"
        description="หน้าหลักนี้สรุปสถานะงานแบบสั้นพอให้เห็นภาพรวม แล้วพาคุณลงมือส่งรายการวัสดุใหม่ได้ทันที"
        className="px-5 py-4 md:px-6 md:py-4"
        actions={[
          {
            label: 'ไปหน้าแลกของรางวัล',
            to: '/farmer-rewards',
            variant: 'secondary',
          },
          {
            label: isLoading ? 'กำลังรีเฟรช...' : 'รีเฟรชข้อมูล',
            onClick: () => void loadDashboard(true),
          },
        ]}
      />

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
              <div className="space-y-4 rounded-2xl bg-gradient-to-br from-primary via-primary-container to-emerald-700 p-5 text-white shadow-lg">
                <div>
                  <p className="text-sm font-semibold tracking-wide">ข้อมูลหลักของรายการ</p>
                  <p className="mt-1 text-sm text-white/80">เลือกวัสดุและระบุปริมาณก่อน จากนั้นค่อยปักหมุดจุดนัดรับทางด้านขวา</p>
                </div>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-white/90">ชนิดวัสดุ</span>
                  <select
                    value={materialType}
                    onChange={(event) => setMaterialType(event.target.value)}
                    className="w-full rounded-xl border border-white/25 bg-white px-4 py-3 text-on-surface outline-none"
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
                    <span className="text-sm font-medium text-white/90">ปริมาณ</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={quantityValue}
                      onChange={(event) => setQuantityValue(event.target.value)}
                      placeholder="เช่น 120"
                      className="w-full rounded-xl border border-white/25 bg-white px-4 py-3 text-on-surface outline-none"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-white/90">หน่วย</span>
                    <select
                      value={quantityUnit}
                      onChange={(event) => setQuantityUnit(event.target.value)}
                      className="w-full rounded-xl border border-white/25 bg-white px-4 py-3 text-on-surface outline-none"
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

                <div className="rounded-xl bg-white/12 px-4 py-3 text-sm leading-6 text-white/90 ring-1 ring-white/12">
                  เคล็ดลัด: ถ้าปักหมุดแล้ว ระบบจะอัปเดตที่อยู่ให้เอง และถ้ากดใช้ตำแหน่งปัจจุบัน จะล็อกหน้าจอชั่วคราวจนดึงที่อยู่เสร็จ
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
              disabled={isSubmittingMaterial || measurementUnits.length === 0 || materialTypes.length === 0}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-container disabled:opacity-60"
            >
              <PackagePlus className="h-4 w-4" />
              <span>{isSubmittingMaterial ? 'กำลังส่งรายการ...' : 'ส่งรายการวัสดุ'}</span>
            </button>
          </form>
        </SectionCard>

        <SectionCard
          title="ประวัติรายการวัสดุ"
          description="กรองสถานะเพื่อดูเฉพาะงานที่สนใจ หรือไล่ดูย้อนหลังทั้งหมดได้จากตารางเดียว"
          actions={
            <div className="flex flex-wrap gap-2">
              {SUBMISSION_STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatusFilter(option.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    statusFilter === option.value
                      ? 'bg-stone-950 text-white'
                      : 'border border-line bg-surface-muted text-stone-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          }
        >
          <p className="mb-4 text-sm text-stone-600">
            แสดง {filteredSubmissions.length.toLocaleString('th-TH')} จาก {submissions.length.toLocaleString('th-TH')} รายการ
          </p>

          {filteredSubmissions.length === 0 ? (
            <EmptyState
              title="ไม่พบรายการตามตัวกรองนี้"
              description="ลองสลับสถานะด้านบน หรือสร้างรายการวัสดุใหม่เพื่อเริ่มต้นใช้งาน"
            />
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {filteredSubmissions.map((item) => (
                  <article key={item.id} className="rounded-xl bg-surface-container-low p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-stone-900">
                          {materialNameByCode[item.material_type] ?? item.material_type}
                        </p>
                        <p className="mt-1 text-xs text-stone-500">{formatDateTime(item.created_at)}</p>
                      </div>
                      <StatusBadge status={item.status} label={formatSubmissionStatus(item.status)} size="sm" />
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-stone-600">
                      <p>
                        ปริมาณ: {Number(item.quantity_value).toLocaleString('th-TH')} {unitNameByCode[item.quantity_unit] ?? fallbackThaiUnit(item.quantity_unit)}
                      </p>
                      <p>สถานที่: {item.pickup_location_text || '-'}</p>
                      <p>
                        ช่วงนัดรับ:{' '}
                        {item.pickup_window_start_at
                          ? `${formatDateTime(item.pickup_window_start_at)} - ${formatDateTime(item.pickup_window_end_at ?? null)}`
                          : 'ยังไม่กำหนด'}
                      </p>
                      {typeof item.pickup_lat === 'number' && typeof item.pickup_lng === 'number' ? (
                        <a
                          href={buildOpenStreetMapLink(item.pickup_lat, item.pickup_lng)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-sm font-medium text-stone-900 underline underline-offset-2"
                        >
                          ดูบนแผนที่
                        </a>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-stone-500">
                      <th className="py-3 pr-3">เวลา</th>
                      <th className="py-3 px-3">วัสดุ</th>
                      <th className="py-3 px-3">ปริมาณ</th>
                      <th className="py-3 px-3">สถานที่นัดรับ</th>
                      <th className="py-3 px-3">สถานะ</th>
                      <th className="py-3 pl-3">ช่วงนัดรับ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubmissions.map((item) => (
                      <tr key={item.id} className="border-b border-line/70 align-top">
                        <td className="py-3 pr-3 whitespace-nowrap">{formatDateTime(item.created_at)}</td>
                        <td className="px-3 py-3 font-medium text-stone-900">
                          {materialNameByCode[item.material_type] ?? item.material_type}
                        </td>
                        <td className="px-3 py-3 text-stone-700">
                          {Number(item.quantity_value).toLocaleString('th-TH')} {unitNameByCode[item.quantity_unit] ?? fallbackThaiUnit(item.quantity_unit)}
                        </td>
                        <td className="px-3 py-3 text-stone-600">
                          <p>{item.pickup_location_text || '-'}</p>
                          {typeof item.pickup_lat === 'number' && typeof item.pickup_lng === 'number' ? (
                            <a
                              href={buildOpenStreetMapLink(item.pickup_lat, item.pickup_lng)}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-flex text-xs font-medium text-stone-900 underline underline-offset-2"
                            >
                              ดูบนแผนที่
                            </a>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge status={item.status} label={formatSubmissionStatus(item.status)} />
                        </td>
                        <td className="pl-3 py-3 text-stone-600">
                          {item.pickup_window_start_at
                            ? `${formatDateTime(item.pickup_window_start_at)} - ${formatDateTime(item.pickup_window_end_at ?? null)}`
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </SectionCard>
      </div>

    </div>
  );
}
