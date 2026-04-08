import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import PickupLocationMapPicker from '@/src/components/PickupLocationMapPicker';
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
      <section className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-on-surface">หน้าจัดการงานวัสดุเกษตร</h1>
          <p className="text-sm text-on-surface-variant mt-1">แจ้งส่งวัสดุและติดตามสถานะจนเสร็จกระบวนการ</p>
          {message && <p className="text-sm text-on-surface-variant mt-2 bg-surface-container-high px-3 py-2 rounded-lg w-fit">{message}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/farmer-rewards"
            className="px-4 py-2 rounded-full bg-surface-container-high text-on-surface text-sm font-medium"
          >
            ไปหน้าแลกของรางวัล
          </Link>
          <button
            type="button"
            onClick={() => void loadDashboard(true)}
            disabled={isLoading}
            className="px-4 py-2 rounded-full bg-primary text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> รีเฟรช
          </button>
        </div>
      </section>

      <section className="bg-white border border-outline-variant/20 rounded-xl p-4">
        <h2 className="text-base font-semibold">ลำดับงานในกระบวนการ</h2>
        <p className="text-sm text-on-surface-variant mt-1">Step 1 แจ้งชนิด/ปริมาณวัสดุ จากนั้นติดตามสถานะการนัดรับ รับของ และส่งถึงโรงงาน</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant">รายการทั้งหมด</p>
          <p className="text-3xl font-semibold mt-2">{stats.all.toLocaleString('th-TH')}</p>
        </div>
        <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant">รอรับวัสดุ</p>
          <p className="text-3xl font-semibold mt-2">{stats.waitingPickup.toLocaleString('th-TH')}</p>
        </div>
        <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant">อยู่ระหว่างขนส่ง</p>
          <p className="text-3xl font-semibold mt-2">{stats.inTransit.toLocaleString('th-TH')}</p>
        </div>
        <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant">เสร็จสมบูรณ์</p>
          <p className="text-3xl font-semibold mt-2">{stats.completed.toLocaleString('th-TH')}</p>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1.35fr,1fr] gap-6">
        <div className="bg-white border border-outline-variant/20 rounded-xl p-5">
          <h2 className="text-lg font-semibold">แจ้งส่งวัสดุใหม่</h2>
          <p className="text-sm text-on-surface-variant mt-1 mb-4">กรอกข้อมูลสั้นๆ ทางซ้าย และปักหมุดจุดนัดรับบนแผนที่ทางขวา</p>

          <form className="grid grid-cols-1 md:grid-cols-[0.42fr,1.58fr] gap-4" onSubmit={handleSubmitMaterial}>
            <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/70 p-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-700">ชนิดวัสดุ</label>
                <select
                  value={materialType}
                  onChange={(event) => setMaterialType(event.target.value)}
                  className="bg-white border border-stone-200 rounded-lg px-3 py-2.5 outline-none w-full"
                  required
                >
                  {materialTypes.length === 0 && <option value="">เลือกชนิดวัสดุ</option>}
                  {materialTypes.map((material) => (
                    <option key={material.code} value={material.code}>{material.name_th}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-700">ปริมาณและหน่วย</label>
                <div className="grid grid-cols-[1fr,0.9fr] gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={quantityValue}
                    onChange={(event) => setQuantityValue(event.target.value)}
                    placeholder="เช่น 120"
                    className="bg-white border border-stone-200 rounded-lg px-3 py-2.5 outline-none w-full"
                  />
                  <select
                    value={quantityUnit}
                    onChange={(event) => setQuantityUnit(event.target.value)}
                    className="bg-white border border-stone-200 rounded-lg px-3 py-2.5 outline-none w-full"
                    required
                  >
                    {measurementUnits.length === 0 && <option value="">เลือกหน่วย</option>}
                    {measurementUnits.map((unit) => (
                      <option key={unit.code} value={unit.code}>{unit.name_th}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-700">สถานที่นัดรับ (ข้อความ)</label>
                <input
                  type="text"
                  value={pickupLocation}
                  onChange={(event) => setPickupLocation(event.target.value)}
                  placeholder="เช่น หน้าวัด/จุดสังเกต"
                  className="bg-white border border-stone-200 rounded-lg px-3 py-2.5 outline-none w-full"
                  required
                />
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
              <p className="text-sm font-semibold text-on-surface">เลือกจุดนัดรับบนแผนที่ OpenStreetMap</p>
              <p className="text-xs text-on-surface-variant">แตะ/คลิกเพื่อปักหมุด หรือกดปุ่มใช้ตำแหน่งปัจจุบัน</p>
              <PickupLocationMapPicker
                lat={pickupLat}
                lng={pickupLng}
                onChange={({ lat, lng }) => {
                  setPickupLat(lat);
                  setPickupLng(lng);
                }}
                onAddressResolved={(address) => {
                  if (!pickupLocation || pickupLocation.trim().length < 3) {
                    setPickupLocation(address);
                  }
                }}
              />
              <p className="text-xs text-on-surface-variant">
                พิกัดที่เลือก: {pickupLat !== null && pickupLng !== null ? `${pickupLat.toFixed(6)}, ${pickupLng.toFixed(6)}` : 'ยังไม่ได้เลือก'}
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmittingMaterial || measurementUnits.length === 0 || materialTypes.length === 0}
              className="md:col-span-2 px-4 py-2.5 rounded-lg bg-primary text-white font-semibold disabled:opacity-60"
            >
              {isSubmittingMaterial ? 'กำลังส่ง...' : 'ส่งรายการวัสดุ'}
            </button>
          </form>
        </div>

        <div className="bg-white border border-outline-variant/20 rounded-xl p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
            <h2 className="text-lg font-semibold">รายการวัสดุ</h2>
            <div className="flex items-center gap-2">
              <label htmlFor="submissionStatusFilter" className="text-sm text-on-surface-variant">กรองสถานะ</label>
              <select
                id="submissionStatusFilter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as (typeof SUBMISSION_STATUS_OPTIONS)[number]['value'])}
                className="bg-surface-container-high rounded-lg px-3 py-2 outline-none text-sm"
              >
                {SUBMISSION_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-xs text-on-surface-variant mb-3">
            แสดง {filteredSubmissions.length.toLocaleString('th-TH')} จาก {submissions.length.toLocaleString('th-TH')} รายการ
          </p>

          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-on-surface-variant">
                  <th className="sticky top-0 z-10 bg-white py-2">เวลา</th>
                  <th className="sticky top-0 z-10 bg-white py-2">วัสดุ</th>
                  <th className="sticky top-0 z-10 bg-white py-2">ปริมาณ</th>
                  <th className="sticky top-0 z-10 bg-white py-2">สถานที่นัดรับ</th>
                  <th className="sticky top-0 z-10 bg-white py-2">สถานะ</th>
                  <th className="sticky top-0 z-10 bg-white py-2">ช่วงนัดรับ</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.map((item) => (
                  <tr key={item.id} className="border-t border-outline-variant/10">
                    <td className="py-2">{new Date(item.created_at).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="py-2">{materialNameByCode[item.material_type] ?? item.material_type}</td>
                    <td className="py-2">{Number(item.quantity_value).toLocaleString('th-TH')} {unitNameByCode[item.quantity_unit] ?? fallbackThaiUnit(item.quantity_unit)}</td>
                    <td className="py-2 text-on-surface-variant">
                      <p>{item.pickup_location_text || '-'}</p>
                      {typeof item.pickup_lat === 'number' && typeof item.pickup_lng === 'number' && (
                        <a
                          href={buildOpenStreetMapLink(item.pickup_lat, item.pickup_lng)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          ดูบนแผนที่
                        </a>
                      )}
                    </td>
                    <td className="py-2">
                      <StatusBadge status={item.status} label={formatSubmissionStatus(item.status)} />
                    </td>
                    <td className="py-2 text-on-surface-variant">
                      {item.pickup_window_start_at
                        ? `${formatDateTime(item.pickup_window_start_at)} - ${formatDateTime(item.pickup_window_end_at ?? null)}`
                        : '-'}
                    </td>
                  </tr>
                ))}
                {filteredSubmissions.length === 0 && (
                  <tr>
                    <td className="py-3 text-on-surface-variant" colSpan={6}>ไม่พบรายการตามสถานะที่เลือก</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
