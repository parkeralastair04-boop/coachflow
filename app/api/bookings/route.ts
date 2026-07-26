import { NextResponse } from "next/server";
import { enforceBotProtection } from "@/lib/bot-protection";
import { HONEYPOT_FIELD_NAME } from "@/lib/bot-protection-shared";
import { enforceRateLimit, getRequestIp, hashIp, RATE_LIMITS } from "@/lib/rate-limit";
import { apiError, safeApiError } from "@/lib/api-response";
import { logAbuseEvent } from "@/lib/abuse-log";
import {
  buildBookingEmailHtml,
  buildBookingEmailText,
  getSessionBookingEmailSubject,
} from "@/lib/booking-emails";
import { type PublicSessionRow } from "@/lib/booking-system";
import {
  createPublicSupabaseClient,
  loadPublicBookingPayload,
  type PublicPortalTenant,
} from "@/lib/public-booking";
import { prepareParentPortalInvite } from "@/lib/parent-account-claim";
import { recordParentJourneyEvent } from "@/lib/parent-journey-events";
import { getResendServerClient, resendFromEmail } from "@/lib/resend";
import { getStripeServerClient } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidEmail } from "@/lib/validation/email";
import { normalisePhone } from "@/lib/validation/phone";
import { rejectDemoMutation } from "@/lib/demo/http-guard";

const CHECKOUT_HOLD_SECONDS = 30 * 60;

type BookingBody = {
  sessionId?: string;
  childName?: string;
  childDateOfBirth?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  notes?: string;
  turnstileToken?: string;
  [key: string]: unknown;
};

type CreateBookingRpcRow = {
  booking_id: string;
  player_id: string;
  coach_id: string;
  booking_status: "pending" | "confirmed" | "waitlist" | "cancelled";
  payment_status: "requires_payment" | "paid" | "not_required" | "failed" | "refunded";
  amount: number;
};

export const runtime = "nodejs";

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Unable to submit booking.";
}

function formatSessionDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(parsed);
}

function getSessionLabel(session: PublicSessionRow) {
  return session.group_name?.trim() || session.session_type?.trim() || "Coaching session";
}

function getTenantFromRequest(request: Request): PublicPortalTenant | null {
  const url = new URL(request.url);
  const coachSlug = url.searchParams.get("coachSlug")?.trim();
  const academySlug = url.searchParams.get("academySlug")?.trim();

  if (coachSlug) return { kind: "coach", slug: coachSlug };
  if (academySlug) return { kind: "academy", slug: academySlug };
  return null;
}

function getPortalUrl(origin: string, tenant: PublicPortalTenant) {
  return tenant.kind === "coach"
    ? `${origin}/book/${tenant.slug}`
    : `${origin}/academy/${tenant.slug}/book`;
}

function getStripeCheckoutExpiry() {
  const stripeCheckoutExpiresAt = Math.floor(Date.now() / 1000) + CHECKOUT_HOLD_SECONDS;
  return {
    stripeCheckoutExpiresAt,
    checkoutExpiresAt: new Date(stripeCheckoutExpiresAt * 1000).toISOString(),
  };
}

async function sendParentEmail(args: {
  kind: "confirmed" | "waitlist";
  paid?: boolean;
  supportEmail?: string | null;
  parentEmail: string;
  parentName: string;
  childName: string;
  academyName: string;
  primaryColor: string;
  session: PublicSessionRow;
  playerId?: string | null;
  bookingId?: string | null;
}): Promise<{ familyPortalUrl: string | null; inviteKind: "claim" | "sign_in" | null }> {
  let portalInviteUrl: string | null = null;
  let portalInviteKind: "claim" | "sign_in" | null = null;

  try {
    try {
      const invite = await prepareParentPortalInvite({
        email: args.parentEmail,
        playerId: args.playerId,
        bookingId: args.bookingId,
        childName: args.childName,
        academyName: args.academyName,
      });
      portalInviteUrl = invite.url;
      portalInviteKind = invite.kind;
    } catch {
      // Invite failure must not block confirmation email.
    }

    const resend = getResendServerClient();
    const sessionLabel = getSessionLabel(args.session);
    await resend.emails.send({
      from: resendFromEmail,
      to: args.parentEmail,
      subject: getSessionBookingEmailSubject({ kind: args.kind, paid: args.paid }),
      html: buildBookingEmailHtml({
        kind: args.kind,
        paid: args.paid,
        supportEmail: args.supportEmail,
        academyName: args.academyName,
        primaryColor: args.primaryColor,
        parentName: args.parentName,
        childName: args.childName,
        sessionLabel,
        sessionDate: formatSessionDate(args.session.session_date),
        location: args.session.location,
        portalInviteUrl,
        portalInviteKind,
      }),
      text: buildBookingEmailText({
        kind: args.kind,
        paid: args.paid,
        supportEmail: args.supportEmail,
        academyName: args.academyName,
        primaryColor: args.primaryColor,
        parentName: args.parentName,
        childName: args.childName,
        sessionLabel,
        sessionDate: formatSessionDate(args.session.session_date),
        location: args.session.location,
        portalInviteUrl,
        portalInviteKind,
      }),
    });

    if (args.kind === "confirmed") {
      await recordParentJourneyEvent({
        event: "booking_completed",
        email: args.parentEmail,
        metadata: {
          source: "public_booking",
          bookingId: args.bookingId ?? null,
          paid: args.paid !== false,
        },
      });
    }
  } catch {
    // Booking creation should still succeed if email delivery is temporarily unavailable.
  }

  return { familyPortalUrl: portalInviteUrl, inviteKind: portalInviteKind };
}

