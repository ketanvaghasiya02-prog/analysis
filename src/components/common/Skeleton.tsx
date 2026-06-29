/**
 * Loading skeleton primitives (Phase R12).
 */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={['animate-pulse rounded-md bg-panel-border/60', className ?? ''].join(
        ' ',
      )}
    />
  );
}

/** Full-page skeleton shown while the first dataset is parsing. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-72 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
