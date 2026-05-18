import type { Metadata } from "next";
import { FeatureGate } from "@/components/feature-gate";
import { PaymentsManager } from "@/components/payments-manager";

export const metadata: Metadata = {
  title: "Parent payments",
};

export default function PaymentsPage() {
  return (
    <FeatureGate
      feature="parent_payments"
      title="Parent payments"
      description="Instalments, mandates, and payout visibility for families are included on CoachFlow Academy."
    >
      <PaymentsManager />
    </FeatureGate>
  );
}
