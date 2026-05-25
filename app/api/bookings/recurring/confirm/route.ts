import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  buildRecurringSubscriptionEmailHtml,
  buildRecurringSubscriptionEmailText,
} from "@/lib/booking-emails";
import { getDayLabel } from "@/lib/booking-system";
import { getStripeCurrentPeriodEnd } from "@/lib/parent-payments";
import { getResendServerClient, resendFromEmail } from "@/lib/resend";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import { getStripeServerClient } from "@/lib/stripe";

type ConfirmRecurringBody = {
  checkoutSessionId?: string;
};

type ConfirmRecurringRpcRow = {
  parent_subscription_id: string;
  recurring_enrolment_id: string;
  player_id: string;
  coach_id: string;
  academy_id: string | null;
  recurring_status: "pending" | "active" | "paused" | "cancelled";
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
  return "Unable to confirm recurring subscription.";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ConfirmRecurringBody;
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

    const enrolmentId = stripeSession.metadata?.enrolment_id?.trim();
    if (!enrolmentId) {
      return NextResponse.json(
        { error: "Missing enrolment metadata on checkout session." },
        { status: 500 },
      );
    }

    const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase.rpc("confirm_public_recurring_enrolment", {
      p_enrolment_id: enrolmentId,
      p_stripe_customer_id:
        typeof stripeSession.customer === "string" ? stripeSession.customer : "",
      p_stripe_subscription_id: stripeSubscription.id,
      p_subscription_status: stripeSubscription.status,
      p_current_period_end: getStripeCurrentPeriodEnd(stripeSubscription),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const confirmed = (data?.[0] ?? null) as ConfirmRecurringRpcRow | null;
    if (!confirmed) {
      return NextResponse.json(
        { error: "Could not reconcile recurring subscription confirmation." },
        { status: 500 },
      );
    }

    if (stripeSession.metadata?.parent_email) {
      try {
        const resend = getResendServerClient();
        await resend.emails.send({
          from: resendFromEmail,
          to: stripeSession.metadata.parent_email,
          subject: `Recurring subscription confirmed for ${stripeSession.metadata.child_name ?? "your player"}`,
          html: buildRecurringSubscriptionEmailHtml({
            academyName: stripeSession.metadata.academy_name ?? "CoachFlow",
            primaryColor: stripeSession.metadata.academy_primary_color ?? "#10b981",
            parentName: stripeSession.metadata.parent_name ?? "",
            childName: stripeSession.metadata.child_name ?? "your player",
            seriesTitle: stripeSession.metadata.series_title ?? "Recurring coaching",
            monthlyPrice: new Intl.NumberFormat("en-GB", {
              style: "currency",
              currency: stripeSession.currency?.toUpperCase() ?? "GBP",
            }).format((stripeSubscription.items.data[0]?.price.unit_amount ?? 0) / 100),
            startDayLabel: getDayLabel(
              Number.parseInt(stripeSession.metadata.series_day_of_week ?? "0", 10),
            ),
            startTimeLabel: (stripeSession.metadata.series_start_time ?? "00:00").slice(0, 5),
            location: stripeSession.metadata.series_location ?? "",
          }),
          text: buildRecurringSubscriptionEmailText({
            academyName: stripeSession.metadata.academy_name ?? "CoachFlow",
            primaryColor: stripeSession.metadata.academy_primary_color ?? "#10b981",
            parentName: stripeSession.metadata.parent_name ?? "",
            childName: stripeSession.metadata.child_name ?? "your player",
            seriesTitle: stripeSession.metadata.series_title ?? "Recurring coaching",
            monthlyPrice: new Intl.NumberFormat("en-GB", {
              style: "currency",
              currency: stripeSession.currency?.toUpperCase() ?? "GBP",
            }).format((stripeSubscription.items.data[0]?.price.unit_amount ?? 0) / 100),
            startDayLabel: getDayLabel(
              Number.parseInt(stripeSession.metadata.series_day_of_week ?? "0", 10),
            ),
            startTimeLabel: (stripeSession.metadata.series_start_time ?? "00:00").slice(0, 5),
            location: stripeSession.metadata.series_location ?? "",
          }),
        });
      } catch {
        // Subscription confirmation should not fail if email delivery is unavailable.
      }
    }

    return NextResponse.json({
      parentSubscriptionId: confirmed.parent_subscription_id,
      recurringEnrolmentId: confirmed.recurring_enrolment_id,
      recurringStatus: confirmed.recurring_status,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
