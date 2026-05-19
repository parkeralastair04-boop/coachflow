import type { Metadata } from "next";
import { CampsManager } from "@/components/camps-manager";
import { FeatureGate } from "@/components/feature-gate";

export const metadata: Metadata = {
  title: "Camps",
};

export default function CampsPage() {
  return (
    <FeatureGate feature="camps">
      <CampsManager />
    </FeatureGate>
  );
}
