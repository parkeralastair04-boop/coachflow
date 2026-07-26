import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSafeAuthNextPath } from "@/lib/auth/safe-next-path";
import { isReferralCode } from "@/lib/referrals";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextPath = getSafeAuthNextPath(searchParams.get("next"), "/dashboard");

  if (!supabaseUrl || !supabaseAnonKey || !code) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* set from Server Component only — callback runs in route handler */
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  // Attribute referral from signup metadata once the session exists.
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const referralCode = user?.user_metadata?.referral_code;
    if (user && typeof referralCode === "string" && isReferralCode(referralCode)) {
      const { error: attributeError } = await supabase.rpc("attribute_referral", {
        p_referral_code: referralCode,
        p_referred_user_id: user.id,
      });
      if (attributeError) {
        console.error("[auth/callback] attribute_referral", attributeError.message);
      }
    }
  } catch {
    // Never block login on referral attribution.
  }

  return NextResponse.redirect(`${origin}${nextPath}`);
}
