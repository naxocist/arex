import React from 'react';
import { AlertCircle, CheckCircle2, Info, type LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/app/lib/utils';

type AlertTone = 'info' | 'success' | 'error';

const toneMap: Record<
  AlertTone,
  { icon: LucideIcon; className: string; title: string }
> = {
  info: {
    icon: Info,
    className: 'border-sky-200 bg-sky-50 text-sky-900',
    title: 'ข้อมูลจากระบบ',
  },
  success: {
    icon: CheckCircle2,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    title: 'ดำเนินการสำเร็จ',
  },
  error: {
    icon: AlertCircle,
    className: 'border-rose-200 bg-rose-50 text-rose-900',
    title: 'ตรวจสอบอีกครั้ง',
  },
};

interface AlertBannerProps {
  message: string;
  tone?: AlertTone;
  title?: string;
  className?: string;
}

export default function AlertBanner({
  message,
  tone = 'info',
  title,
  className,
}: AlertBannerProps) {
  const reduceMotion = useReducedMotion();
  const { icon: Icon, className: toneClassName, title: fallbackTitle } = toneMap[tone];

  return (
    <motion.div
      initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={cn('rounded-xl border px-4 py-3', toneClassName, className)}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-white/70 p-1.5">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title ?? fallbackTitle}</p>
          <p className="mt-1 text-sm leading-6">{message}</p>
        </div>
      </div>
    </motion.div>
  );
}
