import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { ApiError, executiveApi, type ExecutiveOverview } from '@/src/lib/apiClient';

function formatNumber(value: number): string {
  return value.toLocaleString('th-TH');
}

function formatTons(value: number): string {
  return `${value.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ตัน`;
}

function formatKg(value: number): string {
  return `${value.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} กก.`;
}

function formatMaterialLabel(nameTh: string | null | undefined, code: string): string {
  if (nameTh && nameTh.trim()) {
    return nameTh;
  }

  return code
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function ExecutiveDashboard() {
  const [overview, setOverview] = useState<ExecutiveOverview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const metrics = useMemo(() => {
    const submissionsTotal = overview?.submissions_total ?? 0;
    const uniqueFarmersTotal = overview?.unique_farmers_total ?? 0;
    const submissionsPendingPickup = overview?.submissions_pending_pickup ?? 0;
    const pickupJobsActive = overview?.pickup_jobs_active ?? 0;
    const pickupJobsStatusSummary = overview?.pickup_jobs_status_summary ?? {
      pickup_scheduled: 0,
      picked_up: 0,
      delivered_to_factory: 0,
    };
    const rewardRequestsTotal = overview?.reward_requests_total ?? 0;
    const rewardRequestsPendingWarehouse = overview?.reward_requests_pending_warehouse ?? 0;
    const submittedWeightConvertibleKg = overview?.submitted_weight_estimated_kg_total ?? 0;
    const submissionsConvertibleCount = overview?.submissions_convertible_count ?? 0;
    const submissionsNonConvertibleCount = overview?.submissions_non_convertible_count ?? 0;
    const submissionsNonConvertibleQuantityTotal = overview?.submissions_non_convertible_quantity_total ?? 0;
    const confirmedWeightTon = overview?.factory_confirmed_weight_ton_total ?? 0;
    const confirmedWeightKg = overview?.factory_confirmed_weight_kg_total ?? 0;
    const pointsCredited = overview?.points_credited_total ?? 0;
    const pointsReserved = overview?.points_reserved_total ?? 0;
    const pointsSpent = overview?.points_spent_total ?? 0;
    const pointsNetAvailable = Math.max(pointsCredited - pointsSpent - pointsReserved, 0);

    return {
      submissionsTotal,
      uniqueFarmersTotal,
      submissionsPendingPickup,
      pickupJobsActive,
      pickupJobsStatusSummary,
      rewardRequestsTotal,
      rewardRequestsPendingWarehouse,
      submittedWeightConvertibleKg,
      submissionsConvertibleCount,
      submissionsNonConvertibleCount,
      submissionsNonConvertibleQuantityTotal,
      confirmedWeightTon,
      confirmedWeightKg,
      pointsCredited,
      pointsReserved,
      pointsSpent,
      pointsNetAvailable,
    };
  }, [overview]);

  const loadOverview = async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      const response = await executiveApi.getOverview({ forceRefresh });
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
          <p className="text-sm text-on-surface-variant mt-1">ภาพรวมเชิงลึกของการแลกวัสดุและการใช้แต้มของเกษตรกร</p>
          {message && <p className="text-sm text-red-700 mt-2">{message}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadOverview(true)}
            disabled={isLoading}
            className="px-4 py-2 rounded-full bg-primary text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> รีเฟรช
          </button>
          <Link
            to="/executive-settings"
            className="px-4 py-2 rounded-full border border-outline-variant/40 text-sm font-semibold text-on-surface hover:bg-stone-100/70 flex items-center gap-2"
          >
            จัดการสูตรแต้มและ master data <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
          <p className="text-xs uppercase tracking-widest text-emerald-700">เกษตรกรที่เคยทำรายการ</p>
          <p className="text-3xl font-semibold mt-2 text-emerald-900">{formatNumber(metrics.uniqueFarmersTotal)}</p>
          <p className="text-xs text-emerald-700/80 mt-1">นับเฉพาะบัญชีที่มีธุรกรรมอย่างน้อย 1 รายการ</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <p className="text-xs uppercase tracking-widest text-amber-700">น้ำหนักประมาณการ (เฉพาะรายการที่แปลงหน่วยได้)</p>
          <p className="text-3xl font-semibold mt-2 text-amber-900">{formatKg(metrics.submittedWeightConvertibleKg)}</p>
          <p className="text-xs text-amber-700/80 mt-1">
            แปลงได้ {formatNumber(metrics.submissionsConvertibleCount)} รายการ • แปลงไม่ได้ {formatNumber(metrics.submissionsNonConvertibleCount)} รายการ
          </p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-5">
          <p className="text-xs uppercase tracking-widest text-sky-700">น้ำหนักที่โรงงานยืนยันแล้ว</p>
          <p className="text-3xl font-semibold mt-2 text-sky-900">{formatKg(metrics.confirmedWeightKg)}</p>
          <p className="text-xs text-sky-700/80 mt-1">อิงจากรายการรับเข้าที่ปิดงานแล้ว</p>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-5">
          <p className="text-xs uppercase tracking-widest text-violet-700">แต้มคงเหลือใช้งานได้</p>
          <p className="text-3xl font-semibold mt-2 text-violet-900">{formatNumber(metrics.pointsNetAvailable)}</p>
          <p className="text-xs text-violet-700/80 mt-1">แต้มที่ยังนำไปแลกได้จริงตอนนี้</p>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <p className="text-xs uppercase tracking-widest text-stone-500">รายการส่งวัสดุ</p>
          <p className="text-3xl font-semibold mt-2 text-stone-900">{formatNumber(metrics.submissionsTotal)}</p>
          <p className="text-sm text-stone-600 mt-2">รอจัดคิวรับ: {formatNumber(metrics.submissionsPendingPickup)} รายการ</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <p className="text-xs uppercase tracking-widest text-stone-500">งานขนส่งที่กำลังดำเนินการ</p>
          <p className="text-3xl font-semibold mt-2 text-stone-900">{formatNumber(metrics.pickupJobsActive)}</p>
          <p className="text-sm text-stone-600 mt-2">
            นัดรับแล้ว {formatNumber(metrics.pickupJobsStatusSummary.pickup_scheduled)} •
            รับวัสดุแล้ว {formatNumber(metrics.pickupJobsStatusSummary.picked_up)} •
            ส่งถึงโรงงานแล้ว {formatNumber(metrics.pickupJobsStatusSummary.delivered_to_factory)}
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <p className="text-xs uppercase tracking-widest text-stone-500">คำขอแลกรางวัลทั้งหมด</p>
          <p className="text-3xl font-semibold mt-2 text-stone-900">{formatNumber(metrics.rewardRequestsTotal)}</p>
          <p className="text-sm text-stone-600 mt-2">แต้มที่ใช้แลกสำเร็จ: {formatNumber(metrics.pointsSpent)}</p>
        </div>
      </section>

      <section className="bg-white border border-outline-variant/20 rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">สรุปการแลกของรางวัล</h2>
          <p className="text-sm text-on-surface-variant mt-1">แสดงจำนวนคำขอและการเคลื่อนไหวของแต้มแบบแยกบทบาทให้เข้าใจง่าย</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-amber-700">รอพิจารณา</p>
            <p className="text-xl font-semibold text-amber-900">{formatNumber(overview?.reward_requests_status_summary.requested ?? 0)}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="text-emerald-700">อนุมัติแล้ว</p>
            <p className="text-xl font-semibold text-emerald-900">{formatNumber(overview?.reward_requests_status_summary.warehouse_approved ?? 0)}</p>
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
            <p className="text-rose-700">ไม่อนุมัติ</p>
            <p className="text-xl font-semibold text-rose-900">{formatNumber(overview?.reward_requests_status_summary.warehouse_rejected ?? 0)}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
            <p className="text-stone-700">ยกเลิกแล้ว</p>
            <p className="text-xl font-semibold text-stone-900">{formatNumber(overview?.reward_requests_status_summary.cancelled ?? 0)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-3">
            <p className="text-sky-700">แต้มที่ได้รับทั้งหมด</p>
            <p className="text-2xl font-semibold text-sky-900 mt-1">{formatNumber(metrics.pointsCredited)}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
            <p className="text-amber-700">แต้มที่กันไว้รออนุมัติ</p>
            <p className="text-2xl font-semibold text-amber-900 mt-1">{formatNumber(metrics.pointsReserved)}</p>
          </div>
          <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-3">
            <p className="text-violet-700">แต้มที่ยื่นขอแลกทั้งหมด</p>
            <p className="text-2xl font-semibold text-violet-900 mt-1">{formatNumber(overview?.reward_requested_points_total ?? 0)}</p>
            <p className="text-xs text-violet-700/80 mt-1">ส่วนที่อนุมัติแล้ว {formatNumber(overview?.reward_approved_points_total ?? 0)} แต้ม</p>
          </div>
        </div>

        <p className="text-xs text-on-surface-variant">
          หมายเหตุ: ตัวเลขแต่ละบล็อกเป็นคนละมุมมอง เช่น จำนวนคำขอ แยกจากจำนวนแต้ม เพื่อไม่ให้ตีความซ้ำกัน
        </p>
      </section>

      <section className="bg-white border border-outline-variant/20 rounded-2xl p-5">
        <h2 className="text-lg font-semibold mb-3">สัดส่วนตามประเภทวัสดุ</h2>
        <p className="text-sm text-on-surface-variant mb-3">
          จำนวนรายการและน้ำหนักประมาณการเฉพาะรายการที่แปลงหน่วยเป็นกิโลกรัมได้
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b border-stone-200 text-stone-600">
                <th className="py-2 pr-3">Material</th>
                <th className="py-2 px-3">จำนวนรายการ</th>
                <th className="py-2 px-3">แปลงหน่วยได้</th>
                <th className="py-2 px-3">แปลงหน่วยไม่ได้</th>
                <th className="py-2 pl-3 text-right">น้ำหนักประมาณการที่แปลงได้ (กก.)</th>
              </tr>
            </thead>
            <tbody>
              {(overview?.submissions_material_breakdown ?? []).map((item) => (
                <tr key={item.material_type} className="border-b border-stone-100">
                  <td className="py-2 pr-3 font-medium text-stone-900">{formatMaterialLabel(item.material_name_th, item.material_type)}</td>
                  <td className="py-2 px-3 text-stone-700">{formatNumber(item.submissions_count)}</td>
                  <td className="py-2 px-3 text-stone-700">{formatNumber(item.convertible_submissions_count)}</td>
                  <td className="py-2 px-3 text-stone-700">{formatNumber(item.non_convertible_submissions_count)}</td>
                  <td className="py-2 pl-3 text-right text-stone-900 font-semibold">
                    {item.estimated_weight_kg_total.toLocaleString('th-TH', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 3,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-on-surface-variant mt-3">
          รายการที่แปลงหน่วยไม่ได้ในภาพรวม: {formatNumber(metrics.submissionsNonConvertibleCount)} รายการ
          (ปริมาณรวมหน่วยเดิม {overview?.submissions_non_convertible_quantity_total.toLocaleString('th-TH', { maximumFractionDigits: 3 }) ?? '0'})
        </p>
      </section>
    </div>
  );
}
