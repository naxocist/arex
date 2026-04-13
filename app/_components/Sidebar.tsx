'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Leaf } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Image from 'next/image';
import { cn } from '@/app/_lib/utils';
import { roleNavItems, roleMeta } from '@/app/_lib/roleConfig';
import { useUser } from '@/app/_contexts/UserContext';

interface NavItem {
  path: string;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

function getNavItems(role: string): NavItem[] {
  return roleNavItems
    .filter((item) => item.roles.includes(role as typeof item.roles[number]))
    .map((item) => ({
      path: item.path,
      label: item.label,
      shortLabel: item.shortLabel,
      icon: item.icon as React.ComponentType<{ className?: string }>,
    }));
}

function NavLink({
  item,
  isActive,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.path}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-all duration-200',
        isActive
          ? 'bg-emerald-100 text-emerald-900 font-semibold'
          : 'text-stone-600 hover:bg-stone-200/50 hover:text-stone-900 hover:translate-x-1',
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="hidden sm:inline">{item.label}</span>
      <span className="sm:hidden">{item.shortLabel}</span>
    </Link>
  );
}

function SidebarContent({
  navItems,
  currentRole,
  onClose,
}: {
  navItems: React.ReactNode;
  currentRole: string;
  onClose?: () => void;
}) {
  const router = useRouter();
  const { logout } = useUser();
  const [mounted, setMounted] = React.useState(false);
  const roleInfo = mounted ? roleMeta[currentRole as keyof typeof roleMeta] : null;

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = () => {
    logout();
    onClose?.();
    router.replace('/login');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between border-b border-stone-200/60 px-4 py-5">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl primary-gradient text-white shadow-md">
              <Leaf className="h-5 w-5 fill-current" />
            </div>
            {/* PMUC logo badge */}
            <div className="absolute -bottom-2 -right-2 flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border border-stone-200 bg-white p-0.5 shadow-md">
              <Image src="/assets/pmuc_logo.png" alt="บพข" width={18} height={18} className="object-contain" />
            </div>
          </div>
          <div className="pt-0.5">
            <h1 className="text-base font-semibold leading-tight text-emerald-900">AREX Platform</h1>
            <p className="mt-0.5 text-[10px] font-medium leading-tight text-stone-500">ระบบบริหารจัดการวัสดุเหลือใช้</p>
            <p className="mt-0.5 text-[9px] font-medium text-stone-400">ภายใต้ บพข. (อว.)</p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="mt-1 rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 lg:hidden"
            aria-label="ปิดเมนู"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {roleInfo && (
        <div className="mx-4 mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-emerald-700">
            บทบาท
          </p>
          <p className="text-sm font-semibold text-emerald-900">{roleInfo.label}</p>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">{navItems}</div>
      </nav>

      <div className="border-t border-stone-200/60 p-2">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-rose-700 hover:bg-rose-50 transition-all duration-200"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span className="hidden sm:inline">ออกจากระบบ</span>
          <span className="sm:hidden">ออก</span>
        </button>
      </div>
    </div>
  );
}

export function MobileNav({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { role } = useUser();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[9998] bg-stone-900/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed bottom-0 left-0 top-0 z-[9999] w-72 max-w-[85vw] bg-stone-50 shadow-xl"
          >
            <SidebarContent
              navItems={
                !mounted || !role ? null : (
                  <>
                    {getNavItems(role).map((item) => (
                      <NavLink
                        key={item.path}
                        item={item}
                        isActive={pathname === item.path}
                        onClick={onClose}
                      />
                    ))}
                  </>
                )
              }
              currentRole={mounted && role ? role : ''}
              onClose={onClose}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function MobileTopBar({ onOpen }: { onOpen: () => void }) {
  const { role } = useUser();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);
  const roleInfo = mounted && role ? roleMeta[role as keyof typeof roleMeta] : null;

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-stone-200/80 bg-stone-50/95 px-4 py-3 backdrop-blur-sm lg:hidden">
      {/* Brand + role */}
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl primary-gradient text-white shadow-sm">
            <Leaf className="h-4 w-4 fill-current" />
          </div>
          <div className="absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border border-stone-200 bg-white p-0.5 shadow-sm">
            <Image src="/assets/pmuc_logo.png" alt="บพข" width={14} height={14} className="object-contain" />
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight text-emerald-900">AREX Platform</p>
          {roleInfo && (
            <p className="text-[11px] font-medium text-stone-400">{roleInfo.label}</p>
          )}
        </div>
      </div>

      {/* Hamburger */}
      <button
        type="button"
        onClick={onOpen}
        aria-label="เปิดเมนู"
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 shadow-sm transition hover:bg-stone-100 active:scale-95"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </header>
  );
}

export function DesktopSidebar() {
  const pathname = usePathname();
  const { role } = useUser();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-stone-200/60 bg-stone-50 lg:flex">
      <SidebarContent
        navItems={
          !mounted || !role ? null : (
            <>
              {getNavItems(role).map((item) => (
                <NavLink
                  key={item.path}
                  item={item}
                  isActive={pathname === item.path}
                />
              ))}
            </>
          )
        }
        currentRole={mounted && role ? role : ''}
      />
    </aside>
  );
}

interface SidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

export default function Sidebar({}: SidebarProps) {
  return null;
}
