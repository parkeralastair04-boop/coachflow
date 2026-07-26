import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { isReferralCode } from "@/lib/referrals";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { apiError, safeApiError } from "@/lib/api-response";
import { isUuid } from "@/lib/validation/common";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { rejectDemoMutation } from "@/lib/demo/http-guard";

type AttributeBody = {
  referralCode?: string;
  referredUserId?: string;
};

/**
 * Attribute a referral to the signed-in user only.
 * Never accept an arbitrary referredUserId for another account.
 */
export async function POST(request: Request) {
  const route = "/api/referrals/attribute";
  try {
    const limited = await enforceRateLimit({
      request,
      config: RATE_LIMITS.publicReferral,
      route,
    });
    if (limited) return limited;

    const demoBlocked = rejectDemoMutation(request, "attribute a referral");
    if (demoBlocked) return demoBlocked;

    const user = await getAuthenticatedUser();
    if (!user) {
      // Signup may call this before email confirmation creates a session.
      // Defer silently — auth callback attributes from user_metadata.
      return NextResponse.json({ ok: true, deferred: true });
    }

    const body = (await request.json()) as AttributeBody;
    if (!isReferralCode(body.referralCode)) {
      return NextResponse.json({ ok: true });
    }

    // Ignore client-supplied user ids that do not match the session.
    if (
      body.referredUserId &&
      isUuid(body.referredUserId) &&
      body.referredUserId !== user.id
    ) {
      return apiError(403, "Referral attribution must match your account.", "ownership_denied");
    }

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("attribute_referral", {
      p_referral_code: body.referralCode,
      p_referred_user_id: user.id,
    });

    if (error) {
      console.error("[referrals/attribute]", error.message);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return safeApiError({
      request,
      route,
      error,
      clientMessage: "Unable to attribute referral.",
    });
  }
}
