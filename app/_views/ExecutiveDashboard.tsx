'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BarChart3, Boxes, Coins, RefreshCw, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import AlertBanner from '@/app/_components/AlertBanner';
import EmptyState from '@/app/_components/EmptyState';
import SectionCard from '@/app/_components/SectionCard';
import StatCard from '@/app/_components/StatCard';
import { ApiError, executiveApi, type ExecutiveOverview } from '@/app/_lib/apiClient';

function formatNumber(value: number): string {
  return value.toLocaleString('th-TH');
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

function inferMessageTone(message: string | null): 'info' | 'success' | 'error' {
  if (!message) {
    return 'info';
  }
  return message.includes('ไม่สำเร็จ') ? 'error' : 'info';
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
    const rewardRequestsTotal = overview?.reward_requests_total ?? 0;
    const rewardRequestsPendingWarehouse = overview?.reward_requests_pending_warehouse ?? 0;
    const submittedWeightConvertibleKg = overview?.submitted_weight_estimated_kg_total ?? 0;
    const submissionsConvertibleCount = overview?.submissions_convertible_count ?? 0;
    const submissionsNonConvertibleCount = overview?.submissions_non_convertible_count ?? 0;
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
      rewardRequestsTotal,
      rewardRequestsPendingWarehouse,
      submittedWeightConvertibleKg,
      submissionsConvertibleCount,
      submissionsNonConvertibleCount,
      confirmedWeightKg,
      pointsCredited,
      pointsReserved,
      pointsSpent,
      pointsNetAvailable,
    };
  }, [overview]);

  const materialChartData = useMemo(
    () =>
      (overview?.submissions_material_breakdown ?? []).map((item, index) => ({
        name: formatMaterialLabel(item.material_name_th, item.material_type),
        weight: Number(item.estimated_weight_kg_total.toFixed(2)),
        count: item.submissions_count,
        fill: ['#064e93', '#059669', '#c67a25', '#7c3aed'][index % 4],
      })),
    [overview],
  );

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-900">ภาพรวมผู้บริหาร</h1>
        <div className="flex gap-2">
          <Link
            href="/executive-settings"
            className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            จัดการสูตรแต้มและ master data
          </Link>
          <button
            type="button"
            onClick={() => void loadOverview(true)}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'กำลังรีเฟรช...' : 'รีเฟรชข้อมูล'}
          </button>
        </div>
      </div>

      {message ? <AlertBanner message={message} tone={inferMessageTone(message)} /> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="เกษตรกรที่เคยทำรายการ" value={formatNumber(metrics.uniqueFarmersTotal)} detail="นับเฉพาะบัญชีที่มีธุรกรรมอย่างน้อย 1 ครั้ง" icon={Users} tone="blue" />
        <StatCard label="น้ำหนักประมาณการที่แปลงได้" value={formatKg(metrics.submittedWeightConvertibleKg)} detail={`แปลงได้ ${formatNumber(metrics.submissionsConvertibleCount)} รายการ`} icon={Boxes} tone="emerald" />
        <StatCard label="น้ำหนักที่โรงงานยืนยันแล้ว" value={formatKg(metrics.confirmedWeightKg)} detail="อิงจากน้ำหนักจริงที่โรงงานรับเข้าแล้ว" icon={BarChart3} tone="green" />
        <StatCard label="แต้มที่ใช้ได้จริง" value={formatNumber(metrics.pointsNetAvailable)} detail="แต้มคงเหลือหลังหักที่จองไว้และที่ใช้ไปแล้ว" icon={Coins} tone="blue" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
        <SectionCard
          title="ปริมาณธุรกรรม"
          description="มุมมองกว้างที่ผู้บริหารมักใช้ก่อน"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">รายการส่งวัสดุ</p>
              <p className="mt-2 text-2xl font-semibold text-blue-950">{formatNumber(metrics.submissionsTotal)}</p>
            </div>
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-700">คำขอแลกรางวัล</p>
              <p className="mt-2 text-2xl font-semibold text-green-950">{formatNumber(metrics.rewardRequestsTotal)}</p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">แต้มเครดิตแล้ว</p>
              <p className="mt-2 text-2xl font-semibold text-blue-950">{formatNumber(metrics.pointsCredited)}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="แต้มและสภาพคล่อง"
          description="สถานะแต้มในระบบ"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">จองรออนุมัติ</p>
              <p className="mt-2 text-2xl font-semibold text-blue-950">{formatNumber(metrics.pointsReserved)}</p>
            </div>
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-700">ใช้แลกแล้ว</p>
              <p className="mt-2 text-2xl font-semibold text-green-950">{formatNumber(metrics.pointsSpent)}</p>
            </div>
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-700">คงเหลือใช้จริง</p>
              <p className="mt-2 text-2xl font-semibold text-green-950">{formatNumber(metrics.pointsNetAvailable)}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="งานค้างตรงไหน"
          description="pipeline ติดอยู่ตรงไหน"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">รอรับวัสดุ</p>
              <p className="mt-2 text-2xl font-semibold text-amber-950">{formatNumber(metrics.submissionsPendingPickup)}</p>
              <p className="mt-1 text-xs text-amber-800/70">ยังไม่ถึงโรงงาน</p>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">ขนส่งกำลังดำเนิน</p>
              <p className="mt-2 text-2xl font-semibold text-sky-950">{formatNumber(metrics.pickupJobsActive)}</p>
              <p className="mt-1 text-xs text-sky-800/70">ยังไม่ปิดวงรอบ</p>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">รอคลังพิจารณา</p>
              <p className="mt-2 text-2xl font-semibold text-rose-950">{formatNumber(metrics.rewardRequestsPendingWarehouse)}</p>
              <p className="mt-1 text-xs text-rose-800/70">รอ approval</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="วัสดุและสัดส่วน"
          description="น้ำหนักและประเภทวัสดุที่เข้าระบบ"
        >
          {materialChartData.length === 0 ? (
            <EmptyState
              title="ยังไม่มีข้อมูลวัสดุ"
              description="เมื่อเริ่มมีการส่งวัสดุ ระบบจะแสดงสัดส่วนตามประเภท"
              icon={Boxes}
            />
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={materialChartData} margin={{ top: 8, right: 8, left: -12, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d8d0c4" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip
                    cursor={{ fill: 'rgba(29,29,27,0.06)' }}
                    contentStyle={{ borderRadius: 16, borderColor: '#d8d0c4' }}
                    formatter={(value: number) => [`${formatNumber(value)} กก.`, 'น้ำหนัก']}
                  />
                  <Bar dataKey="weight" radius={[8, 8, 4, 4]}>
                    {materialChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>
      </div>

      {metrics.submissionsNonConvertibleCount > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
          <span className="font-semibold">รายการแปลงหน่วยไม่ได้ {formatNumber(metrics.submissionsNonConvertibleCount)} รายการ</span>
          {' '} - อาจต้องพิจารณาปรับ master data หรือกติกาการรับวัสดุ
          <Link href="/executive/settings" className="ml-2 inline-flex items-center gap-1 font-semibold underline underline-offset-2">
            ไปจัดการ
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
