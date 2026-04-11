'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BarChart3, Boxes, Coins, RefreshCw, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import AlertBanner from '@/app/components/AlertBanner';
import EmptyState from '@/app/components/EmptyState';
import PageHeader from '@/app/components/PageHeader';
import SectionCard from '@/app/components/SectionCard';
import StatCard from '@/app/components/StatCard';
import { ApiError, executiveApi, type ExecutiveOverview } from '@/app/lib/apiClient';

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
        fill: ['#1f6b4f', '#c67a25', '#2563eb', '#7c3aed'][index % 4],
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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Executive Overview"
        title="ภาพรวมผู้บริหารที่แยก KPI, งานค้าง และโครงสร้างวัสดุออกจากกันชัดเจน"
        description="ข้อมูลบริหารควรตอบคำถามได้เร็วว่า ตอนนี้ระบบค้างตรงไหน วัสดุเข้าเท่าไร และแต้มกำลังหมุนเวียนอย่างไร หน้านี้จึงจัดเป็น summary, bottlenecks และ material mix"
        actions={[
          {
            label: 'จัดการสูตรแต้มและ master data',
            to: '/executive-settings',
            variant: 'secondary',
          },
          {
            label: isLoading ? 'กำลังรีเฟรช...' : 'รีเฟรชข้อมูล',
            onClick: () => void loadOverview(true),
          },
        ]}
      />

      {message ? <AlertBanner message={message} tone={inferMessageTone(message)} /> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="เกษตรกรที่เคยทำรายการ" value={formatNumber(metrics.uniqueFarmersTotal)} detail="นับเฉพาะบัญชีที่มีธุรกรรมอย่างน้อย 1 ครั้ง" icon={Users} tone="emerald" />
        <StatCard label="น้ำหนักประมาณการที่แปลงได้" value={formatKg(metrics.submittedWeightConvertibleKg)} detail={`แปลงได้ ${formatNumber(metrics.submissionsConvertibleCount)} รายการ`} icon={Boxes} tone="amber" />
        <StatCard label="น้ำหนักที่โรงงานยืนยันแล้ว" value={formatKg(metrics.confirmedWeightKg)} detail="อิงจากน้ำหนักจริงที่โรงงานรับเข้าแล้ว" icon={BarChart3} tone="sky" />
        <StatCard label="แต้มที่ใช้ได้จริง" value={formatNumber(metrics.pointsNetAvailable)} detail="แต้มคงเหลือหลังหักที่จองไว้และที่ใช้ไปแล้ว" icon={Coins} tone="violet" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <SectionCard
          title="Executive Summary"
          description="มุมมองกว้างที่ผู้บริหารมักใช้ก่อน เช่น ปริมาณงานทั้งหมด น้ำหนักที่รับเข้า และการเคลื่อนไหวของแต้ม"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-line bg-surface-muted p-4">
              <p className="text-sm font-semibold text-stone-900">ปริมาณธุรกรรม</p>
              <div className="mt-3 space-y-2 text-sm text-stone-600">
                <p>รายการส่งวัสดุทั้งหมด {formatNumber(metrics.submissionsTotal)} รายการ</p>
                <p>คำขอแลกรางวัลทั้งหมด {formatNumber(metrics.rewardRequestsTotal)} รายการ</p>
                <p>แต้มที่เครดิตแล้ว {formatNumber(metrics.pointsCredited)} แต้ม</p>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-line bg-surface-muted p-4">
              <p className="text-sm font-semibold text-stone-900">สภาพคล่องของแต้ม</p>
              <div className="mt-3 space-y-2 text-sm text-stone-600">
                <p>แต้มจองรออนุมัติ {formatNumber(metrics.pointsReserved)} แต้ม</p>
                <p>แต้มที่ใช้แลกแล้ว {formatNumber(metrics.pointsSpent)} แต้ม</p>
                <p>แต้มคงเหลือใช้งานจริง {formatNumber(metrics.pointsNetAvailable)} แต้ม</p>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Operational Bottlenecks"
          description="ตัวเลขส่วนนี้ช่วยชี้ว่า pipeline ติดอยู่ตรงไหน ไม่ว่าจะเป็นฝั่งขนส่งหรือคลังสินค้า"
        >
          <div className="space-y-3">
            <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">รอรับวัสดุ</p>
              <p className="mt-2 text-3xl font-semibold text-amber-950">{formatNumber(metrics.submissionsPendingPickup)}</p>
              <p className="mt-2 text-sm text-amber-900/80">รายการที่ยังไม่ผ่านกระบวนการรับและส่งเข้าโรงงาน</p>
            </div>
            <div className="rounded-[1.5rem] border border-sky-200 bg-sky-50 p-4">
              <p className="text-sm font-semibold text-sky-900">งานขนส่งที่กำลังดำเนินการ</p>
              <p className="mt-2 text-3xl font-semibold text-sky-950">{formatNumber(metrics.pickupJobsActive)}</p>
              <p className="mt-2 text-sm text-sky-900/80">สะท้อนโหลดงานที่ยังไม่ถึงโรงงานและยังไม่ปิดวงรอบ</p>
            </div>
            <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm font-semibold text-rose-900">คำขอรอคลังพิจารณา</p>
              <p className="mt-2 text-3xl font-semibold text-rose-950">{formatNumber(metrics.rewardRequestsPendingWarehouse)}</p>
              <p className="mt-2 text-sm text-rose-900/80">จุดนี้สะท้อนภาระงาน approval ที่อาจหน่วงการส่งมอบรางวัล</p>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Material Mix"
        description="ใช้กราฟสำหรับภาพรวมเชิงสัดส่วน แล้วคงรายละเอียดเชิงตัวเลขไว้ในตารางสำหรับการตรวจสอบ"
      >
        {materialChartData.length === 0 ? (
          <EmptyState
            title="ยังไม่มีข้อมูลประเภทวัสดุในภาพรวม"
            description="เมื่อเริ่มมีการส่งวัสดุ ระบบจะแสดงทั้งสัดส่วนตามประเภทและน้ำหนักประมาณการที่แปลงได้"
            icon={Boxes}
          />
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
            <div className="h-[320px] rounded-[1.5rem] border border-line bg-surface-muted p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={materialChartData} margin={{ top: 8, right: 8, left: -12, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d8d0c4" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip
                    cursor={{ fill: 'rgba(29,29,27,0.06)' }}
                    contentStyle={{ borderRadius: 16, borderColor: '#d8d0c4' }}
                    formatter={(value: number) => [`${formatNumber(value)} กก.`, 'น้ำหนักประมาณการ']}
                  />
                  <Bar dataKey="weight" radius={[14, 14, 4, 4]}>
                    {materialChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3">
              {(overview?.submissions_material_breakdown ?? []).map((item) => (
                <article key={item.material_type} className="rounded-[1.4rem] border border-line bg-surface-muted p-4">
                  <p className="font-semibold text-stone-900">{formatMaterialLabel(item.material_name_th, item.material_type)}</p>
                  <div className="mt-3 grid gap-2 text-sm text-stone-600 sm:grid-cols-2">
                    <p>จำนวนรายการ {formatNumber(item.submissions_count)}</p>
                    <p>แปลงหน่วยได้ {formatNumber(item.convertible_submissions_count)}</p>
                    <p>แปลงหน่วยไม่ได้ {formatNumber(item.non_convertible_submissions_count)}</p>
                    <p>น้ำหนักประมาณการ {formatNumber(item.estimated_weight_kg_total)} กก.</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 rounded-[1.5rem] border border-line bg-surface-muted p-4 text-sm leading-6 text-stone-600">
          รายการที่แปลงหน่วยไม่ได้ในภาพรวม {formatNumber(metrics.submissionsNonConvertibleCount)} รายการ
          ซึ่งยังเป็นจุดที่ผู้บริหารอาจต้องพิจารณาปรับ master data หรือกติกาการรับวัสดุ
          <Link href="/executive-settings" className="mt-3 inline-flex items-center gap-2 font-semibold text-stone-900 underline underline-offset-2">
            ไปจัดการสูตรและ master data
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
