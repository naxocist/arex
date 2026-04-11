'use client';

import React from 'react';
import { Menu } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { usePathname } from 'next/navigation';
import { DesktopSidebar, MobileNav } from '@/app/_components/Sidebar';
import { getRouteMeta, roleMeta } from '@/app/_lib/roleConfig';
import { useUser } from '@/app/_contexts/UserContext';
import AppLoadingOverlay from '@/app/_components/AppLoadingOverlay';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role } = useUser();
  const [isMobileNavOpen, setIsMobileNavOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const reduceMotion = useReducedMotion();
  const routeMeta = getRouteMeta(pathname);
  const currentRoleMeta = mounted && role ? roleMeta[role] : null;

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-surface">
      <div className="relative flex min-h-screen">
        <DesktopSidebar />

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center border-b border-stone-200 bg-white/95 px-4 backdrop-blur-sm lg:hidden">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-700"
              aria-label="เมนู"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="ml-3 min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-stone-900">{routeMeta.title}</p>
              <p className="truncate text-xs text-stone-500">{currentRoleMeta?.label}</p>
            </div>

            {currentRoleMeta ? (
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                {currentRoleMeta.shortLabel}
              </span>
            ) : null}
          </header>

          <main className="flex-1 px-4 py-4 md:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-7xl">
              <div className="hidden items-center justify-between rounded-2xl bg-white px-6 py-5 shadow-sm lg:flex">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-green-700">
                    {currentRoleMeta?.label}
                  </p>
                  <p className="mt-1 text-xl font-semibold text-stone-900">{routeMeta.title}</p>
                  <p className="mt-1 text-sm text-stone-500">{routeMeta.description}</p>
                </div>
                {currentRoleMeta ? (
                  <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-green-800">
                    {currentRoleMeta.shortLabel}
                  </span>
                ) : null}
              </div>

              <motion.div
                key={pathname}
                initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="mt-4 lg:mt-6"
              >
                {children}
              </motion.div>
            </div>
          </main>

          <footer className="border-t border-stone-200 bg-stone-50 px-4 py-4 text-xs text-stone-500 md:px-6 lg:px-8">
            <div className="mx-auto flex max-w-7xl flex-col justify-between gap-2 md:flex-row">
              <p>AREX Platform</p>
              <p>เจ้าของระบบ: บพข. และ LAWDEE CO., LTD | ผู้พัฒนา: CEDT</p>
            </div>
          </footer>
        </div>

        <AnimatePresence>
          <MobileNav isOpen={isMobileNavOpen} onClose={() => setIsMobileNavOpen(false)} />
        </AnimatePresence>
      </div>

      <AppLoadingOverlay />
    </div>
  );
}