import { NextResponse } from "next/server";
import { getStripeServerClient } from "@/lib/stripe";
import {
  ensureStripeCustomerForParent,
  getStripeCurrentPeriodEnd,
  getStripeSubscriptionStatus,
  loadPlayerForCoach,
  type ParentPlayerRow,
  requireParentPaymentsAccess,
} from "@/lib/parent-payments";

type BillingInterval = "monthly" | "weekly";

type CreateSubscriptionBody = {
  playerId?: string;
  amount?: number;
  interval?: BillingInterval;
};

const intervalToStripeInterval: Record<BillingInterval, "month" | "week"> = {
  monthly: "month",
  weekly: "week",
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const access = await requireParentPaymentsAccess();
    if (!access.ok) return access.response;

    const body = (await request.json()) as CreateSubscriptionBody;
    const playerId = body.playerId?.trim();
    const interval = body.interval;
    const amount = Number(body.amount);

    if (!playerId) {
      return NextResponse.json(
        { error: "playerId is required." },
        { status: 400 },
      );
    }
    if (interval !== "monthly" && interval !== "weekly") {
      return NextResponse.json(
        { error: "interval must be monthly or weekly." },
        { status: 400 },
      );
    }
    if (!Number.isFinite(amount) || amount < 1) {
      return NextResponse.json(
        { error: "amount must be at least 1 pence." },
        { status: 400 },
      );
    }

    const { data: player, error: playerError } = await loadPlayerForCoach(
      access.supabase,
      access.coachId,
      playerId,
    );

    if (playerError) {
      return NextResponse.json({ error: playerError.message }, { status: 404 });
    }

    const safePlayer = player as ParentPlayerRow | null;
    if (!safePlayer) {
      return NextResponse.json(
        { error: "Selected player was not found." },
        { status: 404 },
      );
    }

    const customer = await ensureStripeCustomerForParent(safePlayer);
    const stripe = getStripeServerClient();
    const product = await stripe.products.create({
      name: `CoachFlow coaching subscription - ${safePlayer.player_name}`,
      metadata: {
        coach_id: access.coachId,
        player_id: playerId,
      },
    });
    const price = await stripe.prices.create({
      currency: "gbp",
      product: product.id,
      recurring: {
        interval: intervalToStripeInterval[interval],
      },
      unit_amount: amount,
    });
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      collection_method: "send_invoice",
      days_until_due: 7,
      items: [
        {
          price: price.id,
        },
      ],
      metadata: {
        coach_id: access.coachId,
        player_id: playerId,
      },
    });

    const payload = {
      coach_id: access.coachId,
      player_id: playerId,
      stripe_customer_id: customer.id,
      stripe_subscription_id: subscription.id,
      amount,
      currency: "gbp",
      interval,
      status: getStripeSubscriptionStatus(subscription),
      current_period_end: getStripeCurrentPeriodEnd(subscription),
    };

    const { data, error: insertError } = await access.supabase
      .from("parent_subscriptions")
      .upsert(payload, {
        onConflict: "stripe_subscription_id",
      })
      .select(
        "id, coach_id, player_id, stripe_customer_id, stripe_subscription_id, amount, currency, interval, status, current_period_end, created_at",
      )
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ subscription: data });
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unable to create parent subscription.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
