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

const toneStyles: Record<NonNullable<StatCardProps['tone']>, {
  bar: string;
  iconBg: string;
  iconText: string;
  value: string;
}> = {
  default:  { bar: 'bg-stone-300',    iconBg: 'bg-stone-100',    iconText: 'text-stone-500',    value: 'text-stone-900' },
  blue:     { bar: 'bg-blue-400',     iconBg: 'bg-blue-50',      iconText: 'text-blue-600',     value: 'text-blue-900' },
  emerald:  { bar: 'bg-emerald-400',  iconBg: 'bg-emerald-50',   iconText: 'text-emerald-600',  value: 'text-emerald-900' },
  green:    { bar: 'bg-green-400',    iconBg: 'bg-green-50',     iconText: 'text-green-600',    value: 'text-green-900' },
  amber:    { bar: 'bg-amber-400',    iconBg: 'bg-amber-50',     iconText: 'text-amber-600',    value: 'text-amber-900' },
  sky:      { bar: 'bg-sky-400',      iconBg: 'bg-sky-50',       iconText: 'text-sky-600',      value: 'text-sky-900' },
  violet:   { bar: 'bg-violet-400',   iconBg: 'bg-violet-50',    iconText: 'text-violet-600',   value: 'text-violet-900' },
  rose:     { bar: 'bg-rose-400',     iconBg: 'bg-rose-50',      iconText: 'text-rose-600',     value: 'text-rose-900' },
  teal:     { bar: 'bg-teal-400',     iconBg: 'bg-teal-50',      iconText: 'text-teal-600',     value: 'text-teal-900' },
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
  const s = toneStyles[tone];

  return (
    <motion.article
      initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm flex flex-col',
        className
      )}
    >
      {/* accent bar */}
      <div className={cn('h-1 w-full shrink-0', s.bar)} />

      <div className="flex flex-1 flex-col gap-3 px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">{label}</p>
          {Icon && (
            <div className={cn('flex h-8 w-8 items-center justify-center rounded-xl shrink-0', s.iconBg)}>
              <Icon className={cn('h-4 w-4', s.iconText)} />
            </div>
          )}
        </div>

        <p className={cn('text-3xl font-semibold leading-none tracking-tight', s.value)}>{value}</p>

        {detail && (
          <p className="text-xs text-stone-400 leading-snug">{detail}</p>
        )}
      </div>
    </motion.article>
  );
}
