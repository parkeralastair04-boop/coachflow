import { CalendarCheck, ClipboardList, Cone, Goal, Megaphone, Shirt } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MARKETING_WORKFLOW } from "@/lib/marketing-homepage";

const STEP_ICONS: LucideIcon[] = [Shirt, Cone, Goal, ClipboardList, Megaphone, CalendarCheck];

export function MarketingWorkflowStrip() {
  return (
    <section
      id="workflow"
      className="relative overflow-hidden border-y border-emerald-500/15 bg-[#04100e] px-5 py-16 text-white sm:px-8 lg:px-12 lg:py-20"
      aria-labelledby="workflow-heading"
    >
      <div className="pointer-events-none absolute inset-0 tactical-grid opacity-[0.1]" aria-hidden />
      <div className="pointer-events-none absolute inset-0 pitch-surface-subtle opacity-30" aria-hidden />

      <div className="relative mx-auto max-w-[90rem]">
        <p className="text-accent text-[11px] font-bold tracking-[0.28em] uppercase">
          Academy workflow
        </p>
        <h2
          id="workflow-heading"
          className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.03em] sm:text-4xl"
        >
          From Monday planning to Saturday match day
        </h2>
        <p className="text-muted mt-3 max-w-xl text-base leading-relaxed text-white/55">
          Awarix follows how academies actually develop players — intelligence and ops in the same weekly rhythm.
        </p>

        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {MARKETING_WORKFLOW.map((step, index) => {
            const Icon = STEP_ICONS[index] ?? CalendarCheck;
            return (
              <li
                key={step.title}
                className="relative rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-sm"
              >
                <span className="text-emerald-400/50 font-mono text-xs">{step.number}</span>
                <div className="bg-accent/15 ring-accent/25 mt-3 flex size-10 items-center justify-center rounded-xl ring-1">
                  <Icon className="text-accent size-[1.125rem]" aria-hidden />
                </div>
                <h3 className="mt-4 text-sm font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-white/45">{step.description}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
