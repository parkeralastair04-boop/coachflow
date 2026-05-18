import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isReferralCode } from "@/lib/referrals";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

type AttributeBody = {
  referralCode?: string;
  referredUserId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AttributeBody;
    if (!isReferralCode(body.referralCode) || !body.referredUserId) {
      return NextResponse.json({ ok: true });
    }

    const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });
    const { error } = await supabase.rpc("attribute_referral", {
      p_referral_code: body.referralCode,
      p_referred_user_id: body.referredUserId,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unable to attribute referral.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
