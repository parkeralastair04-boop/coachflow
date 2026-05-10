import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { PricingCard } from "@/components/pricing-card";
import { SubscribeButton } from "@/components/subscribe-button";
import { BILLING_PLANS } from "@/lib/billing";

export const metadata: Metadata = {
  title: "Pricing",
};

export default function PricingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <Navbar />
      <main className="flex-1 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Pick the right plan for your academy
          </h1>
          <p className="text-muted mt-4 max-w-2xl text-lg">
            CoachFlow uses Stripe test mode right now. Replace the test price IDs
            with your production Stripe prices when you go live.
          </p>
          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {BILLING_PLANS.map((plan) => (
              <PricingCard
                key={plan.id}
                name={plan.name}
                price={plan.price}
                description={plan.description}
                features={plan.features}
                highlighted={plan.highlighted}
                cta={<SubscribeButton planId={plan.id} highlighted={plan.highlighted} />}
              />
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
