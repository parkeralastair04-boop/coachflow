import type { Metadata } from "next";
import { FeatureGate } from "@/components/feature-gate";
import { RegistersManager } from "@/components/registers-manager";

export const metadata: Metadata = {
  title: "Registers",
};

export default function RegistersPage() {
  return (
    <FeatureGate
      feature="offline_registers"
      title="Offline registers"
      description="Offline-first group registers are included on CoachFlow Academy."
    >
      <RegistersManager />
    </FeatureGate>
  );
}
