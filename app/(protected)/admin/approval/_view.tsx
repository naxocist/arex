'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Save, ShieldCheck, XCircle } from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import ErrorBoundary from '@/app/_components/ErrorBoundary';
import { adminApi, ApiError, hasAccessToken } from '@/app/_lib/api';
import { roleMeta } from '@/app/_lib/roleConfig';

const APPROVABLE_ROLES = ['farmer', 'logistics', 'factory'] as const;

/* ── Toast ── */
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
      className={`fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border px-5 py-3.5 shadow-lg backdrop-blur-sm ${
        success ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
      }`}
    >
      {success
        ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
        : <XCircle className="h-5 w-5 shrink-0 text-red-400" />}
      <span className={`text-sm font-medium ${success ? 'text-emerald-700' : 'text-red-700'}`}>{message}</span>
    </motion.div>
  );
}

export default function AdminSettingsView() {
  const [required, setRequired] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string; id: number } | null>(null);
  const toastId = useRef(0);

  const load = async () => {
    if (!hasAccessToken()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getSettings({ forceRefresh: true });
      setRequired(res.settings.approval_required_roles ?? []);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggle = (role: string) => {
    setRequired((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await adminApi.updateSettings(required);
      setToast({ tone: 'success', message: 'บันทึกการตั้งค่าสำเร็จ', id: ++toastId.current });
    } catch (e) {
      setToast({ tone: 'error', message: e instanceof ApiError ? e.message : 'บันทึกไม่สำเร็จ', id: ++toastId.current });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ErrorBoundary>
      <div className="flex flex-col gap-4 pb-6">
        {error && <AlertBanner tone="error" message={error} />}

        <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-stone-100 px-4 py-3">
            <ShieldCheck className="h-4 w-4 text-violet-500" />
            <span className="font-semibold text-stone-800 text-sm">บทบาทที่ต้องรอเปิดใช้งานเมื่อสมัครใหม่</span>
          </div>
          {loading ? (
            <div className="px-4 py-6 text-sm text-stone-400">กำลังโหลด...</div>
          ) : (
            <div className="divide-y divide-stone-100">
              {APPROVABLE_ROLES.map((role) => {
                const meta = roleMeta[role];
                const checked = required.includes(role);
                return (
                  <label key={role} className="flex cursor-pointer items-center gap-4 px-4 py-3.5 hover:bg-stone-50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-stone-800">{meta.label}</p>
                      <p className="text-xs text-stone-400">{meta.description}</p>
                    </div>
                    <div className="relative">
                      <input type="checkbox" checked={checked} onChange={() => toggle(role)} className="sr-only" />
                      <div className={`h-6 w-11 rounded-full transition-colors duration-200 ${checked ? 'bg-violet-500' : 'bg-stone-200'}`} />
                      <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-xs text-stone-400 px-1">
          บทบาทที่เปิดสวิตช์ไว้จะถูกสร้างบัญชีในสถานะ "ปิดใช้งาน" และต้องให้ผู้ดูแลระบบเปิดใช้งานก่อนจึงจะเข้าได้
        </p>

        <button
          type="button"
          disabled={loading || saving}
          onClick={save}
          className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          <Save className="h-4 w-4" />
          {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
        </button>
      </div>

      <AnimatePresence>
        {toast && <Toast key={toast.id} tone={toast.tone} message={toast.message} onDone={() => setToast(null)} />}
      </AnimatePresence>
    </ErrorBoundary>
  );
}
