'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, PackageSearch, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import AlertBanner from '@/app/components/AlertBanner';
import EmptyState from '@/app/components/EmptyState';
import PageHeader from '@/app/components/PageHeader';
import SectionCard from '@/app/components/SectionCard';
import StatCard from '@/app/components/StatCard';
import StatusBadge from '@/app/components/StatusBadge';
import { ApiError, warehouseApi, type WarehousePendingRequestItem } from '@/app/lib/apiClient';

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

function inferMessageTone(message: string | null): 'info' | 'success' | 'error' {
  if (!message) {
    return 'info';
  }
  if (message.includes('ไม่สำเร็จ') || message.includes('ยังไม่')) {
    return 'error';
  }
  if (message.includes('สำเร็จ')) {
    return 'success';
  }
  return 'info';
}

export default function WarehouseApproval() {
  const [requests, setRequests] = useState<WarehousePendingRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const summary = useMemo(() => {
    const totalRequests = requests.length;
    const totalPoints = requests.reduce((sum, item) => sum + Number(item.requested_points || 0), 0);
    return { totalRequests, totalPoints };
  }, [requests]);

  const loadPendingRequests = async (forceRefresh = false) => {
    if (!hasAccessToken()) {
      setMessage('ยังไม่พบโทเคนสำหรับเรียก API กรุณาเข้าสู่ระบบที่หน้าเลือกผู้ใช้งาน');
      return;
    }

    setIsLoading(true);
    try {
      const response = await warehouseApi.listPendingRewardRequests({ forceRefresh });
      setRequests(response.requests);
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

  useEffect(() => {
    void loadPendingRequests();
  }, []);

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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Warehouse Inbox"
        title="กล่องงานคลังที่จัดคำขอเป็นชุดตัดสินใจได้ง่ายขึ้น"
        description="บทบาทนี้ไม่ต้องเห็น workflow ทั้งระบบ แต่ต้องเห็นคำขอที่รออนุมัติพร้อมบริบทครบพอสำหรับตัดสินใจ จึงถูกออกแบบเป็น approval inbox ที่กดทำงานได้ทันที"
        actions={[
          {
            label: isLoading ? 'กำลังรีเฟรช...' : 'รีเฟรชข้อมูล',
            onClick: () => void loadPendingRequests(true),
          },
        ]}
      />

      {message ? <AlertBanner message={message} tone={inferMessageTone(message)} /> : null}

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="คำขอรอตรวจสอบ" value={summary.totalRequests.toLocaleString('th-TH')} detail="รายการในสถานะ requested ที่รอการตัดสินใจ" icon={PackageSearch} tone="amber" />
        <StatCard label="PMUC Coin รวมในคิว" value={summary.totalPoints.toLocaleString('th-TH')} detail="ภาระแต้มที่กำลังรอการอนุมัติจากคลัง" icon={ShieldCheck} tone="violet" />
        <StatCard label="สถานะระบบคลัง" value="พร้อมตรวจสอบ" detail="การอนุมัติและปฏิเสธจะส่งต่อสถานะให้ workflow ทันที" icon={CheckCircle2} tone="emerald" />
      </section>

      <SectionCard
        title="คำขอที่รอการตัดสินใจ"
        description="จัดแต่ละคำขอเป็นการ์ดเดียวพร้อมข้อมูลรางวัล จำนวนแต้ม และพื้นที่ระบุเหตุผลปฏิเสธ เพื่อให้ตรวจง่ายกว่าตารางแบบเดิม"
      >
        {requests.length === 0 ? (
          <EmptyState
            title="ยังไม่มีคำขอที่อยู่ในสถานะ requested"
            description="เมื่อมีคำขอรออนุมัติจากเกษตรกร ระบบจะนำเข้ากล่องงานนี้ให้โดยอัตโนมัติ"
            icon={PackageSearch}
          />
        ) : (
          <div className="space-y-4">
            {requests.map((item) => (
              <article key={item.id} className="rounded-[1.6rem] border border-line bg-surface-muted p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-stone-900">{item.reward_name_th ?? 'ไม่พบชื่อรางวัล'}</p>
                      <StatusBadge status={item.status} label={formatRewardRequestStatus(item.status)} size="sm" />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-stone-600">
                      {item.reward_description_th ?? 'ไม่มีรายละเอียดเพิ่มเติม'}
                    </p>
                    <p className="mt-2 text-sm text-stone-500">
                      ยื่นคำขอเมื่อ{' '}
                      {new Date(item.requested_at).toLocaleString('th-TH', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[22rem]">
                    <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-stone-700">
                      <p className="font-semibold text-stone-900">จำนวน / แต้ม</p>
                      <p className="mt-1">จำนวน {Number(item.quantity).toLocaleString('th-TH')} ชิ้น</p>
                      <p className="mt-1">ใช้ {Number(item.requested_points).toLocaleString('th-TH')} PMUC Coin</p>
                      <p className="mt-1 text-stone-500">
                        แต้มต่อชิ้น {Number(item.reward_points_cost ?? 0).toLocaleString('th-TH')}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-stone-700">
                      <p className="font-semibold text-stone-900">เหตุผลปฏิเสธ (ถ้ามี)</p>
                      <textarea
                        value={reasons[item.id] || ''}
                        onChange={(event) =>
                          setReasons((prev) => ({
                            ...prev,
                            [item.id]: event.target.value,
                          }))
                        }
                        placeholder="เช่น ของคงคลังไม่พอ หรือข้อมูลคำขอไม่ครบ"
                        className="mt-2 min-h-24 w-full rounded-2xl border border-line bg-surface-muted px-4 py-3 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleApprove(item.id)}
                    disabled={processingRequestId === item.id}
                    className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-800 disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{processingRequestId === item.id ? 'กำลังบันทึก...' : 'อนุมัติคำขอ'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleReject(item.id)}
                    disabled={processingRequestId === item.id}
                    className="inline-flex items-center gap-2 rounded-full border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 transition hover:bg-red-100 disabled:opacity-60"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>{processingRequestId === item.id ? 'กำลังบันทึก...' : 'ปฏิเสธคำขอ'}</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
