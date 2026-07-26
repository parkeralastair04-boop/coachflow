import { NextResponse } from "next/server";
import { getUserEntitlements } from "@/lib/entitlements";

export const runtime = "nodejs";

/** Trusted entitlement summary for signed-in account settings UI. */
export async function GET() {
  const entitlements = await getUserEntitlements();
  if (!entitlements) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json({
    plan: entitlements.plan,
    status: entitlements.status,
    effectivePlan: entitlements.effectivePlan,
    isTrial: entitlements.isTrial,
    trialEndsAt: entitlements.trialEndsAt?.toISOString() ?? null,
    hasComplimentaryAccess: entitlements.hasComplimentaryAccess,
    isFounder: entitlements.isFounder,
    isBetaTester: entitlements.isBetaTester,
    source: entitlements.source,
  });
}
