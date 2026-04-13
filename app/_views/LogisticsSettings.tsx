'use client';

import React, { useEffect, useState } from 'react';
import { ExternalLink, MapPin, MapPinned, RefreshCw, Save, Truck, X } from 'lucide-react';
import { motion } from 'motion/react';
import AlertBanner from '@/app/_components/AlertBanner';
import ErrorBoundary from '@/app/_components/ErrorBoundary';
import dynamic from 'next/dynamic';
const PickupLocationMapPicker = dynamic(() => import('@/app/_components/PickupLocationMapPicker'), { ssr: false });
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
      setMessage('ยังไม่พบโทเคน AREX_ACCESS_TOKEN กรุณาเข้าสู่ระบบ');
      return;
    }
    setIsLoading(true);
    try {
      const res = await logisticsApi.getMyInfo({ forceRefresh });
      setForm({
        name_th: res.name_th ?? '',
        location_text: res.location_text ?? '',
        lat: typeof res.lat === 'number' ? res.lat : null,
        lng: typeof res.lng === 'number' ? res.lng : null,
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
      setMessage('กรุณาเลือกพิกัดให้ครบทั้งคู่ หรือไม่เลือกทั้งคู่');
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

  const hasCoords = form.lat !== null && form.lng !== null;

  return (
    <ErrorBoundary>
      <div className="space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">ขนส่ง</p>
            <h1 className="mt-0.5 text-4xl font-light tracking-tight text-on-surface">ตั้งค่าทีมขนส่ง</h1>
            <p className="mt-1 text-sm text-on-surface-variant">ชื่อ ที่อยู่ และพิกัดที่ระบบใช้วางแผนเส้นทาง</p>
          </div>
          <button
            type="button"
            onClick={() => void loadInfo(true)}
            disabled={isLoading}
            aria-label="รีเฟรช"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition hover:bg-stone-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {message && <AlertBanner message={message} tone={inferMessageTone(message)} />}

        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
        >
          {/* Card header */}
          <div className="flex items-center gap-3 border-b border-stone-100 px-6 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100">
              <Truck className="h-4 w-4 text-sky-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-800">ข้อมูลทีมขนส่ง</p>
              <p className="text-xs text-stone-400">แสดงในระบบและแผนที่วางแผนเส้นทาง</p>
            </div>
          </div>

          <div className="grid gap-0 xl:grid-cols-2">
            {/* Left: fields */}
            <div className="space-y-5 p-6">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                  ชื่อทีมขนส่ง
                </label>
                <input
                  type="text"
                  value={form.name_th}
                  onChange={(e) => setForm((p) => ({ ...p, name_th: e.target.value }))}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
                  placeholder="เช่น ทีมขนส่ง AREX ภาคเหนือ"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                  ที่อยู่
                </label>
                <input
                  type="text"
                  value={form.location_text}
                  onChange={(e) => setForm((p) => ({ ...p, location_text: e.target.value }))}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
                  placeholder="เช่น อ.เมือง จ.เชียงใหม่"
                />
              </div>

              {/* Coordinate display */}
              <div className="rounded-xl border border-stone-100 bg-stone-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-stone-400" />
                  {hasCoords ? (
                    <span className="font-mono text-xs text-stone-600">
                      {form.lat?.toFixed(5)}, {form.lng?.toFixed(5)}
                    </span>
                  ) : (
                    <span className="text-xs text-stone-400">ยังไม่ได้ปักหมุดบนแผนที่</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={isSaving}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                </button>

                {hasCoords && (
                  <>
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, lat: null, lng: null }))}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-600 transition hover:bg-stone-50"
                    >
                      <X className="h-4 w-4" />
                      ล้างพิกัด
                    </button>
                    <a
                      href={`https://www.google.com/maps?q=${form.lat},${form.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-600 transition hover:bg-stone-50"
                    >
                      <ExternalLink className="h-4 w-4" />
                      เปิด Google Maps
                    </a>
                  </>
                )}
              </div>
            </div>

            {/* Right: map */}
            <div className="border-t border-stone-100 p-6 xl:border-l xl:border-t-0">
              <div className="mb-3 flex items-center gap-2">
                <MapPinned className="h-4 w-4 text-stone-400" />
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                  ตำแหน่งบนแผนที่
                </p>
              </div>
              <p className="mb-4 text-xs text-stone-500">
                คลิกบนแผนที่เพื่อปักหมุด — ระบบจะดึงที่อยู่มากรอกให้อัตโนมัติ
              </p>
              <PickupLocationMapPicker
                lat={form.lat}
                lng={form.lng}
                onChange={({ lat, lng }) => setForm((p) => ({ ...p, lat, lng }))}
                onAddressResolved={(address) => setForm((p) => ({ ...p, location_text: address }))}
                mapHeightClassName="h-[260px] w-full overflow-hidden rounded-xl sm:h-[320px]"
              />
            </div>
          </div>
        </motion.div>

      </div>
    </ErrorBoundary>
  );
}
