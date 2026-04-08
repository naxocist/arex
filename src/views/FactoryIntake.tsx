import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import StatusBadge from '@/src/components/StatusBadge';
import {
  ApiError,
  factoryApi,
  type FactoryConfirmedIntakeItem,
  type FactoryIntakeSummary,
  type FactoryPendingIntakeItem,
} from '@/src/lib/apiClient';

function hasAccessToken(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
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

function quantityToKg(quantityValue: number, toKgFactor: number | null | undefined): number {
  if (typeof toKgFactor === 'number' && Number.isFinite(toKgFactor) && toKgFactor > 0) {
    return quantityValue * toKgFactor;
  }
  return Math.max(quantityValue, 1);
}

function fallbackThaiUnit(unitCode: string): string {
  const map: Record<string, string> = {
    kg: 'กิโลกรัม',
    ton: 'ตัน',
    m3: 'ลูกบาศก์เมตร',
  };
  return map[unitCode] ?? unitCode;
}

function formatPickupStatus(status: string): string {
  const map: Record<string, string> = {
    delivered_to_factory: 'ส่งถึงโรงงานแล้ว',
    picked_up: 'รับวัสดุแล้ว',
    pickup_scheduled: 'จัดคิวรับแล้ว',
  };
  return map[status] ?? status;
}

export default function FactoryIntake() {
  const [queue, setQueue] = useState<FactoryPendingIntakeItem[]>([]);
  const [confirmed, setConfirmed] = useState<FactoryConfirmedIntakeItem[]>([]);
  const [summary, setSummary] = useState<FactoryIntakeSummary | null>(null);
  const [weightByJobId, setWeightByJobId] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [confirmingJobId, setConfirmingJobId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const waitingTon = useMemo(() => {
    return summary?.arrived_estimated_weight_kg_total ? summary.arrived_estimated_weight_kg_total / 1000 : 0;
  }, [summary]);

  const confirmedTon = useMemo(() => {
    return summary?.confirmed_weight_kg_total ? summary.confirmed_weight_kg_total / 1000 : 0;
  }, [summary]);

  const loadQueue = async (forceRefresh = false) => {
    if (!hasAccessToken()) {
      setMessage('ยังไม่พบโทเคน AREX_ACCESS_TOKEN กรุณาเข้าสู่ระบบที่หน้าเลือกผู้ใช้งาน');
      return;
    }

    setIsLoading(true);
    try {
      const response = await factoryApi.listPendingIntakes({ forceRefresh });
      setQueue(response.queue);
      setConfirmed(response.confirmed);
      setSummary(response.summary);
      setWeightByJobId((prev) => {
        const next = { ...prev };
        for (const item of response.queue) {
          if (!next[item.pickup_job_id]) {
            next[item.pickup_job_id] = String(quantityToKg(Number(item.quantity_value), item.quantity_to_kg_factor));
          }
        }
        return next;
      });
      setMessage(null);
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(`โหลดคิวรับเข้าไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('โหลดคิวรับเข้าไม่สำเร็จ');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadQueue();
  }, []);

  const handleConfirm = async (item: FactoryPendingIntakeItem) => {
    const inputWeight = Number(weightByJobId[item.pickup_job_id]);
    if (!Number.isFinite(inputWeight) || inputWeight <= 0) {
      setMessage('กรุณาระบุน้ำหนักจริง (กิโลกรัม) ให้ถูกต้อง');
      return;
    }

    setConfirmingJobId(item.pickup_job_id);
    setMessage(null);
    try {
      await factoryApi.confirmIntake({
        pickup_job_id: item.pickup_job_id,
        measured_weight_kg: inputWeight,
      });
      setMessage('ยืนยันรับเข้าโรงงานสำเร็จแล้ว');
      await loadQueue(true);
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(`ยืนยันรับเข้าไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('ยืนยันรับเข้าไม่สำเร็จ');
      }
    } finally {
      setConfirmingJobId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-stone-200 bg-gradient-to-r from-stone-50 to-sky-50/60 p-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-stone-900">หน้าทำงานฝ่ายโรงงาน</h1>
          <p className="text-sm text-stone-600 mt-1">ตรวจรับงานที่ส่งถึงโรงงาน ยืนยันน้ำหนักจริง และติดตามของที่ยืนยันแล้ว</p>
          {message && <p className="text-sm text-stone-700 mt-2 bg-white border border-stone-200 px-3 py-2 rounded-lg w-fit">{message}</p>}
        </div>
        <button
          type="button"
          onClick={() => void loadQueue(true)}
          disabled={isLoading}
          className="px-4 py-2 rounded-full bg-stone-900 text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> รีเฟรชข้อมูล
        </button>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <p className="text-xs uppercase tracking-widest text-stone-500">ของที่มาถึงโรงงานแล้ว</p>
          <p className="text-3xl font-semibold mt-2 text-stone-900">{summary?.arrived_count.toLocaleString('th-TH') ?? queue.length.toLocaleString('th-TH')}</p>
          <p className="text-sm text-stone-600 mt-2">รอยืนยันรับเข้าอยู่ในคิว</p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-5">
          <p className="text-xs uppercase tracking-widest text-sky-700">น้ำหนักรวมที่มาถึง (ประมาณการ)</p>
          <p className="text-3xl font-semibold mt-2 text-sky-900">{waitingTon.toLocaleString('th-TH', { maximumFractionDigits: 3 })} ตัน</p>
          <p className="text-sm text-sky-700/80 mt-2">คำนวณจากปริมาณแจ้งและหน่วยแปลง</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
          <p className="text-xs uppercase tracking-widest text-emerald-700">ยืนยันน้ำหนักแล้ว</p>
          <p className="text-3xl font-semibold mt-2 text-emerald-900">{summary?.confirmed_count.toLocaleString('th-TH') ?? confirmed.length.toLocaleString('th-TH')}</p>
          <p className="text-sm text-emerald-700/80 mt-2">รายการที่ถูกบันทึกเข้าระบบแล้ว</p>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-5">
          <p className="text-xs uppercase tracking-widest text-violet-700">น้ำหนักรวมที่ยืนยันแล้ว</p>
          <p className="text-3xl font-semibold mt-2 text-violet-900">{confirmedTon.toLocaleString('th-TH', { maximumFractionDigits: 3 })} ตัน</p>
        </div>
      </section>

      <section className="bg-white border border-stone-200 rounded-2xl p-5">
        <h2 className="text-lg font-semibold">ลำดับงานในกระบวนการ</h2>
        <p className="text-sm text-stone-600 mt-1">Step 4 โรงงานบันทึกน้ำหนักจริงและยืนยันรับเข้า จากนั้นระบบเครดิต PMUC Coin ให้เกษตรกร (Step 5)</p>
      </section>

      <section className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">คิวงานที่ส่งถึงโรงงานแล้ว</h2>
          <p className="text-sm text-stone-600 mt-1">บันทึกน้ำหนักจริงทีละรายการ แล้วระบบจะสร้าง PMUC Coin ให้ Farmer อัตโนมัติ</p>
        </div>
        <div className="max-h-[24rem] overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-on-surface-variant">
                <th className="py-2">เวลา</th>
                <th className="py-2">Pickup Job</th>
                <th className="py-2">วัสดุ</th>
                <th className="py-2">สถานะงาน</th>
                <th className="py-2">น้ำหนักแจ้ง</th>
                <th className="py-2">น้ำหนักจริง (กิโลกรัม)</th>
                <th className="py-2">ยืนยัน</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((item) => (
                <tr key={item.pickup_job_id} className="border-t border-outline-variant/10">
                  <td className="py-2">
                    {new Date(item.delivered_factory_at ?? item.planned_pickup_at).toLocaleString('th-TH', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-2">{item.pickup_job_id.slice(0, 8)}</td>
                  <td className="py-2">{formatMaterial(item.material_type)}</td>
                  <td className="py-2">
                    <StatusBadge status={item.status} label={formatPickupStatus(item.status)} />
                  </td>
                  <td className="py-2">{Number(item.quantity_value).toLocaleString('th-TH')} {fallbackThaiUnit(item.quantity_unit)}</td>
                  <td className="py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={weightByJobId[item.pickup_job_id] ?? ''}
                      onChange={(event) =>
                        setWeightByJobId((prev) => ({
                          ...prev,
                          [item.pickup_job_id]: event.target.value,
                        }))
                      }
                      className="w-32 bg-surface-container-high rounded-lg px-2 py-1.5 outline-none"
                    />
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => void handleConfirm(item)}
                      disabled={confirmingJobId === item.pickup_job_id}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold bg-surface-container-high hover:bg-primary hover:text-white disabled:opacity-60"
                    >
                      {confirmingJobId === item.pickup_job_id ? 'กำลังยืนยัน...' : 'ยืนยันรับเข้า'}
                    </button>
                  </td>
                </tr>
              ))}
              {queue.length === 0 && (
                <tr>
                  <td className="py-3 text-stone-500" colSpan={7}>ยังไม่มีงานที่รอยืนยัน</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">รายการที่ยืนยันน้ำหนักแล้ว</h2>
          <p className="text-sm text-stone-600 mt-1">แสดงประวัติที่ยืนยันสำเร็จ พร้อมน้ำหนักจริงที่ใช้คำนวณแต้ม</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-stone-500 border-b border-stone-200">
                <th className="py-2 pr-3">เวลา</th>
                <th className="py-2 px-3">วัสดุ</th>
                <th className="py-2 px-3">น้ำหนักจริง</th>
                <th className="py-2 px-3">สถานะ</th>
                <th className="py-2 pl-3">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {confirmed.map((item) => (
                <tr key={item.intake_id} className="border-b border-stone-100">
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {new Date(item.confirmed_at).toLocaleString('th-TH', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-2 px-3">
                    <div className="font-medium text-stone-900">{item.material_name_th ?? formatMaterial(item.material_type)}</div>
                    <div className="text-xs text-stone-500">{item.material_type}</div>
                  </td>
                  <td className="py-2 px-3 text-stone-800">
                    {item.measured_weight_kg.toLocaleString('th-TH', { maximumFractionDigits: 2 })} กก. ({item.measured_weight_ton.toLocaleString('th-TH', { maximumFractionDigits: 3 })} ตัน)
                  </td>
                  <td className="py-2 px-3">
                    <StatusBadge status={item.status} label="ยืนยันแล้ว" />
                  </td>
                  <td className="py-2 pl-3 text-stone-600">{item.discrepancy_note ?? '-'}</td>
                </tr>
              ))}
              {confirmed.length === 0 && (
                <tr>
                  <td className="py-3 text-stone-500" colSpan={5}>ยังไม่มีรายการที่ยืนยันน้ำหนักแล้ว</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
