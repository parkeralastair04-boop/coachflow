import type { Metadata } from "next";
import Link from "next/link";
import { FeatureGate } from "@/components/feature-gate";

export const metadata: Metadata = {
  title: "Parent payments",
};

export default function PaymentsPage() {
  return (
    <FeatureGate
      feature="parent_payments"
      title="Parent payments"
      description="Instalments, mandates, and payout visibility for families are included on CoachFlow Academy."
    >
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Parent payments
          </h1>
          <p className="text-muted mt-1 text-sm">
            Track what parents owe, what cleared, and what needs a nudge.
          </p>
        </div>
        <section className="glass-panel rounded-2xl p-6 sm:p-8">
          <h2 className="text-lg font-semibold tracking-tight">Stripe & billing</h2>
          <p className="text-muted mt-2 text-sm">
            Manage your subscription and payment methods from billing settings.
          </p>
          <Link
            href="/dashboard/billing"
            className="bg-foreground text-background hover:opacity-90 mt-6 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity"
          >
            Open billing
          </Link>
        </section>
      </div>
    </FeatureGate>
  );
}
