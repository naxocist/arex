'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { CheckCircle2, Gift, RefreshCw, XCircle } from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import ErrorBoundary from '@/app/_components/ErrorBoundary';
import { ApiError, hasAccessToken, warehouseApi, type WarehousePendingRequestItem } from '@/app/_lib/api';
import AnsweredTab from './_components/AnsweredTab';
import PendingTab from './_components/PendingTab';

function inferMessageTone(message: string | null): 'info' | 'success' | 'error' {
  if (!message) return 'info';
  if (message.includes('ไม่สำเร็จ') || message.includes('ยังไม่')) return 'error';
  if (message.includes('สำเร็จ')) return 'success';
  return 'info';
}

type WarehouseTab = 'pending' | 'answered';

export default function WarehouseApproval() {
  const [activeTab, setActiveTab] = useState<WarehouseTab>('pending');
  const [pendingRequests, setPendingRequests] = useState<WarehousePendingRequestItem[]>([]);
  const [answeredRequests, setAnsweredRequests] = useState<WarehousePendingRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const summary = useMemo(() => {
    const totalPoints = pendingRequests.reduce((sum, item) => sum + Number(item.requested_points || 0), 0);
    const approvedCount = answeredRequests.filter((r) => r.status === 'warehouse_approved').length;
    const rejectedCount = answeredRequests.filter((r) => r.status === 'warehouse_rejected').length;
    return { totalPoints, approvedCount, rejectedCount };
  }, [pendingRequests, answeredRequests]);

  const loadPendingRequests = async (forceRefresh = false) => {
    if (!hasAccessToken()) { setMessage('ยังไม่พบโทเคน กรุณาเข้าสู่ระบบก่อน'); return; }
    setIsLoading(true);
    try {
      const response = await warehouseApi.listPendingRewardRequests({ forceRefresh });
      setPendingRequests(response.requests);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof ApiError ? `โหลดรายการรออนุมัติไม่สำเร็จ: ${error.message}` : 'โหลดรายการรออนุมัติไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAnsweredRequests = async (forceRefresh = false) => {
    if (!hasAccessToken()) return;
    setIsLoading(true);
    try {
      const response = await warehouseApi.listAnsweredRewardRequests({ forceRefresh });
      setAnsweredRequests(response.requests);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof ApiError ? `โหลดประวัติคำขอไม่สำเร็จ: ${error.message}` : 'โหลดประวัติคำขอไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPendingRequests();
    void loadAnsweredRequests();
  }, []);

  useEffect(() => {
    if (activeTab === 'pending') void loadPendingRequests();
    else void loadAnsweredRequests();
  }, [activeTab]);

  const handleApprove = async (requestId: string) => {
    setProcessingRequestId(requestId);
    setMessage(null);
    try {
      await warehouseApi.approveRewardRequest(requestId);
      setMessage('อนุมัติคำขอสำเร็จแล้ว');
      await loadPendingRequests(true);
    } catch (error) {
      setMessage(error instanceof ApiError ? `อนุมัติคำขอไม่สำเร็จ: ${error.message}` : 'อนุมัติคำขอไม่สำเร็จ');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessingRequestId(requestId);
    setMessage(null);
    const reason = (reasons[requestId] || '').trim();
    try {
      await warehouseApi.rejectRewardRequest(requestId, { reason });
      setMessage('ปฏิเสธคำขอสำเร็จแล้ว');
      await loadPendingRequests(true);
    } catch (error) {
      setMessage(error instanceof ApiError ? `ปฏิเสธคำขอไม่สำเร็จ: ${error.message}` : 'ปฏิเสธคำขอไม่สำเร็จ');
    } finally {
      setProcessingRequestId(null);
    }
  };

  function toggleExpand(id: string) {
    setExpandedId((cur) => cur === id ? null : id);
  }

  const tabs: { id: WarehouseTab; label: string; count: number }[] = [
    { id: 'pending', label: 'รอตรวจสอบ', count: pendingRequests.length },
    { id: 'answered', label: 'ประวัติ', count: answeredRequests.length },
  ];

  return (
    <ErrorBoundary>
      <div className="space-y-6 pb-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">คลังพัสดุ</p>
            <h1 className="mt-0.5 text-3xl font-light tracking-tight text-on-surface sm:text-4xl">อนุมัติรางวัล</h1>
            <p className="mt-1 text-sm text-stone-400">ตรวจสอบและอนุมัติคำขอแลกรางวัลของเกษตรกร</p>
          </div>
          <motion.button
            type="button"
            onClick={() => { if (activeTab === 'pending') void loadPendingRequests(true); else void loadAnsweredRequests(true); }}
            disabled={isLoading}
            whileTap={reduceMotion ? {} : { scale: 0.88 }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-outline-variant/20 bg-white text-on-surface-variant transition hover:bg-stone-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </motion.button>
        </div>

        {message && <AlertBanner message={message} tone={inferMessageTone(message)} />}

        {!isLoading && (
          <div className="flex flex-wrap gap-2">
            <span className="flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
              <Gift className="h-3.5 w-3.5" />
              รอตรวจสอบ {pendingRequests.length} คำขอ · {summary.totalPoints.toLocaleString('th-TH')} แต้ม
            </span>
            <span className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              อนุมัติแล้ว {summary.approvedCount.toLocaleString('th-TH')} คำขอ
            </span>
            <span className="flex items-center gap-1.5 rounded-md bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600">
              <XCircle className="h-3.5 w-3.5" />
              ปฏิเสธแล้ว {summary.rejectedCount.toLocaleString('th-TH')} คำขอ
            </span>
          </div>
        )}

        <div className="flex rounded-xl bg-stone-100 p-0.5 gap-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActiveTab(tab.id); setExpandedId(null); }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] px-4 py-2 text-sm font-semibold transition-all ${
                activeTab === tab.id ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {tab.label}
              {!isLoading && tab.count > 0 && (
                <span className={`rounded-full min-w-[18px] text-center px-1 py-0.5 text-[10px] font-bold leading-none ${
                  activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-stone-200 text-stone-400'
                }`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'pending' && (
          <PendingTab
            items={pendingRequests}
            isLoading={isLoading}
            expandedId={expandedId}
            onToggle={toggleExpand}
            processingRequestId={processingRequestId}
            reasons={reasons}
            onReasonChange={(id, value) => setReasons((prev) => ({ ...prev, [id]: value }))}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}

        {activeTab === 'answered' && (
          <AnsweredTab
            answeredRequests={answeredRequests}
            isLoading={isLoading}
            expandedId={expandedId}
            onToggle={toggleExpand}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
