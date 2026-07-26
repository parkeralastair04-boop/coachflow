/**
 * Error reporting helpers. No-ops when Sentry DSN is unset.
 */

import { getAppRuntimeInfo } from "@/lib/app-info";
import { logger } from "@/lib/logger";

export function isSentryConfigured(): boolean {
  return Boolean(
    process.env.SENTRY_DSN?.trim() ||
      process.env.NEXT_PUBLIC_SENTRY_DSN?.trim(),
  );
}

export async function captureException(
  error: unknown,
  context?: {
    route?: string;
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    level?: "fatal" | "error" | "warning" | "info";
  },
): Promise<void> {
  const detail =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "unknown";

  logger.error("app", context?.route ? `${context.route}: ${detail}` : detail, {
    ...context?.extra,
    tags: context?.tags,
  });

  if (!isSentryConfigured()) return;

  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.withScope((scope) => {
      if (context?.route) scope.setTag("route", context.route);
      if (context?.level) scope.setLevel(context.level);
      if (context?.tags) {
        for (const [key, value] of Object.entries(context.tags)) {
          scope.setTag(key, value);
        }
      }
      if (context?.extra) scope.setExtras(context.extra);
      const info = getAppRuntimeInfo();
      scope.setTag("app.version", info.version);
      scope.setTag("app.environment", info.environment);
      Sentry.captureException(error);
    });
  } catch {
    // Never throw from monitoring.
  }
}

/** Client-safe capture (browser bundle). */
export function captureClientException(
  error: unknown,
  context?: { route?: string; tags?: Record<string, string> },
): void {
  if (typeof window === "undefined") return;

  console.error("[awarix/client]", error);

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) return;

  void import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.withScope((scope) => {
        if (context?.route) scope.setTag("route", context.route);
        if (context?.tags) {
          for (const [key, value] of Object.entries(context.tags)) {
            scope.setTag(key, value);
          }
        }
        Sentry.captureException(error);
      });
    })
    .catch(() => {
      // ignore
    });
}
