import "server-only";

import {
  buildBookingEmailHtml,
  buildBookingEmailText,
  buildFailedPaymentEmailHtml,
  buildFailedPaymentEmailText,
  buildRecurringSubscriptionEmailHtml,
  buildRecurringSubscriptionEmailText,
  FAILED_PAYMENT_EMAIL_SUBJECT,
  getRecurringBookingEmailSubject,
  getSessionBookingEmailSubject,
} from "@/lib/booking-emails";
import { getDayLabel } from "@/lib/booking-system";
import { prepareParentPortalInvite } from "@/lib/parent-account-claim";
import { recordParentJourneyEvent } from "@/lib/parent-journey-events";
import { recordJobOutcome } from "@/lib/jobs/monitor";
import { getResendServerClient, resendFromEmail } from "@/lib/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  auditLog,
  type SecurityAuditActorType,
} from "@/lib/security-audit";

const AUDIT_ACTIONS = {
  confirmSession: "booking.confirm_session_from_stripe",
  confirmEnrolment: "booking.confirm_enrolment_from_stripe",
  applySubscriptionSnapshot: "subscription.apply_stripe_snapshot",
  paymentFailedEmailSent: "subscription.payment_failed_email_sent",
} as const;

export type StripeBookingAuditContext = {
  /** Defaults to `webhook` when omitted. */
  actorType?: SecurityAuditActorType;
  /** Stripe event id or trace id stored on the audit row. */
  requestId?: string | null;
  metadata?: Record<string, unknown>;
};

export type ConfirmSessionBookingInput = {
  bookingId: string;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId?: string | null;
  sessionEmail?: SessionBookingEmailContext;
  context?: StripeBookingAuditContext;
};

export type SessionBookingEmailContext = {
  parentEmail: string;
  parentName?: string;
  childName?: string;
  academyName?: string;
  primaryColor?: string;
  sessionLabel?: string;
  sessionDate?: string;
  sessionLocation?: string;
  coachId?: string;
  supportEmail?: string | null;
  playerId?: string | null;
  bookingId?: string | null;
};

export type ConfirmEnrolmentInput = {
  enrolmentId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  subscriptionStatus: string;
  currentPeriodEnd: string | null;
  enrolmentEmail?: RecurringEnrolmentEmailContext;
  context?: StripeBookingAuditContext;
};

export type RecurringEnrolmentEmailContext = {
  parentEmail: string;
  parentName?: string;
  childName?: string;
  academyName?: string;
  primaryColor?: string;
  seriesTitle?: string;
  monthlyPrice?: string;
  startDayLabel?: string;
  startTimeLabel?: string;
  location?: string;
  supportEmail?: string | null;
  playerId?: string | null;
  enrolmentId?: string | null;
};

export type ApplySubscriptionSnapshotInput = {
  stripeSubscriptionId: string;
  status: string;
  currentPeriodEnd: string | null;
  context?: StripeBookingAuditContext;
};

export type SessionBookingConfirmationResult = {
  bookingId: string;
  bookingStatus: "pending" | "confirmed" | "waitlist" | "cancelled";
  paymentStatus:
    | "requires_payment"
    | "paid"
    | "not_required"
    | "failed"
    | "refunded";
  confirmedNow: boolean;
};

export type EnrolmentConfirmationResult = {
  parentSubscriptionId: string;
  recurringEnrolmentId: string;
  playerId: string;
  coachId: string;
  academyId: string | null;
  recurringStatus: "pending" | "active" | "paused" | "cancelled";
};

export type SubscriptionSnapshotResult = {
  applied: boolean;
  parentSubscriptionId?: string;
  recurringEnrolmentId?: string | null;
  recurringStatus?: string;
};

export class BookingConfirmationError extends Error {
  constructor(
    message: string,
    readonly causeCode?: string,
  ) {
    super(message);
    this.name = "BookingConfirmationError";
  }
}

type ConfirmSessionRpcRow = {
  booking_id: string;
  booking_status: SessionBookingConfirmationResult["bookingStatus"];
  payment_status: SessionBookingConfirmationResult["paymentStatus"];
  confirmed_now: boolean;
};

type ConfirmEnrolmentRpcRow = {
  parent_subscription_id: string;
  recurring_enrolment_id: string;
  player_id: string;
  coach_id: string;
  academy_id: string | null;
  recurring_status: EnrolmentConfirmationResult["recurringStatus"];
};

