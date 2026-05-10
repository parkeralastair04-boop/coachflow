import { NextResponse } from "next/server";
import { BILLING_PLANS } from "@/lib/billing";
import { getStripeServerClient } from "@/lib/stripe";

type CheckoutRequestBody = {
  planId?: string;
  customerEmail?: string;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CheckoutRequestBody;
    const selectedPlan = BILLING_PLANS.find((plan) => plan.id === body.planId);
    if (!selectedPlan) {
      return NextResponse.json({ error: "Invalid plan selected." }, { status: 400 });
    }
    if (!selectedPlan.stripePriceId?.trim()) {
      return NextResponse.json(
        { error: `Missing stripePriceId for plan: ${selectedPlan.id}` },
        { status: 400 },
      );
    }

    const stripe = getStripeServerClient();
    const origin = new URL(request.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: selectedPlan.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing/cancel`,
      customer_email: body.customerEmail || undefined,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      metadata: {
        plan_id: selectedPlan.id,
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Could not create checkout session." },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unable to start checkout.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
