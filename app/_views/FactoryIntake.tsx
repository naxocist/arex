'use client';

import React, { useEffect, useState } from 'react';
import { Factory, RefreshCw, Scale, ShieldCheck, Warehouse } from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import EmptyState from '@/app/_components/EmptyState';
import SectionCard from '@/app/_components/SectionCard';
import StatCard from '@/app/_components/StatCard';
import StatusBadge from '@/app/_components/StatusBadge';
import {
  ApiError,
  factoryApi,
  type FactoryConfirmedIntakeItem,
  type FactoryIntakeSummary,
  type FactoryPendingIntakeItem,
} from '@/app/_lib/apiClient';

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

function quantityToKg(quantityValue: number, toKgFactor: number | null | undefined): number | null {
  if (typeof toKgFactor === 'number' && Number.isFinite(toKgFactor) && toKgFactor > 0) {
    return quantityValue * toKgFactor;
  }
  return null;
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

export default function FactoryIntake() {
  const [queue, setQueue] = useState<FactoryPendingIntakeItem[]>([]);
  const [confirmed, setConfirmed] = useState<FactoryConfirmedIntakeItem[]>([]);
  const [summary, setSummary] = useState<FactoryIntakeSummary | null>(null);
  const [weightByJobId, setWeightByJobId] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [confirmingJobId, setConfirmingJobId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadQueue = async (forceRefresh = false) => {
    if (!hasAccessToken()) {
      setMessage('ยังไม่พบโทเคน AREX_ACCESS_TOKEN กรุณาเข้าสู่ระบบที่หน้าเลือกผู้ใช้งาน');
      return;
    }

    setIsLoading(true);
    try {
      const queueResponse = await factoryApi.listPendingIntakes({ forceRefresh });

      setQueue(queueResponse.queue);
      setConfirmed(queueResponse.confirmed);
      setSummary(queueResponse.summary);
      setWeightByJobId((prev) => {
        const next = { ...prev };
        for (const item of queueResponse.queue) {
          if (!next[item.pickup_job_id]) {
            const estimatedKg = quantityToKg(Number(item.quantity_value), item.quantity_to_kg_factor);
            if (estimatedKg !== null) {
              next[item.pickup_job_id] = String(estimatedKg);
            }
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-900">คิวตรวจรับเข้าโรงงาน</h1>
        <button
          type="button"
          onClick={() => void loadQueue(true)}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'กำลังรีเฟรช...' : 'รีเฟรชข้อมูล'}
        </button>
      </div>

      {message ? <AlertBanner message={message} tone={inferMessageTone(message)} /> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="ของที่มาถึงโรงงานแล้ว" value={(summary?.arrived_count ?? queue.length).toLocaleString('th-TH')} detail="รายการที่รอยืนยันรับเข้าอยู่ตอนนี้" icon={Warehouse} tone="default" />
        <StatCard label="น้ำหนักประมาณการที่แปลงได้" value={`${(summary?.arrived_estimated_weight_kg_total ?? 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })} กก.`} detail={`แปลงได้ ${(summary?.arrived_convertible_count ?? 0).toLocaleString('th-TH')} รายการ`} icon={Scale} tone="sky" />
        <StatCard label="ยืนยันน้ำหนักแล้ว" value={(summary?.confirmed_count ?? confirmed.length).toLocaleString('th-TH')} detail="รายการที่บันทึกเข้าระบบเรียบร้อย" icon={ShieldCheck} tone="emerald" />
        <StatCard label="น้ำหนักรวมที่ยืนยันแล้ว" value={`${(summary?.confirmed_weight_kg_total ?? 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })} กก.`} detail="น้ำหนักจริงที่โรงงานใช้คำนวณแต้ม" icon={Factory} tone="violet" />
      </section>

      <SectionCard
        title="คิวงานที่ต้องยืนยันตอนนี้"
        description="ระบบเติมน้ำหนักประมาณการให้อัตโนมัติเมื่อหน่วยแปลงเป็นกิโลกรัมได้ เพื่อให้แก้เฉพาะค่าที่ชั่งจริงและยืนยันได้เร็วขึ้น"
      >
        {queue.length === 0 ? (
          <EmptyState
            title="ยังไม่มีงานที่รอยืนยัน"
            description="เมื่อรถส่งวัสดุมาถึงโรงงาน รายการจะขึ้นที่นี่เพื่อให้ฝ่ายโรงงานบันทึกน้ำหนักจริง"
            icon={Factory}
          />
        ) : (
          <div className="space-y-4">
            {queue.map((item) => {
              const estimatedKg = quantityToKg(Number(item.quantity_value), item.quantity_to_kg_factor);

              return (
                <article key={item.pickup_job_id} className="rounded-[1.6rem] border border-line bg-surface-muted p-4">
                  <div className="grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-stone-900">
                          {item.material_name_th ?? formatMaterial(item.material_type)}
                        </p>
                        <StatusBadge status={item.status} label={formatPickupStatus(item.status)} size="sm" />
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-stone-700">
                          <p className="font-semibold text-stone-900">น้ำหนักที่แจ้งมา</p>
                          <p className="mt-1">
                            {Number(item.quantity_value).toLocaleString('th-TH')} {fallbackThaiUnit(item.quantity_unit)}
                          </p>
                          <p className="mt-1 text-stone-500">
                            {estimatedKg !== null
                              ? `ประมาณ ${estimatedKg.toLocaleString('th-TH', { maximumFractionDigits: 2 })} กก.`
                              : 'หน่วยนี้ยังไม่สามารถแปลงเป็นกิโลกรัมอัตโนมัติ'}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-stone-700">
                          <p className="font-semibold text-stone-900">จุดรับต้นทาง</p>
                          <p className="mt-1">{item.pickup_location_text}</p>
                          <p className="mt-1 text-stone-500">
                            มาถึงเมื่อ{' '}
                            {new Date(item.delivered_factory_at ?? item.planned_pickup_at).toLocaleString('th-TH', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-2xl border border-line bg-white px-4 py-3">
                        <label className="block space-y-2">
                          <span className="text-sm font-medium text-stone-700">น้ำหนักจริงที่ชั่งได้ (กิโลกรัม)</span>
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
                            className="w-full rounded-2xl border border-line bg-surface-muted px-4 py-3 outline-none"
                          />
                        </label>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleConfirm(item)}
                        disabled={confirmingJobId === item.pickup_job_id}
                        className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-800 disabled:opacity-60"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        <span>{confirmingJobId === item.pickup_job_id ? 'กำลังยืนยัน...' : 'ยืนยันรับเข้าโรงงาน'}</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="ประวัติที่ยืนยันแล้ว"
        description="ส่วนนี้เก็บรายการที่ปิดงานสำเร็จแล้ว พร้อมน้ำหนักจริงที่ใช้ในการคำนวณแต้มให้เกษตรกร"
      >
        {confirmed.length === 0 ? (
          <EmptyState
            title="ยังไม่มีรายการที่ยืนยันน้ำหนักแล้ว"
            description="เมื่อยืนยันรับเข้าแต่ละงาน ประวัติจะย้ายมาอยู่ส่วนนี้โดยอัตโนมัติ"
            icon={ShieldCheck}
          />
        ) : (
          <div className="space-y-3">
            {confirmed.map((item) => (
              <article key={item.intake_id} className="rounded-[1.4rem] border border-line bg-surface-muted p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-stone-900">
                        {item.material_name_th ?? formatMaterial(item.material_type)}
                      </p>
                      <StatusBadge status={item.status} label="ยืนยันแล้ว" size="sm" />
                    </div>
                    <p className="mt-2 text-sm text-stone-600">
                      น้ำหนักจริง {item.measured_weight_kg.toLocaleString('th-TH', { maximumFractionDigits: 2 })} กก.
                    </p>
                    <p className="mt-1 text-sm text-stone-500">
                      ยืนยันเมื่อ{' '}
                      {new Date(item.confirmed_at).toLocaleString('th-TH', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-stone-600">
                    หมายเหตุ: {item.discrepancy_note ?? '-'}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
