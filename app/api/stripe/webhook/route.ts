import { NextResponse } from "next/server";
import { getStripeCurrentPeriodEnd } from "@/lib/parent-payments";
import { createPublicSupabaseClient } from "@/lib/public-booking";
import { getStripeServerClient } from "@/lib/stripe";

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
  return "Unable to process Stripe webhook.";
}

export async function POST(request: Request) {
  try {
    const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const signature = request.headers.get("stripe-signature");

    if (!stripeWebhookSecret || !signature) {
      return NextResponse.json(
        { error: "Missing Stripe webhook configuration." },
        { status: 400 },
      );
    }

    const stripe = getStripeServerClient();
    const body = await request.text();
    const event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
    const supabase = createPublicSupabaseClient();

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (
        session.mode === "subscription" &&
        typeof session.subscription === "string" &&
        typeof session.customer === "string" &&
        session.metadata?.enrolment_id
      ) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        await supabase.rpc("confirm_public_recurring_enrolment", {
          p_enrolment_id: session.metadata.enrolment_id,
          p_stripe_customer_id: session.customer,
          p_stripe_subscription_id: subscription.id,
          p_subscription_status: subscription.status,
          p_current_period_end: getStripeCurrentPeriodEnd(subscription),
        });
      }
    }

    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object;
      await supabase.rpc("sync_recurring_subscription_state", {
        p_stripe_subscription_id: subscription.id,
        p_status: subscription.status,
        p_current_period_end: getStripeCurrentPeriodEnd(subscription),
      });
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}
