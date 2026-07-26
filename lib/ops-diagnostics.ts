import "server-only";

import { getAuthenticatedUser } from "@/lib/auth/server";
import { getOptionalServerEnv } from "@/lib/env/server";
import { validateStartupEnvironment } from "@/lib/env/validate-startup";
import { isFounder } from "@/lib/founders";
import { buildHealthReport } from "@/lib/health";
import { listAnalyticsFoundationSummary } from "@/lib/analytics-catalog";
import { getAppRuntimeInfo } from "@/lib/app-info";
import { createAdminClient } from "@/lib/supabase/admin";

export type DiagnosticsAccess =
  | { ok: true; via: "founder" | "admin_secret" }
  | { ok: false; status: 401 | 403; error: string };

export async function requireDiagnosticsAccess(
  request: Request,
): Promise<DiagnosticsAccess> {
  const adminSecret = getOptionalServerEnv("ADMIN_API_SECRET");
  const authorization = request.headers.get("authorization");
  if (adminSecret && authorization === `Bearer ${adminSecret}`) {
    return { ok: true, via: "admin_secret" };
  }

  const user = await getAuthenticatedUser();
  if (!user?.email) {
    return { ok: false, status: 401, error: "Sign in required." };
  }
  if (!isFounder(user.email)) {
    return { ok: false, status: 403, error: "Diagnostics are founder-only." };
  }
  return { ok: true, via: "founder" };
}

export async function buildDiagnosticsPayload() {
  const info = getAppRuntimeInfo();
  const health = await buildHealthReport();
  const envResult = validateStartupEnvironment();
  // Founder diagnostics may see real missing key names; public /api/health does not.
  const healthForOps = {
    ...health,
    env: {
      ...health.env,
      missingRequired: envResult.missingRequired,
      missingRequiredCount: envResult.missingRequired.length,
    },
  };

  let webhook: {
    processed24h: number;
    failed24h: number;
    recentFailures: Array<{ id: string; created_at: string; error: string | null }>;
  } = { processed24h: 0, failed24h: 0, recentFailures: [] };

  let activation: { last7d: number; byEvent: Record<string, number> } = {
    last7d: 0,
    byEvent: {},
  };

  let parentJourney: { last7d: number } = { last7d: 0 };

  try {
    const admin = createAdminClient();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [{ count: processed24h }, { count: failed24h }, { data: failures }] =
      await Promise.all([
        admin
          .from("stripe_webhook_events")
          .select("id", { count: "exact", head: true })
          .not("processed_at", "is", null)
          .gte("received_at", since24h),
        admin
          .from("stripe_webhook_events")
          .select("id", { count: "exact", head: true })
          .is("processed_at", null)
          .not("last_error", "is", null)
          .gte("received_at", since24h),
        admin
          .from("stripe_webhook_events")
          .select("id, received_at, last_error")
          .is("processed_at", null)
          .not("last_error", "is", null)
          .order("received_at", { ascending: false })
          .limit(5),
      ]);

    webhook = {
      processed24h: processed24h ?? 0,
      failed24h: failed24h ?? 0,
      recentFailures: (failures ?? []).map((row) => ({
        id: row.id as string,
        created_at: (row.received_at as string) ?? "",
        error:
          typeof row.last_error === "string"
            ? row.last_error.slice(0, 160)
            : null,
      })),
    };

    const { data: activationRows } = await admin
      .from("coach_activation_events")
      .select("event")
      .gte("created_at", since7d);

    const byEvent: Record<string, number> = {};
    for (const row of activationRows ?? []) {
      const event = String(row.event);
      byEvent[event] = (byEvent[event] ?? 0) + 1;
    }
    activation = {
      last7d: activationRows?.length ?? 0,
      byEvent,
    };

    const { count: parentCount } = await admin
      .from("parent_journey_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since7d);
    parentJourney = { last7d: parentCount ?? 0 };
  } catch {
    // Tables may be missing before migrations — leave zeros.
  }

  return {
    app: info,
    health: healthForOps,
    webhooks: webhook,
    activation,
    parentJourney,
    jobs: {
      note: "No durable queue. Stripe retries failed webhooks; failures remain in stripe_webhook_events for replay.",
      stripeWebhookLedger: "stripe_webhook_events",
      automations: "on-demand via /api/automations/run (session-authenticated)",
      notifications: "on-demand via /api/notifications/send",
    },
    analytics: listAnalyticsFoundationSummary(),
    secrets: {
      note: "Values never returned — presence only via health.env.groups",
    },
  };
}
