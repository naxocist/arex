import { cn } from '@/app/_lib/utils';

interface SkeletonProps {
  className?: string;
}

export function SkeletonStatCard({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'h-28 w-full animate-pulse rounded-2xl border border-outline-variant/20 bg-surface-container-low',
        className,
      )}
    />
  );
}

export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5',
        className,
      )}
    >
      <div className="mb-4 h-5 w-1/3 rounded-full bg-surface-container" />
      <div className="space-y-3">
        <div className="h-4 rounded-full bg-surface-container" />
        <div className="h-4 w-4/5 rounded-full bg-surface-container" />
        <div className="h-4 w-3/5 rounded-full bg-surface-container" />
      </div>
    </div>
  );
}

/** Skeleton for a labelled text input field */
export function SkeletonFormField({ className }: SkeletonProps) {
  return (
    <div className={cn('animate-pulse space-y-1.5', className)}>
      <div className="h-3 w-1/4 rounded-full bg-surface-container" />
      <div className="h-11 w-full rounded-xl bg-surface-container-low border border-outline-variant/20" />
    </div>
  );
}

/** Skeleton for a row with text on the left and a toggle on the right */
export function SkeletonToggleRow({ className }: SkeletonProps) {
  return (
    <div className={cn('flex animate-pulse items-center gap-4 px-4 py-3.5', className)}>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-1/3 rounded-full bg-surface-container" />
        <div className="h-3 w-1/2 rounded-full bg-surface-container-low" />
      </div>
      <div className="h-6 w-11 shrink-0 rounded-full bg-surface-container-low" />
    </div>
  );
}

/** Skeleton for an inline badge chip */
export function SkeletonBadge({ className }: SkeletonProps) {
  return (
    <div className={cn('animate-pulse h-7 w-36 rounded-md bg-surface-container-low', className)} />
  );
}
