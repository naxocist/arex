'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { RefreshCw, User } from 'lucide-react';
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

function inferMessageTone(message: string | null): 'info' | 'success' | 'error' {
  if (!message) return 'info';
  if (message.includes('ไม่สำเร็จ') || message.includes('แต้มไม่พอ') || message.includes('ยังไม่')) return 'error';
  if (message.includes('สำเร็จ')) return 'success';
  return 'info';
}

export default function FarmerRewards() {
  const reduceMotion = useReducedMotion();
  const { openProfile } = useFarmerProfile();

  const [availablePoints, setAvailablePoints] = useState(0);
  const [rewardsCatalog, setRewardsCatalog] = useState<FarmerRewardItem[]>([]);
  const [rewardRequests, setRewardRequests] = useState<Parameters<typeof RequestTracking>[0]['rewardRequests']>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [requestingRewardId, setRequestingRewardId] = useState<string | null>(null);
  const [cancellingRewardRequestId, setCancellingRewardRequestId] = useState<string | null>(null);

  const activeCount = useMemo(
    () => rewardRequests.filter((r) => r.status === 'requested' || r.status === 'warehouse_approved').length,
    [rewardRequests],
  );

  const loadRewards = async (forceRefresh = false) => {
    if (!hasAccessToken()) {
      setMessage('ยังไม่พบโทเคน AREX_ACCESS_TOKEN กรุณาเข้าสู่ระบบที่หน้าเลือกผู้ใช้งาน');
      return;
    }
    setIsLoading(true);
    try {
      const [pointsRes, rewardsRes, requestsRes] = await Promise.all([
        farmerApi.getPoints({ forceRefresh }),
        farmerApi.listRewards({ forceRefresh }),
        farmerApi.listRewardRequests({ forceRefresh }),
      ]);
      setAvailablePoints(pointsRes.available_points);
      setRewardsCatalog(rewardsRes.rewards);
      setRewardRequests(requestsRes.requests);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof ApiError ? `โหลดข้อมูลไม่สำเร็จ: ${error.message}` : 'โหลดข้อมูลไม่สำเร็จ');
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
    if (!hasAccessToken()) { setMessage('ยังไม่พบโทเคน AREX_ACCESS_TOKEN สำหรับเชื่อมต่อ FastAPI'); return; }
    const pts = Number(reward.points_cost) || 0;
    if (availablePoints < pts * qty) { setMessage(`แต้มไม่พอสำหรับ ${reward.name_th}`); return; }
    setRequestingRewardId(reward.id);
    setMessage(null);
    try {
      await farmerApi.createRewardRequest({ reward_id: reward.id, quantity: qty, delivery_location_text: locationText || null, delivery_lat: lat, delivery_lng: lng });
      setMessage(`ส่งคำขอแลกรางวัล ${reward.name_th} สำเร็จแล้ว`);
      await loadRewards(true);
    } catch (error) {
      setMessage(error instanceof ApiError ? `ส่งคำขอแลกรางวัลไม่สำเร็จ: ${error.message}` : 'ส่งคำขอแลกรางวัลไม่สำเร็จ');
    } finally {
      setRequestingRewardId(null);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    if (!hasAccessToken()) { setMessage('ยังไม่พบโทเคน AREX_ACCESS_TOKEN สำหรับเชื่อมต่อ FastAPI'); return; }
    setCancellingRewardRequestId(requestId);
    setMessage(null);
    try {
      await farmerApi.cancelRewardRequest(requestId);
      setMessage('ยกเลิกคำขอแลกรางวัลสำเร็จแล้ว และคืนแต้มที่จองไว้เรียบร้อย');
      await loadRewards(true);
    } catch (error) {
      setMessage(error instanceof ApiError ? `ยกเลิกคำขอไม่สำเร็จ: ${error.message}` : 'ยกเลิกคำขอไม่สำเร็จ');
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
          <div className="relative flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white/70">PMUC Coin คงเหลือ</p>
              <div className="mt-1 flex items-end gap-1.5">
                <span className="text-5xl font-light tabular-nums text-white">{availablePoints.toLocaleString('th-TH')}</span>
                <span className="mb-1.5 text-base font-medium text-white/70">แต้ม</span>
              </div>
              {activeCount > 0 && (
                <p className="mt-1.5 text-sm text-white/70">คำขอที่กำลังดำเนินการ{' '}<span className="font-bold text-white">{activeCount} รายการ</span></p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <button type="button" onClick={() => void loadRewards(true)} disabled={isLoading} aria-label="รีเฟรชข้อมูล"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 disabled:opacity-50">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button type="button" onClick={openProfile}
                className="flex items-center gap-2 rounded-full bg-white/20 border border-white/40 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/30 active:scale-95">
                <User className="h-4 w-4" />ข้อมูลส่วนตัว
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {message && (
            <motion.div key="alert"
              initial={reduceMotion ? {} : { opacity: 0, y: -8 }} animate={reduceMotion ? {} : { opacity: 1, y: 0 }} exit={reduceMotion ? {} : { opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <AlertBanner message={message} tone={inferMessageTone(message)} />
            </motion.div>
          )}
        </AnimatePresence>

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
    </ErrorBoundary>
  );
}
