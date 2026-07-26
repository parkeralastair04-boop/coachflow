import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { PricingCard } from "@/components/pricing-card";
import { PricingComparisonTable } from "@/components/pricing-comparison-table";
import { SubscribeButton } from "@/components/subscribe-button";
import { BILLING_PLANS } from "@/lib/billing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Compare Awarix Starter, Pro, and Academy — football intelligence plans with AI reports, insights, and academy tools. 7-day free trial on every plan.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing · Awarix",
    description:
      "Compare Awarix Starter, Pro, and Academy — football intelligence plans with AI reports, insights, and academy tools. 7-day free trial on every plan.",
    url: "/pricing",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing · Awarix",
    description:
      "Compare Awarix Starter, Pro, and Academy — football intelligence plans with a 7-day free trial.",
  },
};

export default function PricingPage() {
  return (
    <div className="mesh-gradient flex min-h-full flex-col">
      <Navbar />
      <main className="flex-1">
        <section className="relative border-b border-border/60 px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="pointer-events-none absolute inset-0 tactical-grid opacity-[0.06]" aria-hidden />
          <div className="pointer-events-none absolute inset-0 stadium-gradient opacity-60" aria-hidden />
          <div className="relative mx-auto max-w-6xl">
            <p className="text-accent text-[11px] font-bold tracking-[0.24em] uppercase">
              Football intelligence plans
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Pricing for coaches who develop players
            </h1>
            <p className="text-muted mt-4 max-w-2xl text-lg leading-relaxed">
              Every paid plan includes 7 days to coach free. No payment today. Cancel anytime
              during your trial. Feature lists reflect what Awarix ships now.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
          <div className="grid items-stretch gap-6 lg:grid-cols-3 lg:gap-8">
            {BILLING_PLANS.map((plan) => (
              <PricingCard
                key={plan.id}
                name={plan.name}
                price={plan.price}
                description={plan.description}
                features={plan.features}
                highlighted={plan.highlighted}
                badge={plan.badge}
                cta={
                  <SubscribeButton
                    planId={plan.id}
                    monthlyPounds={plan.monthlyPounds}
                    highlighted={plan.highlighted}
                  />
                }
              />
            ))}
          </div>

          <PricingComparisonTable />
        </div>
      </main>
      <Footer />
    </div>
  );
}