type SubscriptionSnapshotRpcRow = {
  parent_subscription_id: string;
  recurring_enrolment_id: string | null;
  recurring_status: string;
};

function resolveActorType(context?: StripeBookingAuditContext): SecurityAuditActorType {
  return context?.actorType ?? "webhook";
}

function mergeMetadata(
  context: StripeBookingAuditContext | undefined,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  return { ...(context?.metadata ?? {}), ...extra };
}

function mapSessionBookingRow(
  row: ConfirmSessionRpcRow,
): SessionBookingConfirmationResult {
  return {
    bookingId: row.booking_id,
    bookingStatus: row.booking_status,
    paymentStatus: row.payment_status,
    confirmedNow: row.confirmed_now,
  };
}

function mapEnrolmentRow(row: ConfirmEnrolmentRpcRow): EnrolmentConfirmationResult {
  return {
    parentSubscriptionId: row.parent_subscription_id,
    recurringEnrolmentId: row.recurring_enrolment_id,
    playerId: row.player_id,
    coachId: row.coach_id,
    academyId: row.academy_id,
    recurringStatus: row.recurring_status,
  };
}

function mapSubscriptionSnapshotRow(
  row: SubscriptionSnapshotRpcRow,
): SubscriptionSnapshotResult {
  return {
    applied: true,
    parentSubscriptionId: row.parent_subscription_id,
    recurringEnrolmentId: row.recurring_enrolment_id,
    recurringStatus: row.recurring_status,
  };
}

function formatSessionDateForEmail(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(parsed);
}

async function loadSupportEmailForCoach(coachId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data: membership } = await supabase
    .from("academy_members")
    .select("academy:academies(support_email)")
    .eq("user_id", coachId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const academy = Array.isArray(membership?.academy)
    ? membership.academy[0]
    : membership?.academy;
  const email =
    academy && typeof academy === "object" && "support_email" in academy
      ? (academy.support_email as string | null | undefined)
      : null;
  return email?.trim() || null;
}

async function sendSessionBookingConfirmationEmail(
  email: SessionBookingEmailContext,
) {
  const resend = getResendServerClient();
  const childName = email.childName ?? "your player";
  const supportEmail =
    email.supportEmail?.trim() ||
    (email.coachId ? await loadSupportEmailForCoach(email.coachId) : null);

  let portalInviteUrl: string | null = null;
  let portalInviteKind: "claim" | "sign_in" | null = null;
  try {
    const invite = await prepareParentPortalInvite({
      email: email.parentEmail,
      playerId: email.playerId,
      bookingId: email.bookingId,
      childName,
      academyName: email.academyName,
    });
    portalInviteUrl = invite.url;
    portalInviteKind = invite.kind;
  } catch (error: unknown) {
    console.warn(
      "[booking-confirmation] parent invite",
      error instanceof Error ? error.message : "failed",
    );
  }

  const emailPayload = {
    kind: "confirmed" as const,
    paid: true,
    supportEmail,
    academyName: email.academyName ?? "Awarix",
    primaryColor: email.primaryColor ?? "#10b981",
    parentName: email.parentName ?? "",
    childName,
    sessionLabel: email.sessionLabel ?? "Coaching session",
    sessionDate: formatSessionDateForEmail(
      email.sessionDate ?? new Date().toISOString(),
    ),
    location: email.sessionLocation ?? "",
    portalInviteUrl,
    portalInviteKind,
  };

  await resend.emails.send({
    from: resendFromEmail,
    to: email.parentEmail,
    subject: getSessionBookingEmailSubject({ kind: "confirmed", paid: true }),
    html: buildBookingEmailHtml(emailPayload),
    text: buildBookingEmailText(emailPayload),
  });

  await recordParentJourneyEvent({
    event: "booking_completed",
    email: email.parentEmail,
    metadata: {
      source: "stripe_confirm",
      bookingId: email.bookingId ?? null,
      paid: true,
    },
  });
  await recordParentJourneyEvent({
    event: "payment_completed",
    email: email.parentEmail,
    metadata: {
      source: "stripe_confirm",
      bookingId: email.bookingId ?? null,
    },
  });
}

