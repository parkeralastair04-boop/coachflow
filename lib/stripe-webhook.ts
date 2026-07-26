import "server-only";

import type Stripe from "stripe";
import {
  applyStripeSubscriptionSnapshot,
  confirmEnrolmentFromStripe,
  confirmSessionBookingFromStripe,
  notifyParentOfFailedPayment,
  type RecurringEnrolmentEmailContext,
  type SessionBookingEmailContext,
} from "@/lib/booking-confirmation";
import { getDayLabel } from "@/lib/booking-system";
import {
  getStripeCurrentPeriodEnd,
  getStripeSubscriptionStatus,
} from "@/lib/parent-payments";
import {
  assertCoachSaasSyncApplied,
  isCoachSaasSubscription,
  syncCoachSaasEntitlements,
} from "@/lib/coach-saas-billing";
import { auditLog } from "@/lib/security-audit";
import { getStripeServerClient } from "@/lib/stripe";
import {
  AWARIX_USER_ID_METADATA_KEY,
  LEGACY_USER_ID_METADATA_KEY,
} from "@/lib/stripe-customer-ownership";
import { createAdminClient } from "@/lib/supabase/admin";

const WEBHOOK_AUDIT_ACTIONS = {
  duplicate: "stripe.webhook.duplicate",
  failed: "stripe.webhook.failed",
  ignored: "stripe.webhook.ignored",
  ledgerFailed: "stripe.webhook.ledger_failed",
  processed: "stripe.webhook.processed",
  checkoutLinkSynced: "stripe.webhook.checkout_link_synced",
} as const;

const HANDLED_EVENT_TYPES = new Set<string>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

export type StripeWebhookProcessResult = {
  eventId: string;
  eventType: string;
  status: "processed" | "duplicate" | "ignored";
  detail?: string;
};

export class StripeWebhookProcessingError extends Error {
  constructor(
    message: string,
    readonly eventId: string,
    readonly eventType: string,
  ) {
    super(message);
    this.name = "StripeWebhookProcessingError";
  }
}

type StripeWebhookEventRow = {
  id: string;
  processed_at: string | null;
};

function webhookAuditContext(event: Stripe.Event) {
  return {
    actorType: "webhook" as const,
    requestId: event.id,
    metadata: {
      stripeEventType: event.type,
      livemode: event.livemode,
    },
  };
}

function isUniqueViolation(error: { code?: string } | null | undefined): boolean {
  return error?.code === "23505";
}

async function auditWebhookLedgerFailure(
  event: Stripe.Event,
  stage: "load" | "insert" | "mark_processed" | "record_failure",
  message: string,
  code?: string,
) {
  await auditLog({
    actorType: "webhook",
    actorId: event.id,
    action: WEBHOOK_AUDIT_ACTIONS.ledgerFailed,
    resourceType: "stripe_webhook_event",
    resourceId: event.id,
    outcome: "failure",
    metadata: {
      stripeEventType: event.type,
      livemode: event.livemode,
      stage,
      error: message,
      code,
    },
    requestId: event.id,
  });
}

async function loadWebhookEventRow(
  event: Stripe.Event,
): Promise<StripeWebhookEventRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("stripe_webhook_events")
    .select("id, processed_at")
    .eq("id", event.id)
    .maybeSingle();

  if (error) {
    await auditWebhookLedgerFailure(event, "load", error.message, error.code);
    throw new StripeWebhookProcessingError(
      `Failed to load webhook event row: ${error.message}`,
      event.id,
      event.type,
    );
  }

  return (data as StripeWebhookEventRow | null) ?? null;
}

async function recordWebhookFailure(
  event: Stripe.Event,
  message: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("stripe_webhook_events")
    .update({ last_error: message })
    .eq("id", event.id);

  if (updateError) {
    await auditWebhookLedgerFailure(
      event,
      "record_failure",
      updateError.message,
      updateError.code,
    );
    await auditLog({
      actorType: "webhook",
      actorId: event.id,
      action: WEBHOOK_AUDIT_ACTIONS.failed,
      resourceType: "stripe_webhook_event",
      resourceId: event.id,
      outcome: "failure",
      metadata: {
        stripeEventType: event.type,
        livemode: event.livemode,
        error: message,
        ledgerUpdateFailed: true,
      },
      requestId: event.id,
    });
    throw new StripeWebhookProcessingError(
      `Failed to record webhook failure: ${updateError.message}`,
      event.id,
      event.type,
    );
  }

  await auditLog({
    actorType: "webhook",
    actorId: event.id,
    action: WEBHOOK_AUDIT_ACTIONS.failed,
    resourceType: "stripe_webhook_event",
    resourceId: event.id,
    outcome: "failure",
    metadata: {
      stripeEventType: event.type,
      livemode: event.livemode,
      error: message,
    },
    requestId: event.id,
  });
}

