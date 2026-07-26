import type { Metadata } from "next";
import { Suspense } from "react";
import { TeamsManager } from "@/components/teams-manager";

export const metadata: Metadata = {
  title: "Squads",
};

export default function TeamsPage() {
  return (
    <Suspense
      fallback={
        <div className="glass-panel interactive-surface rounded-2xl p-6 text-sm text-muted">Loading teams...</div>
      }
    >
      <TeamsManager />
    </Suspense>
  );
}
