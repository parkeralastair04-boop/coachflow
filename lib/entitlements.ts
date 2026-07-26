import "server-only";

import { cache } from "react";
import type { PlanId } from "@/lib/billing";
import { getAuthenticatedUser, getServerSupabase } from "@/lib/auth/server";
import { getComplimentaryAccess } from "@/lib/complimentary-access";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FeatureKey } from "@/lib/feature-definitions";
import { buildFeatureAccess } from "@/lib/feature-definitions";

const FEATURE_ACCESS = buildFeatureAccess();

function planHasFeature(plan: PlanId, featureKey: FeatureKey): boolean {
  return FEATURE_ACCESS[plan].includes(featureKey);
}
export type EntitlementStatus =
  | "trialing"
  | "active"
  | "inactive"
  | "past_due"
  | "canceled";

export type EntitlementSource = "stripe" | "complimentary" | "none";

export type UserEntitlements = {
  userId: string;
  email: string | null;
  /** Declared plan from Stripe / complimentary. */
  plan: PlanId;
  status: EntitlementStatus;
  /** Plan used for feature checks. */
  effectivePlan: PlanId;
  isTrial: boolean;
  trialEndsAt: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  isFounder: boolean;
  isBetaTester: boolean;
  hasComplimentaryAccess: boolean;
  source: EntitlementSource;
};

type CoachEntitlementRow = {
  user_id: string;
  plan_id: string;
  status: string;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  source: string;
};

function isPlanId(value: unknown): value is PlanId {
  return value === "starter" || value === "pro" || value === "academy";
}

function isEntitlementStatus(value: unknown): value is EntitlementStatus {
  return (
    value === "trialing" ||
    value === "active" ||
    value === "inactive" ||
    value === "past_due" ||
    value === "canceled"
  );
}

function statusGrantsPaidAccess(
  status: EntitlementStatus,
  trialEndsAt: Date | null,
): boolean {
  if (status === "active") return true;
  if (status === "trialing") {
    // Fail closed when Stripe still says trialing but the trial window has ended.
    if (!trialEndsAt) return true;
    return trialEndsAt.getTime() > Date.now();
  }
  return false;
}

function computeEffectivePlan(args: {
  hasComplimentaryAccess: boolean;
  plan: PlanId;
  status: EntitlementStatus;
  trialEndsAt: Date | null;
}): PlanId {
  if (args.hasComplimentaryAccess) return "academy";
  if (!statusGrantsPaidAccess(args.status, args.trialEndsAt)) return "starter";
  return args.plan;
}

/**
 * Authoritative entitlement resolver for the signed-in user.
 * Reads server-owned `coach_entitlements` (+ complimentary founder/beta).
 * Never trusts client-writable user_metadata for plan access.
 */
