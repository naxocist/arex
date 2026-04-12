'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, PackageSearch, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import EmptyState from '@/app/_components/EmptyState';
import SectionCard from '@/app/_components/SectionCard';
import StatCard from '@/app/_components/StatCard';
import StatusBadge from '@/app/_components/StatusBadge';
import { ApiError, warehouseApi, type WarehousePendingRequestItem } from '@/app/_lib/apiClient';

type WarehouseTab = 'pending' | 'answered';

function hasAccessToken(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return Boolean(localStorage.getItem('AREX_ACCESS_TOKEN'));
}

function formatRewardRequestStatus(status: string): string {
  const map: Record<string, string> = {
    requested: 'รอคลังตรวจสอบ',
    warehouse_approved: 'คลังอนุมัติแล้ว',
    warehouse_rejected: 'คลังปฏิเสธ',
  };
  return map[status] ?? status;
}

function formatDateTime(dateTime: string | null | undefined): string {
  if (!dateTime) return '-';
  return new Date(dateTime).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function inferMessageTone(message: string | null): 'info' | 'success' | 'error' {
  if (!message) return 'info';
  if (message.includes('ไม่สำเร็จ') || message.includes('ยังไม่')) return 'error';
  if (message.includes('สำเร็จ')) return 'success';
  return 'info';
}

function RequestCard({
  item,
  isPending,
  processingRequestId,
  reasons,
  onReasonChange,
  onApprove,
  onReject,
}: {
  item: WarehousePendingRequestItem;
  isPending: boolean;
  processingRequestId: string | null;
  reasons: Record<string, string>;
  onReasonChange: (id: string, value: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const isProcessing = processingRequestId === item.id;

  return (
    <div className="group rounded-2xl border border-stone-200 bg-white p-4 transition hover:border-emerald-200 hover:shadow-md">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-50">
          <Gift className="h-6 w-6 text-emerald-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-stone-900">
                {item.reward_name_th ?? 'รางวัล'}
              </p>
              <p className="mt-1 truncate text-sm text-stone-500">
                {item.reward_description_th || 'ไม่มีรายละเอียด'}
              </p>
            </div>
            <StatusBadge status={item.status} label={formatRewardRequestStatus(item.status)} size="sm" />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-2.5 py-1 font-medium text-stone-700">
              <Package className="h-3.5 w-3.5" />
              {Number(item.quantity)} ชิ้น
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2.5 py-1 font-medium text-violet-700">
              <Coins className="h-3.5 w-3.5" />
              {Number(item.requested_points).toLocaleString('th-TH')} แต้ม
            </span>
            {item.requested_at && (
              <span className="text-xs text-stone-400">
                ยื่นเมื่อ {formatDateTime(item.requested_at)}
              </span>
            )}
          </div>

          {isPending && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <textarea
                value={reasons[item.id] || ''}
                onChange={(event) => onReasonChange(item.id, event.target.value)}
                placeholder="เหตุผล (ถ้าปฏิเสธ)"
                className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm outline-none transition focus:border-emerald-300 focus:bg-white"
                rows={1}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onApprove(item.id)}
                  disabled={isProcessing}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  อนุมัติ
                </button>
                <button
                  type="button"
                  onClick={() => onReject(item.id)}
                  disabled={isProcessing}
                  className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  ปฏิเสธ
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Gift({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 12v10H4V12" />
      <path d="M2 7h20v5H2z" />
      <path d="M12 22V7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h5.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  );
}

function Package({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
    </svg>
  );
}

function Coins({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
      <path d="M12 18V6" />
    </svg>
  );
}

export default function WarehouseApproval() {
  const [activeTab, setActiveTab] = useState<WarehouseTab>('pending');
  const [pendingRequests, setPendingRequests] = useState<WarehousePendingRequestItem[]>([]);
  const [answeredRequests, setAnsweredRequests] = useState<WarehousePendingRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const summary = useMemo(() => {
    const totalRequests = pendingRequests.length;
    const totalPoints = pendingRequests.reduce((sum, item) => sum + Number(item.requested_points || 0), 0);
    return { totalRequests, totalPoints };
  }, [pendingRequests]);

  const loadPendingRequests = async (forceRefresh = false) => {
    if (!hasAccessToken()) {
      setMessage('ยังไม่พบโทเคนสำหรับเรียก API กรุณาเข้าสู่ระบบที่หน้าเลือกผู้ใช้งาน');
      return;
    }

    setIsLoading(true);
    try {
      const response = await warehouseApi.listPendingRewardRequests({ forceRefresh });
      setPendingRequests(response.requests);
      setMessage(null);
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(`โหลดรายการรออนุมัติไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('โหลดรายการรออนุมัติไม่สำเร็จ');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadAnsweredRequests = async (forceRefresh = false) => {
    if (!hasAccessToken()) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await warehouseApi.listAnsweredRewardRequests({ forceRefresh });
      setAnsweredRequests(response.requests);
      setMessage(null);
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(`โหลดประวัติคำขอไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('โหลดประวัติคำขอไม่สำเร็จ');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'pending') {
      void loadPendingRequests();
    } else {
      void loadAnsweredRequests();
    }
  }, [activeTab]);

  const handleApprove = async (requestId: string) => {
    setProcessingRequestId(requestId);
    setMessage(null);

    try {
      await warehouseApi.approveRewardRequest(requestId);
      setMessage('อนุมัติคำขอสำเร็จแล้ว');
      await loadPendingRequests(true);
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(`อนุมัติคำขอไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('อนุมัติคำขอไม่สำเร็จ');
      }
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessingRequestId(requestId);
    setMessage(null);

    const reason = (reasons[requestId] || '').trim() || 'ข้อมูลไม่ครบถ้วน กรุณาตรวจสอบและยื่นใหม่';

    try {
      await warehouseApi.rejectRewardRequest(requestId, { reason });
      setMessage('ปฏิเสธคำขอสำเร็จแล้ว');
      await loadPendingRequests(true);
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(`ปฏิเสธคำขอไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('ปฏิเสธคำขอไม่สำเร็จ');
      }
    } finally {
      setProcessingRequestId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-900">อนุมัติรางวัล</h1>
        <div className="flex gap-2">
          <button onClick={() => setActiveTab(activeTab === 'pending' ? 'answered' : 'pending')} disabled={isLoading} className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700">
            {isLoading ? '...' : 'รีเฟรช'}
          </button>
        </div>
      </div>

      {message ? <AlertBanner message={message} tone={inferMessageTone(message)} /> : null}

      <div className="flex gap-1 rounded-xl bg-stone-100 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('pending')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === 'pending' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          รอตรวจสอบ ({pendingRequests.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('answered')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === 'answered' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          ประวัติ ({answeredRequests.length})
        </button>
      </div>

      {activeTab === 'pending' ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <StatCard label="คำขอรอตรวจสอบ" value={summary.totalRequests.toLocaleString('th-TH')} detail="รายการในสถานะ requested ที่รอการตัดสินใจ" icon={PackageSearch} tone="amber" />
            <StatCard label="PMUC Coin รวมในคิว" value={summary.totalPoints.toLocaleString('th-TH')} detail="ภาระแต้มที่กำลังรอการอนุมัติจากคลัง" icon={ShieldCheck} tone="violet" />
            <StatCard label="สถานะระบบคลัง" value="พร้อมตรวจสอบ" detail="การอนุมัติและปฏิเสธจะส่งต่อสถานะให้ workflow ทันที" icon={CheckCircle2} tone="emerald" />
          </section>

          <SectionCard
            title="คำขอที่รอการตัดสินใจ"
            description="จัดแต่ละคำขอเป็นการ์ดเดียวพร้อมข้อมูลรางวัล จำนวนแต้ม และพื้นที่ระบุเหตุผลปฏิเสธ เพื่อให้ตรวจง่ายกว่าตารางแบบเดิม"
          >
            {pendingRequests.length === 0 ? (
              <EmptyState
                title="ยังไม่มีคำขอที่อยู่ในสถานะ requested"
                description="เมื่อมีคำขอรออนุมัติจากเกษตรกร ระบบจะนำเข้ากล่องงานนี้ให้โดยอัตโนมัติ"
                icon={PackageSearch}
              />
            ) : (
              <div className="grid gap-3">
                {pendingRequests.map((item) => (
                  <RequestCard
                    key={item.id}
                    item={item}
                    isPending={true}
                    processingRequestId={processingRequestId}
                    reasons={reasons}
                    onReasonChange={(id, value) => setReasons((prev) => ({ ...prev, [id]: value }))}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                ))}
              </div>
            )}
          </SectionCard>
        </>
      ) : (
        <SectionCard
          title="ประวัติคำขอที่ตอบแล้ว"
          description="คำขอที่คลังอนุมัติหรือปฏิเสธแล้ว เพื่อตรวจสอบย้อนหลัง"
        >
          {answeredRequests.length === 0 ? (
            <EmptyState
              title="ยังไม่มีประวัติคำขอ"
              description="คำขอที่อนุมัติหรือปฏิเสธแล้วจะแสดงที่นี่"
              icon={CheckCircle2}
            />
          ) : (
            <div className="grid gap-3">
              {answeredRequests.map((item) => (
                <RequestCard
                  key={item.id}
                  item={item}
                  isPending={false}
                  processingRequestId={processingRequestId}
                  reasons={reasons}
                  onReasonChange={() => {}}
                  onApprove={() => {}}
                  onReject={() => {}}
                />
              ))}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
