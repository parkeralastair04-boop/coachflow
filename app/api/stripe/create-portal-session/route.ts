import { NextResponse } from "next/server";
import { hasComplimentaryAccess } from "@/lib/complimentary-access";
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

    let sessionMetadata: Record<string, unknown> | null = null;
    if (supabaseUrl?.trim() && supabaseAnonKey?.trim()) {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      sessionMetadata = user?.user_metadata ?? null;
    }
    if (
      hasComplimentaryAccess({ email: customerEmail, metadata: sessionMetadata }) ||
      hasComplimentaryAccess({ email: customerEmail })
    ) {
      return NextResponse.json(
        { error: "You already have complimentary Academy access." },
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
