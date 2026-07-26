import { NextResponse } from "next/server";
import { getStripeServerClient } from "@/lib/stripe";
import {
  processStripeWebhookEvent,
  StripeWebhookProcessingError,
} from "@/lib/stripe-webhook";
import { recordJobOutcome } from "@/lib/jobs/monitor";
import { logger } from "@/lib/logger";
import { captureException } from "@/lib/monitoring";

export const runtime = "nodejs";

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Unable to process Stripe webhook.";
}

export async function POST(request: Request) {
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");

  if (!stripeWebhookSecret || !signature) {
    logger.warn("webhook", "Missing Stripe webhook configuration or signature");
    return NextResponse.json(
      { error: "Missing Stripe webhook configuration." },
      { status: 400 },
    );
  }

  let event;

  try {
    const stripe = getStripeServerClient();
    const body = await request.text();
    event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
  } catch (error: unknown) {
    logger.warn("webhook", "Stripe signature verification failed", {
      detail: getErrorMessage(error),
    });
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400 },
    );
  }

  try {
    const result = await processStripeWebhookEvent(event);

    await recordJobOutcome({
      job: "stripe_webhook",
      outcome:
        result.status === "duplicate"
          ? "duplicate"
          : result.status === "ignored"
            ? "skipped"
            : "success",
      message: `Webhook ${result.status}: ${result.eventType}`,
      metadata: {
        eventId: result.eventId,
        eventType: result.eventType,
        detail: result.detail ?? null,
      },
    });

    return NextResponse.json({
      received: true,
      eventId: result.eventId,
      status: result.status,
      detail: result.detail,
    });
  } catch (error: unknown) {
    if (error instanceof StripeWebhookProcessingError) {
      await recordJobOutcome({
        job: "stripe_webhook",
        outcome: "retryable",
        message: error.message,
        metadata: {
          eventId: error.eventId,
          eventType: error.eventType,
        },
        error,
      });
      return NextResponse.json(
        {
          error: error.message,
          eventId: error.eventId,
          eventType: error.eventType,
        },
        { status: 500 },
      );
    }

    await recordJobOutcome({
      job: "stripe_webhook",
      outcome: "failed",
      message: getErrorMessage(error),
      metadata: {
        eventId: event.id,
        eventType: event.type,
      },
      error,
    });
    await captureException(error, {
      route: "/api/stripe/webhook",
      tags: { eventType: event.type },
      extra: { eventId: event.id },
    });

    return NextResponse.json(
      {
        error: getErrorMessage(error),
        eventId: event.id,
        eventType: event.type,
      },
      { status: 500 },
    );
  }
}