async function loadRecurringEnrolmentEmailContext(
  enrolmentId: string,
): Promise<RecurringEnrolmentEmailContext | null> {
  const supabase = createAdminClient();
  const { data: enrolment, error } = await supabase
    .from("player_recurring_enrolments")
    .select(
      "id, player_id, parent_email, parent_name, monthly_price, coach_id, players(player_name), recurring_session_series(title, day_of_week, start_time, location, currency)",
    )
    .eq("id", enrolmentId)
    .maybeSingle();

  if (error || !enrolment?.parent_email) {
    return null;
  }

  const player = Array.isArray(enrolment.players)
    ? enrolment.players[0]
    : enrolment.players;
  const series = Array.isArray(enrolment.recurring_session_series)
    ? enrolment.recurring_session_series[0]
    : enrolment.recurring_session_series;

  const { data: profile } = await supabase
    .from("coach_public_profiles")
    .select("display_name, primary_color")
    .eq("coach_id", enrolment.coach_id)
    .maybeSingle();

  const currency = series?.currency?.toUpperCase() ?? "GBP";
  const monthlyPrice = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format((enrolment.monthly_price ?? 0) / 100);

  const supportEmail = await loadSupportEmailForCoach(enrolment.coach_id);

  return {
    parentEmail: enrolment.parent_email,
    parentName: enrolment.parent_name ?? "",
    childName: player?.player_name ?? "your player",
    academyName: profile?.display_name ?? "Awarix",
    primaryColor: profile?.primary_color ?? "#10b981",
    seriesTitle: series?.title ?? "Recurring coaching",
    monthlyPrice,
    startDayLabel: getDayLabel(series?.day_of_week ?? 0),
    startTimeLabel: (series?.start_time ?? "00:00").slice(0, 5),
    location: series?.location ?? "",
    supportEmail,
    playerId: (enrolment.player_id as string | null) ?? null,
    enrolmentId: (enrolment.id as string) ?? enrolmentId,
  };
}

async function sendRecurringEnrolmentConfirmationEmail(
  email: RecurringEnrolmentEmailContext,
) {
  const resend = getResendServerClient();
  const childName = email.childName ?? "your player";

  let portalInviteUrl: string | null = null;
  let portalInviteKind: "claim" | "sign_in" | null = null;
  try {
    const invite = await prepareParentPortalInvite({
      email: email.parentEmail,
      playerId: email.playerId,
      enrolmentId: email.enrolmentId,
      childName,
      academyName: email.academyName,
    });
    portalInviteUrl = invite.url;
    portalInviteKind = invite.kind;
  } catch (error: unknown) {
    console.warn(
      "[booking-confirmation] recurring parent invite",
      error instanceof Error ? error.message : "failed",
    );
  }

  const emailPayload = {
    academyName: email.academyName ?? "Awarix",
    primaryColor: email.primaryColor ?? "#10b981",
    parentName: email.parentName ?? "",
    childName,
    seriesTitle: email.seriesTitle ?? "Recurring coaching",
    monthlyPrice: email.monthlyPrice ?? "",
    startDayLabel: email.startDayLabel ?? "",
    startTimeLabel: email.startTimeLabel ?? "",
    location: email.location ?? "",
    supportEmail: email.supportEmail ?? null,
    portalInviteUrl,
    portalInviteKind,
  };

  await resend.emails.send({
    from: resendFromEmail,
    to: email.parentEmail,
    subject: getRecurringBookingEmailSubject(),
    html: buildRecurringSubscriptionEmailHtml(emailPayload),
    text: buildRecurringSubscriptionEmailText(emailPayload),
  });

  await recordParentJourneyEvent({
    event: "booking_completed",
    email: email.parentEmail,
    metadata: {
      source: "recurring_confirm",
      enrolmentId: email.enrolmentId ?? null,
    },
  });
  await recordParentJourneyEvent({
    event: "payment_completed",
    email: email.parentEmail,
    metadata: {
      source: "recurring_confirm",
      enrolmentId: email.enrolmentId ?? null,
    },
  });
}

