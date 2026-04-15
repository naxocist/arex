'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Boxes, Coins, Flame, Leaf, RefreshCw, Users, Wallet } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import AlertBanner from '@/app/_components/AlertBanner';
import EmptyState from '@/app/_components/EmptyState';
import ErrorBoundary from '@/app/_components/ErrorBoundary';
import SectionCard from '@/app/_components/SectionCard';
import { SkeletonStatCard } from '@/app/_components/Skeleton';
import { ApiError, executiveApi, type ExecutiveOverview, type ImpactKpis, type ValueChainItem } from '@/app/_lib/apiClient';

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

export default function ExecutiveDashboard() {
  const [overview, setOverview] = useState<ExecutiveOverview | null>(null);
  const [impactKpis, setImpactKpis] = useState<ImpactKpis | null>(null);
  const [valueChain, setValueChain] = useState<ValueChainItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [materialSort, setMaterialSort] = useState<{ key: 'weight' | 'pct'; dir: 'desc' | 'asc' }>({ key: 'weight', dir: 'desc' });
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
      const [overviewRes, impactRes, valueChainRes] = await Promise.all([
        executiveApi.getOverview({ forceRefresh }),
        executiveApi.getImpactKpis({ forceRefresh }),
        executiveApi.listValueChain({ forceRefresh }),
      ]);
      setOverview(overviewRes.overview);
      setImpactKpis(impactRes.impact_kpis);
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
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Hotspot */}
              <div className="relative overflow-hidden rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50 to-white p-5">
                <div className="absolute right-4 top-4 rounded-full bg-rose-100 p-2.5">
                  <Flame className="h-5 w-5 text-rose-500" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-widest text-rose-500">จุดเผา Hotspot</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight text-stone-900">
                  {impactKpis?.has_baseline ? formatNumber(impactKpis.hotspot_count_baseline ?? 0) : '—'}
                </p>
                <p className="mt-1 text-xs text-stone-500">{impactKpis?.has_baseline ? 'จุดเผาไหม้ที่ตรวจพบ (ข้อมูล Baseline)' : 'รอข้อมูล Baseline'}</p>
              </div>

              {/* CO2 */}
              <div className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5">
                <div className="absolute right-4 top-4 rounded-full bg-emerald-100 p-2.5">
                  <Leaf className="h-5 w-5 text-emerald-600" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">CO₂ ลดลง</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight text-stone-900">
                  {impactKpis?.has_baseline ? formatNumber(Number((impactKpis.co2_kg_baseline ?? 0).toFixed(0))) : '—'}
                </p>
                <p className="mt-1 text-xs text-stone-500">{impactKpis?.has_baseline ? 'กิโลกรัม CO₂ (ข้อมูล Baseline)' : 'รอข้อมูล Baseline'}</p>
              </div>

              {/* Income */}
              <div className="relative overflow-hidden rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5">
                <div className="absolute right-4 top-4 rounded-full bg-amber-100 p-2.5">
                  <Wallet className="h-5 w-5 text-amber-500" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">รายได้เกษตรกร</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight text-stone-900">
                  {impactKpis?.has_baseline ? `฿${formatNumber(Number((impactKpis.avg_income_baht_per_household ?? 0).toFixed(0)))}` : '—'}
                </p>
                <p className="mt-1 text-xs text-stone-500">{impactKpis?.has_baseline ? 'บาท/ครัวเรือน (ข้อมูล Baseline)' : 'รอข้อมูล Baseline'}</p>
              </div>
            </div>
          )}
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
                  <p className="text-sm font-medium text-stone-600">แต้มที่ใช้ได้จริง</p>
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

        {/* ─── Pipeline + volume ─── */}
        <div className="grid gap-6 xl:grid-cols-2">
          <SectionCard title="งานค้างในระบบ" description="ติดอยู่ตรงไหน — ใช้ตัดสินใจเร่งงาน">
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

          <SectionCard title="ปริมาณธุรกรรม" description="ยอดรวมตลอดอายุโครงการ">
            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-stone-100" />)}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex flex-col rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary/80">ส่งวัสดุทั้งหมด</p>
                  <p className="mt-auto pt-3 text-2xl font-semibold text-stone-900">{formatNumber(metrics.submissionsTotal)}</p>
                  <p className="mt-1 text-xs text-stone-500">รายการ</p>
                </div>
                <div className="flex flex-col rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary/80">คำขอแลกรางวัล</p>
                  <p className="mt-auto pt-3 text-2xl font-semibold text-stone-900">{formatNumber(metrics.rewardRequestsTotal)}</p>
                  <p className="mt-1 text-xs text-stone-500">รายการ</p>
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
    </ErrorBoundary>
  );
}
