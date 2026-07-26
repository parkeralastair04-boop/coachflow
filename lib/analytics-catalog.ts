/**
 * Analytics event catalog — foundations only (no dashboards).
 * Use these names when recording funnel / product events so pipelines stay consistent.
 */

import { ACTIVATION_EVENTS } from "@/lib/activation-types";
import { PARENT_JOURNEY_EVENTS } from "@/lib/parent-journey-types";

export const ANALYTICS_FUNNELS = [
  "activation",
  "trial_conversion",
  "bookings",
  "parent_adoption",
  "academy_growth",
  "feature_usage",
] as const;

export type AnalyticsFunnel = (typeof ANALYTICS_FUNNELS)[number];

/** Canonical event names by funnel. Persist via existing tables / APIs. */
export const ANALYTICS_EVENT_CATALOG = {
  activation: [...ACTIVATION_EVENTS],
  trial_conversion: [
    "trial_started",
    "checkout_started",
    "subscription_activated",
    "subscription_cancelled",
    "plan_upgraded",
    "plan_downgraded",
  ],
  bookings: [
    "booking_started",
    "booking_completed",
    "booking_waitlisted",
    "payment_completed",
    "payment_failed",
  ],
  parent_adoption: [...PARENT_JOURNEY_EVENTS],
  academy_growth: [
    "academy_created",
    "academy_website_viewed",
    "academy_enquiry_received",
    "camp_published",
    "news_published",
  ],
  feature_usage: [
    "report_generated",
    "report_shared",
    "training_plan_generated",
    "match_created",
    "communication_sent",
    "video_clip_shared",
  ],
} as const satisfies Record<AnalyticsFunnel, readonly string[]>;

export type AnalyticsStorageHint =
  | "coach_activation_events"
  | "parent_journey_events"
  | "security_audit_log"
  | "deferred";

export function getAnalyticsStorageHint(event: string): AnalyticsStorageHint {
  if ((ACTIVATION_EVENTS as readonly string[]).includes(event)) {
    return "coach_activation_events";
  }
  if ((PARENT_JOURNEY_EVENTS as readonly string[]).includes(event)) {
    return "parent_journey_events";
  }
  if (
    event.startsWith("subscription_") ||
    event.startsWith("checkout_") ||
    event === "payment_failed"
  ) {
    return "security_audit_log";
  }
  return "deferred";
}

/** Events ready to emit today vs planned for future tables. */
export function listAnalyticsFoundationSummary() {
  return {
    funnels: ANALYTICS_FUNNELS,
    catalog: ANALYTICS_EVENT_CATALOG,
    storage: {
      coach_activation_events: "Coach first-run funnel (table + API)",
      parent_journey_events: "Parent claim/adoption funnel (table + API)",
      security_audit_log: "Billing/security outcomes (audit trail)",
      deferred: "Feature usage & academy growth — emit later or via audit metadata",
    },
  };
}
