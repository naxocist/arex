'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Menu, X, Home, Gift, Truck, Factory, PackageCheck, BarChart3, Settings } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/app/_lib/utils';
import { roleNavItems, roleMeta } from '@/app/_lib/roleConfig';
import { useUser } from '@/app/_contexts/UserContext';

interface NavItem {
  path: string;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Home,
  Gift,
  Truck,
  Factory,
  PackageCheck,
  BarChart3,
  Settings,
};

function getNavItems(role: string): NavItem[] {
  return roleNavItems
    .filter((item) => item.roles.includes(role as typeof item.roles[number]))
    .map((item) => ({
      path: item.path,
      label: item.label,
      shortLabel: item.shortLabel,
      icon: ICON_MAP[item.icon.displayName] || Home,
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
        'flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-all',
        isActive
          ? 'bg-blue-50 text-blue-900 font-semibold'
          : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
      )}
    >
      <Icon className="h-5 w-5" />
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
  const roleInfo = roleMeta[currentRole as keyof typeof roleMeta];

  const handleLogout = () => {
    logout();
    onClose?.();
    router.replace('/login');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-stone-100 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-stone-900">AREX</h1>
            <p className="text-xs text-stone-500">ตามบทบาท</p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 lg:hidden"
            aria-label="ปิดเมนู"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {roleInfo && (
        <div className="mx-4 mt-4 rounded-xl bg-green-50 border border-green-100 px-3 py-2">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-green-700">บทบาท</p>
          <p className="text-sm font-semibold text-green-900">{roleInfo.label}</p>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">{navItems}</div>
      </nav>

      <div className="border-t border-stone-100 p-2">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-rose-700 hover:bg-rose-50"
        >
          <LogOut className="h-5 w-5" />
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

  const navItems = mounted && role ? getNavItems(role) : [];

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
            className="fixed left-0 top-0 bottom-0 z-[9999] w-72 max-w-[85vw] bg-white shadow-xl"
          >
            <SidebarContent
              navItems={
                <>
                  {navItems.map((item) => (
                    <NavLink
                      key={item.path}
                      item={item}
                      isActive={pathname === item.path}
                      onClick={onClose}
                    />
                  ))}
                </>
              }
              currentRole={role || ''}
              onClose={onClose}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function DesktopSidebar() {
  const pathname = usePathname();
  const { role } = useUser();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const navItems = mounted && role ? getNavItems(role) : [];

  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-stone-200 bg-white lg:flex">
      <SidebarContent
        navItems={
          <>
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                item={item}
                isActive={pathname === item.path}
              />
            ))}
          </>
        }
        currentRole={role || ''}
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