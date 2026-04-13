'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  fields?: { label: string; value: string }[];
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  fields,
  confirmLabel = 'ยืนยัน',
  cancelLabel = 'ยกเลิก',
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const isDanger = confirmVariant === 'danger';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden"
          >
            {/* Icon header band */}
            <div className={`flex flex-col items-center px-6 pt-7 pb-5 ${isDanger ? 'bg-red-50' : 'bg-emerald-50'}`}>
              <div className={`flex h-14 w-14 items-center justify-center rounded-full ${isDanger ? 'bg-red-100' : 'bg-emerald-100'}`}>
                {isDanger
                  ? <AlertTriangle className="h-7 w-7 text-red-500" />
                  : <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                }
              </div>
              <h2 className={`mt-3 text-center text-lg font-bold ${isDanger ? 'text-red-700' : 'text-stone-900'}`}>
                {title}
              </h2>
            </div>

            {/* Body */}
            <div className="px-6 py-4">
              {fields && fields.length > 0 ? (
                <div className="divide-y divide-stone-100 rounded-2xl border border-stone-100 overflow-hidden">
                  {fields.map(({ label, value }) => (
                    <div key={label} className="flex items-start justify-between gap-3 px-4 py-3">
                      <span className="text-sm text-stone-400 shrink-0">{label}</span>
                      <span className="text-sm font-semibold text-stone-800 text-right">{value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-stone-600 whitespace-pre-line">{message}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 px-6 pb-6">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 rounded-2xl border border-stone-200 py-3.5 text-base font-semibold text-stone-600 transition hover:bg-stone-50 min-h-[52px]"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`flex-1 rounded-2xl py-3.5 text-base font-bold text-white transition min-h-[52px] ${
                  isDanger ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:opacity-90'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
