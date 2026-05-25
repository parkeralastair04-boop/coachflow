import { NextResponse } from "next/server";
import {
  buildBookingEmailHtml,
  buildBookingEmailText,
} from "@/lib/booking-emails";
import { type PublicSessionRow } from "@/lib/booking-system";
import {
  createPublicSupabaseClient,
  loadPublicBookingPayload,
  type PublicPortalTenant,
} from "@/lib/public-booking";
import { getResendServerClient, resendFromEmail } from "@/lib/resend";
import { getStripeServerClient } from "@/lib/stripe";

type BookingBody = {
  sessionId?: string;
  childName?: string;
  childDateOfBirth?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  notes?: string;
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

async function sendParentEmail(args: {
  kind: "confirmed" | "waitlist";
  parentEmail: string;
  parentName: string;
  childName: string;
  academyName: string;
  primaryColor: string;
  session: PublicSessionRow;
}) {
  try {
    const resend = getResendServerClient();
    const sessionLabel = getSessionLabel(args.session);
    await resend.emails.send({
      from: resendFromEmail,
      to: args.parentEmail,
      subject:
        args.kind === "confirmed"
          ? `Booking confirmed for ${args.childName}`
          : `Waitlist update for ${args.childName}`,
      html: buildBookingEmailHtml({
        kind: args.kind,
        academyName: args.academyName,
        primaryColor: args.primaryColor,
        parentName: args.parentName,
        childName: args.childName,
        sessionLabel,
        sessionDate: formatSessionDate(args.session.session_date),
        location: args.session.location,
      }),
      text: buildBookingEmailText({
        kind: args.kind,
        academyName: args.academyName,
        primaryColor: args.primaryColor,
        parentName: args.parentName,
        childName: args.childName,
        sessionLabel,
        sessionDate: formatSessionDate(args.session.session_date),
        location: args.session.location,
      }),
    });
  } catch {
    // Booking creation should still succeed if email delivery is temporarily unavailable.
  }
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
    const tenant = getTenantFromRequest(request);
    if (!tenant) {
      return NextResponse.json(
        { error: "coachSlug or academySlug is required." },
        { status: 400 },
      );
    }

    const body = (await request.json()) as BookingBody;
    const sessionId = body.sessionId?.trim();
    const childName = body.childName?.trim();
    const parentName = body.parentName?.trim() ?? "";
    const parentEmail = body.parentEmail?.trim();
    const parentPhone = body.parentPhone?.trim() ?? "";

    if (!sessionId || !childName || !parentEmail) {
      return NextResponse.json(
        { error: "Session, child name, and parent email are required." },
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

    const academyName = payload.portal.display_name ?? "CoachFlow";
    const primaryColor = payload.portal.primary_color ?? "#10b981";
    const supabase = createPublicSupabaseClient();

    const { data, error } = await supabase.rpc("create_public_session_booking", {
      p_session_id: sessionId,
      p_child_name: childName,
      p_child_date_of_birth: body.childDateOfBirth || null,
      p_parent_name: parentName || null,
      p_parent_email: parentEmail,
      p_parent_phone: parentPhone || null,
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
      await sendParentEmail({
        kind: "waitlist",
        parentEmail,
        parentName,
        childName,
        academyName,
        primaryColor,
        session: selectedSession,
      });

      return NextResponse.json({
        bookingId: booking.booking_id,
        playerId: booking.player_id,
        status: booking.booking_status,
        checkoutUrl: null,
      });
    }

    if (booking.amount <= 0 || booking.payment_status === "not_required") {
      await sendParentEmail({
        kind: "confirmed",
        parentEmail,
        parentName,
        childName,
        academyName,
        primaryColor,
        session: selectedSession,
      });

      return NextResponse.json({
        bookingId: booking.booking_id,
        playerId: booking.player_id,
        status: booking.booking_status,
        checkoutUrl: null,
      });
    }

    const sessionLabel = getSessionLabel(selectedSession);
    const stripe = getStripeServerClient();
    const origin = new URL(request.url).origin;
    const portalUrl = getPortalUrl(origin, tenant);
    const stripeSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: parentEmail,
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

    return NextResponse.json({
      bookingId: booking.booking_id,
      playerId: booking.player_id,
      status: booking.booking_status,
      checkoutUrl: stripeSession.url ?? null,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
