import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, PackageSearch, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import StatusBadge from '@/src/components/StatusBadge';
import { ApiError, warehouseApi, type WarehousePendingRequestItem } from '@/src/lib/apiClient';

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
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-on-surface">หน้าทำงานฝ่ายคลังสินค้า</h1>
          <p className="text-sm text-on-surface-variant mt-1">ตรวจสอบคำขอแลกรางวัล อนุมัติหรือปฏิเสธตามกติกา</p>
          {message && (
            <p className="text-sm text-on-surface-variant mt-2 bg-surface-container-high px-3 py-2 rounded-lg w-fit">
              {message}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => void loadPendingRequests(true)}
          disabled={isLoading}
          className="px-4 py-2 rounded-full bg-primary text-white text-sm font-semibold flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          รีเฟรชข้อมูล
        </button>
      </div>

      <section className="bg-white border border-outline-variant/20 rounded-xl p-4">
        <h2 className="text-base font-semibold">ลำดับงานในกระบวนการ</h2>
        <p className="text-sm text-on-surface-variant mt-1">Step 7 คลังสินค้าอนุมัติหรือปฏิเสธคำขอแลกรางวัล ก่อนเข้าสู่การส่งมอบรางวัล (Step 8)</p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant">คำขอรอตรวจสอบ</p>
          <p className="text-3xl font-semibold mt-2">{summary.totalRequests.toLocaleString('th-TH')}</p>
        </div>
        <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant">PMUC Coin รวมในคิว</p>
          <p className="text-3xl font-semibold mt-2">{summary.totalPoints.toLocaleString('th-TH')}</p>
        </div>
        <div className="bg-white border border-outline-variant/20 rounded-xl p-4">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant">สถานะระบบคลัง</p>
          <p className="text-lg font-medium mt-3 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            <StatusBadge status="ready" label="พร้อมตรวจสอบ" className="text-sm" />
          </p>
        </div>
      </div>

      <section className="bg-white rounded-xl border border-outline-variant/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-container-high">
          <h2 className="text-lg font-semibold">รายการรออนุมัติ</h2>
        </div>

        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/50">
                <th className="px-6 py-3 text-xs uppercase tracking-widest text-on-surface-variant">เวลา</th>
                <th className="px-6 py-3 text-xs uppercase tracking-widest text-on-surface-variant">ของที่ขอแลก</th>
                <th className="px-6 py-3 text-xs uppercase tracking-widest text-on-surface-variant">สถานะ</th>
                <th className="px-6 py-3 text-xs uppercase tracking-widest text-on-surface-variant">จำนวน</th>
                <th className="px-6 py-3 text-xs uppercase tracking-widest text-on-surface-variant">PMUC Coin</th>
                <th className="px-6 py-3 text-xs uppercase tracking-widest text-on-surface-variant">เหตุผลปฏิเสธ</th>
                <th className="px-6 py-3 text-xs uppercase tracking-widest text-on-surface-variant text-center">การตัดสินใจ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {isLoading && (
                <tr>
                  <td className="px-6 py-6 text-sm text-on-surface-variant" colSpan={7}>กำลังโหลดข้อมูล...</td>
                </tr>
              )}

              {!isLoading && requests.length === 0 && (
                <tr>
                  <td className="px-6 py-6 text-sm text-on-surface-variant" colSpan={7}>
                    <div className="flex items-center gap-2">
                      <PackageSearch className="w-4 h-4" />
                      <span>ยังไม่มีคำขอที่อยู่ในสถานะ requested</span>
                    </div>
                  </td>
                </tr>
              )}

              {requests.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 text-sm">
                    {new Date(item.requested_at).toLocaleString('th-TH', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <p className="font-medium">{item.reward_name_th ?? 'ไม่พบชื่อรางวัล'}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {item.reward_description_th ?? 'ไม่มีรายละเอียดเพิ่มเติม'}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      แต้มต่อชิ้น {Number(item.reward_points_cost ?? 0).toLocaleString('th-TH')}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <StatusBadge status={item.status} label={formatRewardRequestStatus(item.status)} />
                  </td>
                  <td className="px-6 py-4 text-sm">{Number(item.quantity).toLocaleString('th-TH')}</td>
                  <td className="px-6 py-4 text-sm">{Number(item.requested_points).toLocaleString('th-TH')}</td>
                  <td className="px-6 py-4 text-sm">
                    <input
                      type="text"
                      value={reasons[item.id] || ''}
                      onChange={(event) =>
                        setReasons((prev) => ({
                          ...prev,
                          [item.id]: event.target.value,
                        }))
                      }
                      placeholder="(ตัวเลือก) ระบุเหตุผลปฏิเสธ"
                      className="w-full bg-surface-container-high border-none rounded-lg p-2.5 text-on-surface outline-none"
                    />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleApprove(item.id)}
                        disabled={processingRequestId === item.id}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        อนุมัติ
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleReject(item.id)}
                        disabled={processingRequestId === item.id}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 hover:bg-red-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        ปฏิเสธ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
