import "server-only";

import { cache } from "react";
import type Stripe from "stripe";
import { getPlanById, type PlanId } from "@/lib/billing";
import { getUserEntitlements } from "@/lib/entitlements";
import { getStripeServerClient } from "@/lib/stripe";
import { computeDaysRemaining, getTrialStatus } from "@/lib/trial";

export type BillingPaymentMethod = {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
};

export type BillingInvoiceRow = {
  id: string;
  number: string | null;
  status: string | null;
  amountLabel: string;
  date: Date;
  hostedUrl: string | null;
  pdfUrl: string | null;
};

export type BillingAccountDetails = {
  hasComplimentaryAccess: boolean;
  planId: PlanId | null;
  planName: string | null;
  statusLabel: string;
  isTrial: boolean;
  trialEndsAt: Date | null;
  daysRemaining: number | null;
  renewalDate: Date | null;
  monthlyPounds: number | null;
  paymentMethod: BillingPaymentMethod | null;
  invoices: BillingInvoiceRow[];
  canManageInPortal: boolean;
};

function formatCardBrand(brand: string): string {
  const normalized = brand.trim().toLowerCase();
  if (!normalized) return "Card";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatInvoiceAmount(invoice: Stripe.Invoice): string {
  const amount =
    invoice.status === "paid"
      ? invoice.amount_paid
      : invoice.amount_due || invoice.total;
  const pounds = (amount ?? 0) / 100;
  return `£${pounds.toFixed(2)}`;
}

function paymentMethodFromStripe(
  paymentMethod: Stripe.PaymentMethod | null | undefined,
): BillingPaymentMethod | null {
  if (!paymentMethod?.card) return null;
  return {
    brand: formatCardBrand(paymentMethod.card.brand),
    last4: paymentMethod.card.last4,
    expMonth: paymentMethod.card.exp_month,
    expYear: paymentMethod.card.exp_year,
  };
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const raw = subscription as Stripe.Subscription & { current_period_end?: number };
  if (typeof raw.current_period_end !== "number") return null;
  return new Date(raw.current_period_end * 1000);
}

function statusLabelFromEntitlements(args: {
  hasComplimentaryAccess: boolean;
  isTrial: boolean;
  status: string;
}): string {
  if (args.hasComplimentaryAccess) return "Complimentary";
  if (args.isTrial) return "Free trial";
  if (args.status === "active") return "Active";
  if (args.status === "past_due") return "Past due";
  if (args.status === "canceled") return "Canceled";
  if (args.status === "trialing") return "Free trial";
  return "No subscription";
}

export const getBillingAccountDetails = cache(
  async (): Promise<BillingAccountDetails | null> => {
    const [entitlements, trial] = await Promise.all([
      getUserEntitlements(),
      getTrialStatus(),
    ]);
    if (!entitlements) return null;

    const plan = entitlements.plan ? getPlanById(entitlements.plan) : undefined;
    const complimentary = entitlements.hasComplimentaryAccess;

    const base: BillingAccountDetails = {
      hasComplimentaryAccess: complimentary,
      planId: complimentary ? "academy" : entitlements.plan,
      planName:
        complimentary ? "Academy" : trial.planName ?? plan?.name ?? null,
      statusLabel: statusLabelFromEntitlements({
        hasComplimentaryAccess: complimentary,
        isTrial: trial.isTrial,
        status: entitlements.status,
      }),
      isTrial: trial.isTrial,
      trialEndsAt: trial.trialEndsAt,
      daysRemaining: trial.trialEndsAt
        ? computeDaysRemaining(trial.trialEndsAt)
        : null,
      renewalDate: trial.isTrial ? trial.trialEndsAt : trial.nextPaymentDate,
      monthlyPounds: trial.monthlyPounds ?? plan?.monthlyPounds ?? null,
      paymentMethod: null,
      invoices: [],
      canManageInPortal: !complimentary,
    };

    const customerId = entitlements.stripeCustomerId;
    if (!customerId || complimentary) return base;

    try {
      const stripe = getStripeServerClient();
      const customer = (await stripe.customers.retrieve(customerId, {
        expand: ["invoice_settings.default_payment_method"],
      })) as Stripe.Customer;

      if (!customer.deleted) {
        const defaultPm = customer.invoice_settings?.default_payment_method;
        if (defaultPm && typeof defaultPm === "object") {
          base.paymentMethod = paymentMethodFromStripe(defaultPm);
        }

        if (!base.paymentMethod) {
          const methods = await stripe.paymentMethods.list({
            customer: customerId,
            type: "card",
            limit: 1,
          });
          base.paymentMethod = paymentMethodFromStripe(methods.data[0]);
        }
      }

      const subscriptionId = entitlements.stripeSubscriptionId;
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        if (!trial.isTrial) {
          base.renewalDate = subscriptionPeriodEnd(subscription) ?? base.renewalDate;
        }
        if (subscription.status === "past_due") {
          base.statusLabel = "Past due";
        } else if (subscription.status === "canceled") {
          base.statusLabel = "Canceled";
        }
      }

      const invoiceList = await stripe.invoices.list({
        customer: customerId,
        limit: 12,
      });
      base.invoices = invoiceList.data.map((invoice) => ({
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        amountLabel: formatInvoiceAmount(invoice),
        date: new Date(invoice.created * 1000),
        hostedUrl: invoice.hosted_invoice_url ?? null,
        pdfUrl: invoice.invoice_pdf ?? null,
      }));
    } catch {
      // Stripe display is best-effort; entitlements remain authoritative.
    }

    return base;
  },
);
