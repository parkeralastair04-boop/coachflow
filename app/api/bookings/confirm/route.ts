import { NextResponse } from "next/server";
import {
  buildBookingEmailHtml,
  buildBookingEmailText,
} from "@/lib/booking-emails";
import { getResendServerClient, resendFromEmail } from "@/lib/resend";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import { getStripeServerClient } from "@/lib/stripe";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

type ConfirmBody = {
  checkoutSessionId?: string;
};

type ConfirmRpcRow = {
  booking_id: string;
  booking_status: "pending" | "confirmed" | "waitlist" | "cancelled";
  payment_status: "requires_payment" | "paid" | "not_required" | "failed" | "refunded";
  confirmed_now: boolean;
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
  return "Unable to confirm booking.";
}

function formatSessionDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(parsed);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ConfirmBody;
    const checkoutSessionId = body.checkoutSessionId?.trim();

    if (!checkoutSessionId) {
      return NextResponse.json(
        { error: "checkoutSessionId is required." },
        { status: 400 },
      );
    }
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Missing Supabase environment variables." },
        { status: 500 },
      );
    }

    const stripe = getStripeServerClient();
    const stripeSession = await stripe.checkout.sessions.retrieve(checkoutSessionId);

    if (stripeSession.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Stripe checkout has not been paid yet." },
        { status: 409 },
      );
    }

    const bookingId = stripeSession.metadata?.booking_id?.trim();
    if (!bookingId) {
      return NextResponse.json(
        { error: "Missing booking metadata on checkout session." },
        { status: 500 },
      );
    }

    const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase.rpc("confirm_public_session_booking", {
      p_booking_id: bookingId,
      p_stripe_checkout_session_id: stripeSession.id,
      p_stripe_payment_intent_id:
        typeof stripeSession.payment_intent === "string"
          ? stripeSession.payment_intent
          : "",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const confirmed = (data?.[0] ?? null) as ConfirmRpcRow | null;
    if (!confirmed) {
      return NextResponse.json(
        { error: "Could not reconcile booking confirmation." },
        { status: 500 },
      );
    }

    if (confirmed.confirmed_now && stripeSession.metadata?.parent_email) {
      try {
        const resend = getResendServerClient();
        await resend.emails.send({
          from: resendFromEmail,
          to: stripeSession.metadata.parent_email,
          subject: `Booking confirmed for ${stripeSession.metadata.child_name ?? "your player"}`,
          html: buildBookingEmailHtml({
            kind: "confirmed",
            academyName: stripeSession.metadata.academy_name ?? "CoachFlow",
            primaryColor:
              stripeSession.metadata.academy_primary_color ?? "#10b981",
            parentName: stripeSession.metadata.parent_name ?? "",
            childName: stripeSession.metadata.child_name ?? "your player",
            sessionLabel:
              stripeSession.metadata.session_label ?? "Coaching session",
            sessionDate: formatSessionDate(
              stripeSession.metadata.session_date ?? new Date().toISOString(),
            ),
            location: stripeSession.metadata.session_location ?? "",
          }),
          text: buildBookingEmailText({
            kind: "confirmed",
            academyName: stripeSession.metadata.academy_name ?? "CoachFlow",
            primaryColor:
              stripeSession.metadata.academy_primary_color ?? "#10b981",
            parentName: stripeSession.metadata.parent_name ?? "",
            childName: stripeSession.metadata.child_name ?? "your player",
            sessionLabel:
              stripeSession.metadata.session_label ?? "Coaching session",
            sessionDate: formatSessionDate(
              stripeSession.metadata.session_date ?? new Date().toISOString(),
            ),
            location: stripeSession.metadata.session_location ?? "",
          }),
        });
      } catch {
        // Payment confirmation should not fail if email delivery is unavailable.
      }
    }

    return NextResponse.json({
      bookingId: confirmed.booking_id,
      status: confirmed.booking_status,
      paymentStatus: confirmed.payment_status,
      confirmedNow: confirmed.confirmed_now,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
