import "server-only";

import {
  ACTIVATION_EVENTS,
  type ActivationEventName,
} from "@/lib/activation-types";
import { createAdminClient } from "@/lib/supabase/admin";

export { ACTIVATION_EVENTS, type ActivationEventName };

/**
 * Persist an activation funnel event for later analytics dashboards.
 * Failures are logged and never throw to callers.
 */
export async function recordActivationEvent(args: {
  userId: string;
  event: ActivationEventName;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("coach_activation_events").insert({
      user_id: args.userId,
      event: args.event,
      metadata: args.metadata ?? {},
    });
    if (error) {
      console.warn("[activation]", args.event, error.message);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown";
    console.warn("[activation]", args.event, message);
  }
}
