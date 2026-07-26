import { NextResponse } from "next/server";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createPublicSupabaseClient } from "@/lib/public-booking";
import { getStripeServerClient } from "@/lib/stripe";

type ConfirmRecurringBody = {
  checkoutSessionId?: string;
};

type RecurringStatusRow = {
  enrolment_id: string;
  recurring_status: string;
  subscription_status: string | null;
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
  return "Unable to check recurring subscription confirmation.";
}

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit({
      request,
      config: RATE_LIMITS.publicBookingConfirm,
      route: "/api/bookings/recurring/confirm",
    });
    if (limited) return limited;

    const body = (await request.json()) as ConfirmRecurringBody;
    const checkoutSessionId = body.checkoutSessionId?.trim();

    if (!checkoutSessionId) {
      return NextResponse.json(
        { error: "checkoutSessionId is required." },
        { status: 400 },
      );
    }

    const stripe = getStripeServerClient();
    const stripeSession = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
      expand: ["subscription"],
    });

    const stripeSubscription =
      typeof stripeSession.subscription === "object" &&
      stripeSession.subscription !== null
        ? stripeSession.subscription
        : null;

    if (!stripeSubscription || !stripeSession.customer) {
      return NextResponse.json(
        { error: "Recurring checkout is missing Stripe subscription details." },
        { status: 409 },
      );
    }

    const supabase = createPublicSupabaseClient();

    const { data, error } = await supabase.rpc("get_recurring_confirmation_status", {
      p_stripe_checkout_session_id: checkoutSessionId,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const status = (data?.[0] ?? null) as RecurringStatusRow | null;
    if (!status || !status.confirmed) {
      return NextResponse.json({
        confirmed: false,
        pending: true,
      });
    }

    return NextResponse.json({
      confirmed: true,
      recurringStatus: status.recurring_status,
      subscriptionStatus: status.subscription_status,
      enrolmentId: status.enrolment_id,
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
