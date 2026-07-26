import type { Metadata } from "next";
import { CommunicationCentreManager } from "@/components/communication-centre-manager";
import { FeatureGate } from "@/components/feature-gate";

export const metadata: Metadata = {
  title: "Parent Updates",
};

export default function CommunicationPage() {
  return (
    <FeatureGate feature="parent_emails">
      <CommunicationCentreManager />
    </FeatureGate>
  );
}
