import type { Metadata } from "next";
import { DashboardStats } from "@/components/dashboard-stats";
import { DashboardHeader } from "@/components/dashboard-header";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <div className="space-y-10">
      <DashboardHeader />
      <DashboardStats />

      <section id="sessions" className="scroll-mt-24 space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Upcoming sessions</h2>
        <div className="glass-panel rounded-2xl p-6">
          <ul className="divide-border divide-y text-sm">
            {[
              { t: "U12 Development — Skills", when: "Tue · 17:30 · Pitch A" },
              { t: "U9 Mini kickers", when: "Wed · 09:00 · Dome" },
              { t: "1:1 goalkeeper block", when: "Thu · 18:15 · Annex" },
            ].map((row) => (
              <li
                key={row.t}
                className="text-muted hover:text-foreground flex flex-col gap-1 py-4 transition-colors first:pt-0 last:pb-0 sm:flex-row sm:justify-between"
              >
                <span className="text-foreground font-medium">{row.t}</span>
                <span>{row.when}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section id="parents" className="scroll-mt-24 space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Parent pipeline</h2>
          <div className="glass-panel rounded-2xl p-6 text-sm">
            <p className="text-muted">
              <span className="text-foreground font-medium">8</span> trials booked ·{" "}
              <span className="text-foreground font-medium">3</span> awaiting payment ·{" "}
              <span className="text-foreground font-medium">14</span> active subscriptions
            </p>
            <p className="text-muted mt-4 text-xs">
              Snapshot of trials, payments due, and active subscriptions for your academy.
            </p>
          </div>
        </section>

        <section id="payments" className="scroll-mt-24 space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Payments</h2>
          <div className="glass-panel rounded-2xl p-6 text-sm">
            <p className="text-muted">
              <span className="text-foreground font-medium">£1,240</span> collected this week ·{" "}
              <span className="text-foreground font-medium">2</span> failed renewals
            </p>
            <p className="text-muted mt-4 text-xs">
              Weekly collection and failed renewals at a glance.
            </p>
          </div>
        </section>
      </div>

      <section id="settings" className="scroll-mt-24 space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Academy settings</h2>
        <div className="glass-panel rounded-2xl p-6 text-sm text-muted">
          Configure branding, pitch availability, and staff roles from this section.
        </div>
      </section>
    </div>
  );
}
