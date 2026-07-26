import { ContentSkeleton } from "@/components/branded-loading";

export default function BillingLoading() {
  return (
    <div className="px-1 py-2">
      <ContentSkeleton rows={3} />
    </div>
  );
}
