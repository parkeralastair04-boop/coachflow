import { NextResponse } from "next/server";
import { getStripeServerClient } from "@/lib/stripe";
import {
  getStripeCurrentPeriodEnd,
  getStripeSubscriptionStatus,
  type ParentPlayerRow,
  type ParentSubscriptionRow,
  requireParentPaymentsAccess,
} from "@/lib/parent-payments";

export const runtime = "nodejs";

export async function GET() {
  try {
    const access = await requireParentPaymentsAccess();
    if (!access.ok) return access.response;

    const [{ data: playersData, error: playersError }, { data: subscriptionData, error: subscriptionsError }] =
      await Promise.all([
        access.supabase
          .from("players")
          .select("id, player_name, parent_name, parent_email, parent_phone")
          .eq("coach_id", access.coachId)
          .order("player_name", { ascending: true }),
        access.supabase
          .from("parent_subscriptions")
          .select(
            "id, coach_id, academy_id, player_id, stripe_customer_id, stripe_subscription_id, amount, currency, interval, status, current_period_end, subscription_kind, recurring_series_id, recurring_enrolment_id, recurring_series:recurring_session_series(title), created_at",
          )
          .eq("coach_id", access.coachId)
          .order("created_at", { ascending: false }),
      ]);

    if (playersError) {
      return NextResponse.json({ error: playersError.message }, { status: 500 });
    }
    if (subscriptionsError) {
      return NextResponse.json(
        { error: subscriptionsError.message },
        { status: 500 },
      );
    }

    const players = (playersData ?? []) as ParentPlayerRow[];
    const subscriptions = (subscriptionData ?? []) as ParentSubscriptionRow[];
    const stripe = getStripeServerClient();

    const refreshedSubscriptions = await Promise.all(
      subscriptions.map(async (subscription) => {
        if (!subscription.stripe_subscription_id) return subscription;

        try {
          const stripeSubscription = await stripe.subscriptions.retrieve(
            subscription.stripe_subscription_id,
          );
          const status = getStripeSubscriptionStatus(stripeSubscription);
          const currentPeriodEnd = getStripeCurrentPeriodEnd(stripeSubscription);

          if (
            status !== subscription.status ||
            currentPeriodEnd !== subscription.current_period_end
          ) {
            await access.supabase.rpc("sync_recurring_subscription_state", {
              p_stripe_subscription_id: subscription.stripe_subscription_id,
              p_status: status,
              p_current_period_end: currentPeriodEnd,
            });
          }

          return {
            ...subscription,
            status,
            current_period_end: currentPeriodEnd,
          };
        } catch {
          return subscription;
        }
      }),
    );

    await access.supabase.rpc("sync_active_recurring_series_for_coach", {
      p_coach_id: access.coachId,
    });

    return NextResponse.json({
      players,
      subscriptions: refreshedSubscriptions,
    });
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unable to load parent subscriptions.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
