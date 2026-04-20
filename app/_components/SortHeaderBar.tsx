'use client';

import React from 'react';
import { ArrowUpDown } from 'lucide-react';

export type SortDir = 'asc' | 'desc';

export default function SortHeaderBar<T extends string>({
  cols,
  sort,
  onSort,
}: {
  cols: { key: T; label: string; dirLabels?: [string, string]; activeExtra?: React.ReactNode }[];
  sort: { key: T; dir: SortDir };
  onSort: (key: T) => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-stone-100 bg-stone-50/70 px-4 py-2 rounded-t-xl -mb-1 flex-wrap">
      {cols.map((col) => {
        const active = sort.key === col.key;
        const [ascLabel, descLabel] = col.dirLabels ?? ['ก่อน', 'หลัง'];
        return (
          <React.Fragment key={col.key}>
            <button
              type="button"
              onClick={() => onSort(col.key)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                active ? 'text-primary' : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              {col.label}
              {active ? (
                <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold bg-primary/10 text-primary">
                  {sort.dir === 'asc' ? ascLabel : descLabel}
                </span>
              ) : (
                <ArrowUpDown className="h-3 w-3 opacity-40" />
              )}
            </button>
            {active && col.activeExtra}
          </React.Fragment>
        );
      })}
      <span className="ml-auto text-[11px] text-stone-400 hidden sm:inline">กดชื่อคอลัมน์เพื่อเรียงลำดับ</span>
    </div>
  );
}
