import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import StatusBadge from '@/src/components/StatusBadge';
import { ApiError, factoryApi, type FactoryPendingIntakeItem } from '@/src/lib/apiClient';

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

function quantityToKg(quantityValue: number, quantityUnit: string): number {
  if (quantityUnit === 'ton') {
    return quantityValue * 1000;
  }
  if (quantityUnit === 'kg') {
    return quantityValue;
  }
  return Math.max(quantityValue, 1);
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
  const [weightByJobId, setWeightByJobId] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [confirmingJobId, setConfirmingJobId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const waitingTon = useMemo(() => {
    return queue.reduce((sum, item) => {
      const value = Number(item.quantity_value || 0);
      if (item.quantity_unit === 'kg') {
        return sum + value / 1000;
      }
      return sum + value;
    }, 0);
  }, [queue]);

  const loadQueue = async () => {
    if (!hasAccessToken()) {
      setMessage('ยังไม่พบโทเคน AREX_ACCESS_TOKEN กรุณาเข้าสู่ระบบที่หน้าเลือกผู้ใช้งาน');
      return;
    }

    setIsLoading(true);
    try {
      const response = await factoryApi.listPendingIntakes();
      setQueue(response.queue);
      setWeightByJobId((prev) => {
        const next = { ...prev };
        for (const item of response.queue) {
          if (!next[item.pickup_job_id]) {
            next[item.pickup_job_id] = String(quantityToKg(Number(item.quantity_value), item.quantity_unit));
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
      setMessage('กรุณาระบุน้ำหนักจริง (kg) ให้ถูกต้อง');
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
      await loadQueue();
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
      <section className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-on-surface">หน้าทำงานฝ่ายโรงงาน</h1>
          <p className="text-sm text-on-surface-variant mt-1">ตรวจรับงานที่ส่งถึงโรงงานและยืนยันน้ำหนักจริง</p>
          {message && <p className="text-sm text-on-surface-variant mt-2 bg-surface-container-high px-3 py-2 rounded-lg w-fit">{message}</p>}
        </div>
        <button
          type="button"
          onClick={() => void loadQueue()}
          disabled={isLoading}
          className="px-4 py-2 rounded-full bg-primary text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> รีเฟรช
        </button>
      </section>

      <section className="bg-white border border-outline-variant/20 rounded-xl p-4">
        <h2 className="text-base font-semibold">ลำดับงานในกระบวนการ</h2>
        <p className="text-sm text-on-surface-variant mt-1">Step 4 โรงงานบันทึกน้ำหนักจริงและยืนยันรับเข้า จากนั้นระบบเครดิตคะแนนให้เกษตรกร (Step 5)</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant">งานรอยืนยันรับเข้า</p>
          <p className="text-3xl font-semibold mt-2">{queue.length.toLocaleString('th-TH')}</p>
        </div>
        <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant">ปริมาณรอตรวจรับ</p>
          <p className="text-3xl font-semibold mt-2">{waitingTon.toLocaleString('th-TH', { maximumFractionDigits: 2 })} ตัน</p>
        </div>
        <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant">สถานะระบบ</p>
          <div className="mt-3">
            <StatusBadge status="ready" label="พร้อมยืนยันรับเข้า" className="text-sm" />
          </div>
        </div>
      </section>

      <section className="bg-white border border-outline-variant/20 rounded-xl p-4">
        <h2 className="text-lg font-semibold mb-3">คิวงานที่ส่งถึงโรงงานแล้ว</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-on-surface-variant">
                <th className="py-2">เวลา</th>
                <th className="py-2">Pickup Job</th>
                <th className="py-2">วัสดุ</th>
                <th className="py-2">สถานะงาน</th>
                <th className="py-2">น้ำหนักแจ้ง</th>
                <th className="py-2">น้ำหนักจริง (kg)</th>
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
                  <td className="py-2">{Number(item.quantity_value).toLocaleString('th-TH')} {item.quantity_unit}</td>
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
                  <td className="py-3 text-on-surface-variant" colSpan={7}>ยังไม่มีงานที่รอยืนยัน</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
