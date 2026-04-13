import { cn } from '@/app/_lib/utils';

interface SkeletonProps {
  className?: string;
}

export function SkeletonLine({ className }: SkeletonProps) {
  return (
    <div
      className={cn('h-4 animate-pulse rounded-full bg-surface-container', className)}
    />
  );
}

export function SkeletonBlock({ className }: SkeletonProps) {
  return (
    <div
      className={cn('h-32 animate-pulse rounded-2xl bg-surface-container', className)}
    />
  );
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
