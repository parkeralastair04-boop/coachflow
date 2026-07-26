import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/server";
import {
  ACTIVATION_EVENTS,
  type ActivationEventName,
} from "@/lib/activation-types";
import { recordActivationEvent } from "@/lib/activation-events";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Body = {
  event?: string;
  metadata?: Record<string, unknown>;
};

export async function POST(request: Request) {
  const route = "/api/activation/event";
  try {
    const limited = await enforceRateLimit({
      request,
      config: RATE_LIMITS.generalApi,
      route,
    });
    if (limited) return limited;

    const user = await getAuthenticatedUser();
    if (!user) {
      return apiError(401, "Sign in required.", "unauthorized");
    }

    const body = (await request.json()) as Body;
    const event = body.event?.trim() as ActivationEventName | undefined;
    if (!event || !(ACTIVATION_EVENTS as readonly string[]).includes(event)) {
      return apiError(400, "Unknown activation event.", "validation_failed");
    }

    // Prefer user-scoped insert; fall back to admin recorder.
    try {
      const supabase = await createServerSupabaseClient();
      const { error } = await supabase.from("coach_activation_events").insert({
        user_id: user.id,
        event,
        metadata: body.metadata ?? {},
      });
      if (error) {
        await recordActivationEvent({
          userId: user.id,
          event,
          metadata: body.metadata,
        });
      }
    } catch {
      await recordActivationEvent({
        userId: user.id,
        event,
        metadata: body.metadata,
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return apiError(500, "Unable to record event.", "internal_error");
  }
}
