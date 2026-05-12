import type { Metadata } from "next";
import { FeatureGate } from "@/components/feature-gate";

export const metadata: Metadata = {
  title: "Registers",
};

function GroupRegistersContent() {
  return (
    <section className="glass-panel rounded-2xl p-6 sm:p-8">
      <h2 className="text-lg font-semibold tracking-tight">Group registers</h2>
      <p className="text-muted mt-2 text-sm">
        Wire this view to Supabase when your registers schema is ready.
      </p>
    </section>
  );
}

export default function RegistersPage() {
  return (
    <FeatureGate
      feature="group_registers"
      title="Group & attendance registers"
      description="Digital registers for squads and groups are included on CoachFlow Pro and Academy."
    >
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Registers</h1>
          <p className="text-muted mt-1 text-sm">
            Group rolls, offline pitch sheets, and attendance exports will live here.
          </p>
        </div>
        <GroupRegistersContent />
        <FeatureGate
          feature="offline_registers"
          title="Offline registers"
          description="Printable and offline-first register packs are part of CoachFlow Academy."
        >
          <section className="glass-panel rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-semibold tracking-tight">Offline registers</h2>
            <p className="text-muted mt-2 text-sm">
              Export squad sheets and mark attendance without signal on the pitch.
            </p>
          </section>
        </FeatureGate>
      </div>
    </FeatureGate>
  );
}
