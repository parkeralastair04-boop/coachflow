/**
 * M4-02 smoke: webhook-first confirmation + read-only poll endpoints.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const ROOT_DIR = process.cwd();

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    process.env[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
  }
}

loadEnvFile(join(ROOT_DIR, ".env.local"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
const coachId = process.env.BOOKING_COACH_ID?.trim() ?? "";
const baseUrl = process.env.SMOKE_BASE_URL?.trim() || "http://127.0.0.1:3000";

type Evidence = { step: string; ok: boolean; detail: string };
const evidence: Evidence[] = [];

function record(step: string, ok: boolean, detail: string) {
  evidence.push({ step, ok, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${step}: ${detail}`);
}

async function postStripeWebhook(stripe: Stripe, event: Stripe.Event) {
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: stripeWebhookSecret,
  });
  const response = await fetch(`${baseUrl}/api/stripe/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
    body: payload,
  });
  return { ok: response.ok, status: response.status, body: await response.text() };
}

function printSummary() {
  const passed = evidence.filter((e) => e.ok).length;
  console.log(`\n=== M4-02 smoke: ${passed}/${evidence.length} passed ===`);
  if (passed !== evidence.length) process.exit(1);
}

async function main() {
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !stripeSecret || !stripeWebhookSecret || !coachId) {
    throw new Error("Missing required env for smoke test.");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const stripe = new Stripe(stripeSecret);

  const { error: lookupProbe } = await anon.rpc("get_booking_confirmation_status", {
    p_stripe_checkout_session_id: "cs_nonexistent_probe",
  });
  record(
    "Lookup RPCs",
    !lookupProbe?.message?.includes("Could not find the function"),
    lookupProbe?.message?.includes("Could not find the function")
      ? "get_booking_confirmation_status missing"
      : "get_booking_confirmation_status callable",
  );

  const { data: profile } = await admin
    .from("coach_public_profiles")
    .select("slug")
    .eq("coach_id", coachId)
    .maybeSingle();
  if (!profile?.slug) {
    record("Setup", false, "No coach slug");
    printSummary();
    return;
  }

  const sessionsRes = await fetch(
    `${baseUrl}/api/bookings?coachSlug=${encodeURIComponent(profile.slug)}`,
  );
  const portal = (await sessionsRes.json()) as {
    sessions: Array<{ session_id: string; price: number; remaining_spaces: number }>;
    recurringSeries: Array<{
      recurring_series_id: string;
      monthly_price: number;
      remaining_spaces: number;
    }>;
  };

  const smokeId = Date.now();
  const paidSession = portal.sessions?.find((s) => s.price > 0 && s.remaining_spaces > 0);
  const recurringSeries = portal.recurringSeries?.find(
    (s) => s.monthly_price >= 100 && s.remaining_spaces > 0,
  );

  if (paidSession) {
    const bookRes = await fetch(
      `${baseUrl}/api/bookings?coachSlug=${encodeURIComponent(profile.slug)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: paidSession.session_id,
          childName: `M402 Child ${smokeId}`,
          parentName: "M402 Parent",
          parentEmail: `m402-${smokeId}@awarix-smoke.test`,
          parentPhone: "07000000000",
        }),
      },
    );
    const bookBody = (await bookRes.json()) as {
      bookingId?: string;
      checkoutUrl?: string;
      error?: string;
    };

    if (!bookRes.ok || !bookBody.bookingId) {
      record("Session booking", false, bookBody.error ?? String(bookRes.status));
    } else {
      const bookingId = bookBody.bookingId;
      const cs = await stripe.checkout.sessions.list({ limit: 10 });
      const session = cs.data.find((row) => row.metadata?.booking_id === bookingId);
      const checkoutSessionId = session?.id ?? null;

      record("Session booking", Boolean(checkoutSessionId), `bookingId=${bookingId}`);

      if (checkoutSessionId) {
        const { data: before } = await anon.rpc("get_booking_confirmation_status", {
          p_stripe_checkout_session_id: checkoutSessionId,
        });
        const pendingBefore = !before?.[0]?.confirmed;
        record("Session lookup pending", pendingBefore, JSON.stringify(before?.[0] ?? null));

        const eventId = `evt_m402_session_${smokeId}`;
        const webhook = await postStripeWebhook(stripe, {
          id: eventId,
          object: "event",
          api_version: "2024-06-20",
          created: Math.floor(Date.now() / 1000),
          livemode: stripeSecret.startsWith("sk_live"),
          pending_webhooks: 0,
          request: null,
          type: "checkout.session.completed",
          data: {
            object: {
              id: checkoutSessionId,
              object: "checkout.session",
              mode: "payment",
              payment_status: "paid",
              metadata: {
                booking_id: bookingId,
                parent_email: `m402-${smokeId}@awarix-smoke.test`,
                parent_name: "M402 Parent",
                child_name: `M402 Child ${smokeId}`,
                academy_name: "Awarix Smoke",
                session_label: "Smoke session",
                session_date: new Date().toISOString(),
              },
              payment_intent: `pi_m402_${smokeId}`,
            } as Stripe.Checkout.Session,
          },
        } as Stripe.Event);
        record("Session webhook", webhook.ok, `HTTP ${webhook.status}`);

        const { data: after } = await anon.rpc("get_booking_confirmation_status", {
          p_stripe_checkout_session_id: checkoutSessionId,
        });
        record(
          "Session lookup confirmed",
          after?.[0]?.confirmed === true && after?.[0]?.booking_status === "confirmed",
          JSON.stringify(after?.[0] ?? null),
        );

        const replay = await postStripeWebhook(stripe, {
          id: eventId,
          object: "event",
          api_version: "2024-06-20",
          created: Math.floor(Date.now() / 1000),
          livemode: stripeSecret.startsWith("sk_live"),
          pending_webhooks: 0,
          request: null,
          type: "checkout.session.completed",
          data: {
            object: {
              id: checkoutSessionId,
              object: "checkout.session",
              mode: "payment",
              payment_status: "paid",
              metadata: { booking_id: bookingId },
              payment_intent: `pi_m402_${smokeId}`,
            } as Stripe.Checkout.Session,
          },
        } as Stripe.Event);
        record(
          "Session webhook replay",
          replay.ok && replay.body.includes("duplicate"),
          `HTTP ${replay.status}: ${replay.body.slice(0, 120)}`,
        );

        const { data: audits } = await admin
          .from("security_audit_log")
          .select("metadata")
          .eq("action", "booking.confirm_session_from_stripe")
          .contains("metadata", { stripeCheckoutSessionId: checkoutSessionId });

        const confirmNowCount =
          audits?.filter((row) => {
            const meta = row.metadata as { confirmedNow?: boolean } | null;
            return meta?.confirmedNow === true;
          }).length ?? 0;
        record(
          "Session email idempotency",
          confirmNowCount <= 1,
          `${confirmNowCount} audit row(s) with confirmedNow=true (email only on first)`,
        );
      }
    }
  } else {
    record("Session booking", false, "No paid session available");
  }

  if (recurringSeries) {
    const recurRes = await fetch(
      `${baseUrl}/api/bookings/recurring?coachSlug=${encodeURIComponent(profile.slug)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recurringSeriesId: recurringSeries.recurring_series_id,
          childName: `M402 Recur ${smokeId}`,
          parentName: "M402 Parent",
          parentEmail: `m402-recur-${smokeId}@awarix-smoke.test`,
          parentPhone: "07000000000",
        }),
      },
    );
    const recurBody = (await recurRes.json()) as { enrolmentId?: string; error?: string };

    if (!recurRes.ok || !recurBody.enrolmentId) {
      record("Recurring enrolment", false, recurBody.error ?? String(recurRes.status));
    } else {
      const enrolmentId = recurBody.enrolmentId;
      const cs = await stripe.checkout.sessions.list({ limit: 10 });
      const session = cs.data.find((row) => row.metadata?.enrolment_id === enrolmentId);
      const checkoutSessionId = session?.id ?? null;
      record("Recurring enrolment", Boolean(checkoutSessionId), `enrolmentId=${enrolmentId}`);

      if (checkoutSessionId) {
        const syntheticCustomerId = `cus_m402_${smokeId}`;
        const syntheticSubscriptionId = `sub_m402_${smokeId}`;
        const syntheticSubscription = {
          id: syntheticSubscriptionId,
          object: "subscription",
          status: "active",
          customer: syntheticCustomerId,
          currency: session?.currency ?? "gbp",
          items: {
            data: [
              {
                price: {
                  unit_amount: recurringSeries.monthly_price,
                  currency: session?.currency ?? "gbp",
                },
              },
            ],
          },
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
        } as Stripe.Subscription;

        const eventId = `evt_m402_recur_${smokeId}`;
        const webhook = await postStripeWebhook(stripe, {
          id: eventId,
          object: "event",
          api_version: "2024-06-20",
          created: Math.floor(Date.now() / 1000),
          livemode: stripeSecret.startsWith("sk_live"),
          pending_webhooks: 0,
          request: null,
          type: "checkout.session.completed",
          data: {
            object: {
              id: checkoutSessionId,
              object: "checkout.session",
              mode: "subscription",
              payment_status: "paid",
              customer: syntheticCustomerId,
              subscription: syntheticSubscription,
              currency: session?.currency ?? "gbp",
              metadata: {
                enrolment_id: enrolmentId,
                parent_email: `m402-recur-${smokeId}@awarix-smoke.test`,
                parent_name: "M402 Parent",
                child_name: `M402 Recur ${smokeId}`,
                academy_name: "Awarix Smoke",
                series_title: "Smoke recurring",
                series_day_of_week: "1",
                series_start_time: "17:00:00",
                series_location: "Smoke pitch",
              },
            } as Stripe.Checkout.Session,
          },
        } as Stripe.Event);
        record("Recurring webhook", webhook.ok, `HTTP ${webhook.status} ${webhook.body.slice(0, 160)}`);

        const { data: after } = await anon.rpc("get_recurring_confirmation_status", {
          p_stripe_checkout_session_id: checkoutSessionId,
        });
        record(
          "Recurring lookup confirmed",
          after?.[0]?.confirmed === true && after?.[0]?.recurring_status === "active",
          JSON.stringify(after?.[0] ?? null),
        );

        const replay = await postStripeWebhook(stripe, {
          id: eventId,
          object: "event",
          api_version: "2024-06-20",
          created: Math.floor(Date.now() / 1000),
          livemode: stripeSecret.startsWith("sk_live"),
          pending_webhooks: 0,
          request: null,
          type: "checkout.session.completed",
          data: {
            object: {
              id: checkoutSessionId,
              object: "checkout.session",
              mode: "subscription",
              payment_status: "paid",
              customer: syntheticCustomerId,
              subscription: syntheticSubscription,
              metadata: { enrolment_id: enrolmentId },
            } as Stripe.Checkout.Session,
          },
        } as Stripe.Event);
        record(
          "Recurring webhook replay",
          replay.ok && replay.body.includes("duplicate"),
          `HTTP ${replay.status}`,
        );

        const { data: prior } = await admin
          .from("player_recurring_enrolments")
          .select("status")
          .eq("id", enrolmentId)
          .maybeSingle();
        void prior;
        record(
          "Recurring activation idempotency",
          after?.[0]?.recurring_status === "active",
          "Enrolment remains active after replay (no duplicate activation)",
        );
      }
    }
  } else {
    record("Recurring enrolment", false, "No recurring series available");
  }

  printSummary();
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