export async function confirmSessionBookingFromStripe(
  input: ConfirmSessionBookingInput,
): Promise<SessionBookingConfirmationResult> {
  const {
    bookingId,
    stripeCheckoutSessionId,
    stripePaymentIntentId = null,
    sessionEmail,
    context,
  } = input;
  const actorType = resolveActorType(context);
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("confirm_public_session_booking", {
    p_booking_id: bookingId,
    p_stripe_checkout_session_id: stripeCheckoutSessionId,
    p_stripe_payment_intent_id: stripePaymentIntentId ?? "",
  });

  if (error) {
    await auditLog({
      actorType,
      actorId: stripeCheckoutSessionId,
      action: AUDIT_ACTIONS.confirmSession,
      resourceType: "session_booking",
      resourceId: bookingId,
      outcome: "failure",
      metadata: mergeMetadata(context, {
        stripeCheckoutSessionId,
        stripePaymentIntentId,
        error: error.message,
        code: error.code,
      }),
      requestId: context?.requestId ?? null,
    });
    throw new BookingConfirmationError(error.message, error.code);
  }

  const row = (data?.[0] ?? null) as ConfirmSessionRpcRow | null;
  if (!row) {
    const message = "confirm_public_session_booking returned no row.";
    await auditLog({
      actorType,
      actorId: stripeCheckoutSessionId,
      action: AUDIT_ACTIONS.confirmSession,
      resourceType: "session_booking",
      resourceId: bookingId,
      outcome: "failure",
      metadata: mergeMetadata(context, {
        stripeCheckoutSessionId,
        stripePaymentIntentId,
        error: message,
      }),
      requestId: context?.requestId ?? null,
    });
    throw new BookingConfirmationError(message);
  }

  const result = mapSessionBookingRow(row);

  await auditLog({
    actorType,
    actorId: stripeCheckoutSessionId,
    action: AUDIT_ACTIONS.confirmSession,
    resourceType: "session_booking",
    resourceId: result.bookingId,
    outcome: "success",
    metadata: mergeMetadata(context, {
      stripeCheckoutSessionId,
      stripePaymentIntentId,
      bookingStatus: result.bookingStatus,
      paymentStatus: result.paymentStatus,
      confirmedNow: result.confirmedNow,
    }),
    requestId: context?.requestId ?? null,
  });

  if (result.confirmedNow && sessionEmail?.parentEmail) {
    try {
      await sendSessionBookingConfirmationEmail(sessionEmail);
      await recordJobOutcome({
        job: "email_send",
        outcome: "success",
        message: "Session booking confirmation email sent",
        metadata: { kind: "session_booking" },
      });
    } catch (error: unknown) {
      // Payment confirmation should not fail if email delivery is unavailable.
      await recordJobOutcome({
        job: "email_send",
        outcome: "failed",
        message: "Session booking confirmation email failed",
        metadata: { kind: "session_booking" },
        error,
      });
    }
  }

  return result;
}

