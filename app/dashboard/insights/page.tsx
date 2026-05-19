import type { Metadata } from "next";
import { FeatureGate } from "@/components/feature-gate";
import { InsightsManager } from "@/components/insights-manager";

export const metadata: Metadata = {
  title: "AI Business Insights",
};

export default function InsightsPage() {
  return (
    <FeatureGate feature="insights">
      <InsightsManager />
    </FeatureGate>
  );
}
