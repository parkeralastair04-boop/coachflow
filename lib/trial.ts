import "server-only";

import { cache } from "react";
import type Stripe from "stripe";
import { BILLING_PLANS, getPlanById, type PlanId } from "@/lib/billing";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { getStripeServerClient } from "@/lib/stripe";
import {
  TRIAL_PERIOD_DAYS,
  addTrialDays,
  buildCheckoutTrialMessage,
  formatUkLongDate,
  formatUkShortDate,
} from "@/lib/trial-copy";

export {
  TRIAL_PERIOD_DAYS,
  buildCheckoutTrialMessage,
  formatUkLongDate,
  formatUkShortDate,
};

export const addDays = addTrialDays;

export type TrialStatus = {
  isTrial: boolean;
  trialEndsAt: Date | null;
  daysRemaining: number | null;
  nextPaymentDate: Date | null;
  planId: PlanId | null;
  planName: string | null;
  monthlyPounds: number | null;
  subscriptionStatus: string | null;
};

const EMPTY_TRIAL_STATUS: TrialStatus = {
  isTrial: false,
  trialEndsAt: null,
  daysRemaining: null,
  nextPaymentDate: null,
  planId: null,
  planName: null,
  monthlyPounds: null,
  subscriptionStatus: null,
};

export function computeDaysRemaining(trialEndsAt: Date, now = new Date()): number {
  const ms = trialEndsAt.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function isPlanId(value: unknown): value is PlanId {
  return value === "starter" || value === "pro" || value === "academy";
}

function planIdFromSubscription(subscription: Stripe.Subscription): PlanId | null {
  const fromMeta = subscription.metadata?.plan_id?.trim();
  if (isPlanId(fromMeta)) return fromMeta;

  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) return null;
  const plan = BILLING_PLANS.find((p) => p.stripePriceId === priceId);
  return plan?.id ?? null;
}

/**
 * A Stripe customer is trial-ineligible once they have ever had a subscription
 * with a trial window, or customer metadata marks the trial as used.
 */
export async function customerHasUsedTrial(
  customer: Stripe.Customer,
): Promise<boolean> {
  if (customer.metadata?.awarix_trial_used === "true") {
    return true;
  }

  const stripe = getStripeServerClient();
  const subscriptions = await stripe.subscriptions.list({
    customer: customer.id,
    status: "all",
    limit: 100,
  });

  return subscriptions.data.some(
    (subscription) =>
      subscription.trial_start != null || subscription.trial_end != null,
  );
}

/**
 * Resolve an existing Stripe customer owned by this Awarix user, or create one.
 * Email alone never establishes ownership; awarix_user_id is never overwritten.
 */
export async function resolveOrCreateStripeCustomer(args: {
  email: string;
  userId: string;
  preferredCustomerId?: string | null;
}): Promise<Stripe.Customer> {
  const { resolveOrCreateStripeCustomerForUser } = await import(
    "@/lib/stripe-customer-ownership"
  );
  return resolveOrCreateStripeCustomerForUser(args);
}

export async function markStripeCustomerTrialUsed(
  customerId: string,
): Promise<void> {
  const stripe = getStripeServerClient();
  await stripe.customers.update(customerId, {
    metadata: { awarix_trial_used: "true" },
  });
}

function trialStatusFromSubscription(
  subscription: Stripe.Subscription,
): TrialStatus {
  const planId = planIdFromSubscription(subscription);
  const plan = planId ? getPlanById(planId) : undefined;
  const trialEndsAt =
    subscription.status === "trialing" && subscription.trial_end
      ? new Date(subscription.trial_end * 1000)
      : null;
  const isTrial = Boolean(trialEndsAt);

  const periodEndIso = (() => {
    const raw = subscription as unknown as { current_period_end?: number };
    if (typeof raw.current_period_end === "number") {
      return new Date(raw.current_period_end * 1000);
    }
    return null;
  })();

  return {
    isTrial,
    trialEndsAt,
    daysRemaining: trialEndsAt ? computeDaysRemaining(trialEndsAt) : null,
    nextPaymentDate: isTrial ? trialEndsAt : periodEndIso,
    planId: planId ?? null,
    planName: plan?.name ?? null,
    monthlyPounds: plan?.monthlyPounds ?? null,
    subscriptionStatus: subscription.status,
  };
}

/**
 * Request-scoped trial status for the signed-in coach.
 * Uses server-owned entitlements; optional Stripe fallback for display only.
 */
export const getTrialStatus = cache(async (): Promise<TrialStatus> => {
  const user = await getAuthenticatedUser();
  if (!user?.email?.trim()) return EMPTY_TRIAL_STATUS;

  const { getUserEntitlements } = await import("@/lib/entitlements");
  const entitlements = await getUserEntitlements();
  if (!entitlements) return EMPTY_TRIAL_STATUS;

  if (entitlements.hasComplimentaryAccess) {
    return {
      ...EMPTY_TRIAL_STATUS,
      planId: "academy",
      planName: "Academy",
      monthlyPounds: getPlanById("academy")?.monthlyPounds ?? null,
      subscriptionStatus: "complimentary",
    };
  }

  if (entitlements.isTrial && entitlements.trialEndsAt) {
    const plan = getPlanById(entitlements.plan);
    return {
      isTrial: true,
      trialEndsAt: entitlements.trialEndsAt,
      daysRemaining: computeDaysRemaining(entitlements.trialEndsAt),
      nextPaymentDate: entitlements.trialEndsAt,
      planId: entitlements.plan,
      planName: plan?.name ?? null,
      monthlyPounds: plan?.monthlyPounds ?? null,
      subscriptionStatus: "trialing",
    };
  }

  if (entitlements.status === "active") {
    const plan = getPlanById(entitlements.plan);
    return {
      ...EMPTY_TRIAL_STATUS,
      planId: entitlements.plan,
      planName: plan?.name ?? null,
      monthlyPounds: plan?.monthlyPounds ?? null,
      subscriptionStatus: "active",
    };
  }

  // Display-only Stripe fallback when entitlements row is not yet synced.
  try {
    const stripe = getStripeServerClient();
    const customerId = entitlements.stripeCustomerId;
    if (!customerId) return EMPTY_TRIAL_STATUS;

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 20,
    });

    const coachSubs = subscriptions.data.filter((subscription) => {
      const planId = planIdFromSubscription(subscription);
      return planId != null;
    });

    const preferred =
      coachSubs.find((s) => s.status === "trialing") ??
      coachSubs.find((s) => s.status === "active") ??
      coachSubs[0];

    if (!preferred) return EMPTY_TRIAL_STATUS;
    return trialStatusFromSubscription(preferred);
  } catch {
    return EMPTY_TRIAL_STATUS;
  }
});
