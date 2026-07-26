/**
 * Client-side complimentary hint (beta flag on JWT app_metadata only).
 * Founder allowlists are server-only — use GET /api/account/entitlements for
 * authoritative complimentary status (including founders).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isBetaTester } from "@/lib/beta-testers";
import {
  EMPTY_COMPLIMENTARY_ACCESS,
  type ComplimentaryAccess,
} from "@/lib/complimentary-access-types";

export async function readClientComplimentaryAccess(
  supabase: SupabaseClient,
): Promise<ComplimentaryAccess> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return EMPTY_COMPLIMENTARY_ACCESS;

  if (isBetaTester(user.app_metadata as Record<string, unknown> | undefined)) {
    return {
      plan: "academy",
      status: "active",
      isFounder: false,
      isBetaTester: true,
      hasComplimentaryAccess: true,
      accessType: "beta_tester",
    };
  }

  return EMPTY_COMPLIMENTARY_ACCESS;
}

/** Authoritative complimentary / plan status from the server. */
export async function fetchAccountEntitlementsComplimentary(): Promise<{
  hasComplimentaryAccess: boolean;
  plan: string | null;
  status: string | null;
}> {
  try {
    const response = await fetch("/api/account/entitlements");
    if (!response.ok) {
      return { hasComplimentaryAccess: false, plan: null, status: null };
    }
    const payload = (await response.json()) as {
      hasComplimentaryAccess?: boolean;
      plan?: string;
      status?: string;
    };
    return {
      hasComplimentaryAccess: Boolean(payload.hasComplimentaryAccess),
      plan: payload.plan ?? null,
      status: payload.status ?? null,
    };
  } catch {
    return { hasComplimentaryAccess: false, plan: null, status: null };
  }
}
