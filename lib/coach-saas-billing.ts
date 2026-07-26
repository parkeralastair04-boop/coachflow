import "server-only";

import type Stripe from "stripe";
import type { PlanId } from "@/lib/billing";
import {
  clearLegacySubscriptionUserMetadata,
  upsertCoachEntitlement,
  type EntitlementStatus,
} from "@/lib/entitlements";
import { getStripeServerClient } from "@/lib/stripe";
import {
  AWARIX_USER_ID_METADATA_KEY,
  LEGACY_USER_ID_METADATA_KEY,
  getAwarixUserIdFromCustomer,
} from "@/lib/stripe-customer-ownership";
import { createAdminClient } from "@/lib/supabase/admin";
import { markStripeCustomerTrialUsed } from "@/lib/trial";

function isPlanId(value: unknown): value is PlanId {
  return value === "starter" || value === "pro" || value === "academy";
}

function mapSubscriptionStatus(
  status: Stripe.Subscription.Status,
): EntitlementStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    default:
      return "inactive";
  }
}

async function resolveCoachUserId(args: {
  subscription: Stripe.Subscription;
  userId?: string | null;
  clientReferenceId?: string | null;
}): Promise<string | null> {
  const fromArgs = args.userId?.trim() || args.clientReferenceId?.trim() || null;
  if (fromArgs) return fromArgs;

  const fromSub =
    args.subscription.metadata?.[AWARIX_USER_ID_METADATA_KEY]?.trim() ||
    args.subscription.metadata?.[LEGACY_USER_ID_METADATA_KEY]?.trim();
  if (fromSub) return fromSub;

  const customerId =
    typeof args.subscription.customer === "string"
      ? args.subscription.customer
      : args.subscription.customer?.id;
  if (!customerId) return null;

  const stripe = getStripeServerClient();
  const customer = await stripe.customers.retrieve(customerId);
  return getAwarixUserIdFromCustomer(customer);
}

/**
 * Syncs Awarix SaaS entitlements from Stripe into `coach_entitlements`.
 * Stripe webhooks are the only writer for paid/trial state.
 */
export async function syncCoachSaasEntitlements(args: {
  subscription: Stripe.Subscription;
  userId?: string | null;
  clientReferenceId?: string | null;
}): Promise<{ applied: boolean; userId: string | null; reason?: string }> {
  const planIdRaw = args.subscription.metadata?.plan_id?.trim();
  if (!isPlanId(planIdRaw)) {
    return { applied: false, userId: null, reason: "missing_plan_id" };
  }

  const userId = await resolveCoachUserId(args);
  if (!userId) {
    return { applied: false, userId: null, reason: "user_not_found" };
  }

  const admin = createAdminClient();
  const { data: existingUser, error: loadError } =
    await admin.auth.admin.getUserById(userId);
  if (loadError || !existingUser.user) {
    return { applied: false, userId, reason: "user_not_found" };
  }

  const customerId =
    typeof args.subscription.customer === "string"
      ? args.subscription.customer
      : args.subscription.customer?.id ?? null;

  const trialEndsAt = args.subscription.trial_end
    ? new Date(args.subscription.trial_end * 1000).toISOString()
    : null;

  const status = mapSubscriptionStatus(args.subscription.status);

  await upsertCoachEntitlement({
    userId,
    planId: planIdRaw,
    status,
    trialEndsAt,
    stripeCustomerId: customerId,
    stripeSubscriptionId: args.subscription.id,
    source: "stripe",
  });

  // Remove legacy client-writable metadata so it cannot shadow entitlements.
  await clearLegacySubscriptionUserMetadata(userId);

  if (
    customerId &&
    (args.subscription.trial_start != null ||
      args.subscription.status === "trialing")
  ) {
    await markStripeCustomerTrialUsed(customerId);
  }

  if (process.env.NODE_ENV === "development") {
    console.info(
      `[entitlements] synced user=${userId} plan=${planIdRaw} status=${status}`,
    );
  }

  return { applied: true, userId };
}

export function isCoachSaasSubscription(
  subscription: Stripe.Subscription,
): boolean {
  return isPlanId(subscription.metadata?.plan_id?.trim());
}

/**
 * Throws when a coach SaaS sync did not apply — forces Stripe to retry.
 */
export function assertCoachSaasSyncApplied(result: {
  applied: boolean;
  reason?: string;
}): void {
  if (result.applied) return;
  const reason = result.reason ?? "unknown";
  throw new Error(
    `Coach SaaS entitlement sync did not apply (${reason}). Will retry.`,
  );
}
