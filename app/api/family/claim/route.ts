import { NextResponse } from "next/server";
import { recordActivationEvent } from "@/lib/activation-events";
import {
  consumeParentAccountClaim,
  lookupParentAccountClaim,
  reissueParentAccountClaim,
} from "@/lib/parent-account-claim";
import { recordParentJourneyEvent } from "@/lib/parent-journey-events";
import {
  PARENT_ACCOUNT_KIND_METADATA_KEY,
  PARENT_FIRST_LOGIN_METADATA_KEY,
} from "@/lib/parent-journey-types";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getResendServerClient, resendFromEmail } from "@/lib/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { rejectDemoMutation } from "@/lib/demo/http-guard";
import { isValidEmail } from "@/lib/validation/email";

export const runtime = "nodejs";

const MIN_PASSWORD_LENGTH = 8;

type ClaimBody = {
  action?: "claim" | "reissue";
  token?: string;
  password?: string;
  fullName?: string;
  email?: string;
};

export async function GET(request: Request) {
  const limited = await enforceRateLimit({
    request,
    config: RATE_LIMITS.authRelated,
    route: "/api/family/claim",
  });
  if (limited) return limited;

  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim() ?? "";
  const lookup = await lookupParentAccountClaim(token);

  return NextResponse.json({
    status: lookup.status,
    email: lookup.email,
    childName: lookup.childName,
    academyName: lookup.academyName,
    expiresAt: lookup.expiresAt,
  });
}

export async function POST(request: Request) {
  const limited = await enforceRateLimit({
    request,
    config: RATE_LIMITS.authRelated,
    route: "/api/family/claim",
  });
  if (limited) return limited;

  const demoBlocked = rejectDemoMutation(request, "claim or reissue family account email");
  if (demoBlocked) return demoBlocked;

  try {
    const body = (await request.json()) as ClaimBody;
    const action = body.action ?? "claim";

    if (action === "reissue") {
      const email = body.email?.trim().toLowerCase() ?? "";
      if (!email || !isValidEmail(email)) {
        return NextResponse.json(
          { error: "Enter the parent email used for bookings." },
          { status: 400 },
        );
      }

      const invite = await reissueParentAccountClaim({ email });
      if (invite.kind === "sign_in") {
        return NextResponse.json({
          kind: "sign_in",
          message: "An account already exists for this email. Sign in to open your family dashboard.",
          loginUrl: invite.url,
        });
      }

      try {
        const resend = getResendServerClient();
        await resend.emails.send({
          from: resendFromEmail,
          to: email,
          subject: "Your Awarix family account invite",
          html: `<p>Use this secure link to create your family account (expires in 7 days):</p><p><a href="${invite.url}">${invite.url}</a></p>`,
          text: `Create your family account: ${invite.url}\n\nThis link expires in 7 days.`,
        });
      } catch {
        return NextResponse.json(
          { error: "Unable to send a new invite email right now. Try again shortly." },
          { status: 502 },
        );
      }

      return NextResponse.json({
        kind: "claim_sent",
        message: "If we found a matching family, a new invite is on its way.",
      });
    }

    const token = body.token?.trim() ?? "";
    const password = body.password ?? "";
    const fullName = body.fullName?.trim() || null;

    if (!token) {
      return NextResponse.json({ error: "Invite token is required." }, { status: 400 });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
        { status: 400 },
      );
    }

    const lookup = await lookupParentAccountClaim(token);
    if (lookup.status === "expired" || lookup.status === "used" || lookup.status === "revoked") {
      return NextResponse.json(
        {
          error:
            "This invite has expired or was already used. Request a new link with the email from your booking.",
          status: lookup.status,
        },
        { status: 410 },
      );
    }
    if (lookup.status === "invalid" || !lookup.email) {
      return NextResponse.json({ error: "This invite link is invalid." }, { status: 400 });
    }
    if (lookup.status === "valid_existing") {
      return NextResponse.json(
        {
          error: "An account already exists for this email. Sign in instead.",
          loginUrl: `/login?next=${encodeURIComponent("/family")}`,
        },
        { status: 409 },
      );
    }

    const admin = createAdminClient();
    const nowIso = new Date().toISOString();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: lookup.email,
      password,
      email_confirm: true,
      user_metadata: {
        [PARENT_ACCOUNT_KIND_METADATA_KEY]: "parent",
        full_name: fullName,
        [PARENT_FIRST_LOGIN_METADATA_KEY]: nowIso,
      },
    });

    if (createError || !created.user) {
      return NextResponse.json(
        { error: createError?.message ?? "Unable to create your account." },
        { status: 500 },
      );
    }

    const consumed = await consumeParentAccountClaim({
      rawToken: token,
      userId: created.user.id,
    });

    if (!consumed.ok) {
      // Avoid leaving an orphan account bound to a reusable invite.
      await admin.auth.admin.deleteUser(created.user.id);
      return NextResponse.json({ error: consumed.reason }, { status: 409 });
    }

    await recordParentJourneyEvent({
      event: "claim_account",
      userId: created.user.id,
      email: lookup.email,
      metadata: {
        claimId: lookup.claimId,
        childName: lookup.childName,
      },
    });
    await recordParentJourneyEvent({
      event: "first_login",
      userId: created.user.id,
      email: lookup.email,
      metadata: { source: "claim" },
    });
    await recordActivationEvent({
      userId: created.user.id,
      event: "first_parent_account",
      metadata: { email: lookup.email, claimId: lookup.claimId },
    });

    return NextResponse.json({
      ok: true,
      email: lookup.email,
      redirectTo: "/family?welcome=1",
      message: "Account created. Sign in with your new password.",
    });
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unable to complete account claim.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
