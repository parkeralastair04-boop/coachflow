import "server-only";

import { captureException } from "@/lib/monitoring";
import { logger, type LogCategory } from "@/lib/logger";

export type JobName =
  | "stripe_webhook"
  | "automation_run"
  | "notification_send"
  | "email_send"
  | "booking_confirm";

export type JobOutcome = "success" | "failed" | "retryable" | "duplicate" | "skipped";

/**
 * Record background/job outcomes for ops visibility.
 * Does not persist a queue — logs + optional Sentry on failure.
 * Dead-letter: Stripe webhook failures remain in stripe_webhook_events for replay
 * (see docs/payment-runbook.md).
 */
export async function recordJobOutcome(args: {
  job: JobName;
  outcome: JobOutcome;
  message: string;
  metadata?: Record<string, unknown>;
  error?: unknown;
}): Promise<void> {
  const category: LogCategory =
    args.job === "stripe_webhook"
      ? "webhook"
      : args.job === "email_send"
        ? "email"
        : "job";

  const fields = {
    job: args.job,
    outcome: args.outcome,
    ...args.metadata,
  };

  if (args.outcome === "failed" || args.outcome === "retryable") {
    logger.error(category, args.message, fields);
    if (args.error) {
      await captureException(args.error, {
        route: `job:${args.job}`,
        tags: { job: args.job, outcome: args.outcome },
        extra: args.metadata,
      });
    }
    return;
  }

  if (args.outcome === "duplicate" || args.outcome === "skipped") {
    logger.warn(category, args.message, fields);
    return;
  }

  logger.info(category, args.message, fields);
}
