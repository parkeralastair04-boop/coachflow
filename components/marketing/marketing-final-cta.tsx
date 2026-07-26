import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MARKETING_FINAL_CTA } from "@/lib/marketing-homepage";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MarketingFinalCta() {
  const cta = MARKETING_FINAL_CTA;

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 stadium-gradient pitch-surface-subtle" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-b from-[#030712]/80 via-[#030712]/60 to-background" aria-hidden />
      <div className="absolute inset-0 tactical-grid opacity-[0.08]" aria-hidden />

      <div className="relative mx-auto max-w-[90rem] px-5 py-24 sm:px-8 sm:py-32 lg:px-12 lg:py-40">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-accent text-[11px] font-bold tracking-[0.35em] uppercase">
            On the pitch
          </p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl lg:text-6xl">
            {cta.headline}
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/65">
            {cta.subhead}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={cta.primaryCta.href}
              className={cn(
                buttonVariants({ variant: "accent", size: "lg" }),
                "min-h-12 px-8 text-base font-semibold",
              )}
            >
              {cta.primaryCta.label}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href={cta.secondaryCta.href}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "min-h-12 border-white/25 bg-white/5 px-8 text-base text-white hover:bg-white/10 hover:text-white",
              )}
            >
              {cta.secondaryCta.label}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
