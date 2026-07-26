import type { Metadata } from "next";
import { Suspense } from "react";
import { EnquiriesManager } from "@/components/enquiries-manager";
import { FeatureGate } from "@/components/feature-gate";

export const metadata: Metadata = {
  title: "Family Enquiries",
};

export default function EnquiriesPage() {
  return (
    <FeatureGate feature="academy_enquiries">
      <Suspense
        fallback={
          <div className="glass-panel text-muted rounded-2xl p-6 text-sm">
            Loading enquiries…
          </div>
        }
      >
        <EnquiriesManager />
      </Suspense>
    </FeatureGate>
  );
}
