import { NextResponse } from "next/server";
import { getStripeServerClient } from "@/lib/stripe";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasFeatureAccess } from "@/lib/subscription";

export type ParentPlayerRow = {
  id: string;
  player_name: string;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
};

export type ParentSubscriptionRow = {
  id: string;
  coach_id: string;
  academy_id: string | null;
  player_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  amount: number;
  currency: string;
  interval: "monthly" | "weekly" | null;
  status: string;
  current_period_end: string | null;
  subscription_kind: "manual" | "recurring_series";
  recurring_series_id: string | null;
  recurring_enrolment_id: string | null;
  recurring_series?: { title: string | null } | { title: string | null }[] | null;
  created_at: string;
};

export type PaymentAccessContext =
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
      coachId: string;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function requireParentPaymentsAccess(): Promise<PaymentAccessContext> {
  const allowed = await hasFeatureAccess("parent_payments");
  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Parent payments are available on CoachFlow Academy." },
        { status: 403 },
      ),
    };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return {
      ok: false,
      response: NextResponse.json({ error: error.message }, { status: 401 }),
    };
  }

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "You must be signed in to manage parent payments." },
        { status: 401 },
      ),
    };
  }

  return { ok: true, supabase, coachId: user.id };
}

export async function loadPlayerForCoach(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  coachId: string,
  playerId: string,
) {
  return supabase
    .from("players")
    .select("id, player_name, parent_name, parent_email, parent_phone")
    .eq("id", playerId)
    .eq("coach_id", coachId)
    .single();
}

export async function ensureStripeCustomerForParent(player: ParentPlayerRow) {
  const parentEmail = player.parent_email?.trim();
  if (!parentEmail) {
    throw new Error("This player does not have a parent email address.");
  }

  const stripe = getStripeServerClient();
  const existingCustomers = await stripe.customers.list({
    email: parentEmail,
    limit: 1,
  });

  const customer =
    existingCustomers.data[0] ??
    (await stripe.customers.create({
      email: parentEmail,
      name: player.parent_name?.trim() || undefined,
      metadata: {
        player_id: player.id,
        player_name: player.player_name,
      },
    }));

  return customer;
}

export function getStripeSubscriptionStatus(subscription: unknown): string {
  if (
    typeof subscription === "object" &&
    subscription !== null &&
    "status" in subscription &&
    typeof subscription.status === "string"
  ) {
    return subscription.status;
  }
  return "unknown";
}

export function getStripeCurrentPeriodEnd(subscription: unknown): string | null {
  if (
    typeof subscription === "object" &&
    subscription !== null &&
    "current_period_end" in subscription &&
    typeof subscription.current_period_end === "number"
  ) {
    return new Date(subscription.current_period_end * 1000).toISOString();
  }

  if (
    typeof subscription === "object" &&
    subscription !== null &&
    "items" in subscription &&
    typeof subscription.items === "object" &&
    subscription.items !== null &&
    "data" in subscription.items &&
    Array.isArray(subscription.items.data)
  ) {
    const [firstItem] = subscription.items.data as unknown[];
    if (
      typeof firstItem === "object" &&
      firstItem !== null &&
      "current_period_end" in firstItem &&
      typeof firstItem.current_period_end === "number"
    ) {
      return new Date(firstItem.current_period_end * 1000).toISOString();
    }
  }

  return null;
}
