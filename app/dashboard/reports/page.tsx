import type { Metadata } from "next";
import { FeatureGate } from "@/components/feature-gate";
import { ReportsManager } from "@/components/reports-manager";

export const metadata: Metadata = {
  title: "Reports",
};

export default function ReportsPage() {
  return (
    <FeatureGate
      feature="reports"
      title="Reports & AI summaries"
      description="Session notes, saved reports, and parent-ready AI summaries are on CoachFlow Pro and Academy."
    >
      <ReportsManager />
    </FeatureGate>
  );
}
