import { BrandAppIcon, BrandMark } from "@/components/brand-mark";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type BrandedLoadingProps = {
  message?: string;
  className?: string;
  compact?: boolean;
};

/** Branded full-page / section loading state — shimmer, not spinner. */
export function BrandedLoading({
  message = "Loading…",
  className,
  compact = false,
}: BrandedLoadingProps) {
  if (compact) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-4 py-16",
          className,
        )}
        role="status"
        aria-live="polite"
      >
        <Skeleton className="size-12 rounded-2xl" />
        <p className="text-muted text-sm">{message}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mesh-gradient flex min-h-[50vh] items-center justify-center px-6 py-16",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="football-auth-card relative page-content-enter flex w-full max-w-sm flex-col items-center rounded-[2rem] px-8 py-10 text-center">
        <div className="pointer-events-none absolute inset-0 tactical-grid opacity-[0.1]" aria-hidden />
        <div className="relative">
          <div className="size-20 overflow-hidden rounded-[28%] shadow-[0_16px_48px_rgba(5,150,105,0.18)] sm:size-24">
            <BrandAppIcon />
          </div>
          <div className="mt-5 inline-flex items-center gap-2.5 leading-none">
            <BrandMark className="text-navy size-8 dark:text-white" />
            <p className="text-xl font-semibold tracking-tight">
              <span className="text-navy dark:text-white">Awar</span>
              <span className="text-accent">ix</span>
            </p>
          </div>
          <p className="text-muted mt-3 text-sm">{message}</p>
          <div className="mt-6 flex w-full flex-col gap-2">
            <Skeleton className="h-3 w-full rounded-full" />
            <Skeleton className="mx-auto h-3 w-[80%] rounded-full" />
            <Skeleton className="mx-auto h-3 w-[60%] rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Dashboard-style skeleton rows for list pages. */
export function ContentSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="page-content-enter space-y-6" role="status" aria-label="Loading content">
      <div className="football-page-band space-y-3">
        <div className="flex items-start gap-3 sm:gap-4">
          <Skeleton className="size-11 shrink-0 rounded-xl sm:size-12" />
          <div className="min-w-0 flex-1 space-y-2 pt-1">
            <Skeleton className="h-7 w-48 max-w-full rounded-lg" />
            <Skeleton className="h-4 w-72 max-w-full rounded-lg" />
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: Math.min(rows, 3) }).map((_, index) => (
          <div key={`stat-${index}`} className="football-panel space-y-3 rounded-2xl p-5">
            <Skeleton className="h-3 w-1/3 rounded-full" />
            <Skeleton className="h-8 w-1/2 rounded-lg" />
            <Skeleton className="h-3 w-2/3 rounded-full" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="football-panel space-y-3 rounded-2xl p-5 sm:p-6">
            <Skeleton className="h-3 w-1/3 rounded-full" />
            <Skeleton className="h-3 w-full rounded-full" />
            <Skeleton className="h-3 w-[80%] rounded-full" />
            <Skeleton className="mt-2 h-9 w-28 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Compact panel skeleton for nested manager loading states. */
export function PanelSkeleton({
  rows = 3,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("football-panel space-y-4 rounded-2xl p-5 sm:p-6", className)}
      role="status"
      aria-label="Loading"
    >
      <Skeleton className="h-4 w-40 rounded-full" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton
            key={index}
            className={cn("h-3 rounded-full", index === rows - 1 ? "w-2/3" : "w-full")}
          />
        ))}
      </div>
    </div>
  );
}
