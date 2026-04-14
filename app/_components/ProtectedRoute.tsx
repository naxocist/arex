'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, LogOut, ShieldX } from 'lucide-react';
import { clearAuthSession, getStoredApprovalStatus } from '@/app/_lib/apiClient';
import { roleMeta } from '@/app/_lib/roleConfig';
import { useUser } from '@/app/_contexts/UserContext';
import type { UserRole } from '@/app/_contexts/UserContext';

const rolePaths: Record<string, string> = {
  farmer: '/farmer',
  executive: '/executive',
  logistics: '/logistics',
  factory: '/factory',
  warehouse: '/warehouse',
  admin: '/admin',
};

/* ── Approval gate screens ── */
function ApprovalGate({ role, status }: { role: string; status: 'pending' | 'rejected' }) {
  const router = useRouter();
  const { setRole } = useUser();
  const meta = roleMeta[role as UserRole];
  const roleLabel = meta?.label ?? role;

  const handleLogout = () => {
    clearAuthSession();
    setRole(null);
    router.replace('/login');
  };

  if (status === 'pending') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-amber-50 to-white px-6">
        <div className="w-full max-w-sm text-center">
          {/* Icon */}
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 ring-8 ring-amber-50">
            <Clock className="h-9 w-9 text-amber-500" />
          </div>

          {/* Role badge */}
          <span className="inline-flex items-center rounded-full bg-amber-100 border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700 mb-4">
            {roleLabel}
          </span>

          {/* Heading */}
          <h1 className="text-2xl font-bold text-stone-800 leading-snug">
            รอการอนุมัติ
          </h1>
          <p className="mt-3 text-sm text-stone-500 leading-relaxed">
            บัญชีของคุณอยู่ระหว่างการตรวจสอบโดยผู้ดูแลระบบ
            <br />
            กรุณารอสักครู่ แล้วลองเข้าสู่ระบบใหม่อีกครั้ง
          </p>

          {/* Divider with AREX branding */}
          <div className="my-8 flex items-center gap-3">
            <div className="h-px flex-1 bg-stone-200" />
            <span className="text-[0.6rem] font-bold uppercase tracking-widest text-stone-300">AREX</span>
            <div className="h-px flex-1 bg-stone-200" />
          </div>

          <p className="text-xs text-stone-400 mb-6">
            หากไม่ได้รับการอนุมัติภายใน 24 ชั่วโมง<br />กรุณาติดต่อเจ้าหน้าที่ PMUC
          </p>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white py-3 text-sm font-medium text-stone-600 shadow-sm hover:bg-stone-50 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            ออกจากระบบ
          </button>
        </div>
      </div>
    );
  }

  // rejected
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-red-50 to-white px-6">
      <div className="w-full max-w-sm text-center">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 ring-8 ring-red-50">
          <ShieldX className="h-9 w-9 text-red-500" />
        </div>

        {/* Role badge */}
        <span className="inline-flex items-center rounded-full bg-red-100 border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 mb-4">
          {roleLabel}
        </span>

        {/* Heading */}
        <h1 className="text-2xl font-bold text-stone-800 leading-snug">
          ไม่ได้รับอนุมัติ
        </h1>
        <p className="mt-3 text-sm text-stone-500 leading-relaxed">
          คำขอลงทะเบียนของคุณถูกปฏิเสธโดยผู้ดูแลระบบ
          <br />
          กรุณาติดต่อเจ้าหน้าที่ PMUC เพื่อขอข้อมูลเพิ่มเติม
        </p>

        {/* Divider */}
        <div className="my-8 flex items-center gap-3">
          <div className="h-px flex-1 bg-stone-200" />
          <span className="text-[0.6rem] font-bold uppercase tracking-widest text-stone-300">AREX</span>
          <div className="h-px flex-1 bg-stone-200" />
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white py-3 text-sm font-medium text-stone-600 shadow-sm hover:bg-stone-50 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          ออกจากระบบ
        </button>
      </div>
    </div>
  );
}

/* ── Main ── */
export default function ProtectedRoute({
  children,
  allowedRole,
}: {
  children: React.ReactNode;
  allowedRole: string;
}) {
  const { role } = useUser();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setApprovalStatus(getStoredApprovalStatus());
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!role) {
      router.replace('/login');
    } else if (role !== allowedRole) {
      router.replace(rolePaths[role] ?? '/login');
    }
  }, [mounted, role, allowedRole, router]);

  if (!mounted || !role || role !== allowedRole) {
    return null;
  }

  // Roles that can be gated by approval (admin/executive/warehouse never need this)
  const gatedRoles = ['farmer', 'logistics', 'factory'];
  if (gatedRoles.includes(role) && (approvalStatus === 'pending' || approvalStatus === 'rejected')) {
    return <ApprovalGate role={role} status={approvalStatus as 'pending' | 'rejected'} />;
  }

  return <>{children}</>;
}
