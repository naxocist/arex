import React from 'react';
import { cn } from '@/app/_lib/utils';

const BASE_BADGE_CLASS =
  'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide';

export function getStatusBadgeClass(status: string): string {
  const normalized = status.trim().toLowerCase();

  if (normalized === 'warehouse_rejected' || normalized === 'cancelled') {
    return 'border-red-200 bg-red-100 text-red-800';
  }

  if (normalized === 'warehouse_approved' || normalized === 'reward_delivered' || normalized === 'points_credited' || normalized === 'ready') {
    return 'border-emerald-200 bg-emerald-100 text-emerald-800';
  }

  if (normalized === 'delivered_to_factory' || normalized === 'factory_confirmed') {
    return 'border-blue-200 bg-blue-100 text-blue-800';
  }

  if (normalized === 'picked_up' || normalized === 'out_for_delivery') {
    return 'border-cyan-200 bg-cyan-100 text-cyan-800';
  }

  if (normalized === 'submitted' || normalized === 'requested' || normalized === 'pickup_scheduled' || normalized === 'reward_delivery_scheduled') {
    return 'border-amber-200 bg-amber-100 text-amber-800';
  }

  return 'border-stone-200 bg-stone-100 text-stone-700';
}

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, label, className, size = 'md' }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        BASE_BADGE_CLASS,
        size === 'sm' ? 'px-2 py-0.5 text-[0.7rem]' : 'px-2.5 py-1 text-xs',
        getStatusBadgeClass(status),
        className,
      )}
    >
      {label ?? status}
    </span>
  );
}
