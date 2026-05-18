import type { Metadata } from "next";
import { AutomationsManager } from "@/components/automations-manager";
import { FeatureGate } from "@/components/feature-gate";

export const metadata: Metadata = {
  title: "Automations",
};

export default function AutomationsPage() {
  return (
    <FeatureGate
      feature="automations"
      title="CRM automations"
      description="Smart notifications and CRM automations are included on CoachFlow Pro and Academy."
    >
      <AutomationsManager />
    </FeatureGate>
  );
}
