import type { Metadata } from "next";
import { FeatureGate } from "@/components/feature-gate";

export const metadata: Metadata = {
  title: "Camps",
};

export default function CampsPage() {
  return (
    <FeatureGate
      feature="camps"
      title="Holiday camps & blocks"
      description="Multi-day camps, capacity, and parent comms are part of CoachFlow Academy."
    >
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Camps</h1>
          <p className="text-muted mt-1 text-sm">
            Plan camp weeks, deposits, and rosters from one place.
          </p>
        </div>
        <section className="glass-panel rounded-2xl p-6 sm:p-8">
          <h2 className="text-lg font-semibold tracking-tight">Upcoming camps</h2>
          <p className="text-muted mt-2 text-sm">
            Connect your bookings data to list live camp blocks here.
          </p>
        </section>
      </div>
    </FeatureGate>
  );
}
