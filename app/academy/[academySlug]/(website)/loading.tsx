import { Skeleton } from "@/components/ui/skeleton";

export default function AcademyWebsiteLoading() {
  return (
    <div
      className="bg-background flex min-h-screen flex-col"
      role="status"
      aria-live="polite"
    >
      <div className="border-border border-b px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-xl" />
            <Skeleton className="h-4 w-32 rounded-lg" />
          </div>
          <Skeleton className="h-11 w-24 rounded-full" />
        </div>
      </div>
      <div className="page-content-enter mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-16 sm:px-6 lg:px-8">
        <Skeleton className="size-16 rounded-2xl" />
        <Skeleton className="h-12 w-2/3 max-w-md rounded-xl" />
        <Skeleton className="h-4 w-full max-w-lg rounded-lg" />
        <Skeleton className="h-4 w-full max-w-md rounded-lg" />
        <div className="mt-4 flex gap-3">
          <Skeleton className="h-12 w-36 rounded-full" />
          <Skeleton className="h-12 w-36 rounded-full" />
        </div>
      </div>
      <span className="sr-only">Loading academy website</span>
    </div>
  );
}
