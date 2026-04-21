'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Building2, CheckCircle2, ExternalLink, MapPin, MapPinned, RefreshCw, Save, X, XCircle } from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import ErrorBoundary from '@/app/_components/ErrorBoundary';
import dynamic from 'next/dynamic';
const PickupLocationMapPicker = dynamic(() => import('@/app/_components/PickupLocationMapPicker'), { ssr: false });
import { ApiError, hasAccessToken, factoryApi } from '@/app/_lib/api';

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

export default function FactorySettings() {
  const [form, setForm] = useState({
    name_th: '',
    location_text: '',
    lat: null as number | null,
    lng: null as number | null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string; id: number } | null>(null);
  const toastId = useRef(0);

  const loadFactory = async (forceRefresh = false) => {
    if (!hasAccessToken()) {
      setError('ยังไม่พบโทเคน AREX_ACCESS_TOKEN กรุณาเข้าสู่ระบบ');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await factoryApi.getMyFactory({ forceRefresh });
      setForm({
        name_th: res.name_th ?? '',
        location_text: res.location_text ?? '',
        lat: typeof res.lat === 'number' ? res.lat : null,
        lng: typeof res.lng === 'number' ? res.lng : null,
      });
    } catch (err) {
      setError(err instanceof ApiError ? `โหลดข้อมูลโรงงานไม่สำเร็จ: ${err.message}` : 'โหลดข้อมูลโรงงานไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadFactory(); }, []);

  const handleSave = async () => {
    const name = form.name_th.trim();
    if (!name) { setToast({ tone: 'error', message: 'กรุณาระบุชื่อโรงงาน', id: ++toastId.current }); return; }
    if ((form.lat === null) !== (form.lng === null)) {
      setToast({ tone: 'error', message: 'กรุณาเลือกพิกัดให้ครบทั้งคู่ หรือไม่เลือกทั้งคู่', id: ++toastId.current });
      return;
    }
    setIsSaving(true);
    try {
      const updated = await factoryApi.updateMyFactory({
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
      setToast({ tone: 'success', message: 'บันทึกข้อมูลโรงงานสำเร็จแล้ว', id: ++toastId.current });
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof ApiError ? `บันทึกไม่สำเร็จ: ${err.message}` : 'บันทึกไม่สำเร็จ', id: ++toastId.current });
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
            <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">โรงงาน</p>
            <h1 className="mt-0.5 text-4xl font-light tracking-tight text-on-surface">ตั้งค่าโรงงาน</h1>
            <p className="mt-1 text-sm text-on-surface-variant">ชื่อ ที่อยู่ และพิกัดที่ระบบขนส่งใช้นำทาง</p>
          </div>
          <button
            type="button"
            onClick={() => void loadFactory(true)}
            disabled={isLoading}
            aria-label="รีเฟรช"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition hover:bg-stone-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && <AlertBanner message={error} tone="error" />}

        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
        >
          {/* Card header */}
          <div className="flex items-center gap-3 border-b border-stone-100 px-6 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100">
              <Building2 className="h-4 w-4 text-emerald-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-800">ข้อมูลโรงงาน</p>
              <p className="text-xs text-stone-400">แสดงในระบบขนส่งและแผนที่นำทาง</p>
            </div>
          </div>

          <div className="grid gap-0 xl:grid-cols-2">
            {/* Left: fields */}
            <div className="space-y-5 p-6">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                  ชื่อโรงงาน
                </label>
                <input
                  type="text"
                  value={form.name_th}
                  onChange={(e) => setForm((p) => ({ ...p, name_th: e.target.value }))}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
                  placeholder="เช่น โรงงานแปรรูปชีวมวล AREX สระบุรี"
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
                  placeholder="เช่น อ.เมือง จ.สระบุรี"
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

      <AnimatePresence>
        {toast && <Toast key={toast.id} tone={toast.tone} message={toast.message} onDone={() => setToast(null)} />}
      </AnimatePresence>
    </ErrorBoundary>
  );
}
