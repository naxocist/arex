'use client';

import React, { useEffect, useState } from 'react';
import { MapPinned, RefreshCw, Save } from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import ErrorBoundary from '@/app/_components/ErrorBoundary';
import dynamic from 'next/dynamic';
const PickupLocationMapPicker = dynamic(() => import('@/app/_components/PickupLocationMapPicker'), { ssr: false });
import SectionCard from '@/app/_components/SectionCard';
import { ApiError, logisticsApi } from '@/app/_lib/apiClient';

function hasAccessToken(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem('AREX_ACCESS_TOKEN'));
}

function inferMessageTone(message: string | null): 'info' | 'success' | 'error' {
  if (!message) return 'info';
  if (message.includes('ไม่สำเร็จ') || message.includes('กรุณา') || message.includes('ยังไม่')) return 'error';
  if (message.includes('สำเร็จ')) return 'success';
  return 'info';
}

export default function LogisticsSettings() {
  const [form, setForm] = useState({
    name_th: '',
    location_text: '',
    lat: null as number | null,
    lng: null as number | null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadInfo = async (forceRefresh = false) => {
    if (!hasAccessToken()) {
      setMessage('ยังไม่พบโทเคน AREX_ACCESS_TOKEN กรุณาเข้าสู่ระบบที่หน้าเลือกผู้ใช้งาน');
      return;
    }
    setIsLoading(true);
    try {
      const response = await logisticsApi.getMyInfo({ forceRefresh });
      setForm({
        name_th: response.name_th ?? '',
        location_text: response.location_text ?? '',
        lat: typeof response.lat === 'number' ? response.lat : null,
        lng: typeof response.lng === 'number' ? response.lng : null,
      });
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof ApiError ? `โหลดข้อมูลไม่สำเร็จ: ${error.message}` : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadInfo(); }, []);

  const handleSave = async () => {
    const name = form.name_th.trim();
    if (!name) { setMessage('กรุณาระบุชื่อทีมขนส่ง'); return; }
    if ((form.lat === null) !== (form.lng === null)) {
      setMessage('กรุณาเลือกพิกัดจากแผนที่ให้ครบทั้งคู่ หรือไม่เลือกทั้งคู่');
      return;
    }
    setIsSaving(true);
    setMessage(null);
    try {
      const updated = await logisticsApi.updateMyInfo({
        name_th: name,
        location_text: form.location_text.trim() || null,
        lat: form.lat,
        lng: form.lng,
      });
      setForm({
        name_th: updated.name_th ?? '',
        location_text: updated.location_text ?? '',
        lat: typeof updated.lat === 'number' ? updated.lat : null,
        lng: typeof updated.lng === 'number' ? updated.lng : null,
      });
      setMessage('บันทึกข้อมูลทีมขนส่งสำเร็จแล้ว');
    } catch (error) {
      setMessage(error instanceof ApiError ? `บันทึกไม่สำเร็จ: ${error.message}` : 'บันทึกไม่สำเร็จ');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ErrorBoundary>
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-light tracking-tight text-on-surface">ตั้งค่าทีมขนส่ง</h1>
          <p className="mt-1 text-on-surface-variant">จัดการข้อมูลทีมและยานพาหนะขนส่ง</p>
        </div>
        <button
          type="button"
          onClick={() => void loadInfo(true)}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'กำลังรีเฟรช...' : 'รีเฟรชข้อมูล'}
        </button>
      </div>

      {message ? <AlertBanner message={message} tone={inferMessageTone(message)} /> : null}

      <SectionCard
        title="ข้อมูลทีมขนส่ง"
        description="ระบุชื่อและที่ตั้งของทีมขนส่ง เพื่อใช้ในการวางแผนและแสดงในระบบ"
      >
        <div className="grid gap-6 xl:grid-cols-[0.88fr,1.12fr]">
          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-stone-700">ชื่อทีมขนส่ง</span>
              <input
                type="text"
                value={form.name_th}
                onChange={(e) => setForm((prev) => ({ ...prev, name_th: e.target.value }))}
                className="w-full rounded-xl border-none bg-surface-container-high px-4 py-3.5 text-base outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="เช่น ทีมขนส่งภาคเหนือ"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-stone-700">ที่อยู่ (ข้อความ)</span>
              <input
                type="text"
                value={form.location_text}
                onChange={(e) => setForm((prev) => ({ ...prev, location_text: e.target.value }))}
                className="w-full rounded-xl border-none bg-surface-container-high px-4 py-3.5 text-base outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="เช่น อ.เมือง จ.เชียงใหม่"
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
              </button>
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, lat: null, lng: null }))}
                className="rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-surface-muted"
              >
                ล้างพิกัด
              </button>
              {form.lat !== null && form.lng !== null ? (
                <a
                  href={`https://www.google.com/maps?q=${form.lat},${form.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-surface-muted"
                >
                  <MapPinned className="h-4 w-4" />
                  เปิดแผนที่ตำแหน่ง
                </a>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-[1.6rem] border border-line bg-surface-muted p-4">
              <p className="text-sm font-semibold text-stone-900">ตำแหน่งทีมขนส่งบนแผนที่</p>
              <p className="mt-1 text-sm leading-6 text-stone-600">
                คลิกบนแผนที่เพื่อปักหมุดใหม่ หรือใช้ตำแหน่งปัจจุบันเพื่อดึงที่อยู่มาช่วยกรอกอัตโนมัติ
              </p>
              <div className="mt-4">
                <PickupLocationMapPicker
                  lat={form.lat}
                  lng={form.lng}
                  onChange={({ lat, lng }) => setForm((prev) => ({ ...prev, lat, lng }))}
                  onAddressResolved={(address) => setForm((prev) => ({ ...prev, location_text: address }))}
                  mapHeightClassName="h-[280px] w-full overflow-hidden rounded-[1.5rem] sm:h-[340px]"
                />
              </div>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
    </ErrorBoundary>
  );
}
