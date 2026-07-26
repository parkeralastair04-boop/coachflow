import { cache } from "react";
import type { PlanId } from "@/lib/billing";
import {
  buildFeatureAccess,
  planMeetsMinimum,
  type FeatureKey,
} from "@/lib/feature-definitions";
import {
  getUserEntitlements,
  userHasFeatureAccess,
} from "@/lib/entitlements";
import { logAuthTiming } from "@/lib/auth/server";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

export { FEATURE_KEYS, type FeatureKey } from "@/lib/feature-definitions";

/** Which features each plan tier includes — derived from `FEATURE_DEFINITIONS`. */
export const FEATURE_ACCESS: Record<PlanId, readonly FeatureKey[]> = buildFeatureAccess();

export type CurrentSubscription = {
  userId: string | null;
  email: string | null;
  /** Declared plan from trusted entitlements or complimentary default. */
  plan: PlanId;
  status: "active" | "inactive";
  isFounder: boolean;
  isBetaTester: boolean;
  hasComplimentaryAccess: boolean;
  /** Plan used for feature checks (complimentary → academy; lapsed paid → starter-level access). */
  effectivePlan: PlanId;
};

/** Pure check: does this plan tier include the feature? */
export function planHasFeature(plan: PlanId, featureKey: FeatureKey): boolean {
  return FEATURE_ACCESS[plan].includes(featureKey);
}

/**
 * Resolves subscription tier for gating via server-owned entitlements.
 * Does not read client-writable user_metadata.
 */
export const getCurrentSubscription = cache(
  async (): Promise<CurrentSubscription | null> => {
    const startedAt = performance.now();
    try {
      if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
        return null;
      }

      const entitlements = await getUserEntitlements();
      if (!entitlements) return null;

      const status: "active" | "inactive" =
        entitlements.status === "trialing" || entitlements.status === "active"
          ? "active"
          : "inactive";

      return {
        userId: entitlements.userId,
        email: entitlements.email,
        plan: entitlements.plan,
        status,
        isFounder: entitlements.isFounder,
        isBetaTester: entitlements.isBetaTester,
        hasComplimentaryAccess: entitlements.hasComplimentaryAccess,
        effectivePlan: entitlements.effectivePlan,
      };
    } finally {
      logAuthTiming("getCurrentSubscription", startedAt);
    }
  },
);

export async function hasFeatureAccess(featureKey: FeatureKey): Promise<boolean> {
  return userHasFeatureAccess(featureKey);
}

export { planMeetsMinimum, getUserEntitlements };
