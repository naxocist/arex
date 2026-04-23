'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CheckCircle2, RefreshCw, User, XCircle } from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import ErrorBoundary from '@/app/_components/ErrorBoundary';
import { useFarmerProfile } from '@/app/_contexts/FarmerProfileContext';
import {
  ApiError,
  hasAccessToken,
  farmerApi,
  type FarmerRewardItem,
} from '@/app/_lib/api';
import RewardCatalog from './_components/RewardCatalog';
import RequestTracking from './_components/RequestTracking';

function Toast({ tone, message, onDone }: { tone: 'success' | 'error'; message: string; onDone: () => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    timerRef.current = setTimeout(() => onDoneRef.current(), 3000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);
  const success = tone === 'success';
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      className={`fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border px-5 py-3.5 shadow-lg backdrop-blur-sm ${success ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}
    >
      {success ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" /> : <XCircle className="h-5 w-5 shrink-0 text-red-400" />}
      <span className={`text-sm font-medium ${success ? 'text-emerald-700' : 'text-red-700'}`}>{message}</span>
    </motion.div>
  );
}

export default function FarmerRewards() {
  const reduceMotion = useReducedMotion();
  const { openProfile } = useFarmerProfile();

  const [availablePoints, setAvailablePoints] = useState(0);
  const [rewardsCatalog, setRewardsCatalog] = useState<FarmerRewardItem[]>([]);
  const [rewardRequests, setRewardRequests] = useState<Parameters<typeof RequestTracking>[0]['rewardRequests']>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string; id: number } | null>(null);
  const toastId = useRef(0);
  const [requestingRewardId, setRequestingRewardId] = useState<string | null>(null);
  const [cancellingRewardRequestId, setCancellingRewardRequestId] = useState<string | null>(null);

  const activeCount = useMemo(
    () => rewardRequests.filter((r) => r.status === 'requested' || r.status === 'warehouse_approved').length,
    [rewardRequests],
  );

  const loadRewards = async (forceRefresh = false) => {
    if (!hasAccessToken()) {
      setError('ยังไม่พบโทเคน AREX_ACCESS_TOKEN กรุณาเข้าสู่ระบบที่หน้าเลือกผู้ใช้งาน');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [pointsRes, rewardsRes, requestsRes] = await Promise.all([
        farmerApi.getPoints({ forceRefresh }),
        farmerApi.listRewards({ forceRefresh }),
        farmerApi.listRewardRequests({ forceRefresh }),
      ]);
      setAvailablePoints(pointsRes.available_points);
      setRewardsCatalog(rewardsRes.rewards);
      setRewardRequests(requestsRes.requests);
    } catch (err) {
      setError(err instanceof ApiError ? `โหลดข้อมูลไม่สำเร็จ: ${err.message}` : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadRewards(); }, []);

  const handleSubmitRequest = async (
    reward: FarmerRewardItem,
    qty: number,
    locationText: string,
    lat: number | null,
    lng: number | null,
  ) => {
    if (!hasAccessToken()) { setToast({ tone: 'error', message: 'ยังไม่พบโทเคน AREX_ACCESS_TOKEN สำหรับเชื่อมต่อ FastAPI', id: ++toastId.current }); return; }
    const pts = Number(reward.points_cost) || 0;
    if (availablePoints < pts * qty) { setToast({ tone: 'error', message: `แต้มไม่พอสำหรับ ${reward.name_th}`, id: ++toastId.current }); return; }
    setRequestingRewardId(reward.id);
    try {
      await farmerApi.createRewardRequest({ reward_id: reward.id, quantity: qty, delivery_location_text: locationText || null, delivery_lat: lat, delivery_lng: lng });
      setToast({ tone: 'success', message: `ส่งคำขอแลกรางวัล ${reward.name_th} สำเร็จแล้ว`, id: ++toastId.current });
      await loadRewards(true);
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof ApiError ? `ส่งคำขอแลกรางวัลไม่สำเร็จ: ${err.message}` : 'ส่งคำขอแลกรางวัลไม่สำเร็จ', id: ++toastId.current });
    } finally {
      setRequestingRewardId(null);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    if (!hasAccessToken()) { setToast({ tone: 'error', message: 'ยังไม่พบโทเคน AREX_ACCESS_TOKEN สำหรับเชื่อมต่อ FastAPI', id: ++toastId.current }); return; }
    setCancellingRewardRequestId(requestId);
    try {
      await farmerApi.cancelRewardRequest(requestId);
      setToast({ tone: 'success', message: 'ยกเลิกคำขอแลกรางวัลสำเร็จแล้ว และคืนแต้มที่จองไว้เรียบร้อย', id: ++toastId.current });
      await loadRewards(true);
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof ApiError ? `ยกเลิกคำขอไม่สำเร็จ: ${err.message}` : 'ยกเลิกคำขอไม่สำเร็จ', id: ++toastId.current });
    } finally {
      setCancellingRewardRequestId(null);
    }
  };

  return (
    <ErrorBoundary>
      <div className="space-y-5 pb-10">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-emerald-600 px-5 py-5 shadow-md shadow-primary/15">
          <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute -bottom-6 right-12 h-20 w-20 rounded-full bg-white/5" />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start justify-between gap-2 sm:block">
              <div>
                <p className="text-sm font-medium text-white/70">PMUC Coin คงเหลือ</p>
                <div className="mt-1 flex items-end gap-1.5">
                  <span className="text-4xl font-light tabular-nums text-white sm:text-5xl">{availablePoints.toLocaleString('th-TH')}</span>
                  <span className="mb-1.5 text-base font-medium text-white/70">แต้ม</span>
                </div>
                {activeCount > 0 && (
                  <p className="mt-1.5 text-sm text-white/70">คำขอที่กำลังดำเนินการ{' '}<span className="font-bold text-white">{activeCount} รายการ</span></p>
                )}
              </div>
              <button type="button" onClick={() => void loadRewards(true)} disabled={isLoading} aria-label="รีเฟรชข้อมูล"
                className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 disabled:opacity-50 sm:hidden">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="flex items-center gap-2 sm:flex-col sm:items-end">
              <button type="button" onClick={() => void loadRewards(true)} disabled={isLoading} aria-label="รีเฟรชข้อมูล"
                className="hidden h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 disabled:opacity-50 sm:flex">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button type="button" onClick={openProfile}
                className="flex items-center gap-2 rounded-full bg-white/20 border border-white/40 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-white/30 active:scale-95 sm:px-4 sm:py-2">
                <User className="h-4 w-4" />ข้อมูลส่วนตัว
              </button>
            </div>
          </div>
        </div>

        {error && <AlertBanner message={error} tone="error" />}

        <RewardCatalog
          rewards={rewardsCatalog}
          availablePoints={availablePoints}
          requestingRewardId={requestingRewardId}
          isLoading={isLoading}
          onSubmitRequest={(reward, qty, locationText, lat, lng) => void handleSubmitRequest(reward, qty, locationText, lat, lng)}
        />

        <RequestTracking
          rewardRequests={rewardRequests}
          rewardsCatalog={rewardsCatalog}
          isLoading={isLoading}
          cancellingRewardRequestId={cancellingRewardRequestId}
          onCancel={(id) => void handleCancelRequest(id)}
        />
      </div>

      <AnimatePresence>
        {toast && <Toast key={toast.id} tone={toast.tone} message={toast.message} onDone={() => setToast(null)} />}
      </AnimatePresence>
    </ErrorBoundary>
  );
}
