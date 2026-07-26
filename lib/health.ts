import "server-only";

import { getAppRuntimeInfo } from "@/lib/app-info";
import {
  validateStartupEnvironment,
  type EnvCheck,
} from "@/lib/env/validate-startup";
import { getOptionalServerEnv, isPrivilegedFeatureEnabled } from "@/lib/env/server";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export type HealthStatus = "healthy" | "warning" | "unhealthy";

export type HealthComponent = {
  name: string;
  status: HealthStatus;
  detail: string;
};

export type HealthReport = {
  status: HealthStatus;
  version: string;
  release: string;
  environment: string;
  buildTimestamp: string | null;
  commitSha: string | null;
  checkedAt: string;
  components: HealthComponent[];
  env: {
    ok: boolean;
    missingRequired: string[];
    missingRequiredCount: number;
    groups: Record<string, { ok: number; missing: number; optionalMissing: number }>;
  };
};

function worst(a: HealthStatus, b: HealthStatus): HealthStatus {
  const rank = { healthy: 0, warning: 1, unhealthy: 2 } as const;
  return rank[a] >= rank[b] ? a : b;
}

function summarizeEnv(checks: EnvCheck[]) {
  const groups: HealthReport["env"]["groups"] = {};
  for (const check of checks) {
    const bucket = groups[check.group] ?? { ok: 0, missing: 0, optionalMissing: 0 };
    if (check.status === "ok") bucket.ok += 1;
    else if (check.status === "missing") bucket.missing += 1;
    else bucket.optionalMissing += 1;
    groups[check.group] = bucket;
  }
  return groups;
}

async function checkDatabase(): Promise<HealthComponent> {
  try {
    if (!isPrivilegedFeatureEnabled("service_role")) {
      return {
        name: "database",
        status: "unhealthy",
        detail: "Service role key not configured",
      };
    }
    const admin = createAdminClient();
    const { error } = await admin.from("academies").select("id").limit(1);
    if (error) {
      return {
        name: "database",
        status: "unhealthy",
        detail: "Supabase query failed",
      };
    }
    return {
      name: "database",
      status: "healthy",
      detail: "Supabase reachable",
    };
  } catch {
    return {
      name: "database",
      status: "unhealthy",
      detail: "Supabase unavailable",
    };
  }
}

function checkStripe(): HealthComponent {
  const api = isPrivilegedFeatureEnabled("stripe_api");
  const webhook = isPrivilegedFeatureEnabled("stripe_webhook");
  const prices = ["STRIPE_PRICE_STARTER", "STRIPE_PRICE_PRO", "STRIPE_PRICE_ACADEMY"].every(
    (key) => Boolean(getOptionalServerEnv(key)),
  );

  if (api && webhook && prices) {
    return { name: "stripe", status: "healthy", detail: "API, webhook secret, and price IDs set" };
  }
  if (api || webhook) {
    return {
      name: "stripe",
      status: "warning",
      detail: "Partial Stripe configuration",
    };
  }
  return {
    name: "stripe",
    status: "unhealthy",
    detail: "Stripe not configured",
  };
}

function checkEmail(): HealthComponent {
  if (getOptionalServerEnv("RESEND_API_KEY")) {
    return { name: "email", status: "healthy", detail: "Resend configured" };
  }
  return {
    name: "email",
    status: "warning",
    detail: "RESEND_API_KEY missing — transactional email disabled",
  };
}

function checkMonitoring(): HealthComponent {
  if (
    getOptionalServerEnv("SENTRY_DSN") ||
    getOptionalServerEnv("NEXT_PUBLIC_SENTRY_DSN")
  ) {
    return { name: "monitoring", status: "healthy", detail: "Sentry DSN configured" };
  }
  return {
    name: "monitoring",
    status: "warning",
    detail: "Sentry DSN not set — errors only go to logs",
  };
}

export async function buildHealthReport(): Promise<HealthReport> {
  const info = getAppRuntimeInfo();
  const envResult = validateStartupEnvironment();
  const [database] = await Promise.all([checkDatabase()]);
  const components: HealthComponent[] = [
    database,
    checkStripe(),
    checkEmail(),
    checkMonitoring(),
    {
      name: "supabase_public",
      status:
        getOptionalServerEnv("NEXT_PUBLIC_SUPABASE_URL") &&
        getOptionalServerEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
          ? "healthy"
          : "unhealthy",
      detail:
        getOptionalServerEnv("NEXT_PUBLIC_SUPABASE_URL") &&
        getOptionalServerEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
          ? "Public Supabase env present"
          : "Public Supabase env missing",
    },
  ];

  let status: HealthStatus = envResult.ok ? "healthy" : "unhealthy";
  for (const component of components) {
    status = worst(status, component.status);
  }

  const report: HealthReport = {
    status,
    version: info.version,
    release: info.release,
    environment: info.environment,
    buildTimestamp: info.buildTimestamp,
    commitSha: info.commitSha,
    checkedAt: new Date().toISOString(),
    components,
    env: {
      ok: envResult.ok,
      // Public probe: counts only — never list secret names.
      missingRequired: envResult.missingRequired.map(() => "[configured-check]"),
      missingRequiredCount: envResult.missingRequired.length,
      groups: summarizeEnv(envResult.checks),
    },
  };

  logger.info("health", `Health check ${status}`, {
    status,
    components: components.map((c) => c.name + ":" + c.status),
  });

  return report;
}
