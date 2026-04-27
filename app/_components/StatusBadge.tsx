import React from 'react';
import {
  CheckCircle2,
  Clock,
  Coins,
  Factory,
  Package,
  Truck,
  XCircle,
} from 'lucide-react';
import { cn } from '@/app/_lib/utils';

const BASE_BADGE_CLASS =
  'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide';

function getStatusBadgeClass(status: string): string {
  const normalized = status.trim().toLowerCase();

  if (normalized === 'rejected' || normalized === 'cancelled') {
    return 'border-red-200 bg-red-100 text-red-800';
  }

  if (
    normalized === 'approved' ||
    normalized === 'done' ||
    normalized === 'ready'
  ) {
    return 'border-emerald-200 bg-emerald-100 text-emerald-800';
  }

  if (normalized === 'delivered') {
    return 'border-blue-200 bg-blue-100 text-blue-800';
  }

  if (normalized === 'received' || normalized === 'out_for_delivery') {
    return 'border-cyan-200 bg-cyan-100 text-cyan-800';
  }

  if (
    normalized === 'submitted' ||
    normalized === 'requested' ||
    normalized === 'pickup_scheduled' ||
    normalized === 'delivery_scheduled'
  ) {
    return 'border-amber-200 bg-amber-100 text-amber-800';
  }

  return 'border-stone-200 bg-stone-100 text-stone-700';
}

const STATUS_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  submitted: Clock,
  requested: Clock,
  pickup_scheduled: Clock,
  delivery_scheduled: Clock,
  received: Truck,
  out_for_delivery: Truck,
  delivered: Package,
  approved: CheckCircle2,
  done: Coins,
  ready: CheckCircle2,
  rejected: XCircle,
  cancelled: XCircle,
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, label, className, size = 'md' }: StatusBadgeProps) {
  const normalized = status.trim().toLowerCase();
  const Icon = STATUS_ICON_MAP[normalized];

  return (
    <span
      className={cn(
        BASE_BADGE_CLASS,
        size === 'sm' ? 'px-2 py-0.5 text-[0.7rem]' : 'px-2.5 py-1 text-xs',
        getStatusBadgeClass(status),
        className,
      )}
    >
      {Icon ? <Icon className={cn('mr-1 shrink-0', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} /> : null}
      {label ?? status}
    </span>
  );
}
