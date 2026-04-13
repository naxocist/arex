import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/app/_lib/utils';

interface SectionCardProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export default function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: SectionCardProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      initial={reduceMotion ? undefined : { opacity: 0, y: 22 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.46, ease: 'easeOut' }}
      className={cn('rounded-2xl border border-outline-variant/10 bg-white p-8 shadow-sm', className)}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-medium text-on-surface">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-6 text-on-surface-variant">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className={cn('mt-4', contentClassName)}>{children}</div>
    </motion.section>
  );
}
