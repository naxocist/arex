'use client';

import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronDown } from 'lucide-react';

const accentBorder: Record<string, string> = {
  amber: 'border-l-amber-400',
  sky: 'border-l-sky-400',
  violet: 'border-l-violet-400',
  emerald: 'border-l-emerald-400',
};

export default function ExpandableCard({
  children,
  expandedContent,
  isExpanded,
  onToggle,
  accent,
}: {
  children: React.ReactNode;
  expandedContent: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  accent?: 'amber' | 'sky' | 'violet' | 'emerald';
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={`overflow-hidden rounded-xl border border-stone-200/80 border-l-4 bg-white shadow-sm transition-shadow hover:shadow-md ${
        accent ? accentBorder[accent] : 'border-l-stone-300'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-2 px-3.5 py-2 text-left"
      >
        <div className="min-w-0 flex-1">{children}</div>
        <motion.span
          animate={reduceMotion ? {} : { rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.22 }}
          style={{ display: 'inline-flex' }}
          className="mt-0.5 shrink-0 text-stone-400"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="expanded"
            initial={reduceMotion ? {} : { height: 0, opacity: 0 }}
            animate={reduceMotion ? {} : { height: 'auto', opacity: 1 }}
            exit={reduceMotion ? {} : { height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="border-t border-stone-100 bg-stone-50/60 px-3.5 pb-3.5 pt-3">
              {expandedContent}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
