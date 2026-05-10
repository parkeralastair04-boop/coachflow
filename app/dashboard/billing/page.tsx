import type { Metadata } from "next";
import Link from "next/link";
import { ManageBillingButton } from "@/components/manage-billing-button";

export const metadata: Metadata = {
  title: "Billing",
};

export default function BillingPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Billing</h1>
        <p className="text-muted mt-1 text-sm">
          Manage your Stripe subscription and payment settings.
        </p>
      </div>

      <section className="glass-panel rounded-2xl p-6 sm:p-8">
        <h2 className="text-lg font-semibold tracking-tight">Subscription management</h2>
        <p className="text-muted mt-1 text-sm">
          Open Stripe Billing Portal to update payment method, invoices, or cancel.
        </p>
        <div className="mt-6">
          <ManageBillingButton />
        </div>
      </section>

      <section className="glass-panel rounded-2xl p-6 sm:p-8">
        <h2 className="text-lg font-semibold tracking-tight">Need a plan change?</h2>
        <p className="text-muted mt-1 text-sm">
          Compare plans and start a new checkout flow from pricing.
        </p>
        <Link
          href="/pricing"
          className="bg-foreground text-background hover:opacity-90 mt-6 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity"
        >
          View Pricing
        </Link>
      </section>
    </div>
  );
}