export async function GET(request: Request) {
  try {
    const tenant = getTenantFromRequest(request);
    if (!tenant) {
      return NextResponse.json(
        { error: "coachSlug or academySlug is required." },
        { status: 400 },
      );
    }

    const payload = await loadPublicBookingPayload(tenant);
    if (!payload) {
      return NextResponse.json({ error: "Booking portal not found." }, { status: 404 });
    }

    return NextResponse.json(payload);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const route = "/api/bookings";
    const limited = await enforceRateLimit({
      request,
      config: RATE_LIMITS.publicBooking,
      route,
    });
    if (limited) return limited;

    const tenant = getTenantFromRequest(request);
    if (!tenant) {
      return NextResponse.json(
        { error: "coachSlug or academySlug is required." },
        { status: 400 },
      );
    }

    const demoResponse = rejectDemoMutation(
      request,
      "create a live booking",
      tenant.kind === "academy"
        ? { academySlug: tenant.slug }
        : { coachSlug: tenant.slug },
    );
    if (demoResponse) {
      return NextResponse.json({
        demo: true,
        bookingStatus: "confirmed",
        paymentStatus: "not_required",
        message:
          "Demo booking accepted. No payment was taken and no email was sent.",
        checkoutUrl: null,
      });
    }

    const body = (await request.json()) as BookingBody;

    const bot = await enforceBotProtection({
      request,
      route,
      input: {
        honeypot:
          typeof body[HONEYPOT_FIELD_NAME] === "string"
            ? (body[HONEYPOT_FIELD_NAME] as string)
            : "",
        turnstileToken:
          typeof body.turnstileToken === "string" ? body.turnstileToken : null,
      },
    });
    if (!bot.ok) {
      if (bot.code === "honeypot") {
        return NextResponse.json({ ok: true, honeypot: true });
      }
      logAbuseEvent({
        event: "bot_blocked",
        route,
        ipHash: hashIp(getRequestIp(request)),
        detail: bot.code,
      });
      return apiError(400, bot.message, "bot_blocked");
    }

    const sessionId = body.sessionId?.trim();
    const childName = typeof body.childName === "string" ? body.childName.trim() : "";
    const parentName = typeof body.parentName === "string" ? body.parentName.trim() : "";
    const parentEmail = typeof body.parentEmail === "string" ? body.parentEmail.trim() : "";
    const parentPhone = normalisePhone(
      typeof body.parentPhone === "string" ? body.parentPhone : null,
    );

    if (!sessionId || !childName || !parentEmail) {
      return NextResponse.json(
        { error: "Session, child name, and parent email are required." },
        { status: 400 },
      );
    }

    if (!isValidEmail(parentEmail)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 },
      );
    }

    const payload = await loadPublicBookingPayload(tenant);
    if (!payload) {
      return NextResponse.json({ error: "Booking portal not found." }, { status: 404 });
    }

    const selectedSession = payload.sessions.find((session) => session.session_id === sessionId);
    if (!selectedSession || !payload.portal.booking_enabled) {
      return NextResponse.json(
        { error: "Selected session is no longer available." },
        { status: 404 },
      );
    }

    const academyName = payload.portal.display_name ?? "Awarix";
    const primaryColor = payload.portal.primary_color ?? "#10b981";
    const supportEmail = payload.portal.support_email?.trim() || null;
    const supabase = createPublicSupabaseClient();

    const { data, error } = await supabase.rpc("create_public_session_booking", {
      p_session_id: sessionId,
      p_child_name: childName,
      p_child_date_of_birth: body.childDateOfBirth || null,
      p_parent_name: parentName || null,
      p_parent_email: parentEmail,
      p_parent_phone: parentPhone,
      p_notes: body.notes?.trim() || null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const booking = (data?.[0] ?? null) as CreateBookingRpcRow | null;
    if (!booking) {
      return NextResponse.json(
        { error: "Could not create booking." },
        { status: 500 },
      );
    }

    if (booking.booking_status === "waitlist") {
      const invite = await sendParentEmail({
        kind: "waitlist",
        supportEmail,
        parentEmail,
        parentName,
        childName,
        academyName,
        primaryColor,
        session: selectedSession,
        playerId: booking.player_id,
        bookingId: booking.booking_id,
      });

      return NextResponse.json({
        bookingId: booking.booking_id,
        playerId: booking.player_id,
        status: booking.booking_status,
        checkoutUrl: null,
        familyPortalUrl: invite.familyPortalUrl,
        familyInviteKind: invite.inviteKind,
      });
    }

    if (booking.amount <= 0 || booking.payment_status === "not_required") {
      const invite = await sendParentEmail({
        kind: "confirmed",
        paid: false,
        supportEmail,
        parentEmail,
        parentName,
        childName,
        academyName,
        primaryColor,
        session: selectedSession,
        playerId: booking.player_id,
        bookingId: booking.booking_id,
      });

      return NextResponse.json({
        bookingId: booking.booking_id,
        playerId: booking.player_id,
        status: booking.booking_status,
        checkoutUrl: null,
        familyPortalUrl: invite.familyPortalUrl,
        familyInviteKind: invite.inviteKind,
      });
    }

    const sessionLabel = getSessionLabel(selectedSession);
    const { stripeCheckoutExpiresAt, checkoutExpiresAt } = getStripeCheckoutExpiry();
    const stripe = getStripeServerClient();
    const origin = new URL(request.url).origin;
    const portalUrl = getPortalUrl(origin, tenant);
    const stripeSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: parentEmail,
      expires_at: stripeCheckoutExpiresAt,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            product_data: {
              name: sessionLabel,
              description: formatSessionDate(selectedSession.session_date),
            },
            unit_amount: booking.amount,
          },
        },
      ],
      success_url: `${portalUrl}?booking=success&checkout_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${portalUrl}?booking=cancelled`,
      metadata: {
        coach_id: selectedSession.coach_id,
        session_id: sessionId,
        booking_id: booking.booking_id,
        player_id: booking.player_id,
        child_name: childName,
        parent_name: parentName,
        parent_email: parentEmail,
        academy_name: academyName,
        academy_primary_color: primaryColor,
        session_label: sessionLabel,
        session_date: selectedSession.session_date,
        session_location: selectedSession.location ?? "",
        portal_kind: tenant.kind,
        portal_slug: tenant.slug,
      },
    });

    const admin = createAdminClient();
    const { error: attachError } = await admin.rpc(
      "attach_stripe_checkout_to_session_booking",
      {
        p_booking_id: booking.booking_id,
        p_stripe_checkout_session_id: stripeSession.id,
        p_checkout_expires_at: stripeCheckoutExpiresAt,
      },
    );

    if (attachError) {
      // Compensate: expire Stripe Checkout and release the pending hold so we
      // never leave a live Checkout URL without a linked booking row.
      try {
        await stripe.checkout.sessions.expire(stripeSession.id);
      } catch {
        // Best-effort; session may already be expired.
      }
      try {
        await admin.rpc("expire_pending_session_booking", {
          p_booking_id: booking.booking_id,
        });
      } catch {
        // Best-effort capacity release.
      }
      return NextResponse.json({ error: attachError.message }, { status: 500 });
    }

    return NextResponse.json({
      bookingId: booking.booking_id,
      playerId: booking.player_id,
      status: booking.booking_status,
      checkoutUrl: stripeSession.url ?? null,
      checkoutExpiresAt,
    });
  } catch (error: unknown) {
    return safeApiError({
      request,
      route: "/api/bookings",
      error,
      clientMessage:
        "We couldn't complete your booking right now. Please try again.",
    });
  }
}
