/**
 * 0.3-10 smoke test: checkout hold alignment + webhook path.
 * Requires .env.local with service role, Stripe keys, and BOOKING_COACH_ID.
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
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    process.env[key] = value;
  }
}

loadEnvFile(join(ROOT_DIR, ".env.local"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
const coachId = process.env.BOOKING_COACH_ID?.trim() ?? "";
const baseUrl = process.env.SMOKE_BASE_URL?.trim() || "http://127.0.0.1:3000";

type Evidence = {
  step: string;
  ok: boolean;
  detail: string;
  data?: Record<string, unknown>;
};

const evidence: Evidence[] = [];

function record(step: string, ok: boolean, detail: string, data?: Record<string, unknown>) {
  evidence.push({ step, ok, detail, data });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${step}: ${detail}`);
  if (data) console.log(JSON.stringify(data, null, 2));
}

async function postStripeWebhook(
  stripe: Stripe,
  event: Stripe.Event,
): Promise<{
  ok: boolean;
  status: number;
  body: unknown;
}> {
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
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = await response.text();
  }
  return { ok: response.ok, status: response.status, body };
}

function requireEnv() {
  const missing: string[] = [];
  if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!stripeSecret) missing.push("STRIPE_SECRET_KEY");
  if (!stripeWebhookSecret) missing.push("STRIPE_WEBHOOK_SECRET");
  if (!coachId) missing.push("BOOKING_COACH_ID");
  if (missing.length > 0) {
    throw new Error(`Missing env: ${missing.join(", ")}`);
  }
}

async function main() {
  requireEnv();
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const stripe = new Stripe(stripeSecret);

  // Pre-check: migration applied
  const { error: schemaError } = await admin
    .from("player_recurring_enrolments")
    .select("expires_at")
    .limit(1);
  if (schemaError?.message?.includes("expires_at")) {
    record(
      "0. Migration schema",
      false,
      `player_recurring_enrolments.expires_at missing: ${schemaError.message}`,
    );
    printSummary();
    process.exit(1);
  }

  const { error: attachProbe } = await admin.rpc("attach_stripe_checkout_to_session_booking", {
    p_booking_id: "00000000-0000-0000-0000-000000000000",
    p_stripe_checkout_session_id: "cs_probe",
    p_checkout_expires_at: Math.floor(Date.now() / 1000) + 1800,
  });
  const attachMissing =
    attachProbe?.message?.includes("Could not find the function") ||
    attachProbe?.code === "PGRST202";
  if (attachMissing) {
    record("0. Migration RPCs", false, "attach_stripe_checkout_to_session_booking not found");
    printSummary();
    process.exit(1);
  }
  record(
    "0. Migration RPCs",
    true,
    attachProbe?.message?.includes("booking not found")
      ? "attach RPC exists (probe got expected booking not found)"
      : `attach RPC responded: ${attachProbe?.message ?? "ok"}`,
  );

  const { data: profile } = await admin
    .from("coach_public_profiles")
    .select("slug, booking_enabled")
    .eq("coach_id", coachId)
    .maybeSingle();
  if (!profile?.slug) {
    record("Setup", false, `No coach_public_profiles slug for BOOKING_COACH_ID=${coachId}`);
    printSummary();
    process.exit(1);
  }
  const coachSlug = profile.slug as string;
  record("Setup", true, `Using coach slug ${coachSlug}`);

  const sessionsRes = await fetch(
    `${baseUrl}/api/bookings?coachSlug=${encodeURIComponent(coachSlug)}`,
  );
  if (!sessionsRes.ok) {
    record("Setup", false, `GET /api/bookings failed: ${sessionsRes.status} ${await sessionsRes.text()}`);
    printSummary();
    process.exit(1);
  }
  const payload = (await sessionsRes.json()) as {
    sessions: Array<{ session_id: string; price: number; remaining_spaces: number }>;
    recurringSeries: Array<{
      recurring_series_id: string;
      monthly_price: number;
      remaining_spaces: number;
    }>;
  };

  const paidSession = payload.sessions.find(
    (s) => s.price > 0 && s.remaining_spaces > 0,
  );
  const recurringSeries = payload.recurringSeries.find(
    (s) => s.monthly_price >= 100 && s.remaining_spaces > 0,
  );

  if (!paidSession) {
    record("1. Session booking", false, "No paid session with remaining_spaces > 0");
  }
  if (!recurringSeries) {
    record("2. Recurring enrolment", false, "No recurring series with remaining_spaces > 0");
  }
  if (!paidSession && !recurringSeries) {
    printSummary();
    process.exit(1);
  }

  const smokeId = Date.now();
  let sessionBookingId: string | null = null;
  let sessionCheckoutSessionId: string | null = null;
  let sessionCheckoutExpiresAt: string | null = null;

  if (paidSession) {
    const bookRes = await fetch(
      `${baseUrl}/api/bookings?coachSlug=${encodeURIComponent(coachSlug)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: paidSession.session_id,
          childName: `Smoke Child ${smokeId}`,
          parentName: "Smoke Parent",
          parentEmail: `smoke-${smokeId}@awarix-smoke.test`,
          parentPhone: "07000000000",
        }),
      },
    );
    const bookBody = await bookRes.json();
    if (!bookRes.ok) {
      record("1. Session booking", false, `${bookRes.status}: ${JSON.stringify(bookBody)}`);
    } else {
      sessionBookingId = bookBody.bookingId ?? null;
      const checkoutUrl = bookBody.checkoutUrl as string | null;
      sessionCheckoutExpiresAt = bookBody.checkoutExpiresAt ?? null;
      record("1. Session booking", Boolean(checkoutUrl && sessionBookingId), "Created pending booking", {
        bookingId: sessionBookingId,
        checkoutUrl: checkoutUrl ? "(present)" : null,
        checkoutExpiresAt: sessionCheckoutExpiresAt,
      });

      if (sessionBookingId && checkoutUrl) {
        const match = checkoutUrl.match(/cs_(?:test|live)_[A-Za-z0-9]+/);
        sessionCheckoutSessionId = match?.[1] ?? null;
        if (!sessionCheckoutSessionId) {
          const cs = await stripe.checkout.sessions.list({ limit: 5 });
          const found = cs.data.find(
            (s) => s.metadata?.booking_id === sessionBookingId,
          );
          sessionCheckoutSessionId = found?.id ?? null;
        }

        const { data: row } = await admin
          .from("session_bookings")
          .select("stripe_checkout_session_id, expires_at")
          .eq("id", sessionBookingId)
          .maybeSingle();

        const persisted = row?.stripe_checkout_session_id === sessionCheckoutSessionId;
        record(
          "4. Session stripe_checkout_session_id",
          Boolean(persisted && sessionCheckoutSessionId),
          persisted
            ? "Persisted immediately after checkout create"
            : `Expected ${sessionCheckoutSessionId}, got ${row?.stripe_checkout_session_id}`,
          { db: row },
        );

        const dbExpires = row?.expires_at ? new Date(row.expires_at).toISOString() : null;
        const expiresMatch =
          dbExpires &&
          sessionCheckoutExpiresAt &&
          Math.abs(
            new Date(dbExpires).getTime() - new Date(sessionCheckoutExpiresAt).getTime(),
          ) < 2000;
        record(
          "5. Session expires_at alignment",
          Boolean(expiresMatch),
          expiresMatch
            ? "DB expires_at matches API checkoutExpiresAt"
            : `API=${sessionCheckoutExpiresAt} DB=${dbExpires}`,
        );

        if (sessionCheckoutSessionId) {
          const eventId = `evt_smoke_session_${smokeId}`;
          const piId = `pi_smoke_${smokeId}`;
          const event: Stripe.Event = {
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
                id: sessionCheckoutSessionId,
                object: "checkout.session",
                mode: "payment",
                payment_status: "paid",
                metadata: { booking_id: sessionBookingId },
                payment_intent: piId,
              } as Stripe.Checkout.Session,
            },
          };

          try {
            const webhook = await postStripeWebhook(stripe, event);
            record(
              "3. Session webhook",
              webhook.ok,
              `HTTP ${webhook.status}: ${JSON.stringify(webhook.body)}`,
            );
          } catch (error) {
            record(
              "3. Session webhook",
              false,
              error instanceof Error ? error.message : String(error),
            );
          }

          const { data: webhookRow } = await admin
            .from("stripe_webhook_events")
            .select("id, processed_at")
            .eq("id", eventId)
            .maybeSingle();
          const { data: auditRows } = await admin
            .from("security_audit_log")
            .select("id, action, request_id")
            .eq("request_id", eventId);

          record(
            "7. Session stripe_webhook_events",
            Boolean(webhookRow?.processed_at),
            webhookRow?.processed_at
              ? "Ledger row processed"
              : `Missing or unprocessed: ${JSON.stringify(webhookRow)}`,
          );
          record(
            "7. Session security_audit_log",
            (auditRows?.length ?? 0) > 0,
            `${auditRows?.length ?? 0} audit row(s) for request_id=${eventId}`,
            { actions: auditRows?.map((r) => r.action) },
          );
        }
      }
    }
  }

  let enrolmentId: string | null = null;
  let recurringCheckoutSessionId: string | null = null;
  let recurringCheckoutExpiresAt: string | null = null;

  if (recurringSeries) {
    const recurRes = await fetch(
      `${baseUrl}/api/bookings/recurring?coachSlug=${encodeURIComponent(coachSlug)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recurringSeriesId: recurringSeries.recurring_series_id,
          childName: `Smoke Recur ${smokeId}`,
          parentName: "Smoke Parent",
          parentEmail: `smoke-recur-${smokeId}@awarix-smoke.test`,
          parentPhone: "07000000000",
        }),
      },
    );
    const recurBody = await recurRes.json();
    if (!recurRes.ok) {
      record("2. Recurring enrolment", false, `${recurRes.status}: ${JSON.stringify(recurBody)}`);
    } else {
      enrolmentId = recurBody.enrolmentId ?? null;
      recurringCheckoutExpiresAt = recurBody.checkoutExpiresAt ?? null;
      const checkoutUrl = recurBody.checkoutUrl as string | null;
      record("2. Recurring enrolment", Boolean(enrolmentId && checkoutUrl), "Created pending enrolment", {
        enrolmentId,
        checkoutExpiresAt: recurringCheckoutExpiresAt,
      });

      if (enrolmentId && checkoutUrl) {
        const match = checkoutUrl.match(/cs_(?:test|live)_[A-Za-z0-9]+/);
        recurringCheckoutSessionId = match?.[1] ?? null;
        if (!recurringCheckoutSessionId) {
          const cs = await stripe.checkout.sessions.list({ limit: 10 });
          const found = cs.data.find((s) => s.metadata?.enrolment_id === enrolmentId);
          recurringCheckoutSessionId = found?.id ?? null;
        }

        const { data: row } = await admin
          .from("player_recurring_enrolments")
          .select("stripe_checkout_session_id, expires_at, status")
          .eq("id", enrolmentId)
          .maybeSingle();

        record(
          "4. Recurring stripe_checkout_session_id",
          row?.stripe_checkout_session_id === recurringCheckoutSessionId,
          row?.stripe_checkout_session_id === recurringCheckoutSessionId
            ? "Persisted immediately"
            : `Expected ${recurringCheckoutSessionId}, got ${row?.stripe_checkout_session_id}`,
          { db: row },
        );

        const dbExpires = row?.expires_at ? new Date(row.expires_at).toISOString() : null;
        const expiresMatch =
          dbExpires &&
          recurringCheckoutExpiresAt &&
          Math.abs(
            new Date(dbExpires).getTime() - new Date(recurringCheckoutExpiresAt).getTime(),
          ) < 2000;
        record(
          "5. Recurring expires_at alignment",
          Boolean(expiresMatch),
          expiresMatch
            ? "DB expires_at matches API checkoutExpiresAt"
            : `API=${recurringCheckoutExpiresAt} DB=${dbExpires}`,
        );

        if (recurringCheckoutSessionId && enrolmentId) {
          const subId = `sub_smoke_${smokeId}`;
          const custId = `cus_smoke_${smokeId}`;
          const eventId = `evt_smoke_recur_${smokeId}`;
          const periodEnd = Math.floor(Date.now() / 1000) + 86400 * 30;
          const subscriptionObject = {
            id: subId,
            object: "subscription",
            status: "active",
            customer: custId,
            currency: "gbp",
            metadata: { enrolment_id: enrolmentId },
            current_period_end: periodEnd,
          } as Stripe.Subscription;
          const event: Stripe.Event = {
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
                id: recurringCheckoutSessionId,
                object: "checkout.session",
                mode: "subscription",
                payment_status: "paid",
                customer: custId,
                metadata: { enrolment_id: enrolmentId },
                subscription: subscriptionObject,
              } as Stripe.Checkout.Session,
            },
          };

          await admin.from("parent_subscriptions").delete().eq("stripe_subscription_id", subId);

          try {
            const webhook = await postStripeWebhook(stripe, event);
            record(
              "3. Recurring webhook",
              webhook.ok,
              `HTTP ${webhook.status}: ${JSON.stringify(webhook.body)}`,
            );
          } catch (error) {
            record(
              "3. Recurring webhook",
              false,
              error instanceof Error ? error.message : String(error),
            );
          }

          const { data: enrolAfter } = await admin
            .from("player_recurring_enrolments")
            .select("expires_at, status")
            .eq("id", enrolmentId)
            .maybeSingle();

          record(
            "6. Recurring expires_at cleared",
            enrolAfter?.expires_at === null && enrolAfter?.status === "active",
            `expires_at=${enrolAfter?.expires_at} status=${enrolAfter?.status}`,
          );

          const { data: webhookRow } = await admin
            .from("stripe_webhook_events")
            .select("id, processed_at")
            .eq("id", eventId)
            .maybeSingle();
          const { data: auditRows } = await admin
            .from("security_audit_log")
            .select("id, action")
            .eq("request_id", eventId);

          record(
            "7. Recurring stripe_webhook_events",
            Boolean(webhookRow?.processed_at),
            webhookRow?.processed_at ? "Ledger row processed" : JSON.stringify(webhookRow),
          );
          record(
            "7. Recurring security_audit_log",
            (auditRows?.length ?? 0) > 0,
            `${auditRows?.length ?? 0} audit row(s)`,
            { actions: auditRows?.map((r) => r.action) },
          );

          await admin.from("parent_subscriptions").delete().eq("stripe_subscription_id", subId);
        }
      }
    }
  }

  printSummary();
  const failed = evidence.some((e) => !e.ok);
  process.exit(failed ? 1 : 0);
}

function printSummary() {
  console.log("\n=== 0.3-10 Smoke Test Summary ===");
  for (const row of evidence) {
    console.log(`${row.ok ? "PASS" : "FAIL"} | ${row.step} | ${row.detail}`);
  }
  const passed = evidence.filter((e) => e.ok).length;
  console.log(`\n${passed}/${evidence.length} checks passed`);
}

main().catch((error: unknown) => {
  console.error("Smoke test crashed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
