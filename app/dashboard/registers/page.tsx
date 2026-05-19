import type { Metadata } from "next";
import { FeatureGate } from "@/components/feature-gate";
import { RegistersManager } from "@/components/registers-manager";

export const metadata: Metadata = {
  title: "Registers",
};

export default function RegistersPage() {
  return (
    <FeatureGate feature="group_registers">
      <RegistersManager />
    </FeatureGate>
  );
}
