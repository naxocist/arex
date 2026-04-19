'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Boxes, Coins, ExternalLink, Flame, Info, Leaf, RefreshCw, Users, Wallet, X } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import AlertBanner from '@/app/_components/AlertBanner';
import EmptyState from '@/app/_components/EmptyState';
import ErrorBoundary from '@/app/_components/ErrorBoundary';
import SectionCard from '@/app/_components/SectionCard';
import { SkeletonStatCard } from '@/app/_components/Skeleton';
import { ApiError, executiveApi, type ExecutiveOverview, type ValueChainItem } from '@/app/_lib/api';

function formatNumber(value: number): string {
  return value.toLocaleString('th-TH');
}

function formatKg(value: number): string {
  return `${value.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} กก.`;
}

function formatMaterialLabel(nameTh: string | null | undefined, code: string): string {
  if (nameTh && nameTh.trim()) return nameTh;
  return code.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function inferMessageTone(message: string | null): 'info' | 'success' | 'error' {
  if (!message) return 'info';
  return message.includes('ไม่สำเร็จ') ? 'error' : 'info';
}

// Maximally distinct palette — adjacent colors are far apart in hue
const MATERIAL_COLORS = [
  '#2d6a4f', // forest green
  '#e07b39', // burnt orange
  '#3a7abf', // ocean blue
  '#c0392b', // crimson
  '#8e44ad', // violet
  '#f0b429', // golden amber
  '#16a085', // teal
  '#d35400', // deep orange
  '#1a5276', // navy
  '#27ae60', // mid green
  '#922b21', // dark red
  '#1f618d', // steel blue
];

interface DonutLabelProps {
  cx: number;
  cy: number;
  innerLabel: string;
  innerValue: string;
}
function DonutCenterLabel({ cx, cy, innerLabel, innerValue }: DonutLabelProps) {
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
      <tspan x={cx} dy="-0.6em" fontSize={22} fontWeight={600} fill="#1c1917">{innerValue}</tspan>
      <tspan x={cx} dy="1.5em" fontSize={11} fill="#78716c">{innerLabel}</tspan>
    </text>
  );
}

