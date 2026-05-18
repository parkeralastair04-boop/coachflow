import type { Metadata } from "next";
import { AnalyticsManager } from "@/components/analytics-manager";
import { FeatureGate } from "@/components/feature-gate";

export const metadata: Metadata = {
  title: "Analytics",
};

export default function AnalyticsPage() {
  return (
    <FeatureGate
      feature="analytics"
      title="Analytics dashboard"
      description="Business analytics are included on CoachFlow Pro and Academy."
    >
      <AnalyticsManager />
    </FeatureGate>
  );
}
