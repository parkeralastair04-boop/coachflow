import type { Metadata } from "next";
import { FeatureGate } from "@/components/feature-gate";
import { ReferralsManager } from "@/components/referrals-manager";

export const metadata: Metadata = {
  title: "Referrals",
};

export default function ReferralsPage() {
  return (
    <FeatureGate feature="referrals">
      <ReferralsManager />
    </FeatureGate>
  );
}
