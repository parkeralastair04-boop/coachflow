/**
 * RC webhook smoke — signature + endpoint readiness (no booking fixtures).
 *
 * Env:
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET
 *   SMOKE_BASE_URL (default http://127.0.0.1:3000)
 *
 * Full booking confirmation smoke: scripts/smoke-m402-webhook-confirm.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
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
    if (process.env[key] !== undefined) continue;
    process.env[key] = trimmed.slice(separator + 1).trim();
  }
}

loadEnvFile(join(ROOT_DIR, ".env.local"));

const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
const baseUrl = process.env.SMOKE_BASE_URL?.trim() || "http://127.0.0.1:3000";

type Evidence = { step: string; ok: boolean; detail: string };
const evidence: Evidence[] = [];

function record(step: string, ok: boolean, detail: string) {
  evidence.push({ step, ok, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${step}: ${detail}`);
}

async function postWebhook(args: {
  body: string;
  signature: string | null;
}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (args.signature) {
    headers["stripe-signature"] = args.signature;
  }
  const response = await fetch(`${baseUrl}/api/stripe/webhook`, {
    method: "POST",
    headers,
    body: args.body,
  });
  return {
    ok: response.ok,
    status: response.status,
    body: await response.text(),
  };
}

function printSummary() {
  const passed = evidence.filter((e) => e.ok).length;
  console.log(`\n=== RC webhook smoke: ${passed}/${evidence.length} passed ===`);
  if (passed !== evidence.length) process.exit(1);
}

async function main() {
  if (!stripeSecret || !stripeWebhookSecret) {
    throw new Error(
      "Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET for RC webhook smoke.",
    );
  }

  const stripe = new Stripe(stripeSecret);
  const eventId = `evt_rc_smoke_${Date.now()}`;
  const event = {
    id: eventId,
    object: "event",
    api_version: "2025-01-27.acacia",
    created: Math.floor(Date.now() / 1000),
    type: "ping",
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    data: { object: { id: "ping_rc_smoke", object: "ping" } },
  } as unknown as Stripe.Event;

  const payload = JSON.stringify(event);

  const missingSig = await postWebhook({ body: payload, signature: null });
  record(
    "Reject missing signature",
    missingSig.status === 400,
    `status=${missingSig.status}`,
  );

  const badSig = await postWebhook({
    body: payload,
    signature: "t=1,v1=deadbeef",
  });
  record(
    "Reject invalid signature",
    badSig.status === 400,
    `status=${badSig.status}`,
  );

  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: stripeWebhookSecret,
  });
  const valid = await postWebhook({ body: payload, signature });
  let detail = `status=${valid.status}`;
  try {
    const json = JSON.parse(valid.body) as { received?: boolean; status?: string };
    detail += ` received=${Boolean(json.received)} status=${json.status ?? "?"}`;
  } catch {
    detail += ` body=${valid.body.slice(0, 120)}`;
  }
  record(
    "Accept signed ping event",
    valid.ok && valid.status === 200,
    detail,
  );

  const healthRes = await fetch(`${baseUrl}/api/health`);
  const healthOk = healthRes.ok;
  let stripeHealthy = false;
  try {
    const health = (await healthRes.json()) as {
      components?: Array<{ name: string; status: string }>;
    };
    stripeHealthy =
      health.components?.some(
        (c) => c.name === "stripe" && c.status !== "unhealthy",
      ) ?? false;
  } catch {
    stripeHealthy = false;
  }
  record(
    "Health stripe component",
    healthOk && stripeHealthy,
    `healthHttp=${healthRes.status} stripeOk=${stripeHealthy}`,
  );

  printSummary();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
