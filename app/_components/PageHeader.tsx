'use client';

import React from 'react';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { cn } from '@/app/_lib/utils';

interface PageHeaderAction {
  label: string;
  onClick?: () => void;
  to?: string;
  href?: string;
  icon?: LucideIcon;
  variant?: 'primary' | 'secondary';
}

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: PageHeaderAction[];
  className?: string;
}

export default function PageHeader({
  eyebrow,
  title,
  description,
  actions = [],
  className,
}: PageHeaderProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      initial={reduceMotion ? undefined : { opacity: 0, y: 14, scale: 0.985 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className={cn(
        'rounded-2xl border border-outline-variant/20 bg-white px-5 py-5 shadow-sm md:px-6 md:py-6',
        className,
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          {eyebrow ? (
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-emerald-700">{eyebrow}</p>
          ) : null}
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-on-surface md:text-4xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant md:text-base">{description}</p>
        </div>

        {actions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            {actions.map((action, index) => {
              const Icon = action.icon ?? ArrowRight;
              const isPrimary = action.variant !== 'secondary';
              const commonClassName = cn(
                'inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition',
                isPrimary
                  ? 'bg-primary text-white hover:bg-primary-container'
                  : 'border border-outline-variant/30 bg-surface-container-low text-on-surface hover:bg-surface-container-high',
              );

              if (action.to) {
                return (
                  <motion.div
                    key={`${action.label}-${action.to}`}
                    initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
                    whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.7 }}
                    transition={{ duration: 0.34, delay: index * 0.05 }}
                    whileHover={reduceMotion ? undefined : { y: -1 }}
                  >
                    <Link href={action.to} className={commonClassName}>
                      <span>{action.label}</span>
                      <Icon className="h-4 w-4" />
                    </Link>
                  </motion.div>
                );
              }

              if (action.href) {
                return (
                  <motion.a
                    key={`${action.label}-${action.href}`}
                    href={action.href}
                    className={commonClassName}
                    initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
                    whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.7 }}
                    transition={{ duration: 0.34, delay: index * 0.05 }}
                    whileHover={reduceMotion ? undefined : { y: -1 }}
                  >
                    <span>{action.label}</span>
                    <Icon className="h-4 w-4" />
                  </motion.a>
                );
              }

              return (
                <motion.button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className={commonClassName}
                  initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
                  whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.7 }}
                  transition={{ duration: 0.34, delay: index * 0.05 }}
                  whileHover={reduceMotion ? undefined : { y: -1 }}
                >
                  <span>{action.label}</span>
                  <Icon className="h-4 w-4" />
                </motion.button>
              );
            })}
          </div>
        ) : null}
      </div>
    </motion.section>
  );
}
