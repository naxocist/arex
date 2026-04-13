import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/app/_lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  detail?: string;
  icon?: LucideIcon;
  tone?: 'default' | 'blue' | 'emerald' | 'green' | 'amber' | 'sky' | 'violet' | 'rose' | 'teal';
  className?: string;
}

const toneClassName: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'border-line bg-white text-stone-900',
  blue: 'border-blue-200 bg-blue-50 text-blue-950',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  green: 'border-green-200 bg-green-50 text-green-950',
  amber: 'border-amber-200 bg-amber-50 text-amber-950',
  sky: 'border-sky-200 bg-sky-50 text-sky-950',
  violet: 'border-violet-200 bg-violet-50 text-violet-950',
  rose: 'border-rose-200 bg-rose-50 text-rose-950',
  teal: 'border-teal-200 bg-teal-50 text-teal-950',
};

export default function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'default',
  className,
}: StatCardProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.article
      initial={reduceMotion ? undefined : { opacity: 0, y: 18, scale: 0.98 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      className={cn('group rounded-2xl border px-5 py-5 shadow-sm transition-colors hover:bg-primary/5', toneClassName[tone], className)}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] opacity-70">{label}</p>
        {Icon ? (
          <div className="rounded-xl bg-white/70 p-2.5 shadow-sm transition-colors group-hover:bg-primary group-hover:text-white">
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
      </div>
      <p className="mt-4 text-3xl font-light tracking-tight">{value}</p>
      {detail ? <p className="mt-1 text-sm leading-6 opacity-80">{detail}</p> : null}
    </motion.article>
  );
}
