import { NextResponse } from "next/server";
import { isFounder } from "@/lib/founders";
import { getStripeServerClient } from "@/lib/stripe";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

type PortalRequestBody = {
  customerEmail?: string;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PortalRequestBody;
    const customerEmail = body.customerEmail?.trim();
    if (!customerEmail) {
      return NextResponse.json(
        { error: "customerEmail is required." },
        { status: 400 },
      );
    }

    let sessionEmail: string | null = null;
    if (supabaseUrl?.trim() && supabaseAnonKey?.trim()) {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      sessionEmail = user?.email ?? null;
    }
    if (isFounder(customerEmail) || isFounder(sessionEmail)) {
      return NextResponse.json(
        { error: "You have complimentary founder access." },
        { status: 403 },
      );
    }

    const stripe = getStripeServerClient();
    const origin = new URL(request.url).origin;

    const existingCustomers = await stripe.customers.list({
      email: customerEmail,
      limit: 1,
    });

    const customer =
      existingCustomers.data[0] ??
      (await stripe.customers.create({
        email: customerEmail,
      }));

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${origin}/dashboard/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unable to open billing portal.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
