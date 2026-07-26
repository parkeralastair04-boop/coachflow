import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PricingCard } from "@/components/pricing-card";
import { BILLING_PLANS } from "@/lib/billing";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MarketingPricingPreview() {
  return (
    <section
      id="pricing"
      className="scroll-mt-20 bg-[#030712] px-5 py-20 text-white sm:px-8 sm:py-28 lg:px-12"
      aria-labelledby="pricing-heading"
    >
      <div className="mx-auto max-w-[90rem]">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-accent text-[11px] font-bold tracking-[0.35em] uppercase">
              Pricing
            </p>
            <h2
              id="pricing-heading"
              className="mt-4 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl"
            >
              Plans for every stage of your academy.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-white/60">
              Every plan includes a 7-day free trial. No payment today. Feature lists
              match what Awarix ships now.
            </p>
          </div>
          <Link
            href="/pricing"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "shrink-0 border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white",
            )}
          >
            Full comparison
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>

        <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-3 lg:gap-8">
          {BILLING_PLANS.map((plan) => (
            <PricingCard
              key={plan.id}
              name={plan.name}
              price={plan.price}
              description={plan.description}
              features={plan.features}
              highlighted={plan.highlighted}
              badge={plan.badge}
              ctaHref="/signup"
              ctaLabel="Start coaching free"
              showTrialPerks={false}
              className={cn(
                  "border-white/15 bg-white/10 text-white hover:bg-white/15",
                  plan.highlighted && "ring-accent/50 ring-2",
                )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
