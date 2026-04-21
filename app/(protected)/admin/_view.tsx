'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CheckCircle2, MapPin, Phone, RefreshCw, Users, XCircle } from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import ConfirmDialog from '@/app/_components/ConfirmDialog';
import EmptyState from '@/app/_components/EmptyState';
import ErrorBoundary from '@/app/_components/ErrorBoundary';
import { SkeletonCard } from '@/app/_components/Skeleton';
import { adminApi, ApiError, hasAccessToken, type AdminProfile } from '@/app/_lib/api';
import { roleMeta } from '@/app/_lib/roleConfig';

/* ── Toast ── */
interface ToastInfo { name: string; status: 'active' | 'inactive'; tone: 'success' | 'error'; errMsg?: string; id: number }

function Toast({ toast, onDone }: { toast: ToastInfo; onDone: () => void }) {
  const prefersReduced = useReducedMotion();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    timerRef.current = setTimeout(() => onDoneRef.current(), 3000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const success = toast.tone === 'success';
  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      className={`fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border px-5 py-3.5 shadow-lg backdrop-blur-sm ${
        success ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
      }`}
    >
      {success ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
      ) : (
        <XCircle className="h-5 w-5 shrink-0 text-red-400" />
      )}
      <div className="text-sm">
        {success ? (
          <>
            <span className="font-semibold text-stone-800">{toast.name}</span>
            <span className={`ml-2 font-medium ${toast.status === 'active' ? 'text-emerald-600' : 'text-amber-600'}`}>
              {toast.status === 'active' ? 'เปิดใช้งานแล้ว' : 'ปิดใช้งานแล้ว'}
            </span>
          </>
        ) : (
          <span className="text-red-700">{toast.errMsg ?? 'เกิดข้อผิดพลาด'}</span>
        )}
      </div>
    </motion.div>
  );
}

const APPROVABLE_ROLES = ['farmer', 'logistics', 'factory'] as const;
type ApprovableRole = typeof APPROVABLE_ROLES[number];


function roleLabel(role: string): string {
  const meta = roleMeta[role as keyof typeof roleMeta];
  return meta ? meta.label : role;
}

function roleAccent(role: string): string {
  const meta = roleMeta[role as keyof typeof roleMeta];
  return meta ? meta.accentClassName : 'text-stone-700 bg-stone-100 border-stone-200';
}

/* ── AccountCard ── */
function AccountCard({
  item,
  onToggle,
  busy,
}: {
  item: AdminProfile;
  onToggle: (id: string) => void;
  busy: boolean;
}) {
  const prefersReduced = useReducedMotion();
  const [confirm, setConfirm] = useState(false);
  const active = item.approval_status === 'active';

  return (
    <>
      <motion.div
        initial={prefersReduced ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white shadow-sm px-3 py-2.5"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-semibold text-stone-800 text-sm truncate min-w-0">{item.display_name}</span>
            <span className={`shrink-0 inline-flex items-center rounded-full border px-1.5 py-px text-[0.6rem] font-semibold ${roleAccent(item.role)}`}>
              {roleLabel(item.role)}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-xs text-stone-400">
            <span className="truncate text-stone-500">{item.email ?? '-'}</span>
            <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{item.phone || '-'}</span>
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{item.province || '-'}</span>
          </div>
        </div>

        {/* Toggle switch */}
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirm(true)}
          aria-label={active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
          className="shrink-0 disabled:opacity-50"
        >
          <div className={`relative h-7 w-12 rounded-full transition-colors duration-200 ${active ? 'bg-emerald-500' : 'bg-stone-300'}`}>
            <div className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${active ? 'translate-x-6' : 'translate-x-1'}`} />
          </div>
        </button>
      </motion.div>

      <ConfirmDialog
        open={confirm}
        title={active ? 'ปิดใช้งานบัญชี?' : 'เปิดใช้งานบัญชี?'}
        message=""
        fields={[
          { label: 'ชื่อ', value: item.display_name },
          { label: 'อีเมล', value: item.email ?? '-' },
          { label: 'บทบาท', value: roleLabel(item.role) },
          { label: 'สถานะใหม่', value: active ? 'ปิดใช้งาน' : 'เปิดใช้งาน' },
        ]}
        confirmLabel={active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
        confirmVariant={active ? 'danger' : 'primary'}
        onConfirm={() => { setConfirm(false); onToggle(item.id); }}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}

/* ── Main View ── */
type RoleFilter = ApprovableRole | 'all';
type StatusFilter = 'all' | 'active' | 'inactive';

export default function AdminDashboard() {
  const [accounts, setAccounts] = useState<AdminProfile[]>([]);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastInfo | null>(null);
  const toastId = useRef(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async (force = false) => {
    if (!hasAccessToken()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listAllAccounts(force ? { forceRefresh: true } : undefined);
      setAccounts(res.accounts ?? []);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleToggle = async (id: string) => {
    setBusyId(id);
    const account = accounts.find((a) => a.id === id);
    try {
      const res = await adminApi.toggleAccount(id);
      setToast({ name: account?.display_name ?? '', status: res.account.approval_status, tone: 'success', id: ++toastId.current });
      await load(true);
    } catch (e) {
      setToast({ name: account?.display_name ?? '', status: 'inactive', tone: 'error', errMsg: e instanceof ApiError ? e.message : 'เกิดข้อผิดพลาด', id: ++toastId.current });
    } finally {
      setBusyId(null);
    }
  };

  const filtered = accounts.filter((a) => {
    if (roleFilter !== 'all' && a.role !== roleFilter) return false;
    if (statusFilter !== 'all' && a.approval_status !== statusFilter) return false;
    return true;
  });
  const activeCount = accounts.filter((a) => a.approval_status === 'active').length;
  const inactiveCount = accounts.filter((a) => a.approval_status === 'inactive').length;

  return (
    <ErrorBoundary>
      <div className="flex flex-col gap-4 pb-6">
        {error && <AlertBanner tone="error" message={error} />}

        {/* Stats + refresh */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 border border-emerald-100">
            เปิดใช้งาน {activeCount} บัญชี
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 border border-amber-100">
            ปิดใช้งาน {inactiveCount} บัญชี
          </div>
          <button
            type="button"
            onClick={() => load(true)}
            className="ml-auto flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-500 hover:bg-stone-50 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />รีเฟรช
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {/* Role filter */}
          <div className="flex rounded-lg bg-stone-100 p-0.5 gap-0.5">
            {(['all', ...APPROVABLE_ROLES] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  roleFilter === r ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                {r === 'all' ? 'ทุกบทบาท' : roleLabel(r)}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex rounded-lg bg-stone-100 p-0.5 gap-0.5">
            {(['all', 'active', 'inactive'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  statusFilter === s ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                {s === 'all' ? 'ทุกสถานะ' : s === 'active' ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="ไม่พบบัญชีผู้ใช้"
            description="ไม่มีบัญชีที่ตรงกับตัวกรองที่เลือก"
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((a) => (
              <AccountCard
                key={a.id}
                item={a}
                onToggle={handleToggle}
                busy={busyId === a.id}
              />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {toast && <Toast key={toast.id} toast={toast} onDone={() => setToast(null)} />}
      </AnimatePresence>
    </ErrorBoundary>
  );
}
