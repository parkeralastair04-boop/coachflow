import { ContentSkeleton } from "@/components/branded-loading";

export default function DashboardLoading() {
  return (
    <div className="px-1 py-2">
      <ContentSkeleton rows={4} />
    </div>
  );
}
