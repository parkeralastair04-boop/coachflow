import type { Metadata } from "next";
import { Suspense } from "react";
import { FeatureGate } from "@/components/feature-gate";
import { TrainingPlansManager } from "@/components/training-plans-manager";

export const metadata: Metadata = {
  title: "Training Planner",
};

export default function TrainingPage() {
  return (
    <FeatureGate feature="training_planner">
      <Suspense
        fallback={
          <div className="glass-panel text-muted rounded-2xl p-6 text-sm">
            Loading Training Planner...
          </div>
        }
      >
        <TrainingPlansManager />
      </Suspense>
    </FeatureGate>
  );
}
