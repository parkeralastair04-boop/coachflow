import type { Metadata } from "next";
import { Suspense } from "react";
import { CampsManager } from "@/components/camps-manager";
import { FeatureGate } from "@/components/feature-gate";

export const metadata: Metadata = {
  title: "Holiday Camps",
};

export default function CampsPage() {
  return (
    <FeatureGate feature="camps">
      <Suspense
        fallback={
          <div className="glass-panel text-muted rounded-2xl p-6 text-sm">Loading camps...</div>
        }
      >
        <CampsManager />
      </Suspense>
    </FeatureGate>
  );
}
