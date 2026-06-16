import type { PlanId } from "@/lib/billing";
import { getComplimentaryAccess } from "@/lib/complimentary-access";
import {
  buildFeatureAccess,
  planMeetsMinimum,
  type FeatureKey,
} from "@/lib/feature-definitions";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export { FEATURE_KEYS, type FeatureKey } from "@/lib/feature-definitions";

/** Which features each plan tier includes — derived from `FEATURE_DEFINITIONS`. */
export const FEATURE_ACCESS: Record<PlanId, readonly FeatureKey[]> = buildFeatureAccess();

export type CurrentSubscription = {
  userId: string | null;
  email: string | null;
  /** Declared plan from billing metadata or complimentary default. */
  plan: PlanId;
  status: "active" | "inactive";
  isFounder: boolean;
  isBetaTester: boolean;
  hasComplimentaryAccess: boolean;
  /** Plan used for feature checks (complimentary → academy; lapsed paid → starter-level access). */
  effectivePlan: PlanId;
};

function isPlanId(value: unknown): value is PlanId {
  return value === "starter" || value === "pro" || value === "academy";
}

function parseMetadataStatus(raw: unknown): "active" | "inactive" {
  if (raw === "active" || raw === "trialing") return "active";
  return "inactive";
}

/** Pure check: does this plan tier include the feature? */
export function planHasFeature(plan: PlanId, featureKey: FeatureKey): boolean {
  return FEATURE_ACCESS[plan].includes(featureKey);
}

function computeEffectivePlan(args: {
  hasComplimentaryAccess: boolean;
  declaredPlan: PlanId;
  status: "active" | "inactive";
}): PlanId {
  if (args.hasComplimentaryAccess) return "academy";
  if (args.status !== "active") return "starter";
  return args.declaredPlan;
}

/**
 * Reads the signed-in user from cookies and resolves subscription tier for gating.
 * Stripe webhooks (or admin) can set `user_metadata.subscription_plan` and `subscription_status`.
 * Beta testers are flagged with `user_metadata.is_beta_tester`.
 */
export async function getCurrentSubscription(): Promise<CurrentSubscription | null> {
  if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const email = user.email ?? null;
  const complimentary = getComplimentaryAccess({
    email,
    metadata: user.user_metadata,
  });

  const metaPlanRaw = user.user_metadata?.subscription_plan;
  const declaredPlan: PlanId = isPlanId(metaPlanRaw)
    ? metaPlanRaw
    : complimentary.plan;

  const status = complimentary.hasComplimentaryAccess
    ? ("active" as const)
    : parseMetadataStatus(user.user_metadata?.subscription_status);

  const effectivePlan = computeEffectivePlan({
    hasComplimentaryAccess: complimentary.hasComplimentaryAccess,
    declaredPlan,
    status,
  });

  return {
    userId: user.id,
    email,
    plan: complimentary.hasComplimentaryAccess ? "academy" : declaredPlan,
    status: complimentary.hasComplimentaryAccess ? "active" : status,
    isFounder: complimentary.isFounder,
    isBetaTester: complimentary.isBetaTester,
    hasComplimentaryAccess: complimentary.hasComplimentaryAccess,
    effectivePlan,
  };
}

export async function hasFeatureAccess(featureKey: FeatureKey): Promise<boolean> {
  const sub = await getCurrentSubscription();
  if (!sub) return false;
  return planHasFeature(sub.effectivePlan, featureKey);
}

export { planMeetsMinimum };