async function markWebhookProcessed(event: Stripe.Event, detail?: string) {
  const admin = createAdminClient();
  const processedAt = new Date().toISOString();

  const { error: updateError } = await admin
    .from("stripe_webhook_events")
    .update({ processed_at: processedAt, last_error: null })
    .eq("id", event.id);

  if (updateError) {
    await auditWebhookLedgerFailure(
      event,
      "mark_processed",
      updateError.message,
      updateError.code,
    );
    throw new StripeWebhookProcessingError(
      `Failed to mark webhook event processed: ${updateError.message}`,
      event.id,
      event.type,
    );
  }

  await auditLog({
    actorType: "webhook",
    actorId: event.id,
    action: WEBHOOK_AUDIT_ACTIONS.processed,
    resourceType: "stripe_webhook_event",
    resourceId: event.id,
    outcome: "success",
    metadata: {
      stripeEventType: event.type,
      livemode: event.livemode,
      detail,
    },
    requestId: event.id,
  });
}

async function claimWebhookEvent(
  event: Stripe.Event,
): Promise<"process" | "duplicate"> {
  const admin = createAdminClient();
  const existing = await loadWebhookEventRow(event);

  if (existing?.processed_at) {
    await auditLog({
      actorType: "webhook",
      actorId: event.id,
      action: WEBHOOK_AUDIT_ACTIONS.duplicate,
      resourceType: "stripe_webhook_event",
      resourceId: event.id,
      outcome: "success",
      metadata: {
        stripeEventType: event.type,
        livemode: event.livemode,
        processedAt: existing.processed_at,
      },
      requestId: event.id,
    });
    return "duplicate";
  }

  if (!existing) {
    const { error: insertError } = await admin.from("stripe_webhook_events").insert({
      id: event.id,
      type: event.type,
      livemode: event.livemode,
    });

    if (insertError && !isUniqueViolation(insertError)) {
      await auditWebhookLedgerFailure(
        event,
        "insert",
        insertError.message,
        insertError.code,
      );
      throw new StripeWebhookProcessingError(
        `Failed to record webhook event: ${insertError.message}`,
        event.id,
        event.type,
      );
    }

    if (insertError && isUniqueViolation(insertError)) {
      const raced = await loadWebhookEventRow(event);
      if (raced?.processed_at) {
        await auditLog({
          actorType: "webhook",
          actorId: event.id,
          action: WEBHOOK_AUDIT_ACTIONS.duplicate,
          resourceType: "stripe_webhook_event",
          resourceId: event.id,
          outcome: "success",
          metadata: {
            stripeEventType: event.type,
            livemode: event.livemode,
            processedAt: raced.processed_at,
          },
          requestId: event.id,
        });
        return "duplicate";
      }
    }
  }

  return "process";
}

async function retrieveSubscription(
  subscription: string | Stripe.Subscription | null | undefined,
): Promise<Stripe.Subscription | null> {
  if (!subscription) {
    return null;
  }

  if (typeof subscription === "object") {
    return subscription;
  }

  const stripe = getStripeServerClient();
  return stripe.subscriptions.retrieve(subscription);
}

function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const invoiceRecord = invoice as Stripe.Invoice & {
    subscription?: string | { id: string } | null;
    parent?: {
      type?: string;
      subscription_details?: {
        subscription?: string | { id: string } | null;
      } | null;
    } | null;
    lines?: {
      data?: Array<{
        parent?: {
          subscription_item_details?: {
            subscription?: string | null;
          } | null;
        } | null;
      }>;
    };
  };

  const candidates: Array<string | { id: string } | null | undefined> = [
    invoiceRecord.subscription,
    invoiceRecord.parent?.type === "subscription_details"
      ? invoiceRecord.parent.subscription_details?.subscription
      : null,
    invoiceRecord.lines?.data?.[0]?.parent?.subscription_item_details?.subscription,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      return candidate;
    }

    if (
      candidate &&
      typeof candidate === "object" &&
      "id" in candidate &&
      typeof candidate.id === "string"
    ) {
      return candidate.id;
    }
  }

  return null;
}

