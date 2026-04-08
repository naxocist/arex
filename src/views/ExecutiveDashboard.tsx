import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import StatusBadge from '@/src/components/StatusBadge';
import { ApiError, executiveApi } from '@/src/lib/apiClient';

export default function ExecutiveDashboard() {
  const [overview, setOverview] = useState<Record<string, number> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const metrics = useMemo(() => {
    const submissionsTotal = overview?.submissions_total ?? 0;
    const submissionsPendingPickup = overview?.submissions_pending_pickup ?? 0;
    const pickupJobsActive = overview?.pickup_jobs_active ?? 0;
    const rewardRequestsPendingWarehouse = overview?.reward_requests_pending_warehouse ?? 0;

    return {
      submissionsTotal,
      submissionsPendingPickup,
      pickupJobsActive,
      rewardRequestsPendingWarehouse,
    };
  }, [overview]);

  const loadOverview = async () => {
    setIsLoading(true);
    try {
      const response = await executiveApi.getOverview();
      setOverview(response.overview);
      setMessage(null);
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(`โหลดข้อมูลภาพรวมไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('โหลดข้อมูลภาพรวมไม่สำเร็จ');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, []);

  return (
    <div className="space-y-6">
      <section className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-on-surface">หน้าภาพรวมผู้บริหาร</h1>
          <p className="text-sm text-on-surface-variant mt-1">ภาพรวมตัวชี้วัดหลักจากการดำเนินงานจริงในระบบ</p>
          {message && <p className="text-sm text-on-surface-variant mt-2 bg-surface-container-high px-3 py-2 rounded-lg w-fit">{message}</p>}
        </div>
        <button
          type="button"
          onClick={() => void loadOverview()}
          disabled={isLoading}
          className="px-4 py-2 rounded-full bg-primary text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> รีเฟรช
        </button>
      </section>

      <section className="bg-white border border-outline-variant/20 rounded-xl p-4">
        <h2 className="text-base font-semibold">ภาพรวมลำดับงาน</h2>
        <p className="text-sm text-on-surface-variant mt-1">ติดตามงานตั้งแต่เกษตรกรแจ้งวัสดุ (Step 1) ไปจนถึงคลังอนุมัติและส่งมอบรางวัล (Step 7-8)</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant">รายการส่งวัสดุทั้งหมด</p>
          <p className="text-3xl font-semibold mt-2">{metrics.submissionsTotal.toLocaleString('th-TH')}</p>
        </div>
        <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant">รอจัดคิวรับวัสดุ</p>
          <p className="text-3xl font-semibold mt-2">{metrics.submissionsPendingPickup.toLocaleString('th-TH')}</p>
        </div>
        <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant">งานขนส่งที่กำลังดำเนินการ</p>
          <p className="text-3xl font-semibold mt-2">{metrics.pickupJobsActive.toLocaleString('th-TH')}</p>
        </div>
        <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant">คำขอรอคลังอนุมัติ</p>
          <p className="text-3xl font-semibold mt-2">{metrics.rewardRequestsPendingWarehouse.toLocaleString('th-TH')}</p>
        </div>
      </section>

      <section className="bg-white border border-outline-variant/20 rounded-xl p-4">
        <h2 className="text-lg font-semibold mb-3">สถานะความพร้อมตามบทบาท</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="border border-outline-variant/15 rounded-lg p-3 flex items-center justify-between gap-2">
            <span>Farmer submit + reward request</span>
            <StatusBadge status="ready" label="พร้อมใช้งาน" />
          </div>
          <div className="border border-outline-variant/15 rounded-lg p-3 flex items-center justify-between gap-2">
            <span>Logistics pickup + reward delivery</span>
            <StatusBadge status="ready" label="พร้อมใช้งาน" />
          </div>
          <div className="border border-outline-variant/15 rounded-lg p-3 flex items-center justify-between gap-2">
            <span>Factory intake confirm + points trigger</span>
            <StatusBadge status="ready" label="พร้อมใช้งาน" />
          </div>
          <div className="border border-outline-variant/15 rounded-lg p-3 flex items-center justify-between gap-2">
            <span>Warehouse approve/reject reward request</span>
            <StatusBadge status="ready" label="พร้อมใช้งาน" />
          </div>
        </div>
      </section>
    </div>
  );
}
