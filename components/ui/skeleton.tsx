import { cn } from "@/lib/utils";

type SkeletonProps = {
  className?: string;
};

/** Shimmer placeholder — prefer over spinners for content loading. */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("skeleton-pulse rounded-lg", className)}
      aria-hidden
    />
  );
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)} role="status" aria-label="Loading">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn(
            "h-3 rounded-full",
            index === lines - 1 ? "w-2/3" : "w-full",
          )}
        />
      ))}
    </div>
  );
}
