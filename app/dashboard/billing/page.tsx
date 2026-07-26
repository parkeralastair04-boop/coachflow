import type { Metadata } from "next";
import { BillingAccountOverview } from "@/components/billing-account-overview";
import { getBillingAccountDetails } from "@/lib/billing-account-details";
import { TYPE } from "@/lib/ui/tokens";

export const metadata: Metadata = {
  title: "Your Awarix plan",
};

export default async function BillingPage() {
  const details = await getBillingAccountDetails();

  return (
    <div className="space-y-8">
      <div>
        <h1 className={TYPE.pageTitle}>Your Awarix plan</h1>
        <p className={TYPE.description}>
          Plan access, payment method, and invoices — managed securely through
          Stripe.
        </p>
      </div>

      {details ? (
        <BillingAccountOverview details={details} />
      ) : (
        <p className="text-muted text-sm">Sign in to view billing details.</p>
      )}
    </div>
  );
}
