import { NextResponse } from "next/server";
import {
  ensureStripeCustomerForParent,
  loadPlayerForCoach,
  type ParentPlayerRow,
  requireParentPaymentsAccess,
} from "@/lib/parent-payments";

type CreateCustomerBody = {
  playerId?: string;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const access = await requireParentPaymentsAccess();
    if (!access.ok) return access.response;

    const body = (await request.json()) as CreateCustomerBody;
    const playerId = body.playerId?.trim();
    if (!playerId) {
      return NextResponse.json(
        { error: "playerId is required." },
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

    const { data: existingRows, error: existingError } = await access.supabase
      .from("parent_subscriptions")
      .select("id")
      .eq("coach_id", access.coachId)
      .eq("player_id", playerId)
      .eq("stripe_customer_id", customer.id)
      .limit(1);

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 500 },
      );
    }

    if ((existingRows ?? []).length === 0) {
      const { error: insertError } = await access.supabase
        .from("parent_subscriptions")
        .insert({
          coach_id: access.coachId,
          player_id: playerId,
          stripe_customer_id: customer.id,
          stripe_subscription_id: null,
          amount: 0,
          currency: "gbp",
          interval: null,
          status: "customer_created",
          current_period_end: null,
        });

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ customerId: customer.id });
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unable to create Stripe customer.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
