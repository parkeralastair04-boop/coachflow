import { NextResponse } from "next/server";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createPublicSupabaseClient } from "@/lib/public-booking";
import { getStripeServerClient } from "@/lib/stripe";

type ConfirmBody = {
  checkoutSessionId?: string;
};

type BookingStatusRow = {
  booking_id: string;
  booking_status: string;
  payment_status: string;
  confirmed: boolean;
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
  return "Unable to check booking confirmation.";
}

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit({
      request,
      config: RATE_LIMITS.publicBookingConfirm,
      route: "/api/bookings/confirm",
    });
    if (limited) return limited;

    const body = (await request.json()) as ConfirmBody;
    const checkoutSessionId = body.checkoutSessionId?.trim();

    if (!checkoutSessionId) {
      return NextResponse.json(
        { error: "checkoutSessionId is required." },
        { status: 400 },
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

    const supabase = createPublicSupabaseClient();

    const { data, error } = await supabase.rpc("get_booking_confirmation_status", {
      p_stripe_checkout_session_id: checkoutSessionId,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const status = (data?.[0] ?? null) as BookingStatusRow | null;
    if (!status || !status.confirmed) {
      return NextResponse.json({
        confirmed: false,
        pending: true,
      });
    }

    return NextResponse.json({
      confirmed: true,
      bookingStatus: status.booking_status,
      paymentStatus: status.payment_status,
      bookingId: status.booking_id,
    });
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message === "Missing Supabase environment variables."
    ) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
