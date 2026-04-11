'use client';

import React from 'react';
import { Menu, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import { getRouteMeta, roleMeta } from '@/app/_lib/roleConfig';
import { useUser } from '@/app/_contexts/UserContext';

export default function Layout({ children }: { children: React.ReactNode }) {
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
        <aside className="sticky top-0 hidden h-screen w-80 shrink-0 lg:block">
          <Sidebar />
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-outline-variant/20 bg-white lg:hidden">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(true)}
                className="rounded-xl border border-outline-variant/20 bg-white p-2.5 text-stone-700"
                aria-label="เปิดเมนูนำทาง"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-stone-900">{routeMeta.title}</p>
                <p className="truncate text-xs text-stone-500">{currentRoleMeta?.label ?? 'AREX Platform'}</p>
              </div>

              {currentRoleMeta ? (
                <div className="rounded-full bg-green-100 px-3 py-1 text-[0.72rem] font-semibold text-green-900" key={currentRoleMeta.shortLabel}>
                  {currentRoleMeta.shortLabel}
                </div>
              ) : null}
            </div>
          </header>

          <main className="relative flex-1 px-4 py-5 md:px-6 lg:px-10 lg:py-8">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
              <div className="hidden items-center justify-between rounded-xl border border-outline-variant/20 bg-white px-5 py-4 lg:flex">
                <div className="min-w-0">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-green-700">
                    {currentRoleMeta?.label ?? 'AREX Platform'}
                  </p>
                  <p className="mt-1 truncate text-xl font-semibold text-stone-950">{routeMeta.title}</p>
                  <p className="mt-1 text-sm text-stone-600">{routeMeta.description}</p>
                </div>
                {currentRoleMeta ? (
                  <div className="rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-green-900" key={currentRoleMeta?.shortLabel}>
                    {currentRoleMeta?.shortLabel}
                  </div>
                ) : null}
              </div>

              <motion.div
                key={pathname}
                initial={reduceMotion ? undefined : { opacity: 0, y: 14 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.26, ease: 'easeOut' }}
              >
                {children}
              </motion.div>
            </div>
          </main>

          <footer className="border-t border-outline-variant/20 px-4 py-5 text-xs text-stone-500 md:px-6 lg:px-10">
            <div className="mx-auto flex max-w-7xl flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <p>AREX Platform</p>
              <p>เจ้าของระบบ: บพข. และ LAWDEE CO., LTD • Development: CEDT</p>
            </div>
          </footer>
        </div>

        <AnimatePresence>
          {isMobileNavOpen ? (
            <>
              <motion.button
                type="button"
                aria-label="ปิดเมนูนำทาง"
                initial={reduceMotion ? undefined : { opacity: 0 }}
                animate={reduceMotion ? undefined : { opacity: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setIsMobileNavOpen(false)}
                className="fixed inset-0 z-40 bg-stone-950/35 lg:hidden"
              />
              <motion.div
                initial={reduceMotion ? undefined : { x: -30, opacity: 0 }}
                animate={reduceMotion ? undefined : { x: 0, opacity: 1 }}
                exit={reduceMotion ? undefined : { x: -30, opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="fixed inset-y-0 left-0 z-50 lg:hidden"
              >
                <div className="w-[calc(100vw-2rem)] max-w-[20rem]">
                  <div className="flex items-center justify-end px-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setIsMobileNavOpen(false)}
                      className="rounded-xl border border-outline-variant/20 bg-white p-2.5 text-stone-700"
                      aria-label="ปิดเมนูนำทาง"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="h-[calc(100vh-4rem)]">
                    <Sidebar mobile onNavigate={() => setIsMobileNavOpen(false)} />
                  </div>
                </div>
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
