'use client';

import React, { useEffect, useState } from 'react';
import { Boxes, Clock, Coins, RefreshCw, UserCheck } from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import ErrorBoundary from '@/app/_components/ErrorBoundary';
import { SkeletonStatCard } from '@/app/_components/Skeleton';
import { adminApi, ApiError, type AdminOverview } from '@/app/_lib/apiClient';
import { roleMeta } from '@/app/_lib/roleConfig';

function hasAccessToken(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem('AREX_ACCESS_TOKEN'));
}

function fmt(n: number): string {
  return n.toLocaleString('th-TH');
}

function roleLabel(role: string): string {
  const meta = roleMeta[role as keyof typeof roleMeta];
  return meta ? meta.label : role;
}

export default function AdminOverviewView() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (force = false) => {
    if (!hasAccessToken()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getOverview(force ? { forceRefresh: true } : undefined);
      setData(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const ov = data?.overview;
  const pending = data?.pending_approvals ?? {};
  const pendingTotal = data?.pending_total ?? 0;

  return (
    <ErrorBoundary>
      <div className="flex flex-col gap-4 pb-6">
        {error && <AlertBanner tone="error" message={error} />}

        {/* refresh */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => load(true)}
            className="flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-500 hover:bg-stone-50 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            รีเฟรช
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4].map((i) => <SkeletonStatCard key={i} />)}
          </div>
        ) : ov ? (
          <>
            {/* Pending approvals section */}
            {pendingTotal > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-800">รออนุมัติบัญชี {pendingTotal} รายการ</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(pending).map(([role, count]) => (
                    <span key={role} className="rounded-full bg-amber-100 border border-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                      {roleLabel(role)} {count} บัญชี
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* System stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Boxes className="h-4 w-4 text-stone-400" />
                  <span className="text-xs text-stone-500">ยื่นเรื่องทั้งหมด</span>
                </div>
                <p className="text-2xl font-bold text-stone-800">{fmt(ov.submissions_total ?? 0)}</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-stone-400" />
                  <span className="text-xs text-stone-500">งานค้างทั้งหมด</span>
                </div>
                <p className="text-2xl font-bold text-stone-800">{fmt((ov.submissions_pending_pickup ?? 0) + (ov.pickup_jobs_active ?? 0))}</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Coins className="h-4 w-4 text-stone-400" />
                  <span className="text-xs text-stone-500">แต้มที่แจกจ่ายแล้ว</span>
                </div>
                <p className="text-2xl font-bold text-stone-800">{fmt(ov.points_credited_total ?? 0)}</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <UserCheck className="h-4 w-4 text-stone-400" />
                  <span className="text-xs text-stone-500">เกษตรกรทั้งหมด</span>
                </div>
                <p className="text-2xl font-bold text-stone-800">{fmt(ov.unique_farmers_total ?? 0)}</p>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </ErrorBoundary>
  );
}
