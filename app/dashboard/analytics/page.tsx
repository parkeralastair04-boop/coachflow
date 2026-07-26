import type { Metadata } from "next";
import { FeatureGate } from "@/components/feature-gate";
import { AnalyticsManager } from "@/components/analytics-manager";

export const metadata: Metadata = {
  title: "Performance Insights",
};

export default function AnalyticsPage() {
  return (
    <FeatureGate feature="analytics">
      <AnalyticsManager />
    </FeatureGate>
  );
}
