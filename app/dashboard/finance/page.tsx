import type { Metadata } from "next";
import { Suspense } from "react";
import { FeatureGate } from "@/components/feature-gate";
import { FinanceCentreManager } from "@/components/finance-centre-manager";

export const metadata: Metadata = {
  title: "Finance Centre",
};

export default function FinancePage() {
  return (
    <FeatureGate feature="finance_centre">
      <Suspense fallback={null}>
        <FinanceCentreManager />
      </Suspense>
    </FeatureGate>
  );
}
