'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { User, X } from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import { useFarmerProfile } from '@/app/_contexts/FarmerProfileContext';
import { ApiError, farmerApi } from '@/app/_lib/api';
import { THAI_PROVINCES } from '@/app/_lib/utils';

function inferMessageTone(msg: string): 'success' | 'error' | 'info' {
  if (msg.includes('สำเร็จ')) return 'success';
  if (msg.includes('ไม่สำเร็จ') || msg.includes('กรุณา') || msg.includes('ต้อง')) return 'error';
  return 'info';
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function FarmerProfileSheet({ open, onClose }: Props) {
  const reduceMotion = useReducedMotion();
  const { cachedProfile, setCachedProfile } = useFarmerProfile();

  const [profileForm, setProfileForm] = useState({ display_name: '', phone: '', province: '' });
  const [provinceSearch, setProvinceSearch] = useState('');
  const [provinceOpen, setProvinceOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadProfile = async () => {
    try {
      const res = await farmerApi.getProfile({ forceRefresh: !cachedProfile });
      setCachedProfile(res);
      setProfileForm({
        display_name: res.display_name ?? '',
        phone: res.phone ?? '',
        province: res.province ?? '',
      });
    } catch {
      // non-fatal
    }
  };

  useEffect(() => {
    if (!open) return;
    setMessage(null);
    if (cachedProfile) {
      setProfileForm({
        display_name: cachedProfile.display_name ?? '',
        phone: cachedProfile.phone ?? '',
        province: cachedProfile.province ?? '',
      });
    } else {
      void loadProfile();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSave = async () => {
    setMessage(null);
    if (!profileForm.display_name.trim()) { setMessage('กรุณาระบุชื่อผู้ใช้งาน'); return; }
    const digitsOnly = profileForm.phone.replace(/\D/g, '');
    if (digitsOnly.length !== 10) { setMessage('เบอร์โทรต้องมี 10 หลัก'); return; }
    if (!profileForm.province || !THAI_PROVINCES.includes(profileForm.province as typeof THAI_PROVINCES[number])) {
      setMessage('เลือกจังหวัดจากรายการ'); return;
    }
    setIsSaving(true);
    try {
      const res = await farmerApi.updateProfile({
        display_name: profileForm.display_name.trim() || null,
        phone: digitsOnly || null,
        province: profileForm.province.trim() || null,
      });
      setCachedProfile(res);
      setMessage('บันทึกข้อมูลสำเร็จแล้ว');
    } catch (error) {
      setMessage(error instanceof ApiError ? `บันทึกไม่สำเร็จ: ${error.message}` : 'บันทึกไม่สำเร็จ');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="profile-backdrop"
            className="fixed inset-0 z-40 bg-black/40"
            initial={reduceMotion ? {} : { opacity: 0 }}
            animate={reduceMotion ? {} : { opacity: 1 }}
            exit={reduceMotion ? {} : { opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="profile-sheet"
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl"
            initial={reduceMotion ? {} : { y: '100%' }}
            animate={reduceMotion ? {} : { y: 0 }}
            exit={reduceMotion ? {} : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-100 bg-white px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-base font-bold text-stone-900">ข้อมูลส่วนตัว</p>
                  <p className="text-xs text-stone-400">แก้ไขได้ทุกเมื่อ</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-stone-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <div className="space-y-5 px-5 pb-8 pt-5">
              {message && (
                <AlertBanner message={message} tone={inferMessageTone(message)} />
              )}

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-stone-700">ชื่อผู้ใช้งาน <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={profileForm.display_name}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, display_name: e.target.value }))}
                  placeholder="เช่น นายสมชาย ใจดี"
                  className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3.5 text-base text-stone-900 outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-stone-700">เบอร์โทร <span className="text-rose-500">*</span></label>
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="เช่น 08xxxxxxxx"
                  className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3.5 text-base text-stone-900 outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
                />
                <p className="text-xs text-stone-400">10 หลัก ไม่ต้องใส่ขีด</p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-stone-700">จังหวัด <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <input
                    type="text"
                    value={provinceSearch !== '' ? provinceSearch : profileForm.province}
                    onChange={(e) => {
                      setProvinceSearch(e.target.value);
                      setProvinceOpen(true);
                      setProfileForm((prev) => ({ ...prev, province: '' }));
                    }}
                    onFocus={() => { setProvinceSearch(profileForm.province); setProvinceOpen(true); }}
                    onBlur={() => setTimeout(() => setProvinceOpen(false), 150)}
                    placeholder="พิมพ์เพื่อค้นหาจังหวัด"
                    className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3.5 text-base text-stone-900 outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
                  />
                  {provinceOpen && (
                    <ul className="absolute z-50 bottom-full mb-1 max-h-52 w-full overflow-y-auto rounded-2xl border border-stone-200 bg-white shadow-lg">
                      {THAI_PROVINCES.filter((p) => !provinceSearch || p.includes(provinceSearch)).map((p) => (
                        <li
                          key={p}
                          onMouseDown={() => {
                            setProfileForm((prev) => ({ ...prev, province: p }));
                            setProvinceSearch('');
                            setProvinceOpen(false);
                          }}
                          className="cursor-pointer px-4 py-3 text-base hover:bg-emerald-50 hover:text-emerald-900"
                        >
                          {p}
                        </li>
                      ))}
                      {THAI_PROVINCES.filter((p) => !provinceSearch || p.includes(provinceSearch)).length === 0 && (
                        <li className="px-4 py-3 text-base text-stone-400">ไม่พบจังหวัด</li>
                      )}
                    </ul>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="flex w-full min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-white shadow-md shadow-primary/20 transition hover:opacity-90 disabled:opacity-50"
              >
                {isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
