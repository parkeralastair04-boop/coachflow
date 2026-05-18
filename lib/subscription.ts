import type { PlanId } from "@/lib/billing";
import { getAccountBillingAccess } from "@/lib/founders";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const FEATURE_KEYS = [
  "players",
  "sessions",
  "analytics",
  "reports",
  "saved_reports",
  "group_registers",
  "camps",
  "offline_registers",
  "parent_emails",
  "parent_payments",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

const ALL_FEATURES: readonly FeatureKey[] = [...FEATURE_KEYS];

/** Which features each plan tier includes (Academy = full product). */
export const FEATURE_ACCESS: Record<PlanId, readonly FeatureKey[]> = {
  starter: ["players", "sessions"],
  pro: [
    "players",
    "sessions",
    "analytics",
    "reports",
    "saved_reports",
    "group_registers",
    "parent_emails",
  ],
  academy: ALL_FEATURES,
};

export type CurrentSubscription = {
  userId: string | null;
  email: string | null;
  /** Declared plan from billing metadata or founder default. */
  plan: PlanId;
  status: "active" | "inactive";
  isFounder: boolean;
  /** Plan used for feature checks (founders → academy; lapsed paid → starter-level access). */
  effectivePlan: PlanId;
};

function isPlanId(value: unknown): value is PlanId {
  return value === "starter" || value === "pro" || value === "academy";
}

function parseMetadataStatus(
  raw: unknown,
): "active" | "inactive" {
  if (raw === "active" || raw === "trialing") return "active";
  return "inactive";
}

/** Pure check: does this plan tier include the feature? */
export function planHasFeature(plan: PlanId, featureKey: FeatureKey): boolean {
  return FEATURE_ACCESS[plan].includes(featureKey);
}

function computeEffectivePlan(args: {
  isFounder: boolean;
  declaredPlan: PlanId;
  status: "active" | "inactive";
}): PlanId {
  if (args.isFounder) return "academy";
  if (args.status !== "active") return "starter";
  return args.declaredPlan;
}

/**
 * Reads the signed-in user from cookies and resolves subscription tier for gating.
 * Stripe webhooks (or admin) can set `user_metadata.subscription_plan` and `subscription_status`.
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
  const founderAccess = getAccountBillingAccess(email);

  const metaPlanRaw = user.user_metadata?.subscription_plan;
  const declaredPlan: PlanId = isPlanId(metaPlanRaw)
    ? metaPlanRaw
    : founderAccess.plan;

  const status = founderAccess.isFounder
    ? ("active" as const)
    : parseMetadataStatus(user.user_metadata?.subscription_status);

  const effectivePlan = computeEffectivePlan({
    isFounder: founderAccess.isFounder,
    declaredPlan,
    status,
  });

  return {
    userId: user.id,
    email,
    plan: founderAccess.isFounder ? "academy" : declaredPlan,
    status: founderAccess.isFounder ? "active" : status,
    isFounder: founderAccess.isFounder,
    effectivePlan,
  };
}

export async function hasFeatureAccess(
  featureKey: FeatureKey,
): Promise<boolean> {
  const sub = await getCurrentSubscription();
  if (!sub) return false;
  return planHasFeature(sub.effectivePlan, featureKey);
}