function parseCheckoutLinkAmount(metadata: Stripe.Metadata | null | undefined): number {
  const raw = metadata?.amount?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCheckoutLinkInterval(
  metadata: Stripe.Metadata | null | undefined,
): "monthly" | "weekly" | null {
  const raw = metadata?.billing_interval?.trim();
  if (raw === "monthly" || raw === "weekly") {
    return raw;
  }
  return null;
}

async function syncCheckoutLinkParentSubscription(args: {
  event: Stripe.Event;
  session: Stripe.Checkout.Session;
  subscription: Stripe.Subscription;
}): Promise<void> {
  const coachId = args.session.metadata?.coach_id?.trim();
  const playerId = args.session.metadata?.player_id?.trim();
  const customerId =
    typeof args.session.customer === "string"
      ? args.session.customer
      : args.session.customer?.id;

  if (!coachId || !playerId || !customerId) {
    await auditLog({
      actorType: "webhook",
      actorId: args.event.id,
      action: WEBHOOK_AUDIT_ACTIONS.ignored,
      resourceType: "stripe_checkout_session",
      resourceId: args.session.id,
      outcome: "success",
      metadata: {
        reason: "checkout_link_missing_metadata",
        stripeEventType: args.event.type,
      },
      requestId: args.event.id,
    });
    return;
  }

  const admin = createAdminClient();
  const payload = {
    coach_id: coachId,
    player_id: playerId,
    stripe_customer_id: customerId,
    stripe_subscription_id: args.subscription.id,
    amount: parseCheckoutLinkAmount(args.session.metadata),
    currency: args.subscription.currency ?? "gbp",
    interval: parseCheckoutLinkInterval(args.session.metadata),
    status: getStripeSubscriptionStatus(args.subscription),
    current_period_end: getStripeCurrentPeriodEnd(args.subscription),
    subscription_kind: "manual" as const,
    recurring_series_id: null,
    recurring_enrolment_id: null,
  };

  const { error } = await admin.from("parent_subscriptions").upsert(payload, {
    onConflict: "stripe_subscription_id",
  });

  if (error) {
    throw new StripeWebhookProcessingError(
      `Failed to sync checkout-link parent subscription: ${error.message}`,
      args.event.id,
      args.event.type,
    );
  }

  await auditLog({
    actorType: "webhook",
    actorId: args.event.id,
    action: WEBHOOK_AUDIT_ACTIONS.checkoutLinkSynced,
    resourceType: "parent_subscription",
    resourceId: args.subscription.id,
    outcome: "success",
    metadata: {
      coachId,
      playerId,
      stripeCheckoutSessionId: args.session.id,
      stripeSubscriptionId: args.subscription.id,
    },
    requestId: args.event.id,
  });
}

function sessionEmailFromCheckoutMetadata(
  metadata: Stripe.Metadata | null | undefined,
): SessionBookingEmailContext | undefined {
  const parentEmail = metadata?.parent_email?.trim();
  if (!parentEmail) return undefined;

  return {
    parentEmail,
    parentName: metadata?.parent_name ?? "",
    childName: metadata?.child_name ?? "your player",
    academyName: metadata?.academy_name ?? "Awarix",
    primaryColor: metadata?.academy_primary_color ?? "#10b981",
    sessionLabel: metadata?.session_label ?? "Coaching session",
    sessionDate: metadata?.session_date ?? new Date().toISOString(),
    sessionLocation: metadata?.session_location ?? "",
    coachId: metadata?.coach_id ?? undefined,
  };
}

function enrolmentEmailFromCheckoutMetadata(
  metadata: Stripe.Metadata | null | undefined,
  subscription: Stripe.Subscription,
  currency?: string | null,
): RecurringEnrolmentEmailContext | undefined {
  const parentEmail = metadata?.parent_email?.trim();
  if (!parentEmail) return undefined;

  const unitAmount = subscription.items.data[0]?.price.unit_amount ?? 0;
  const priceCurrency = currency?.toUpperCase() ?? "GBP";

  return {
    parentEmail,
    parentName: metadata?.parent_name ?? "",
    childName: metadata?.child_name ?? "your player",
    academyName: metadata?.academy_name ?? "Awarix",
    primaryColor: metadata?.academy_primary_color ?? "#10b981",
    seriesTitle: metadata?.series_title ?? "Recurring coaching",
    monthlyPrice: new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: priceCurrency,
    }).format(unitAmount / 100),
    startDayLabel: getDayLabel(
      Number.parseInt(metadata?.series_day_of_week ?? "0", 10),
    ),
    startTimeLabel: (metadata?.series_start_time ?? "00:00").slice(0, 5),
    location: metadata?.series_location ?? "",
  };
}

