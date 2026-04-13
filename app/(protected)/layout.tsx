'use client';

import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { usePathname } from 'next/navigation';
import { DesktopSidebar, MobileNav, MobileTopBar } from '@/app/_components/Sidebar';
import AppLoadingOverlay from '@/app/_components/AppLoadingOverlay';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileNavOpen, setIsMobileNavOpen] = React.useState(false);
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <div className="relative flex flex-1">
        <DesktopSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <MobileTopBar onOpen={() => setIsMobileNavOpen(true)} />
          <main className="flex-1 px-4 py-6 md:px-6 md:py-8 lg:px-8">
            <div className="mx-auto w-full max-w-7xl">
              <motion.div
                key={pathname}
                initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                {children}
              </motion.div>
            </div>
          </main>

          <footer className="border-t border-stone-200/60 bg-stone-50 px-4 py-5 md:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                {/* Owner group */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={'/assets/' + encodeURIComponent('อว_logo.png')} alt="กระทรวง อว." className="h-9 w-9 object-contain" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/assets/pmuc_logo.png" alt="บพข." className="h-7 w-auto object-contain" />
                  </div>
                  <div className="h-8 w-px bg-stone-200" />
                  <div>
                    <p className="text-xs font-semibold text-stone-600">เจ้าของระบบ</p>
                    <p className="text-xs text-stone-400">บพข. และ LAWDEE CO., LTD</p>
                  </div>
                </div>

                {/* Developer group */}
                <div className="flex items-center gap-3">
                  <div className="h-8 w-px bg-stone-200 hidden sm:block" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/assets/cedt_logo.png" alt="CEDT" className="h-5 w-auto object-contain" />
                  <div>
                    <p className="text-xs font-semibold text-stone-600">ผู้พัฒนา</p>
                    <p className="text-xs text-stone-400">CEDT, จุฬาลงกรณ์มหาวิทยาลัย</p>
                  </div>
                </div>

              </div>
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