export default function OverviewDashboard() {
  const [overview, setOverview] = useState<ExecutiveOverview | null>(null);
  const [valueChain, setValueChain] = useState<ValueChainItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [materialSort, setMaterialSort] = useState<{ key: 'weight' | 'pct'; dir: 'desc' | 'asc' }>({ key: 'weight', dir: 'desc' });
  const [co2ModalOpen, setCo2ModalOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  const metrics = useMemo(() => {
    const submissionsTotal = overview?.submissions_total ?? 0;
    const uniqueFarmersTotal = overview?.unique_farmers_total ?? 0;
    const submissionsPendingPickup = overview?.submissions_pending_pickup ?? 0;
    const pickupJobsActive = overview?.pickup_jobs_active ?? 0;
    const rewardRequestsTotal = overview?.reward_requests_total ?? 0;
    const rewardRequestsPendingWarehouse = overview?.reward_requests_pending_warehouse ?? 0;
    const submissionsConvertibleCount = overview?.submissions_convertible_count ?? 0;
    const submissionsNonConvertibleCount = overview?.submissions_non_convertible_count ?? 0;
    const confirmedWeightKg = overview?.factory_confirmed_weight_kg_total ?? 0;
    const pointsCredited = overview?.points_credited_total ?? 0;
    const pointsReserved = overview?.points_reserved_total ?? 0;
    const pointsSpent = overview?.points_spent_total ?? 0;
    const pointsNetAvailable = Math.max(pointsCredited - pointsSpent - pointsReserved, 0);
    return {
      submissionsTotal, uniqueFarmersTotal, submissionsPendingPickup, pickupJobsActive,
      rewardRequestsTotal, rewardRequestsPendingWarehouse, submissionsConvertibleCount,
      submissionsNonConvertibleCount, confirmedWeightKg, pointsCredited, pointsReserved,
      pointsSpent, pointsNetAvailable,
    };
  }, [overview]);

  const estCo2Kg = Math.round(metrics.confirmedWeightKg * 1.47);

  const materialChartData = useMemo(
    () => (overview?.submissions_material_breakdown ?? []).map((item, index) => ({
      name: formatMaterialLabel(item.material_name_th, item.material_type),
      weight: Number(item.estimated_weight_kg_total.toFixed(2)),
      count: item.submissions_count,
      fill: MATERIAL_COLORS[index % MATERIAL_COLORS.length],
    })),
    [overview],
  );

  const loadOverview = async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      const [overviewRes, valueChainRes] = await Promise.all([
        executiveApi.getOverview({ forceRefresh }),
        executiveApi.listValueChain({ forceRefresh }),
      ]);
      setOverview(overviewRes.overview);
      setValueChain(valueChainRes.value_chain);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof ApiError ? `โหลดข้อมูลภาพรวมไม่สำเร็จ: ${error.message}` : 'โหลดข้อมูลภาพรวมไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadOverview(); }, []);

  return (
    <ErrorBoundary>
      <div className="space-y-10">

        {/* ─── Header ─── */}
        <motion.div
          initial={reduceMotion ? {} : { opacity: 0, y: -8 }}
          animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="flex items-start justify-between gap-4"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">ผู้บริหาร</p>
            <h1 className="mt-0.5 text-4xl font-light tracking-tight text-on-surface">ภาพรวมระบบ</h1>
            <p className="mt-1 text-sm text-on-surface-variant">ข้อมูลสรุประบบ Zero Burn to Earn ทั้งหมดแบบเรียลไทม์</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <motion.button
              type="button"
              onClick={() => void loadOverview(true)}
              disabled={isLoading}
              whileTap={reduceMotion ? {} : { scale: 0.94 }}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 shadow-sm transition hover:bg-stone-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </motion.button>
          </div>
        </motion.div>

        {message ? <AlertBanner message={message} tone={inferMessageTone(message)} /> : null}

        {/* ─── ตัวชี้วัดผลกระทบ (Impact KPIs) — TOP ─── */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <div className="h-1 w-6 rounded-full bg-emerald-500" />
            <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">ตัวชี้วัดผลกระทบ</p>
          </div>
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => <SkeletonStatCard key={i} />)}
            </div>
          ) : (() => {
            const avgIncomePerFarmer = metrics.uniqueFarmersTotal > 0
              ? Math.round(metrics.pointsCredited / metrics.uniqueFarmersTotal)
              : 0;
            return (
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Hotspot */}
              <div className="relative overflow-hidden rounded-3xl border border-rose-100 p-5 bg-gradient-to-br from-rose-50 to-white">
                <div className="absolute right-4 top-4 rounded-full bg-rose-100 p-2.5">
                  <Flame className="h-5 w-5 text-rose-500" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-widest text-rose-500">จุดเผา Hotspot ป้องกัน</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight text-stone-900">{formatNumber(metrics.submissionsTotal)}</p>
                <p className="mt-1 text-xs text-stone-500">รายการส่งวัสดุในระบบ</p>
                <p className="mt-2 text-[10px] text-stone-400">1 รายการส่งวัสดุ ≈ 1 จุดเผาที่เลือกไม่เผา</p>
              </div>

              {/* CO2 */}
              <button
                type="button"
                onClick={() => setCo2ModalOpen(true)}
                className="relative overflow-hidden rounded-3xl border border-emerald-100 p-5 bg-gradient-to-br from-emerald-50 to-white text-left transition hover:shadow-md hover:brightness-[0.98]"
              >
                <div className="absolute right-4 top-4 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-emerald-400" />
                  <div className="rounded-full bg-emerald-100 p-2.5">
                    <Leaf className="h-5 w-5 text-emerald-600" />
                  </div>
                </div>
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">CO₂ หลีกเลี่ยงได้</p>
                <div className="mt-3 space-y-2">
                  <div className="rounded-xl bg-white/70 px-3 py-2 ring-1 ring-emerald-100">
                    <p className="text-2xl font-semibold tracking-tight text-stone-900">{formatNumber(estCo2Kg)} <span className="text-sm font-normal text-stone-500">กก.</span></p>
                    <p className="mt-0.5 text-[10px] leading-snug text-stone-500">คาร์บอนที่หลีกเลี่ยงได้ (gross) × 1.47</p>
                  </div>
                  <div className="rounded-xl bg-white/70 px-3 py-2 ring-1 ring-emerald-100">
                    <p className="text-2xl font-semibold tracking-tight text-stone-900">{formatNumber(Math.round(metrics.confirmedWeightKg * 0.088))} <span className="text-sm font-normal text-stone-500">กก. CO₂eq</span></p>
                    <p className="mt-0.5 text-[10px] leading-snug text-stone-500">CH₄+N₂O (GHG inventory) × 0.088</p>
                  </div>
                </div>
                <p className="mt-3 text-[10px] text-emerald-500">คลิกเพื่อดูวิธีคำนวณ →</p>
              </button>

              {/* Income */}
              <div className="relative overflow-hidden rounded-3xl border border-amber-100 p-5 bg-gradient-to-br from-amber-50 to-white">
                <div className="absolute right-4 top-4 rounded-full bg-amber-100 p-2.5">
                  <Wallet className="h-5 w-5 text-amber-500" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">รายได้เกษตรกร</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight text-stone-900">฿{formatNumber(avgIncomePerFarmer)}</p>
                <p className="mt-1 text-xs text-stone-500">บาท/เกษตรกร เฉลี่ย</p>
                <p className="mt-2 text-[10px] text-stone-400">แต้มที่ได้รับทั้งหมด ÷ จำนวนเกษตรกร (1 แต้ม ≈ 1 ฿)</p>
              </div>
            </div>
            );
          })()}
        </div>

        {/* ─── KPI summary numbers ─── */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <div className="h-1 w-6 rounded-full bg-stone-400" />
            <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">สรุปภาพรวม</p>
          </div>
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium text-stone-600">เกษตรกรที่เคยทำรายการ</p>
                  <div className="rounded-full bg-blue-50 p-2">
                    <Users className="h-4 w-4 text-blue-500" />
                  </div>
                </div>
                <p className="mt-4 text-3xl font-semibold text-stone-900">{formatNumber(metrics.uniqueFarmersTotal)}</p>
                <p className="mt-1 text-xs text-stone-400">บัญชีผู้ใช้งาน (ราย)</p>
              </div>

              <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium text-stone-600">น้ำหนักที่โรงงานยืนยันแล้ว</p>
                  <div className="rounded-full bg-emerald-50 p-2">
                    <Boxes className="h-4 w-4 text-emerald-600" />
                  </div>
                </div>
                <p className="mt-4 text-3xl font-semibold text-stone-900">{formatKg(metrics.confirmedWeightKg)}</p>
                <p className="mt-1 text-xs text-stone-400">โรงงานรับจริง</p>
              </div>

              <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium text-stone-600">แต้มที่เครดิตแล้ว</p>
                  <div className="rounded-full bg-green-50 p-2">
                    <Coins className="h-4 w-4 text-green-600" />
                  </div>
                </div>
                <p className="mt-4 text-3xl font-semibold text-stone-900">{formatNumber(metrics.pointsCredited)}</p>
                <p className="mt-1 text-xs text-stone-400">แต้ม PMUC สะสมทั้งหมด</p>
              </div>

              <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium text-stone-600">แต้มคงเหลือใช้ได้ทันที</p>
                  <div className="rounded-full bg-sky-50 p-2">
                    <Wallet className="h-4 w-4 text-sky-500" />
                  </div>
                </div>
                <p className="mt-4 text-3xl font-semibold text-stone-900">{formatNumber(metrics.pointsNetAvailable)}</p>
                <p className="mt-1 text-xs text-stone-400">หลังหักจอง/ใช้แล้ว</p>
              </div>
            </div>
          )}
        </div>

        {/* ─── Pipeline + volume ─── */}
        <div className="grid gap-6 xl:grid-cols-2">
          <SectionCard title="งานค้างในระบบ" description="ติดอยู่ตรงไหน - ใช้ตัดสินใจเร่งงาน">
            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-stone-100" />)}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex flex-col rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">รอรับวัสดุ</p>
                  <p className="mt-auto pt-3 text-2xl font-semibold text-amber-950">{formatNumber(metrics.submissionsPendingPickup)}</p>
                  <p className="mt-1 text-xs text-amber-800/70">รายการ</p>
                </div>
                <div className="flex flex-col rounded-2xl border border-sky-200 bg-sky-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">ขนส่งดำเนินอยู่</p>
                  <p className="mt-auto pt-3 text-2xl font-semibold text-sky-950">{formatNumber(metrics.pickupJobsActive)}</p>
                  <p className="mt-1 text-xs text-sky-800/70">งาน</p>
                </div>
                <div className="flex flex-col rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">รอคลังพิจารณา</p>
                  <p className="mt-auto pt-3 text-2xl font-semibold text-rose-950">{formatNumber(metrics.rewardRequestsPendingWarehouse)}</p>
                  <p className="mt-1 text-xs text-rose-800/70">คำขอ</p>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title="จำนวนในระบบ" description="ยอดรวมตลอดอายุโครงการ">
            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-stone-100" />)}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex flex-col rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <p className="text-xs font-medium text-stone-400">ส่งวัสดุทั้งหมด</p>
                  <p className="mt-auto pt-3 text-2xl font-semibold text-stone-900">{formatNumber(metrics.submissionsTotal)}</p>
                  <p className="mt-1 text-xs text-stone-500">รายการ</p>
                </div>
                <div className="flex flex-col rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <p className="text-xs font-medium text-stone-400">คำขอแลกรางวัล</p>
                  <p className="mt-auto pt-3 text-2xl font-semibold text-stone-900">{formatNumber(metrics.rewardRequestsTotal)}</p>
                  <p className="mt-1 text-xs text-stone-500">รายการ</p>
                </div>
                <div className="flex flex-col rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <p className="text-xs font-medium text-stone-400">เกษตรกร</p>
                  <p className="mt-auto pt-3 text-2xl font-semibold text-stone-900">{formatNumber(metrics.uniqueFarmersTotal)}</p>
                  <p className="mt-1 text-xs text-stone-500">ราย</p>
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        {/* ─── Material Donut + Points liquidity ─── */}
        <div className="grid gap-6 xl:grid-cols-[1fr,320px]">

          {/* Donut chart */}
          <SectionCard title="วัสดุและสัดส่วน" description="น้ำหนักประมาณการแยกตามประเภทวัสดุ">
            {isLoading ? (
              <div className="flex flex-col items-center gap-4">
                <div className="h-56 w-56 animate-pulse rounded-full bg-stone-100" />
                <div className="w-full space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-8 animate-pulse rounded-xl bg-stone-100" />
                  ))}
                </div>
              </div>
            ) : materialChartData.length === 0 ? (
              <EmptyState title="ยังไม่มีข้อมูลวัสดุ" description="เมื่อเริ่มมีการส่งวัสดุ ระบบจะแสดงสัดส่วนตามประเภท" icon={Boxes} />
            ) : (
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                {/* Donut */}
                <div className="mx-auto shrink-0 sm:mx-0">
                  <ResponsiveContainer width={220} height={220}>
                    <PieChart>
                      <Pie
                        data={materialChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={62}
                        outerRadius={104}
                        paddingAngle={1}
                        dataKey="weight"
                        startAngle={90}
                        endAngle={-270}
                        strokeWidth={2}
                        stroke="#fff"
                        minAngle={6}
                      >
                        {materialChartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 12, borderColor: '#e7e5e4', fontSize: 12 }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload as typeof materialChartData[number];
                          const total = materialChartData.reduce((s, x) => s + x.weight, 0);
                          const pct = total > 0 ? (d.weight / total) * 100 : 0;
                          return (
                            <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-lg text-sm">
                              <div className="flex items-center gap-2 font-semibold text-stone-800 mb-2">
                                <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                                {d.name}
                              </div>
                              <div className="space-y-0.5 text-xs text-stone-500">
                                <p>น้ำหนัก: <span className="font-medium text-stone-700">{formatKg(d.weight)}</span></p>
                                <p>สัดส่วน: <span className="font-medium text-stone-700">{pct.toFixed(1)}%</span></p>
                                <p>จำนวนรายการ: <span className="font-medium text-stone-700">{formatNumber(d.count)} รายการ</span></p>
                              </div>
                            </div>
                          );
                        }}
                      />
                      {(() => {
                        const totalWeight = materialChartData.reduce((s, d) => s + d.weight, 0);
                        return (
                          <DonutCenterLabel
                            cx={110}
                            cy={110}
                            innerValue={`${formatNumber(Math.round(totalWeight))}`}
                            innerLabel="กก. รวม"
                          />
                        );
                      })()}
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend table */}
                <div className="min-w-0 flex-1">
                  {(() => {
                    const total = materialChartData.reduce((sum, d) => sum + d.weight, 0);
                    const withPct = materialChartData.map((d) => ({ ...d, pct: total > 0 ? (d.weight / total) * 100 : 0 }));
                    const sorted = [...withPct].sort((a, b) => {
                      const av = materialSort.key === 'weight' ? a.weight : a.pct;
                      const bv = materialSort.key === 'weight' ? b.weight : b.pct;
                      return materialSort.dir === 'desc' ? bv - av : av - bv;
                    });
                    const toggle = (key: 'weight' | 'pct') =>
                      setMaterialSort((prev) => ({ key, dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc' }));
                    const SortIcon = ({ col }: { col: 'weight' | 'pct' }) => (
                      <span className="ml-1 inline-block leading-none">
                        {materialSort.key === col ? (materialSort.dir === 'desc' ? '↓' : '↑') : <span className="text-stone-200">↕</span>}
                      </span>
                    );
                    return (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-stone-100">
                            <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-stone-400">วัสดุ</th>
                            <th
                              className={`pb-2 text-right text-xs font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors ${materialSort.key === 'weight' ? 'text-stone-700' : 'text-stone-400 hover:text-stone-600'}`}
                              onClick={() => toggle('weight')}
                            >
                              น้ำหนัก<SortIcon col="weight" />
                            </th>
                            <th
                              className={`pb-2 pl-4 text-right text-xs font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors ${materialSort.key === 'pct' ? 'text-stone-700' : 'text-stone-400 hover:text-stone-600'}`}
                              onClick={() => toggle('pct')}
                            >
                              สัดส่วน<SortIcon col="pct" />
                            </th>
                            <th className="pb-2 pl-4 text-right text-xs font-semibold uppercase tracking-wider text-stone-400">รายการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-50">
                          {sorted.map((entry) => (
                            <tr key={entry.name} className="group">
                              <td className="py-3 pr-3">
                                <div className="flex items-center gap-2">
                                  <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: entry.fill }} />
                                  <span className="font-medium text-stone-700">{entry.name}</span>
                                </div>
                              </td>
                              <td className="py-3 text-right tabular-nums text-stone-600">{formatKg(entry.weight)}</td>
                              <td className="py-3 pl-4 text-right">
                                <span className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: `${entry.fill}22`, color: entry.fill }}>
                                  {entry.pct.toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-3 pl-4 text-right tabular-nums text-stone-400">{formatNumber(entry.count)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              </div>
            )}
          </SectionCard>

          {/* Points liquidity */}
          <SectionCard title="แต้มและสภาพคล่อง" description="สถานะแต้มในระบบทั้งหมด">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-xl bg-stone-100" />
                ))}
              </div>
            ) : (
              <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 overflow-hidden">
                <div className="bg-emerald-50 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-sm font-medium text-emerald-800">เครดิตแล้วทั้งหมด</span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-semibold tabular-nums text-emerald-950">{formatNumber(metrics.pointsCredited)}</span>
                      <span className="ml-1.5 text-xs text-emerald-700/60">แต้ม</span>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-emerald-700/60">แต้มทั้งหมดที่โอนให้เกษตรกรจากการส่งวัสดุที่โรงงานยืนยันแล้ว</p>
                </div>
                <div className="bg-amber-50 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      <span className="text-sm font-medium text-amber-800">จองรออนุมัติ</span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-semibold tabular-nums text-amber-950">{formatNumber(metrics.pointsReserved)}</span>
                      <span className="ml-1.5 text-xs text-amber-700/60">แต้ม</span>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-amber-700/60">แต้มที่ถูกล็อกไว้รอคลังอนุมัติ — ยังใช้ไม่ได้จนกว่าจะผ่านหรือถูกปฏิเสธ</p>
                </div>
                <div className="bg-stone-50 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-stone-400" />
                      <span className="text-sm font-medium text-stone-600">ใช้แลกแล้ว</span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-semibold tabular-nums text-stone-900">{formatNumber(metrics.pointsSpent)}</span>
                      <span className="ml-1.5 text-xs text-stone-400">แต้ม</span>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-stone-400">แต้มที่หักออกจริงหลังคลังอนุมัติและส่งมอบรางวัลให้เกษตรกรเสร็จแล้ว</p>
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        {/* ─── Non-convertible warning ─── */}
        <AnimatePresence>
          {metrics.submissionsNonConvertibleCount > 0 && (
            <motion.div
              initial={reduceMotion ? {} : { opacity: 0, y: 6 }}
              animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
              exit={reduceMotion ? {} : { opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900"
            >
              <span className="font-semibold">รายการแปลงหน่วยไม่ได้ {formatNumber(metrics.submissionsNonConvertibleCount)} รายการ</span>
              {' '}— อาจต้องปรับ master data หรือกติกาการรับวัสดุ
              <Link href="/executive/settings" className="ml-2 inline-flex items-center gap-1 font-semibold underline underline-offset-2">
                ไปจัดการ
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Value chain table ─── */}
        {valueChain.length > 0 && (
          <SectionCard title="Value Chain ปลายทาง" description="ผลิตภัณฑ์แปรรูปจากวัสดุเหลือทิ้ง → ผู้รับซื้อ">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left">
                    {['ผลิตภัณฑ์', 'หน่วยผลิต', 'ผู้รับซื้อ', 'การใช้งาน'].map((h) => (
                      <th key={h} className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wider text-stone-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {valueChain.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 pr-4 font-medium text-stone-800">{item.product_name_th}</td>
                      <td className="py-3 pr-4 text-stone-600">{item.producer_org ?? '—'}</td>
                      <td className="py-3 pr-4 text-stone-600">{item.buyer_org ?? '—'}</td>
                      <td className="py-3 text-stone-600">{item.buyer_use_th ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}

      </div>

      {/* ─── CO2 derivation modal ─── */}
      <AnimatePresence>
        {co2ModalOpen && (
          <motion.div
            initial={reduceMotion ? {} : { opacity: 0 }}
            animate={reduceMotion ? {} : { opacity: 1 }}
            exit={reduceMotion ? {} : { opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={() => setCo2ModalOpen(false)}
          >
            <motion.div
              initial={reduceMotion ? {} : { opacity: 0, scale: 0.95, y: 10 }}
              animate={reduceMotion ? {} : { opacity: 1, scale: 1, y: 0 }}
              exit={reduceMotion ? {} : { opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-emerald-100 p-2">
                    <Leaf className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-stone-900">วิธีคำนวณ CO₂ ที่หลีกเลี่ยงได้</p>
                    <p className="text-xs text-stone-400">ประมาณการจากข้อมูลปฏิบัติการจริง</p>
                  </div>
                </div>
                <button type="button" onClick={() => setCo2ModalOpen(false)} className="rounded-full p-1.5 text-stone-400 transition hover:bg-stone-100">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="space-y-4 px-6 py-5">

                {/* Input */}
                <div className="rounded-2xl bg-stone-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">ข้อมูลตั้งต้น</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <p className="text-3xl font-semibold text-stone-900">{formatKg(metrics.confirmedWeightKg)}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-stone-500">น้ำหนักวัสดุที่โรงงานชั่งและยืนยันแล้ว (factory_confirmed_weight_kg)</p>
                </div>

                {/* Method A */}
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">วิธีที่ 1 — Avoided Carbon (Gross)</p>
                      <p className="mt-1 text-xs text-stone-600">
                        วัสดุเกษตรมีคาร์บอนสะสมอยู่ประมาณ <strong>40%</strong> ของน้ำหนักแห้ง
                        หากถูกเผาในแปลง คาร์บอนจะถูกปลดปล่อยเป็น CO₂ ทั้งหมด
                        สูตรคือ C × (44÷12) เพื่อแปลงน้ำหนักคาร์บอนเป็น CO₂
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-xl bg-white/80 px-3 py-2 font-mono text-sm text-stone-700">
                    {metrics.confirmedWeightKg.toFixed(1)} กก. × <strong>1.47</strong> = <strong className="text-emerald-700">{formatNumber(estCo2Kg)} กก. CO₂</strong>
                  </div>
                  <div className="mt-2 text-[10px] text-stone-500">
                    ที่มา factor 1.47 = 0.40 (C-fraction) × 44/12 (CO₂/C ratio){' '}
                    <a href="https://doi.org/10.1016/j.biombioe.2009.05.020" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-emerald-600 underline hover:text-emerald-800">
                      Gadde et al. 2009 <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                    {' '}· ข้อควรรู้: IPCC ไม่นับ CO₂ จากวัสดุชีวภาพเป็น net emission เพราะถูกดูดซับระหว่างการเติบโต
                  </div>
                </div>

                {/* Method B */}
                <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">วิธีที่ 2 — GHG Inventory (CH₄ + N₂O เท่านั้น)</p>
                    <p className="mt-1 text-xs text-stone-600">
                      มาตรฐาน IPCC สำหรับบัญชีก๊าซเรือนกระจกแห่งชาติ นับเฉพาะ CH₄ และ N₂O
                      ซึ่งเป็นก๊าซที่เกิดจากการเผาไหม้ไม่สมบูรณ์ แปลงเป็น CO₂eq ด้วย GWP
                    </p>
                  </div>
                  <div className="mt-3 rounded-xl bg-white/80 px-3 py-2 font-mono text-sm text-stone-700">
                    {metrics.confirmedWeightKg.toFixed(1)} กก. × <strong>0.088</strong> = <strong className="text-sky-700">{formatNumber(Math.round(metrics.confirmedWeightKg * 0.088))} กก. CO₂eq</strong>
                  </div>
                  <div className="mt-2 text-[10px] text-stone-500">
                    factor 0.088 = (CH₄ 2.7 g/kg × GWP 25) + (N₂O 0.07 g/kg × GWP 298) ÷ 1000{' '}
                    <a href="https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/4_Volume4/V4_02_Ch2_Generic.pdf" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-sky-600 underline hover:text-sky-800">
                      IPCC 2006 Vol.4 Ch.2 Table 2.5 <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </div>

                {/* Guidance */}
                <p className="text-[11px] text-stone-400">
                  ตัวเลขทั้งสองเป็นการประมาณการจากน้ำหนักที่โรงงานชั่งจริง ยังไม่ใช่ผลการตรวจวัดภาคสนาม
                  ข้อมูล Baseline จาก CMU จะใช้เปรียบเทียบ "ก่อน vs หลัง" โครงการ ไม่ใช่ปรับสูตรนี้
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </ErrorBoundary>
  );
}
