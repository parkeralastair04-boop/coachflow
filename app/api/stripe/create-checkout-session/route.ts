import { NextResponse } from "next/server";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  BILLING_PLANS,
  assertStripePricesConfigured,
} from "@/lib/billing";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { getUserEntitlements } from "@/lib/entitlements";
import { hasComplimentaryAccess } from "@/lib/complimentary-access";
import { getStripeServerClient } from "@/lib/stripe";
import {
  assertStripeCustomerOwnedByUser,
  StripeCustomerOwnershipError,
} from "@/lib/stripe-customer-ownership";
import {
  TRIAL_PERIOD_DAYS,
  addDays,
  buildCheckoutTrialMessage,
  customerHasUsedTrial,
  formatUkShortDate,
  resolveOrCreateStripeCustomer,
} from "@/lib/trial";
import { rejectDemoMutation } from "@/lib/demo/http-guard";

type CheckoutRequestBody = {
  planId?: string;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit({
      request,
      config: RATE_LIMITS.billing,
      route: "/api/stripe/create-checkout-session",
    });
    if (limited) return limited;

    const demoBlocked = rejectDemoMutation(request, "start Stripe checkout");
    if (demoBlocked) {
      return NextResponse.json({
        demo: true,
        error: "Demo mode cannot start live checkout.",
        code: "demo_mode",
      }, { status: 403 });
    }

    const body = (await request.json()) as CheckoutRequestBody;

    const user = await getAuthenticatedUser();
    if (!user?.email?.trim()) {
      return NextResponse.json(
        { error: "Sign in to start checkout." },
        { status: 401 },
      );
    }

    if (
      hasComplimentaryAccess({
        email: user.email,
        appMetadata: user.app_metadata as Record<string, unknown> | undefined,
      })
    ) {
      return NextResponse.json(
        { error: "You already have complimentary Academy access." },
        { status: 403 },
      );
    }

    try {
      assertStripePricesConfigured();
    } catch {
      return NextResponse.json(
        { error: "Billing is not configured. Please try again later." },
        { status: 503 },
      );
    }

    const selectedPlan = BILLING_PLANS.find((plan) => plan.id === body.planId);
    if (!selectedPlan) {
      return NextResponse.json({ error: "Invalid plan selected." }, { status: 400 });
    }
    if (!selectedPlan.stripePriceId?.trim()) {
      return NextResponse.json(
        { error: `Missing Stripe price for plan: ${selectedPlan.id}` },
        { status: 503 },
      );
    }

    const stripe = getStripeServerClient();
    const origin = new URL(request.url).origin;
    const entitlements = await getUserEntitlements();

    const customer = await resolveOrCreateStripeCustomer({
      email: user.email.trim().toLowerCase(),
      userId: user.id,
      preferredCustomerId: entitlements?.stripeCustomerId,
    });

    assertStripeCustomerOwnedByUser(customer, user.id);

    const trialUsed = await customerHasUsedTrial(customer);
    const trialEligible = !trialUsed;
    const firstPaymentDate = addDays(new Date(), TRIAL_PERIOD_DAYS);
    const trialMessage = trialEligible
      ? buildCheckoutTrialMessage({
          monthlyPounds: selectedPlan.monthlyPounds,
          firstPaymentDate,
        })
      : null;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      client_reference_id: user.id,
      line_items: [
        {
          price: selectedPlan.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing/cancel`,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      metadata: {
        plan_id: selectedPlan.id,
        awarix_user_id: user.id,
        trial_eligible: trialEligible ? "true" : "false",
      },
      subscription_data: {
        ...(trialEligible ? { trial_period_days: TRIAL_PERIOD_DAYS } : {}),
        metadata: {
          plan_id: selectedPlan.id,
          awarix_user_id: user.id,
          trial_eligible: trialEligible ? "true" : "false",
        },
      },
      ...(trialMessage
        ? {
            custom_text: {
              submit: {
                message: trialMessage.slice(0, 1200),
              },
            },
          }
        : {}),
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Could not create checkout session." },
        { status: 500 },
      );
    }

    const { createServerSupabaseClient } = await import("@/lib/supabase/server");
    const supabase = await createServerSupabaseClient();
    await supabase
      .from("referrals")
      .update({
        status: "converted",
        reward_type: "pro_month",
        reward_value: 1,
      })
      .eq("referred_user_id", user.id)
      .neq("status", "converted");

    return NextResponse.json({
      url: session.url,
      trialEligible,
      trialPeriodDays: trialEligible ? TRIAL_PERIOD_DAYS : 0,
      firstPaymentDate: trialEligible
        ? formatUkShortDate(firstPaymentDate)
        : null,
      firstPaymentAmount: selectedPlan.monthlyPounds,
      message: trialMessage,
    });
  } catch (error: unknown) {
    if (error instanceof StripeCustomerOwnershipError) {
      const status = error.code === "owned_by_other" ? 409 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }

    return NextResponse.json(
      { error: "We couldn't start checkout right now. Please try again." },
      { status: 500 },
    );
  }
}
