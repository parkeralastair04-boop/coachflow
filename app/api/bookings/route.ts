import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  buildBookingEmailHtml,
  buildBookingEmailText,
} from "@/lib/booking-emails";
import { type PublicSessionRow } from "@/lib/booking-system";
import { getPublicAcademyForCoach } from "@/lib/academy";
import { getResendServerClient, resendFromEmail } from "@/lib/resend";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
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

function getCoachId() {
  return process.env.BOOKING_COACH_ID ?? process.env.NEXT_PUBLIC_BOOKING_COACH_ID;
}

function createPublicSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
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

async function loadPublicSessions(coachId: string) {
  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase.rpc("list_public_sessions", {
    p_coach_id: coachId,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as PublicSessionRow[];
}

export async function GET() {
  try {
    const coachId = getCoachId();
    if (!coachId) {
      return NextResponse.json(
        { error: "Missing BOOKING_COACH_ID environment variable." },
        { status: 500 },
      );
    }

    const [academy, sessions] = await Promise.all([
      getPublicAcademyForCoach(coachId),
      loadPublicSessions(coachId),
    ]);

    return NextResponse.json({
      academy,
      sessions,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const coachId = getCoachId();
    if (!coachId) {
      return NextResponse.json(
        { error: "Missing BOOKING_COACH_ID environment variable." },
        { status: 500 },
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

    const [academy, sessions] = await Promise.all([
      getPublicAcademyForCoach(coachId),
      loadPublicSessions(coachId),
    ]);

    const selectedSession = sessions.find((session) => session.session_id === sessionId);
    if (!selectedSession) {
      return NextResponse.json(
        { error: "Selected session is no longer available." },
        { status: 404 },
      );
    }

    const academyName = academy?.name ?? "CoachFlow";
    const primaryColor = academy?.primary_color ?? "#10b981";
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
      success_url: `${origin}/book?booking=success&checkout_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/book?booking=cancelled`,
      metadata: {
        coach_id: coachId,
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