async function handleCheckoutSessionCompleted(
  event: Stripe.Event,
): Promise<string> {
  const session = event.data.object as Stripe.Checkout.Session;
  const context = webhookAuditContext(event);

  if (session.metadata?.plan_id?.trim()) {
    const subscription = await retrieveSubscription(session.subscription);
    if (!subscription) {
      throw new StripeWebhookProcessingError(
        "Coach SaaS checkout session is missing Stripe subscription details.",
        event.id,
        event.type,
      );
    }

    const sync = await syncCoachSaasEntitlements({
      subscription,
      userId:
        session.metadata[AWARIX_USER_ID_METADATA_KEY] ||
        session.metadata[LEGACY_USER_ID_METADATA_KEY],
      clientReferenceId:
        typeof session.client_reference_id === "string"
          ? session.client_reference_id
          : null,
    });

    assertCoachSaasSyncApplied(sync);

    await auditLog({
      actorType: "webhook",
      actorId: event.id,
      action: WEBHOOK_AUDIT_ACTIONS.processed,
      resourceType: "stripe_checkout_session",
      resourceId: session.id,
      outcome: "success",
      metadata: {
        reason: "coach_saas_checkout_synced",
        planId: session.metadata.plan_id,
        userId: sync.userId,
        subscriptionStatus: subscription.status,
        applied: sync.applied,
        syncReason: sync.reason,
      },
      requestId: event.id,
    });

    return `coach SaaS checkout synced (status=${subscription.status})`;
  }

  if (
    session.mode === "payment" &&
    session.payment_status === "paid" &&
    session.metadata?.booking_id?.trim()
  ) {
    const result = await confirmSessionBookingFromStripe({
      bookingId: session.metadata.booking_id.trim(),
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null,
      sessionEmail: sessionEmailFromCheckoutMetadata(session.metadata),
      context,
    });

    return `session booking confirmed (confirmedNow=${result.confirmedNow})`;
  }

  if (session.mode === "subscription" && session.metadata?.enrolment_id?.trim()) {
    const subscription = await retrieveSubscription(session.subscription);
    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id;

    if (!subscription || !customerId) {
      throw new StripeWebhookProcessingError(
        "Recurring checkout session is missing Stripe subscription details.",
        event.id,
        event.type,
      );
    }

    const result = await confirmEnrolmentFromStripe({
      enrolmentId: session.metadata.enrolment_id.trim(),
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      currentPeriodEnd: getStripeCurrentPeriodEnd(subscription),
      enrolmentEmail: enrolmentEmailFromCheckoutMetadata(
        session.metadata,
        subscription,
        session.currency,
      ),
      context,
    });

    return `recurring enrolment confirmed (status=${result.recurringStatus})`;
  }

  if (
    session.mode === "subscription" &&
    session.metadata?.player_id?.trim() &&
    session.metadata?.coach_id?.trim() &&
    !session.metadata?.enrolment_id?.trim()
  ) {
    const subscription = await retrieveSubscription(session.subscription);
    if (!subscription) {
      throw new StripeWebhookProcessingError(
        "Checkout-link session is missing Stripe subscription details.",
        event.id,
        event.type,
      );
    }

    await syncCheckoutLinkParentSubscription({ event, session, subscription });
    return "checkout-link parent subscription synced";
  }

  await auditLog({
    actorType: "webhook",
    actorId: event.id,
    action: WEBHOOK_AUDIT_ACTIONS.ignored,
    resourceType: "stripe_checkout_session",
    resourceId: session.id,
    outcome: "success",
    metadata: {
      reason: "unsupported_checkout_session",
      mode: session.mode,
      paymentStatus: session.payment_status,
    },
    requestId: event.id,
  });

  return "checkout.session.completed ignored (no matching metadata)";
}

