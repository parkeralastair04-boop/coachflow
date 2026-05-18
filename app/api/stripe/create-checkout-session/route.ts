import { NextResponse } from "next/server";
import { BILLING_PLANS } from "@/lib/billing";
import { isFounder } from "@/lib/founders";
import { getStripeServerClient } from "@/lib/stripe";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

type CheckoutRequestBody = {
  planId?: string;
  customerEmail?: string;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CheckoutRequestBody;

    let sessionEmail: string | null = null;
    if (supabaseUrl?.trim() && supabaseAnonKey?.trim()) {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      sessionEmail = user?.email ?? null;
    }
    if (isFounder(sessionEmail) || isFounder(body.customerEmail)) {
      return NextResponse.json(
        { error: "You have complimentary founder access." },
        { status: 403 },
      );
    }

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

    if (sessionEmail && supabaseUrl?.trim() && supabaseAnonKey?.trim()) {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("referrals")
          .update({
            status: "converted",
            reward_type: "pro_month",
            reward_value: 1,
          })
          .eq("referred_user_id", user.id)
          .neq("status", "converted");
      }
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
