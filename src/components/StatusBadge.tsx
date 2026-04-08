import React from 'react';
import { cn } from '@/src/lib/utils';

const BASE_BADGE_CLASS = 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold';

export function getStatusBadgeClass(status: string): string {
  const normalized = status.trim().toLowerCase();

  if (normalized === 'warehouse_rejected' || normalized === 'cancelled') {
    return 'bg-red-100 text-red-800';
  }

  if (normalized === 'warehouse_approved' || normalized === 'reward_delivered' || normalized === 'points_credited' || normalized === 'ready') {
    return 'bg-emerald-100 text-emerald-800';
  }

  if (normalized === 'delivered_to_factory' || normalized === 'factory_confirmed') {
    return 'bg-blue-100 text-blue-800';
  }

  if (normalized === 'picked_up' || normalized === 'out_for_delivery') {
    return 'bg-cyan-100 text-cyan-800';
  }

  if (normalized === 'submitted' || normalized === 'requested' || normalized === 'pickup_scheduled' || normalized === 'reward_delivery_scheduled') {
    return 'bg-amber-100 text-amber-800';
  }

  return 'bg-stone-100 text-stone-700';
}

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export default function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <span className={cn(BASE_BADGE_CLASS, getStatusBadgeClass(status), className)}>
      {label ?? status}
    </span>
  );
}
