import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import PickupLocationMapPicker from '@/src/components/PickupLocationMapPicker';
import { ApiError, factoryApi } from '@/src/lib/apiClient';

function hasAccessToken(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return Boolean(localStorage.getItem('AREX_ACCESS_TOKEN'));
}

export default function FactorySettings() {
  const [factoryForm, setFactoryForm] = useState({
    name_th: '',
    location_text: '',
    lat: null as number | null,
    lng: null as number | null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadFactory = async (forceRefresh = false) => {
    if (!hasAccessToken()) {
      setMessage('ยังไม่พบโทเคน AREX_ACCESS_TOKEN กรุณาเข้าสู่ระบบที่หน้าเลือกผู้ใช้งาน');
      return;
    }

    setIsLoading(true);
    try {
      const response = await factoryApi.getMyFactory({ forceRefresh });
      setFactoryForm({
        name_th: response.name_th ?? '',
        location_text: response.location_text ?? '',
        lat: typeof response.lat === 'number' ? response.lat : null,
        lng: typeof response.lng === 'number' ? response.lng : null,
      });
      setMessage(null);
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(`โหลดข้อมูลโรงงานไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('โหลดข้อมูลโรงงานไม่สำเร็จ');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadFactory();
  }, []);

  const handleSave = async () => {
    const name = factoryForm.name_th.trim();
    if (!name) {
      setMessage('กรุณาระบุชื่อโรงงาน');
      return;
    }

    if ((factoryForm.lat === null) !== (factoryForm.lng === null)) {
      setMessage('กรุณาเลือกพิกัดจากแผนที่ให้ครบทั้งคู่ หรือไม่เลือกทั้งคู่');
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      const updated = await factoryApi.updateMyFactory({
        name_th: name,
        location_text: factoryForm.location_text.trim() || null,
        lat: factoryForm.lat,
        lng: factoryForm.lng,
      });

      setFactoryForm({
        name_th: updated.name_th ?? '',
        location_text: updated.location_text ?? '',
        lat: typeof updated.lat === 'number' ? updated.lat : null,
        lng: typeof updated.lng === 'number' ? updated.lng : null,
      });
      setMessage('บันทึกข้อมูลโรงงานสำเร็จแล้ว');
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(`บันทึกข้อมูลโรงงานไม่สำเร็จ: ${error.message}`);
      } else {
        setMessage('บันทึกข้อมูลโรงงานไม่สำเร็จ');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-stone-200 bg-gradient-to-r from-stone-50 to-sky-50/60 p-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-stone-900">ตั้งค่าข้อมูลโรงงาน</h1>
          <p className="text-sm text-stone-600 mt-1">แก้ไขชื่อโรงงาน ที่อยู่ และตำแหน่งพิกัดของบัญชีโรงงานนี้</p>
          {message && <p className="text-sm text-stone-700 mt-2 bg-white border border-stone-200 px-3 py-2 rounded-lg w-fit">{message}</p>}
        </div>
        <button
          type="button"
          onClick={() => void loadFactory(true)}
          disabled={isLoading}
          className="px-4 py-2 rounded-full bg-stone-900 text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> รีเฟรชข้อมูล
        </button>
      </section>

      <section className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-stone-600">ชื่อโรงงาน</span>
            <input
              type="text"
              value={factoryForm.name_th}
              onChange={(event) => setFactoryForm((prev) => ({ ...prev, name_th: event.target.value }))}
              className="rounded-lg border border-stone-300 px-3 py-2 outline-none focus:border-stone-500"
              placeholder="เช่น โรงงานแปรรูปชีวมวลลำพูน"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="text-stone-600">ที่อยู่ (ข้อความ)</span>
            <input
              type="text"
              value={factoryForm.location_text}
              onChange={(event) => setFactoryForm((prev) => ({ ...prev, location_text: event.target.value }))}
              className="rounded-lg border border-stone-300 px-3 py-2 outline-none focus:border-stone-500"
              placeholder="เช่น อ.เมือง จ.ลำพูน"
            />
          </label>

          <div className="md:col-span-2 rounded-xl border border-stone-200 p-3 space-y-3">
            <p className="text-sm text-stone-700">เลือกพิกัดโรงงานจากแผนที่ OpenStreetMap</p>
            <PickupLocationMapPicker
              lat={factoryForm.lat}
              lng={factoryForm.lng}
              onChange={({ lat, lng }) => setFactoryForm((prev) => ({ ...prev, lat, lng }))}
              onAddressResolved={(address) => {
                setFactoryForm((prev) => ({
                  ...prev,
                  location_text: address,
                }));
              }}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-600">
              <div className="rounded-lg bg-stone-50 border border-stone-200 px-3 py-2">
                Latitude: {typeof factoryForm.lat === 'number' ? factoryForm.lat.toFixed(6) : '-'}
              </div>
              <div className="rounded-lg bg-stone-50 border border-stone-200 px-3 py-2">
                Longitude: {typeof factoryForm.lng === 'number' ? factoryForm.lng.toFixed(6) : '-'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFactoryForm((prev) => ({ ...prev, lat: null, lng: null }))}
              className="px-3 py-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs"
            >
              ล้างพิกัดที่เลือก
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="px-4 py-2 rounded-full bg-stone-900 text-white text-sm font-semibold disabled:opacity-60"
          >
            {isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูลโรงงาน'}
          </button>
          {factoryForm.lat !== null && factoryForm.lng !== null && (
            <a
              href={`https://www.openstreetmap.org/?mlat=${factoryForm.lat}&mlon=${factoryForm.lng}#map=15/${factoryForm.lat}/${factoryForm.lng}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-sky-700 hover:text-sky-800 underline"
            >
              เปิดแผนที่ตำแหน่งโรงงาน
            </a>
          )}
        </div>
      </section>
    </div>
  );
}
