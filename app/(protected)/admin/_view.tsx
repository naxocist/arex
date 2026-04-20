'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  MapPin,
  Phone,
  RefreshCw,
  User,
  UserCheck,
  UserX,
  X,
  XCircle,
} from 'lucide-react';
import AlertBanner from '@/app/_components/AlertBanner';
import EmptyState from '@/app/_components/EmptyState';
import ErrorBoundary from '@/app/_components/ErrorBoundary';
import { SkeletonCard } from '@/app/_components/Skeleton';
import { adminApi, ApiError, hasAccessToken, type AdminProfile } from '@/app/_lib/api';
import { roleMeta } from '@/app/_lib/roleConfig';

/* ── helpers ── */
function formatDate(dt: string): string {
  return new Date(dt).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' });
}

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
  onApprove,
  onReject,
  busy,
}: {
  item: AdminProfile;
  onApprove: (id: string) => void;
  onReject: (id: string, note: string) => void;
  busy: boolean;
}) {
  const prefersReduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm"
    >
      {/* Card header — always visible */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        {/* Row 1: name + role badge */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-stone-800 truncate min-w-0">{item.display_name}</span>
            <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold ${roleAccent(item.role)}`}>
              {roleLabel(item.role)}
            </span>
          </div>
          {/* Row 2: email */}
          <div className="mt-0.5 text-xs text-stone-500 truncate">{item.email}</div>
          {/* Row 3: phone + province + date */}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0 text-xs text-stone-400">
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {item.phone || '-'}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {item.province || '-'}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              สมัคร {formatDate(item.created_at)}
            </span>
          </div>
        </div>
        <ChevronDown
          className={`mt-1 h-4 w-4 shrink-0 text-stone-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Expanded: action buttons */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: prefersReduced ? 0 : 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-stone-100 px-4 pb-4 pt-3 space-y-3">
              {!showRejectForm ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onApprove(item.id)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    <Check className="h-4 w-4" />
                    อนุมัติ
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setShowRejectForm(true)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
                  >
                    <X className="h-4 w-4" />
                    ปฏิเสธ
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    placeholder="เหตุผลในการปฏิเสธ (ไม่บังคับ)"
                    rows={2}
                    className="w-full resize-none rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-300"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onReject(item.id, rejectNote)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      <UserX className="h-4 w-4" />
                      ยืนยันปฏิเสธ
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowRejectForm(false); setRejectNote(''); }}
                      className="rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-600 hover:bg-stone-50"
                    >
                      ยกเลิก
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── AnsweredCard ── */
function AnsweredCard({ item }: { item: AdminProfile }) {
  const prefersReduced = useReducedMotion();
  const approved = item.approval_status === 'approved';

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {approved ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
        ) : (
          <XCircle className="h-4 w-4 shrink-0 text-red-400" />
        )}
        <span className="font-semibold text-stone-800 truncate">{item.display_name}</span>
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold ${roleAccent(item.role)}`}>
          {roleLabel(item.role)}
        </span>
        <span className={`text-xs font-medium ${approved ? 'text-emerald-600' : 'text-red-500'}`}>
          {approved ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว'}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0 text-xs text-stone-400">
        <span>{item.email}</span>
        {item.approval_note && (
          <span className="text-stone-500">เหตุผล: {item.approval_note}</span>
        )}
      </div>
    </div>
  );
}

/* ── Main View ── */
export default function AdminDashboard() {
  const [pending, setPending] = useState<AdminProfile[]>([]);
  const [answered, setAnswered] = useState<AdminProfile[]>([]);
  const [tab, setTab] = useState<'pending' | 'answered'>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionTone, setActionTone] = useState<'success' | 'error'>('success');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async (force = false) => {
    if (!hasAccessToken()) return;
    setLoading(true);
    setError(null);
    try {
      const opts = force ? { forceRefresh: true } : undefined;
      const [pendingRes, allRes] = await Promise.all([
        adminApi.listPendingAccounts(),
        adminApi.listAllAccounts({ approval_filter: 'approved' }),
      ]);
      setPending(pendingRes.accounts ?? []);
      // answered = approved + rejected
      const answeredRes = await adminApi.listAllAccounts({ approval_filter: 'rejected' });
      setAnswered([...(allRes.accounts ?? []), ...(answeredRes.accounts ?? [])]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (id: string) => {
    setBusyId(id);
    try {
      await adminApi.approveAccount(id);
      setActionMsg('อนุมัติบัญชีสำเร็จ');
      setActionTone('success');
      await load(true);
    } catch (e) {
      setActionMsg(e instanceof ApiError ? e.message : 'เกิดข้อผิดพลาด');
      setActionTone('error');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id: string, note: string) => {
    setBusyId(id);
    try {
      await adminApi.rejectAccount(id, note || undefined);
      setActionMsg('ปฏิเสธบัญชีแล้ว');
      setActionTone('success');
      await load(true);
    } catch (e) {
      setActionMsg(e instanceof ApiError ? e.message : 'เกิดข้อผิดพลาด');
      setActionTone('error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ErrorBoundary>
      <div className="flex flex-col gap-4 pb-6">
        {/* Action feedback */}
        {actionMsg && <AlertBanner tone={actionTone} message={actionMsg} />}
        {error && <AlertBanner tone="error" message={error} />}

        {/* Stats strip */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 border border-amber-100">
            <Clock className="h-3.5 w-3.5" />
            รอดำเนินการ {pending.length} บัญชี
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 border border-emerald-100">
            <UserCheck className="h-3.5 w-3.5" />
            ดำเนินการแล้ว {answered.length} บัญชี
          </div>
          <button
            type="button"
            onClick={() => load(true)}
            className="ml-auto flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-500 hover:bg-stone-50 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            รีเฟรช
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex rounded-xl bg-stone-100 p-0.5 gap-0.5">
          {(['pending', 'answered'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                tab === t ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {t === 'pending' ? `รอดำเนินการ (${pending.length})` : `ดำเนินการแล้ว (${answered.length})`}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : tab === 'pending' ? (
          pending.length === 0 ? (
            <EmptyState
              icon={UserCheck}
              title="ไม่มีบัญชีที่รออนุมัติ"
              description="บัญชีผู้ใช้ใหม่ที่ต้องผ่านการอนุมัติจะปรากฏที่นี่"
            />
          ) : (
            <div className="space-y-3">
              {pending.map((p) => (
                <AccountCard
                  key={p.id}
                  item={p}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  busy={busyId === p.id}
                />
              ))}
            </div>
          )
        ) : (
          answered.length === 0 ? (
            <EmptyState
              icon={User}
              title="ยังไม่มีประวัติการดำเนินการ"
              description="บัญชีที่อนุมัติหรือปฏิเสธแล้วจะปรากฏที่นี่"
            />
          ) : (
            <div className="space-y-2">
              {answered.map((a) => (
                <AnsweredCard key={a.id} item={a} />
              ))}
            </div>
          )
        )}
      </div>
    </ErrorBoundary>
  );
}
