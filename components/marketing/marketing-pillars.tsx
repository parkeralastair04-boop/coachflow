import { MARKETING_PILLARS } from "@/lib/marketing-homepage";

export function MarketingPillars() {
  return (
    <section
      className="relative overflow-hidden border-b border-emerald-500/10 bg-[#071210] px-5 py-14 text-white sm:px-8 lg:px-12"
      aria-label="Core capabilities"
    >
      <div className="pointer-events-none absolute inset-0 tactical-grid opacity-[0.08]" aria-hidden />
      <div className="relative mx-auto max-w-[90rem]">
        <p className="text-center text-[11px] font-bold tracking-[0.28em] text-emerald-400/80 uppercase">
          Built for football academies
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MARKETING_PILLARS.map((pillar) => (
            <div
              key={pillar.label}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-8 backdrop-blur-sm sm:px-7"
            >
              <p className="text-emerald-400 text-sm font-semibold">{pillar.label}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/50">{pillar.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
