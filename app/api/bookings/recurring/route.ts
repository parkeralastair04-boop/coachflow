import { NextResponse } from "next/server";
import { getDayLabel, type PublicRecurringSeriesRow } from "@/lib/booking-system";
import {
  createPublicSupabaseClient,
  loadPublicBookingPayload,
  type PublicPortalTenant,
} from "@/lib/public-booking";
import { getStripeServerClient } from "@/lib/stripe";

type RecurringBookingBody = {
  recurringSeriesId?: string;
  childName?: string;
  childDateOfBirth?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  notes?: string;
};

type CreateRecurringRpcRow = {
  enrolment_id: string;
  player_id: string;
  coach_id: string;
  academy_id: string | null;
  title: string;
  monthly_price: number;
  currency: string;
};

export const runtime = "nodejs";

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Unable to create recurring subscription.";
}

function getTenantFromRequest(request: Request): PublicPortalTenant | null {
  const url = new URL(request.url);
  const coachSlug = url.searchParams.get("coachSlug")?.trim();
  const academySlug = url.searchParams.get("academySlug")?.trim();

  if (coachSlug) return { kind: "coach", slug: coachSlug };
  if (academySlug) return { kind: "academy", slug: academySlug };
  return null;
}

function getPortalUrl(origin: string, tenant: PublicPortalTenant) {
  return tenant.kind === "coach"
    ? `${origin}/book/${tenant.slug}`
    : `${origin}/academy/${tenant.slug}/book`;
}

function getSeriesTimeLabel(series: PublicRecurringSeriesRow) {
  return series.start_time.slice(0, 5);
}

export async function POST(request: Request) {
  try {
    const tenant = getTenantFromRequest(request);
    if (!tenant) {
      return NextResponse.json(
        { error: "coachSlug or academySlug is required." },
        { status: 400 },
      );
    }

    const body = (await request.json()) as RecurringBookingBody;
    const recurringSeriesId = body.recurringSeriesId?.trim();
    const childName = body.childName?.trim();
    const parentName = body.parentName?.trim() ?? "";
    const parentEmail = body.parentEmail?.trim();
    const parentPhone = body.parentPhone?.trim() ?? "";

    if (!recurringSeriesId || !childName || !parentEmail) {
      return NextResponse.json(
        {
          error:
            "Recurring series, child name, and parent email are required.",
        },
        { status: 400 },
      );
    }

    const payload = await loadPublicBookingPayload(tenant);
    if (!payload || !payload.portal.booking_enabled) {
      return NextResponse.json({ error: "Booking portal not found." }, { status: 404 });
    }

    const selectedSeries = payload.recurringSeries.find(
      (series) => series.recurring_series_id === recurringSeriesId,
    );
    if (!selectedSeries || selectedSeries.remaining_spaces <= 0) {
      return NextResponse.json(
        { error: "Selected recurring series is no longer available." },
        { status: 404 },
      );
    }

    if (selectedSeries.monthly_price < 100) {
      return NextResponse.json(
        {
          error:
            "Recurring subscriptions require a monthly price of at least £1.00.",
        },
        { status: 400 },
      );
    }

    const supabase = createPublicSupabaseClient();
    const { data, error } = await supabase.rpc("create_public_recurring_enrolment", {
      p_series_id: recurringSeriesId,
      p_child_name: childName,
      p_child_date_of_birth: body.childDateOfBirth || null,
      p_parent_name: parentName || null,
      p_parent_email: parentEmail,
      p_parent_phone: parentPhone || null,
      p_notes: body.notes?.trim() || null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const enrolment = (data?.[0] ?? null) as CreateRecurringRpcRow | null;
    if (!enrolment) {
      return NextResponse.json(
        { error: "Could not create recurring enrolment." },
        { status: 500 },
      );
    }

    const stripe = getStripeServerClient();
    const origin = new URL(request.url).origin;
    const portalUrl = getPortalUrl(origin, tenant);
    const stripeSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: parentEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: selectedSeries.currency,
            unit_amount: enrolment.monthly_price,
            recurring: { interval: "month" },
            product_data: {
              name: selectedSeries.title,
              description: `${getDayLabel(selectedSeries.day_of_week)} at ${getSeriesTimeLabel(selectedSeries)}`,
            },
          },
        },
      ],
      success_url: `${portalUrl}?subscription=success&checkout_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${portalUrl}?subscription=cancelled`,
      metadata: {
        enrolment_id: enrolment.enrolment_id,
        recurring_series_id: recurringSeriesId,
        player_id: enrolment.player_id,
        coach_id: enrolment.coach_id,
        academy_id: enrolment.academy_id ?? "",
        child_name: childName,
        parent_name: parentName,
        parent_email: parentEmail,
        academy_name: payload.portal.display_name,
        academy_primary_color: payload.portal.primary_color,
        series_title: selectedSeries.title,
        series_day_of_week: String(selectedSeries.day_of_week),
        series_start_time: selectedSeries.start_time,
        series_location: selectedSeries.location ?? "",
        portal_kind: tenant.kind,
        portal_slug: tenant.slug,
      },
      subscription_data: {
        metadata: {
          enrolment_id: enrolment.enrolment_id,
          recurring_series_id: recurringSeriesId,
          player_id: enrolment.player_id,
          coach_id: enrolment.coach_id,
          academy_id: enrolment.academy_id ?? "",
          portal_kind: tenant.kind,
          portal_slug: tenant.slug,
        },
      },
    });

    return NextResponse.json({
      enrolmentId: enrolment.enrolment_id,
      playerId: enrolment.player_id,
      checkoutUrl: stripeSession.url ?? null,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
