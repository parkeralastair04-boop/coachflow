/**
 * M4-04: Post-lockdown end-to-end smoke + audit verification.
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
  console.log(`\n=== M4-04 smoke: ${passed}/${evidence.length} passed ===`);
  if (passed !== evidence.length) process.exit(1);
}

async function main() {
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !stripeSecret || !stripeWebhookSecret || !coachId) {
    throw new Error("Missing required env for smoke test.");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const stripe = new Stripe(stripeSecret);
  const smokeId = Date.now();

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

  const portalRes = await fetch(
    `${baseUrl}/api/bookings?coachSlug=${encodeURIComponent(profile.slug)}`,
  );
  const portal = (await portalRes.json()) as {
    sessions: Array<{ session_id: string; price: number; remaining_spaces: number }>;
    recurringSeries: Array<{
      recurring_series_id: string;
      monthly_price: number;
      remaining_spaces: number;
    }>;
  };

  const paidSession = portal.sessions?.find((s) => s.price > 0 && s.remaining_spaces > 0);
  const recurringSeries = portal.recurringSeries?.find(
    (s) => s.monthly_price >= 100 && s.remaining_spaces > 0,
  );

  // --- SESSION ---
  if (paidSession) {
    const bookRes = await fetch(
      `${baseUrl}/api/bookings?coachSlug=${encodeURIComponent(profile.slug)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: paidSession.session_id,
          childName: `M404 Child ${smokeId}`,
          parentName: "M404 Parent",
          parentEmail: `m404-${smokeId}@awarix-smoke.test`,
          parentPhone: "07000000000",
        }),
      },
    );
    const bookBody = (await bookRes.json()) as { bookingId?: string };
    const bookingId = bookBody.bookingId ?? null;
    const cs = await stripe.checkout.sessions.list({ limit: 10 });
    const session = cs.data.find((row) => row.metadata?.booking_id === bookingId);
    const checkoutSessionId = session?.id ?? null;

    if (checkoutSessionId && bookingId) {
      const { data: pendingLookup } = await anon.rpc("get_booking_confirmation_status", {
        p_stripe_checkout_session_id: checkoutSessionId,
      });
      record(
        "Session poll lookup (pre-webhook)",
        pendingLookup?.[0]?.confirmed === false,
        JSON.stringify(pendingLookup?.[0] ?? null),
      );

      const pollRes = await fetch(`${baseUrl}/api/bookings/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutSessionId }),
      });
      const pollBody = (await pollRes.json()) as Record<string, unknown>;
      const pollPending =
        pollRes.status === 409 ||
        (pollRes.ok && pollBody.pending === true && pollBody.confirmed === false);
      record(
        "Session poll endpoint (pre-webhook)",
        pollPending,
        `HTTP ${pollRes.status}: ${JSON.stringify(pollBody)}`,
      );

      const eventId = `evt_m404_session_${smokeId}`;
      const checkoutEvent: Stripe.Event = {
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
              parent_email: `m404-${smokeId}@awarix-smoke.test`,
              parent_name: "M404 Parent",
              child_name: `M404 Child ${smokeId}`,
              academy_name: "Awarix Smoke",
              session_label: "Smoke session",
              session_date: new Date().toISOString(),
            },
            payment_intent: `pi_m404_${smokeId}`,
          } as Stripe.Checkout.Session,
        },
      };

      const webhook = await postStripeWebhook(stripe, checkoutEvent);
      record("Session webhook", webhook.ok, `HTTP ${webhook.status}`);

      const { data: confirmedLookup } = await anon.rpc("get_booking_confirmation_status", {
        p_stripe_checkout_session_id: checkoutSessionId,
      });
      record(
        "Session confirmed (post-webhook)",
        confirmedLookup?.[0]?.confirmed === true &&
          confirmedLookup?.[0]?.booking_status === "confirmed",
        JSON.stringify(confirmedLookup?.[0] ?? null),
      );

      const replay = await postStripeWebhook(stripe, checkoutEvent);
      record(
        "Session webhook replay",
        replay.ok && replay.body.includes("duplicate"),
        `HTTP ${replay.status}`,
      );

      const { data: audits } = await admin
        .from("security_audit_log")
        .select("metadata, action")
        .eq("action", "booking.confirm_session_from_stripe")
        .contains("metadata", { stripeCheckoutSessionId: checkoutSessionId });

      const confirmNowRows =
        audits?.filter((row) => {
          const meta = row.metadata as { confirmedNow?: boolean } | null;
          return meta?.confirmedNow === true;
        }).length ?? 0;
      record(
        "Session email idempotency (confirmedNow)",
        confirmNowRows === 1,
        `${confirmNowRows} row(s) with confirmedNow=true`,
      );

      const { data: processedAudit } = await admin
        .from("security_audit_log")
        .select("action")
        .eq("request_id", eventId)
        .eq("action", "stripe.webhook.processed")
        .maybeSingle();
      record(
        "Audit: stripe.webhook.processed (session)",
        Boolean(processedAudit),
        processedAudit ? "present" : "missing",
      );
    } else {
      record("Session booking", false, "Missing checkout session");
    }
  } else {
    record("Session booking", false, "No paid session");
  }

  // --- RECURRING (subscription.created path) ---
  if (recurringSeries) {
    const recurRes = await fetch(
      `${baseUrl}/api/bookings/recurring?coachSlug=${encodeURIComponent(profile.slug)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recurringSeriesId: recurringSeries.recurring_series_id,
          childName: `M404 Recur ${smokeId}`,
          parentName: "M404 Parent",
          parentEmail: `m404-recur-${smokeId}@awarix-smoke.test`,
          parentPhone: "07000000000",
        }),
      },
    );
    const recurBody = (await recurRes.json()) as { enrolmentId?: string };
    const enrolmentId = recurBody.enrolmentId ?? null;
    const cs = await stripe.checkout.sessions.list({ limit: 10 });
    const checkoutSession = cs.data.find((row) => row.metadata?.enrolment_id === enrolmentId);
    const checkoutSessionId = checkoutSession?.id ?? null;

    if (enrolmentId && checkoutSessionId) {
      const syntheticCustomerId = `cus_m404_${smokeId}`;
      const syntheticSubscriptionId = `sub_m404_${smokeId}`;
      const syntheticSubscription = {
        id: syntheticSubscriptionId,
        object: "subscription",
        status: "active",
        customer: syntheticCustomerId,
        currency: checkoutSession.currency ?? "gbp",
        items: {
          data: [
            {
              price: {
                unit_amount: recurringSeries.monthly_price,
                currency: checkoutSession.currency ?? "gbp",
              },
            },
          ],
        },
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
        metadata: { enrolment_id: enrolmentId },
      } as Stripe.Subscription;

      const subEventId = `evt_m404_sub_created_${smokeId}`;
      const subCreated: Stripe.Event = {
        id: subEventId,
        object: "event",
        api_version: "2024-06-20",
        created: Math.floor(Date.now() / 1000),
        livemode: stripeSecret.startsWith("sk_live"),
        pending_webhooks: 0,
        request: null,
        type: "customer.subscription.created",
        data: { object: syntheticSubscription },
      };

      const subWebhook = await postStripeWebhook(stripe, subCreated);
      record("Recurring subscription.created", subWebhook.ok, `HTTP ${subWebhook.status}`);

      const { data: recurLookup } = await anon.rpc("get_recurring_confirmation_status", {
        p_stripe_checkout_session_id: checkoutSessionId,
      });
      record(
        "Recurring active (post-webhook)",
        recurLookup?.[0]?.recurring_status === "active",
        JSON.stringify(recurLookup?.[0] ?? null),
      );

      const subReplay = await postStripeWebhook(stripe, subCreated);
      record(
        "Recurring subscription.created replay",
        subReplay.ok && subReplay.body.includes("duplicate"),
        `HTTP ${subReplay.status}`,
      );

      const { data: enrolAudits } = await admin
        .from("security_audit_log")
        .select("metadata, action")
        .eq("action", "booking.confirm_enrolment_from_stripe")
        .contains("metadata", { stripeSubscriptionId: syntheticSubscriptionId });

      record(
        "Audit: booking.confirm_enrolment_from_stripe",
        (enrolAudits?.length ?? 0) >= 1,
        `${enrolAudits?.length ?? 0} row(s)`,
      );

      const { data: subProcessed } = await admin
        .from("security_audit_log")
        .select("action")
        .eq("request_id", subEventId)
        .eq("action", "stripe.webhook.processed")
        .maybeSingle();
      record(
        "Audit: stripe.webhook.processed (recurring)",
        Boolean(subProcessed),
        subProcessed ? "present" : "missing",
      );
    } else {
      record("Recurring enrolment", false, "Missing enrolment/checkout session");
    }
  } else {
    record("Recurring enrolment", false, "No recurring series");
  }

  // --- PAYMENTS DASHBOARD (service_role sync path) ---
  const listRes = await fetch(`${baseUrl}/api/payments/list-subscriptions`);
  record(
    "Payments route unauthenticated",
    listRes.status === 401 || listRes.status === 403,
    `HTTP ${listRes.status} (expected 401/403 without session)`,
  );

  const { data: coachSubs } = await admin
    .from("parent_subscriptions")
    .select("stripe_subscription_id, status, current_period_end")
    .eq("coach_id", coachId)
    .not("stripe_subscription_id", "is", null)
    .limit(1);

  const subRow = coachSubs?.[0];
  if (subRow?.stripe_subscription_id) {
    const { error: syncError } = await admin.rpc("sync_recurring_subscription_state", {
      p_stripe_subscription_id: subRow.stripe_subscription_id,
      p_status: subRow.status,
      p_current_period_end: subRow.current_period_end,
    });
    record(
      "Payments sync via service_role",
      !syncError,
      syncError?.message ?? `sync ok for ${subRow.stripe_subscription_id}`,
    );

    const subUpdatedId = `evt_m404_sub_updated_${smokeId}`;
    const subUpdated: Stripe.Event = {
      id: subUpdatedId,
      object: "event",
      api_version: "2024-06-20",
      created: Math.floor(Date.now() / 1000),
      livemode: stripeSecret.startsWith("sk_live"),
      pending_webhooks: 0,
      request: null,
      type: "customer.subscription.updated",
      data: {
        object: {
          id: subRow.stripe_subscription_id,
          object: "subscription",
          status: subRow.status,
          customer: `cus_m404_${smokeId}`,
          current_period_end: subRow.current_period_end
            ? Math.floor(new Date(subRow.current_period_end).getTime() / 1000)
            : Math.floor(Date.now() / 1000) + 86400,
        } as Stripe.Subscription,
      },
    };
    const subUpdateWebhook = await postStripeWebhook(stripe, subUpdated);
    record(
      "Subscription.updated webhook",
      subUpdateWebhook.ok,
      `HTTP ${subUpdateWebhook.status}`,
    );

    const { data: snapshotAudit } = await admin
      .from("security_audit_log")
      .select("action")
      .eq("request_id", subUpdatedId)
      .eq("action", "subscription.apply_stripe_snapshot")
      .maybeSingle();
    record(
      "Audit: subscription.apply_stripe_snapshot",
      Boolean(snapshotAudit),
      snapshotAudit ? "present" : "missing",
    );
  } else {
    record("Payments sync via service_role", true, "No coach subscription row to sync (skipped)");
  }

  printSummary();
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
