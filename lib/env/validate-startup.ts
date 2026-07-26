import "server-only";

import { getOptionalServerEnv, isProductionRuntime } from "@/lib/env/server";
import { logger } from "@/lib/logger";

export type EnvCheckStatus = "ok" | "missing" | "optional_missing";

export type EnvCheck = {
  key: string;
  status: EnvCheckStatus;
  requiredInProduction: boolean;
  group: "supabase" | "stripe" | "email" | "ai" | "bot" | "ops" | "app";
};

export type StartupValidationResult = {
  ok: boolean;
  checks: EnvCheck[];
  missingRequired: string[];
};

const REQUIRED_ALWAYS: Array<{ key: string; group: EnvCheck["group"] }> = [
  { key: "NEXT_PUBLIC_SUPABASE_URL", group: "supabase" },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", group: "supabase" },
];

const REQUIRED_IN_PRODUCTION: Array<{ key: string; group: EnvCheck["group"] }> = [
  { key: "SUPABASE_SERVICE_ROLE_KEY", group: "supabase" },
  { key: "STRIPE_SECRET_KEY", group: "stripe" },
  { key: "STRIPE_WEBHOOK_SECRET", group: "stripe" },
  { key: "STRIPE_PRICE_STARTER", group: "stripe" },
  { key: "STRIPE_PRICE_PRO", group: "stripe" },
  { key: "STRIPE_PRICE_ACADEMY", group: "stripe" },
  { key: "RESEND_API_KEY", group: "email" },
  { key: "TURNSTILE_SECRET_KEY", group: "bot" },
  { key: "NEXT_PUBLIC_TURNSTILE_SITE_KEY", group: "bot" },
];

const OPTIONAL: Array<{ key: string; group: EnvCheck["group"] }> = [
  { key: "OPENAI_API_KEY", group: "ai" },
  { key: "AWARIX_FOUNDER_EMAILS", group: "ops" },
  { key: "CRON_SECRET", group: "ops" },
  { key: "ADMIN_API_SECRET", group: "ops" },
  { key: "SENTRY_DSN", group: "ops" },
  { key: "NEXT_PUBLIC_SENTRY_DSN", group: "ops" },
  { key: "SENTRY_AUTH_TOKEN", group: "ops" },
  { key: "SENTRY_ORG", group: "ops" },
  { key: "SENTRY_PROJECT", group: "ops" },
  { key: "UPSTASH_REDIS_REST_URL", group: "ops" },
  { key: "UPSTASH_REDIS_REST_TOKEN", group: "ops" },
  { key: "NEXT_PUBLIC_SITE_URL", group: "app" },
  { key: "RESEND_FROM_EMAIL", group: "email" },
  { key: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", group: "stripe" },
];

function checkKey(
  key: string,
  group: EnvCheck["group"],
  requiredInProduction: boolean,
): EnvCheck {
  const present = Boolean(getOptionalServerEnv(key));
  if (present) {
    return { key, status: "ok", requiredInProduction, group };
  }
  if (requiredInProduction && isProductionRuntime()) {
    return { key, status: "missing", requiredInProduction, group };
  }
  if (requiredInProduction) {
    return { key, status: "optional_missing", requiredInProduction, group };
  }
  return { key, status: "optional_missing", requiredInProduction, group };
}

export function validateStartupEnvironment(): StartupValidationResult {
  const checks: EnvCheck[] = [
    ...REQUIRED_ALWAYS.map((item) => checkKey(item.key, item.group, true)),
    ...REQUIRED_IN_PRODUCTION.map((item) =>
      checkKey(item.key, item.group, true),
    ),
    ...OPTIONAL.map((item) => checkKey(item.key, item.group, false)),
  ];

  const missingRequired = checks
    .filter((check) => check.status === "missing")
    .map((check) => check.key);

  // Always-required keys fail in every environment.
  for (const item of REQUIRED_ALWAYS) {
    if (!getOptionalServerEnv(item.key) && !missingRequired.includes(item.key)) {
      missingRequired.push(item.key);
    }
  }

  const ok = missingRequired.length === 0;
  return { ok, checks, missingRequired };
}

/**
 * Fail fast in development when always-required config is absent (e.g. Supabase public keys).
 * Production-only secrets (Stripe, Resend) warn in local/dev so partial setups still boot.
 * In production, log loudly but allow boot so `/api/health` can report Unhealthy.
 */
export function runStartupValidation(): StartupValidationResult {
  const result = validateStartupEnvironment();

  if (!result.ok) {
    const message = `Missing required environment: ${result.missingRequired.join(", ")}`;
    logger.error("health", message, { missing: result.missingRequired });

    if (!isProductionRuntime()) {
      throw new Error(
        `[awarix] Startup validation failed. ${message}. Set these in .env.local before continuing.`,
      );
    }
  } else {
    const softMissing = result.checks
      .filter((check) => check.status === "optional_missing" && check.requiredInProduction)
      .map((check) => check.key);
    if (softMissing.length > 0 && !isProductionRuntime()) {
      logger.warn(
        "health",
        "Production-required env missing in non-production (OK for local). Set before deploy.",
        { missing: softMissing },
      );
    } else {
      logger.info("health", "Startup environment validation passed", {
        checkCount: result.checks.length,
      });
    }
  }

  return result;
}