export async function confirmEnrolmentFromStripe(
  input: ConfirmEnrolmentInput,
): Promise<EnrolmentConfirmationResult> {
  const {
    enrolmentId,
    stripeCustomerId,
    stripeSubscriptionId,
    subscriptionStatus,
    currentPeriodEnd,
    enrolmentEmail,
    context,
  } = input;
  const actorType = resolveActorType(context);
  const supabase = createAdminClient();

  const { data: priorEnrolment } = await supabase
    .from("player_recurring_enrolments")
    .select("status")
    .eq("id", enrolmentId)
    .maybeSingle();
  const priorStatus = priorEnrolment?.status ?? null;

  const { data, error } = await supabase.rpc("confirm_public_recurring_enrolment", {
    p_enrolment_id: enrolmentId,
    p_stripe_customer_id: stripeCustomerId,
    p_stripe_subscription_id: stripeSubscriptionId,
    p_subscription_status: subscriptionStatus,
    p_current_period_end: currentPeriodEnd,
  });

  if (error) {
    await auditLog({
      actorType,
      actorId: stripeSubscriptionId,
      action: AUDIT_ACTIONS.confirmEnrolment,
      resourceType: "player_recurring_enrolment",
      resourceId: enrolmentId,
      outcome: "failure",
      metadata: mergeMetadata(context, {
        stripeCustomerId,
        stripeSubscriptionId,
        subscriptionStatus,
        currentPeriodEnd,
        error: error.message,
        code: error.code,
      }),
      requestId: context?.requestId ?? null,
    });
    throw new BookingConfirmationError(error.message, error.code);
  }

  const row = (data?.[0] ?? null) as ConfirmEnrolmentRpcRow | null;
  if (!row) {
    const message = "confirm_public_recurring_enrolment returned no row.";
    await auditLog({
      actorType,
      actorId: stripeSubscriptionId,
      action: AUDIT_ACTIONS.confirmEnrolment,
      resourceType: "player_recurring_enrolment",
      resourceId: enrolmentId,
      outcome: "failure",
      metadata: mergeMetadata(context, {
        stripeCustomerId,
        stripeSubscriptionId,
        subscriptionStatus,
        currentPeriodEnd,
        error: message,
      }),
      requestId: context?.requestId ?? null,
    });
    throw new BookingConfirmationError(message);
  }

  const result = mapEnrolmentRow(row);

  await auditLog({
    actorType,
    actorId: stripeSubscriptionId,
    action: AUDIT_ACTIONS.confirmEnrolment,
    resourceType: "player_recurring_enrolment",
    resourceId: result.recurringEnrolmentId,
    outcome: "success",
    metadata: mergeMetadata(context, {
      stripeCustomerId,
      stripeSubscriptionId,
      subscriptionStatus,
      currentPeriodEnd,
      parentSubscriptionId: result.parentSubscriptionId,
      recurringStatus: result.recurringStatus,
    }),
    requestId: context?.requestId ?? null,
  });

  const activatedNow =
    priorStatus === "pending" && result.recurringStatus === "active";

  if (activatedNow) {
    try {
      const emailContext =
        enrolmentEmail?.parentEmail
          ? enrolmentEmail
          : await loadRecurringEnrolmentEmailContext(enrolmentId);

      if (emailContext?.parentEmail) {
        await sendRecurringEnrolmentConfirmationEmail(emailContext);
        await recordJobOutcome({
          job: "email_send",
          outcome: "success",
          message: "Recurring enrolment confirmation email sent",
          metadata: { kind: "recurring_enrolment" },
        });
      }
    } catch (error: unknown) {
      // Subscription confirmation should not fail if email delivery is unavailable.
      await recordJobOutcome({
        job: "email_send",
        outcome: "failed",
        message: "Recurring enrolment confirmation email failed",
        metadata: { kind: "recurring_enrolment" },
        error,
      });
    }
  }

  return result;
}

export async function applyStripeSubscriptionSnapshot(
  input: ApplySubscriptionSnapshotInput,
): Promise<SubscriptionSnapshotResult> {
  const { stripeSubscriptionId, status, currentPeriodEnd, context } = input;
  const actorType = resolveActorType(context);
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("sync_recurring_subscription_state", {
    p_stripe_subscription_id: stripeSubscriptionId,
    p_status: status,
    p_current_period_end: currentPeriodEnd,
  });

  if (error) {
    await auditLog({
      actorType,
      actorId: stripeSubscriptionId,
      action: AUDIT_ACTIONS.applySubscriptionSnapshot,
      resourceType: "parent_subscription",
      resourceId: stripeSubscriptionId,
      outcome: "failure",
      metadata: mergeMetadata(context, {
        status,
        currentPeriodEnd,
        error: error.message,
        code: error.code,
      }),
      requestId: context?.requestId ?? null,
    });
    throw new BookingConfirmationError(error.message, error.code);
  }

  const row = (data?.[0] ?? null) as SubscriptionSnapshotRpcRow | null;
  if (!row) {
    const result: SubscriptionSnapshotResult = { applied: false };

    await auditLog({
      actorType,
      actorId: stripeSubscriptionId,
      action: AUDIT_ACTIONS.applySubscriptionSnapshot,
      resourceType: "parent_subscription",
      resourceId: stripeSubscriptionId,
      outcome: "success",
      metadata: mergeMetadata(context, {
        status,
        currentPeriodEnd,
        applied: false,
        reason: "subscription_not_found",
      }),
      requestId: context?.requestId ?? null,
    });

    return result;
  }

  const result = mapSubscriptionSnapshotRow(row);

  await auditLog({
    actorType,
    actorId: stripeSubscriptionId,
    action: AUDIT_ACTIONS.applySubscriptionSnapshot,
    resourceType: "parent_subscription",
    resourceId: result.parentSubscriptionId ?? stripeSubscriptionId,
    outcome: "success",
    metadata: mergeMetadata(context, {
      status,
      currentPeriodEnd,
      applied: true,
      recurringEnrolmentId: result.recurringEnrolmentId,
      recurringStatus: result.recurringStatus,
    }),
    requestId: context?.requestId ?? null,
  });

  return result;
}