export const getUserEntitlements = cache(
  async (): Promise<UserEntitlements | null> => {
    const user = await getAuthenticatedUser();
    if (!user) return null;

    const email = user.email ?? null;
    // Beta flags must live in app_metadata (admin-only), never user_metadata.
    const complimentary = getComplimentaryAccess({
      email,
      appMetadata: user.app_metadata as Record<string, unknown> | undefined,
    });

    if (complimentary.hasComplimentaryAccess) {
      return {
        userId: user.id,
        email,
        plan: "academy",
        status: "active",
        effectivePlan: "academy",
        isTrial: false,
        trialEndsAt: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        isFounder: complimentary.isFounder,
        isBetaTester: complimentary.isBetaTester,
        hasComplimentaryAccess: true,
        source: "complimentary",
      };
    }

    const supabase = await getServerSupabase();
    const { data, error } = await supabase
      .from("coach_entitlements")
      .select(
        "user_id, plan_id, status, trial_ends_at, stripe_customer_id, stripe_subscription_id, source",
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[entitlements] failed to load coach_entitlements", error);
      }
      // Fail closed to Starter — never fall back to user_metadata.
      return {
        userId: user.id,
        email,
        plan: "starter",
        status: "inactive",
        effectivePlan: "starter",
        isTrial: false,
        trialEndsAt: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        isFounder: false,
        isBetaTester: false,
        hasComplimentaryAccess: false,
        source: "none",
      };
    }

    const row = data as CoachEntitlementRow | null;
    if (!row || !isPlanId(row.plan_id) || !isEntitlementStatus(row.status)) {
      return {
        userId: user.id,
        email,
        plan: "starter",
        status: "inactive",
        effectivePlan: "starter",
        isTrial: false,
        trialEndsAt: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        isFounder: false,
        isBetaTester: false,
        hasComplimentaryAccess: false,
        source: "none",
      };
    }

    const trialEndsAt = row.trial_ends_at ? new Date(row.trial_ends_at) : null;
    const isTrial =
      row.status === "trialing" &&
      Boolean(trialEndsAt && trialEndsAt.getTime() > Date.now());

    const effectivePlan = computeEffectivePlan({
      hasComplimentaryAccess: false,
      plan: row.plan_id,
      status: row.status,
      trialEndsAt,
    });

    // Surface expired trials as inactive for billing labels while keeping Stripe plan_id.
    const statusForUi: EntitlementStatus =
      row.status === "trialing" && !isTrial ? "inactive" : row.status;

    return {
      userId: user.id,
      email,
      plan: row.plan_id,
      status: statusForUi,
      effectivePlan,
      isTrial,
      trialEndsAt: isTrial ? trialEndsAt : null,
      stripeCustomerId: row.stripe_customer_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      isFounder: false,
      isBetaTester: false,
      hasComplimentaryAccess: false,
      source: row.source === "complimentary" ? "complimentary" : "stripe",
    };
  },
);

export async function userHasFeatureAccess(
  featureKey: FeatureKey,
): Promise<boolean> {
  const entitlements = await getUserEntitlements();
  if (!entitlements) return false;
  return planHasFeature(entitlements.effectivePlan, featureKey);
}

export function listFeaturesForPlan(plan: PlanId): readonly FeatureKey[] {
  return FEATURE_ACCESS[plan];
}

export type UpsertCoachEntitlementInput = {
  userId: string;
  planId: PlanId;
  status: EntitlementStatus;
  trialEndsAt?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  source?: "stripe" | "complimentary";
};

/**
 * Service-role upsert. Only call from Stripe webhooks / trusted admin flows.
 */
export async function upsertCoachEntitlement(
  input: UpsertCoachEntitlementInput,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("coach_entitlements").upsert(
    {
      user_id: input.userId,
      plan_id: input.planId,
      status: input.status,
      trial_ends_at: input.trialEndsAt ?? null,
      stripe_customer_id: input.stripeCustomerId ?? null,
      stripe_subscription_id: input.stripeSubscriptionId ?? null,
      source: input.source ?? "stripe",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error(`Failed to upsert coach entitlements: ${error.message}`);
  }
}

/**
 * Strip legacy client-writable subscription fields from user_metadata so they
 * cannot be used as a shadow source of truth.
 *
 * Retention (Sprint 6.5): keep calling this from Stripe webhook sync until
 * production Auth users no longer retain subscription_* metadata. After a
 * one-time admin audit confirms zero remaining keys, schedule removal of this
 * helper and its webhook call in a follow-up cleanup sprint.
 */
export async function clearLegacySubscriptionUserMetadata(
  userId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data, error: loadError } = await admin.auth.admin.getUserById(userId);
  if (loadError || !data.user) {
    throw new Error(
      `Failed to load user for metadata cleanup: ${loadError?.message ?? "not found"}`,
    );
  }

  const previous = { ...(data.user.user_metadata ?? {}) } as Record<
    string,
    unknown
  >;
  delete previous.subscription_plan;
  delete previous.subscription_status;
  delete previous.trial_ends_at;
  delete previous.stripe_subscription_id;
  delete previous.stripe_customer_id;
  // Beta must not live in user_metadata.
  delete previous.is_beta_tester;

  const { error } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: previous,
  });
  if (error) {
    throw new Error(`Failed to clear legacy subscription metadata: ${error.message}`);
  }
}
