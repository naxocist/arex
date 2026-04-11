import React from 'react';
import { cn } from '@/app/_lib/utils';
import { type LucideIcon } from 'lucide-react';

interface CompactItemProps {
  label: string;
  sublabel?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  icon?: LucideIcon;
}

export function CompactItem({ label, sublabel, badge, action, icon: Icon }: CompactItemProps) {
  return (
    <div className={cn('flex items-center gap-3 rounded-lg bg-stone-50 px-3 py-2')}>
      {Icon && (
        <Icon className="h-4 w-4 shrink-0 text-stone-400" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-stone-900">{label}</p>
        {sublabel && <p className="truncate text-xs text-stone-500">{sublabel}</p>}
      </div>
      {badge}
      {action}
    </div>
  );
}

export function CompactList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('space-y-1.5', className)}>{children}</div>;
}

export function CompactCard({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const content = (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      {children}
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full text-left">
        {content}
      </button>
    );
  }

  return content;
}