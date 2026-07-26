import "server-only";

import {
  PARENT_JOURNEY_EVENTS,
  type ParentJourneyEventName,
} from "@/lib/parent-journey-types";
import { createAdminClient } from "@/lib/supabase/admin";

export function isParentJourneyEventName(
  value: string,
): value is ParentJourneyEventName {
  return (PARENT_JOURNEY_EVENTS as readonly string[]).includes(value);
}

/** Best-effort parent funnel tracking. Never throws to callers. */
export async function recordParentJourneyEvent(args: {
  event: ParentJourneyEventName;
  userId?: string | null;
  email?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("parent_journey_events").insert({
      user_id: args.userId?.trim() || null,
      email: args.email?.trim().toLowerCase() || null,
      event: args.event,
      metadata: args.metadata ?? {},
    });
    if (error) {
      console.warn("[parent-journey]", args.event, error.message);
    }
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "unknown";
    console.warn("[parent-journey]", args.event, message);
  }
}