async function handleSubscriptionCreated(event: Stripe.Event): Promise<string> {
  const subscription = event.data.object as Stripe.Subscription;
  const context = webhookAuditContext(event);

  if (isCoachSaasSubscription(subscription)) {
    const sync = await syncCoachSaasEntitlements({ subscription });
    assertCoachSaasSyncApplied(sync);
    return `subscription.created coach SaaS synced (status=${subscription.status})`;
  }

  const enrolmentId = subscription.metadata?.enrolment_id?.trim();

  if (enrolmentId) {
    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer?.id;

    if (!customerId) {
      throw new StripeWebhookProcessingError(
        "Subscription created event is missing customer id.",
        event.id,
        event.type,
      );
    }

    const result = await confirmEnrolmentFromStripe({
      enrolmentId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      currentPeriodEnd: getStripeCurrentPeriodEnd(subscription),
      context,
    });

    return `subscription.created enrolment confirmed (status=${result.recurringStatus})`;
  }

  if (
    subscription.metadata?.player_id?.trim() &&
    subscription.metadata?.coach_id?.trim()
  ) {
    const admin = createAdminClient();
    const coachId = subscription.metadata.coach_id.trim();
    const playerId = subscription.metadata.player_id.trim();
    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer?.id;

    if (!customerId) {
      throw new StripeWebhookProcessingError(
        "Subscription created event is missing customer id.",
        event.id,
        event.type,
      );
    }

    const { error } = await admin.from("parent_subscriptions").upsert(
      {
        coach_id: coachId,
        player_id: playerId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        amount: parseCheckoutLinkAmount(subscription.metadata),
        currency: subscription.currency ?? "gbp",
        interval: parseCheckoutLinkInterval(subscription.metadata),
        status: getStripeSubscriptionStatus(subscription),
        current_period_end: getStripeCurrentPeriodEnd(subscription),
        subscription_kind: "manual",
        recurring_series_id: null,
        recurring_enrolment_id: null,
      },
      { onConflict: "stripe_subscription_id" },
    );

    if (error) {
      throw new StripeWebhookProcessingError(
        `Failed to sync subscription.created checkout-link row: ${error.message}`,
        event.id,
        event.type,
      );
    }

    await auditLog({
      actorType: "webhook",
      actorId: event.id,
      action: WEBHOOK_AUDIT_ACTIONS.checkoutLinkSynced,
      resourceType: "parent_subscription",
      resourceId: subscription.id,
      outcome: "success",
      metadata: { coachId, playerId, source: "customer.subscription.created" },
      requestId: event.id,
    });

    return "subscription.created checkout-link parent subscription synced";
  }

  const result = await applyStripeSubscriptionSnapshot({
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodEnd: getStripeCurrentPeriodEnd(subscription),
    context,
  });

  return result.applied
    ? `subscription.created snapshot applied (status=${result.recurringStatus ?? subscription.status})`
    : "subscription.created snapshot no-op (subscription not tracked)";
}

async function handleSubscriptionUpdatedOrDeleted(
  event: Stripe.Event,
): Promise<string> {
  const subscription = event.data.object as Stripe.Subscription;
  const context = webhookAuditContext(event);
  const status =
    event.type === "customer.subscription.deleted"
      ? "canceled"
      : subscription.status;

  if (isCoachSaasSubscription(subscription)) {
    const subscriptionForSync =
      event.type === "customer.subscription.deleted"
        ? ({ ...subscription, status: "canceled" } as Stripe.Subscription)
        : subscription;
    const sync = await syncCoachSaasEntitlements({
      subscription: subscriptionForSync,
    });
    assertCoachSaasSyncApplied(sync);
    return `coach SaaS subscription synced (status=${status})`;
  }

  const result = await applyStripeSubscriptionSnapshot({
    stripeSubscriptionId: subscription.id,
    status,
    currentPeriodEnd: getStripeCurrentPeriodEnd(subscription),
    context,
  });

  return result.applied
    ? `subscription snapshot applied (status=${result.recurringStatus ?? status})`
    : "subscription snapshot no-op (subscription not tracked)";
}

async function handleInvoicePaid(event: Stripe.Event): Promise<string> {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);

  if (!subscriptionId) {
    await auditLog({
      actorType: "webhook",
      actorId: event.id,
      action: WEBHOOK_AUDIT_ACTIONS.ignored,
      resourceType: "stripe_invoice",
      resourceId: invoice.id,
      outcome: "success",
      metadata: { reason: "invoice_without_subscription" },
      requestId: event.id,
    });
    return "invoice.paid ignored (no subscription)";
  }

  const subscription = await retrieveSubscription(subscriptionId);
  if (!subscription) {
    throw new StripeWebhookProcessingError(
      "invoice.paid referenced a subscription that could not be retrieved.",
      event.id,
      event.type,
    );
  }

  if (isCoachSaasSubscription(subscription)) {
    const sync = await syncCoachSaasEntitlements({ subscription });
    assertCoachSaasSyncApplied(sync);
    return `invoice.paid coach SaaS synced (status=${subscription.status})`;
  }

  const result = await applyStripeSubscriptionSnapshot({
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodEnd: getStripeCurrentPeriodEnd(subscription),
    context: webhookAuditContext(event),
  });

  return result.applied
    ? `invoice.paid snapshot applied (status=${result.recurringStatus ?? subscription.status})`
    : "invoice.paid snapshot no-op (subscription not tracked)";
}

