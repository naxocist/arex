'use client';

import React from 'react';
import { LoaderCircle, Leaf } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  getIsGlobalLoading,
  subscribeToGlobalLoading,
} from '@/app/_lib/loadingState';

export default function AppLoadingOverlay() {
  const reduceMotion = useReducedMotion();
  const isLoading = React.useSyncExternalStore(
    subscribeToGlobalLoading,
    getIsGlobalLoading,
    getIsGlobalLoading,
  );

  React.useEffect(() => {
    document.body.classList.toggle('app-loading', isLoading);
    return () => {
      document.body.classList.remove('app-loading');
    };
  }, [isLoading]);

  return (
    <AnimatePresence>
      {isLoading ? (
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0 }}
          animate={reduceMotion ? undefined : { opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="fixed inset-0 z-[2400] flex items-center justify-center bg-white/78 px-6 backdrop-blur-md"
        >
          <motion.div
            initial={reduceMotion ? undefined : { opacity: 0, y: 18, scale: 0.98 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="w-full max-w-sm rounded-[1.8rem] border border-emerald-100 bg-white/95 px-6 py-6 text-center shadow-xl shadow-emerald-100/60"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-primary">
              <Leaf className="h-6 w-6 fill-current" />
            </div>
            <div className="mt-5 flex items-center justify-center gap-3 text-primary">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              <p className="text-sm font-semibold uppercase tracking-[0.22em]">AREX Loading</p>
            </div>
            <h2 className="mt-3 text-xl font-semibold text-stone-950">กำลังโหลดข้อมูลจากระบบ</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              โปรดรอสักครู่ หน้าจอจะกลับมาใช้งานอัตโนมัติเมื่อข้อมูลพร้อมแล้ว
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
