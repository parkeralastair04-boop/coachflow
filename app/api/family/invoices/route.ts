import { NextResponse } from "next/server";
import { getStripeServerClient } from "@/lib/stripe";
import { requireParentPortalAccess } from "@/lib/parent-portal-access";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const access = await requireParentPortalAccess();
    if (!access.ok) return access.response;

    const admin = createAdminClient();
    const { data: players } = await admin
      .from("players")
      .select("id")
      .ilike("parent_email", access.parentEmail);

    const playerIds = (players ?? []).map((row) => row.id as string);
    if (playerIds.length === 0) {
      return NextResponse.json({ invoices: [], upcomingPayment: null });
    }

    const { data: subscription } = await admin
      .from("parent_subscriptions")
      .select("stripe_customer_id, amount, currency, interval, status, current_period_end")
      .in("player_id", playerIds)
      .not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json({ invoices: [], upcomingPayment: null });
    }

    const stripe = getStripeServerClient();
    const invoiceList = await stripe.invoices.list({
      customer: subscription.stripe_customer_id as string,
      limit: 10,
    });

    const invoices = invoiceList.data.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      amount: invoice.amount_paid || invoice.amount_due,
      currency: invoice.currency,
      createdAt: new Date(invoice.created * 1000).toISOString(),
      hostedUrl: invoice.hosted_invoice_url,
      pdfUrl: invoice.invoice_pdf,
    }));

    return NextResponse.json({
      invoices,
      upcomingPayment: subscription.current_period_end
        ? {
            date: subscription.current_period_end,
            amount: subscription.amount,
            currency: subscription.currency,
            interval: subscription.interval,
            status: subscription.status,
          }
        : null,
    });
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unable to load invoices.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
