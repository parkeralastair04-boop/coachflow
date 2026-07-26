import type { Metadata } from "next";
import { Suspense } from "react";
import { FeatureGate } from "@/components/feature-gate";
import { ReportsManager } from "@/components/reports-manager";

export const metadata: Metadata = {
  title: "Player Development",
};

export default function ReportsPage() {
  return (
    <FeatureGate feature="reports">
      <Suspense fallback={null}>
        <ReportsManager />
      </Suspense>
    </FeatureGate>
  );
}
