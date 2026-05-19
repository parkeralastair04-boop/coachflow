import type { Metadata } from "next";
import { FeatureGate } from "@/components/feature-gate";
import { AcademySettingsManager } from "@/components/academy-settings-manager";

export const metadata: Metadata = {
  title: "Academy Settings",
};

export default function AcademySettingsPage() {
  return (
    <FeatureGate feature="white_label">
      <AcademySettingsManager />
    </FeatureGate>
  );
}
