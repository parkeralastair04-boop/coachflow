import type { Metadata } from "next";
import { FeatureGate } from "@/components/feature-gate";
import { ReportsManager } from "@/components/reports-manager";

export const metadata: Metadata = {
  title: "Reports",
};

export default function ReportsPage() {
  return (
    <FeatureGate feature="reports">
      <ReportsManager />
    </FeatureGate>
  );
}
