import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/server";
import {
  isParentJourneyEventName,
  recordParentJourneyEvent,
} from "@/lib/parent-journey-events";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Body = {
  event?: string;
  metadata?: Record<string, unknown>;
};

export async function POST(request: Request) {
  const limited = await enforceRateLimit({
    request,
    config: RATE_LIMITS.generalApi,
    route: "/api/family/events",
  });
  if (limited) return limited;

  const user = await getAuthenticatedUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  const event = body.event?.trim() ?? "";
  if (!isParentJourneyEventName(event)) {
    return NextResponse.json({ error: "Unknown event." }, { status: 400 });
  }

  // Client may only emit interactive/parent-side events.
  const clientAllowed = new Set([
    "first_login",
    "return_visit",
    "report_opened",
    "notification_opened",
  ]);
  if (!clientAllowed.has(event)) {
    return NextResponse.json({ error: "Event not allowed from client." }, { status: 403 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("parent_journey_events").insert({
      user_id: user.id,
      email: user.email.trim().toLowerCase(),
      event,
      metadata: body.metadata ?? {},
    });
    if (error) {
      await recordParentJourneyEvent({
        event,
        userId: user.id,
        email: user.email,
        metadata: body.metadata,
      });
    }
  } catch {
    await recordParentJourneyEvent({
      event,
      userId: user.id,
      email: user.email,
      metadata: body.metadata,
    });
  }

  return NextResponse.json({ ok: true });
}