type FailedPaymentNotificationInput = {
  stripeSubscriptionId: string;
  stripeInvoiceId: string;
  stripePaymentUrl?: string | null;
  context?: StripeBookingAuditContext;
};

type FailedPaymentEmailContext = {
  parentEmail: string;
  parentName: string;
  childName: string;
  academyName: string;
  primaryColor: string;
  supportEmail: string | null;
};

async function wasPaymentFailedEmailSentForInvoice(invoiceId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("security_audit_log")
    .select("id")
    .eq("action", AUDIT_ACTIONS.paymentFailedEmailSent)
    .eq("resource_id", invoiceId)
    .limit(1)
    .maybeSingle();

  if (error) {
    return false;
  }

  return Boolean(data);
}

async function loadFailedPaymentEmailContext(
  stripeSubscriptionId: string,
): Promise<FailedPaymentEmailContext | null> {
  const supabase = createAdminClient();
  const { data: subscription, error } = await supabase
    .from("parent_subscriptions")
    .select(
      "coach_id, players(player_name, parent_name, parent_email), recurring_session_series(title)",
    )
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();

  if (error || !subscription) {
    return null;
  }

  const player = Array.isArray(subscription.players)
    ? subscription.players[0]
    : subscription.players;
  const parentEmail = player?.parent_email?.trim();
  if (!parentEmail) {
    return null;
  }

  const { data: profile } = await supabase
    .from("coach_public_profiles")
    .select("display_name, primary_color")
    .eq("coach_id", subscription.coach_id)
    .maybeSingle();

  const supportEmail = await loadSupportEmailForCoach(subscription.coach_id);

  return {
    parentEmail,
    parentName: player?.parent_name?.trim() || "",
    childName: player?.player_name?.trim() || "your child",
    academyName: profile?.display_name?.trim() || "Your coach",
    primaryColor: profile?.primary_color?.trim() || "#10b981",
    supportEmail,
  };
}

async function sendFailedPaymentEmail(args: {
  context: FailedPaymentEmailContext;
  stripePaymentUrl?: string | null;
}) {
  const resend = getResendServerClient();
  const emailPayload = {
    academyName: args.context.academyName,
    primaryColor: args.context.primaryColor,
    parentName: args.context.parentName,
    childName: args.context.childName,
    supportEmail: args.context.supportEmail,
    stripePaymentUrl: args.stripePaymentUrl,
  };

  await resend.emails.send({
    from: resendFromEmail,
    to: args.context.parentEmail,
    subject: FAILED_PAYMENT_EMAIL_SUBJECT,
    html: buildFailedPaymentEmailHtml(emailPayload),
    text: buildFailedPaymentEmailText(emailPayload),
  });
}

export async function notifyParentOfFailedPayment(
  input: FailedPaymentNotificationInput,
): Promise<"sent" | "skipped" | "duplicate"> {
  const { stripeSubscriptionId, stripeInvoiceId, stripePaymentUrl, context } = input;

  if (await wasPaymentFailedEmailSentForInvoice(stripeInvoiceId)) {
    return "duplicate";
  }

  const emailContext = await loadFailedPaymentEmailContext(stripeSubscriptionId);
  if (!emailContext) {
    return "skipped";
  }

  try {
    await sendFailedPaymentEmail({
      context: emailContext,
      stripePaymentUrl,
    });
    await recordJobOutcome({
      job: "email_send",
      outcome: "success",
      message: "Failed payment email sent",
      metadata: { kind: "payment_failed" },
    });
  } catch (error: unknown) {
    await recordJobOutcome({
      job: "email_send",
      outcome: "failed",
      message: "Failed payment email failed",
      metadata: { kind: "payment_failed" },
      error,
    });
    return "skipped";
  }

  await auditLog({
    actorType: resolveActorType(context),
    actorId: stripeSubscriptionId,
    action: AUDIT_ACTIONS.paymentFailedEmailSent,
    resourceType: "stripe_invoice",
    resourceId: stripeInvoiceId,
    outcome: "success",
    metadata: mergeMetadata(context, {
      stripeSubscriptionId,
      parentEmail: emailContext.parentEmail,
    }),
    requestId: context?.requestId ?? null,
  });

  return "sent";
}
