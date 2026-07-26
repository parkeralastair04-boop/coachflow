import type { Metadata } from "next";
import { Suspense } from "react";
import { FeatureGate } from "@/components/feature-gate";
import { RegistersManager } from "@/components/registers-manager";

export const metadata: Metadata = {
  title: "Session Registers",
};

export default function RegistersPage() {
  return (
    <FeatureGate feature="group_registers">
      <Suspense fallback={null}>
        <RegistersManager />
      </Suspense>
    </FeatureGate>
  );
}
