import { NextResponse } from "next/server";
import { getStripeServerClient } from "@/lib/stripe";
import { requireParentPortalAccess } from "@/lib/parent-portal-access";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type BillingPortalBody = {
  stripeCustomerId?: string;
};

export async function POST(request: Request) {
  try {
    const access = await requireParentPortalAccess();
    if (!access.ok) return access.response;

    const body = (await request.json().catch(() => ({}))) as BillingPortalBody;
    const admin = createAdminClient();

    const { data: players } = await admin
      .from("players")
      .select("id")
      .ilike("parent_email", access.parentEmail);

    const playerIds = (players ?? []).map((player) => player.id as string);
    if (playerIds.length === 0) {
      return NextResponse.json(
        { error: "No linked children were found for this account." },
        { status: 404 },
      );
    }

    let stripeCustomerId = body.stripeCustomerId?.trim() ?? "";

    if (stripeCustomerId) {
      const { data: subscription } = await admin
        .from("parent_subscriptions")
        .select("stripe_customer_id")
        .in("player_id", playerIds)
        .eq("stripe_customer_id", stripeCustomerId)
        .maybeSingle();

      if (!subscription) {
        return NextResponse.json(
          { error: "Payment details could not be found for this family." },
          { status: 403 },
        );
      }
    } else {
      const { data: subscription } = await admin
        .from("parent_subscriptions")
        .select("stripe_customer_id")
        .in("player_id", playerIds)
        .not("stripe_customer_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      stripeCustomerId = (subscription?.stripe_customer_id as string | undefined)?.trim() ?? "";
    }

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: "No payment profile is set up yet. Contact your coach if you need help." },
        { status: 404 },
      );
    }

    const stripe = getStripeServerClient();
    const origin = new URL(request.url).origin;

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${origin}/family`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unable to open payment details.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
