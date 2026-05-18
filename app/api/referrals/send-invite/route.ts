import { NextResponse } from "next/server";
import { getReferralCode, getReferralUrl } from "@/lib/referrals";
import { getResendServerClient, resendFromEmail } from "@/lib/resend";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type InviteBody = {
  email?: string;
};

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 401 });
    }
    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to send referral invites." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as InviteBody;
    const email = body.email?.trim();
    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const referralCode = getReferralCode(user.id);
    const referralUrl = getReferralUrl(referralCode);
    const { error: insertError } = await supabase.from("referrals").insert({
      referrer_id: user.id,
      referred_user_id: null,
      referral_code: referralCode,
      status: "invited",
      reward_type: "pro_month",
      reward_value: 0,
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const resend = getResendServerClient();
    const { error } = await resend.emails.send({
      from: resendFromEmail,
      to: email,
      subject: "Try CoachFlow for your coaching business",
      html: `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#f6f7f9;padding:32px;"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:24px;padding:32px;border:1px solid #e5e7eb;"><p style="color:#10b981;font-weight:700;letter-spacing:.12em;text-transform:uppercase;font-size:12px;">CoachFlow</p><h1 style="color:#0f172a;">You have been invited to CoachFlow</h1><p style="color:#374151;line-height:1.65;">CoachFlow helps football coaches run players, sessions, reports, payments, and bookings from one premium workspace.</p><p><a href="${referralUrl}" style="display:inline-block;background:#10b981;color:white;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700;">Start with CoachFlow</a></p><p style="color:#6b7280;font-size:13px;">Referral code: ${referralCode}</p></div></body></html>`,
      text: `You have been invited to CoachFlow.\n\nStart here: ${referralUrl}\n\nReferral code: ${referralCode}`,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unable to send referral invite.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