async function handleInvoicePaymentFailed(event: Stripe.Event): Promise<string> {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);

  if (!subscriptionId) {
    await auditLog({
      actorType: "webhook",
      actorId: event.id,
      action: WEBHOOK_AUDIT_ACTIONS.ignored,
      resourceType: "stripe_invoice",
      resourceId: invoice.id,
      outcome: "success",
      metadata: { reason: "invoice_without_subscription" },
      requestId: event.id,
    });
    return "invoice.payment_failed ignored (no subscription)";
  }

  const subscription = await retrieveSubscription(subscriptionId);
  if (!subscription) {
    throw new StripeWebhookProcessingError(
      "invoice.payment_failed referenced a subscription that could not be retrieved.",
      event.id,
      event.type,
    );
  }

  if (isCoachSaasSubscription(subscription)) {
    const sync = await syncCoachSaasEntitlements({ subscription });
    assertCoachSaasSyncApplied(sync);
    return `invoice.payment_failed coach SaaS synced (status=${subscription.status})`;
  }

  const result = await applyStripeSubscriptionSnapshot({
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodEnd: getStripeCurrentPeriodEnd(subscription),
    context: webhookAuditContext(event),
  });

  if (result.applied) {
    const emailOutcome = await notifyParentOfFailedPayment({
      stripeSubscriptionId: subscription.id,
      stripeInvoiceId: invoice.id,
      stripePaymentUrl: invoice.hosted_invoice_url,
      context: webhookAuditContext(event),
    });

    return emailOutcome === "sent"
      ? `invoice.payment_failed snapshot applied; parent notified (status=${result.recurringStatus ?? subscription.status})`
      : `invoice.payment_failed snapshot applied (status=${result.recurringStatus ?? subscription.status})`;
  }

  return "invoice.payment_failed snapshot no-op (subscription not tracked)";
}

async function dispatchStripeWebhookEvent(event: Stripe.Event): Promise<string> {
  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutSessionCompleted(event);
    case "customer.subscription.created":
      return handleSubscriptionCreated(event);
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return handleSubscriptionUpdatedOrDeleted(event);
    case "invoice.paid":
      return handleInvoicePaid(event);
    case "invoice.payment_failed":
      return handleInvoicePaymentFailed(event);
    default:
      await auditLog({
        actorType: "webhook",
        actorId: event.id,
        action: WEBHOOK_AUDIT_ACTIONS.ignored,
        resourceType: "stripe_webhook_event",
        resourceId: event.id,
        outcome: "success",
        metadata: {
          stripeEventType: event.type,
          reason: "unsupported_event_type",
        },
        requestId: event.id,
      });
      return `ignored unsupported event type ${event.type}`;
  }
}

/**
 * Process a signature-verified Stripe webhook event with idempotency,
 * audit logging, and booking-confirmation delegation.
 */
export async function processStripeWebhookEvent(
  event: Stripe.Event,
): Promise<StripeWebhookProcessResult> {
  if (!HANDLED_EVENT_TYPES.has(event.type)) {
    await auditLog({
      actorType: "webhook",
      actorId: event.id,
      action: WEBHOOK_AUDIT_ACTIONS.ignored,
      resourceType: "stripe_webhook_event",
      resourceId: event.id,
      outcome: "success",
      metadata: {
        stripeEventType: event.type,
        reason: "unhandled_event_type",
      },
      requestId: event.id,
    });

    return {
      eventId: event.id,
      eventType: event.type,
      status: "ignored",
      detail: "Event type is not handled by stripe-webhook dispatcher.",
    };
  }

  const claim = await claimWebhookEvent(event);
  if (claim === "duplicate") {
    return {
      eventId: event.id,
      eventType: event.type,
      status: "duplicate",
      detail: "Event already processed.",
    };
  }

  try {
    const detail = await dispatchStripeWebhookEvent(event);
    await markWebhookProcessed(event, detail);

    return {
      eventId: event.id,
      eventType: event.type,
      status: "processed",
      detail,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown Stripe webhook processing error.";

    await recordWebhookFailure(event, message);

    if (error instanceof StripeWebhookProcessingError) {
      throw error;
    }

    throw new StripeWebhookProcessingError(message, event.id, event.type);
  }
}
