import { NextResponse } from "next/server";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { getUserEntitlements } from "@/lib/entitlements";
import { hasComplimentaryAccess } from "@/lib/complimentary-access";
import { getStripeServerClient } from "@/lib/stripe";
import {
  assertStripeCustomerOwnedByUser,
  resolveOwnedStripeCustomerForPortal,
  StripeCustomerOwnershipError,
} from "@/lib/stripe-customer-ownership";
import { rejectDemoMutation } from "@/lib/demo/http-guard";

export const runtime = "nodejs";

/**
 * Opens Stripe Billing Portal for the authenticated user only.
 * Never accepts a client-supplied customer email or customer id.
 * Never silently binds unbound Stripe customers.
 */
export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit({
      request,
      config: RATE_LIMITS.billing,
      route: "/api/stripe/create-portal-session",
    });
    if (limited) return limited;

    const demoBlocked = rejectDemoMutation(request, "open Stripe billing portal");
    if (demoBlocked) {
      return NextResponse.json(
        {
          demo: true,
          error: "Demo mode cannot open the live billing portal.",
          code: "demo_mode",
        },
        { status: 403 },
      );
    }

    const user = await getAuthenticatedUser();
    if (!user?.email?.trim()) {
      return NextResponse.json(
        { error: "Sign in to manage billing." },
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

    const entitlements = await getUserEntitlements();
    const stripe = getStripeServerClient();
    const origin = new URL(request.url).origin;

    const customer = await resolveOwnedStripeCustomerForPortal({
      userId: user.id,
      email: user.email,
      entitlementsCustomerId: entitlements?.stripeCustomerId,
    });

    assertStripeCustomerOwnedByUser(customer, user.id);

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${origin}/dashboard/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    if (error instanceof StripeCustomerOwnershipError) {
      const status =
        error.code === "not_found"
          ? 404
          : error.code === "owned_by_other" || error.code === "unbound"
            ? 403
            : 400;
      return NextResponse.json({ error: error.message }, { status });
    }

    return NextResponse.json(
      { error: "Unable to open billing portal." },
      { status: 500 },
    );
  }
}
