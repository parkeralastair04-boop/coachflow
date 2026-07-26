import "server-only";

export type PrivilegedFeature =
  | "service_role"
  | "stripe_webhook"
  | "stripe_api"
  | "cron"
  | "admin_api";

const loggedWarnings = new Set<string>();

function warnOnce(key: string, message: string) {
  if (loggedWarnings.has(key)) {
    return;
  }
  loggedWarnings.add(key);
  console.warn(`[awarix/env] ${message}`);
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

export function getOptionalServerEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function getRequiredServerEnv(name: string): string {
  const value = getOptionalServerEnv(name);
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

export function getServiceRoleKey(): string {
  const key = getOptionalServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (key) {
    return key;
  }

  const message =
    "SUPABASE_SERVICE_ROLE_KEY is not configured. Privileged operations are disabled.";

  if (isProductionRuntime()) {
    throw new Error(message);
  }

  warnOnce("service_role_missing", `${message} (development)`);
  throw new Error(message);
}

export function isPrivilegedFeatureEnabled(feature: PrivilegedFeature): boolean {
  switch (feature) {
    case "service_role":
      return Boolean(getOptionalServerEnv("SUPABASE_SERVICE_ROLE_KEY"));
    case "stripe_webhook":
      return Boolean(getOptionalServerEnv("STRIPE_WEBHOOK_SECRET"));
    case "stripe_api":
      return Boolean(getOptionalServerEnv("STRIPE_SECRET_KEY"));
    case "cron":
      return Boolean(getOptionalServerEnv("CRON_SECRET"));
    case "admin_api":
      return Boolean(getOptionalServerEnv("ADMIN_API_SECRET"));
    default:
      return false;
  }
}

export function assertPrivilegedFeatureEnabled(feature: PrivilegedFeature): void {
  if (isPrivilegedFeatureEnabled(feature)) {
    return;
  }

  const envName: Record<PrivilegedFeature, string> = {
    service_role: "SUPABASE_SERVICE_ROLE_KEY",
    stripe_webhook: "STRIPE_WEBHOOK_SECRET",
    stripe_api: "STRIPE_SECRET_KEY",
    cron: "CRON_SECRET",
    admin_api: "ADMIN_API_SECRET",
  };

  throw new Error(`${envName[feature]} is not configured.`);
}
