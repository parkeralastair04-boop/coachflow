import type { Metadata } from "next";
import { Suspense } from "react";
import { FeatureGate } from "@/components/feature-gate";
import { MatchesManager } from "@/components/matches-manager";

export const metadata: Metadata = {
  title: "Match Centre",
};

export default function MatchesPage() {
  return (
    <FeatureGate feature="match_centre">
      <Suspense
        fallback={
          <div className="glass-panel text-muted rounded-2xl p-6 text-sm">Loading Match Centre...</div>
        }
      >
        <MatchesManager />
      </Suspense>
    </FeatureGate>
  );
}
