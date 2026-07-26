import { NextResponse } from "next/server";
import { apiError, safeApiError } from "@/lib/api-response";
import { logAbuseEvent } from "@/lib/abuse-log";
import { getMinimumPlanForGateFeature } from "@/lib/feature-definitions";
import { recordJobOutcome } from "@/lib/jobs/monitor";
import {
  PUSH_NOTIFICATION_TEMPLATES,
  sendPushNotification,
  type PushNotificationType,
} from "@/lib/push-notifications";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { hasFeatureAccess } from "@/lib/subscription";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type SendNotificationBody = {
  userId?: string;
  type?: PushNotificationType;
  title?: string;
  message?: string;
  url?: string;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  const route = "/api/notifications/send";
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return apiError(401, "You must be signed in to send notifications.", "unauthorized");
    }

    const limited = await enforceRateLimit({
      request,
      config: RATE_LIMITS.notifications,
      subject: user.id,
      actorId: user.id,
      route,
    });
    if (limited) return limited;

    const allowed = await hasFeatureAccess("push_notifications");
    if (!allowed) {
      return NextResponse.json(
        {
          error: "Push notifications require Awarix Academy.",
          code: "forbidden",
          requiredPlan: getMinimumPlanForGateFeature("push_notifications"),
        },
        { status: 403 },
      );
    }

    const body = (await request.json()) as SendNotificationBody;

    // Never honour client-supplied target user ids — notifications are self-only.
    if (body.userId && body.userId !== user.id) {
      logAbuseEvent({
        event: "ownership_denied",
        route,
        actorId: user.id,
        detail: "cross_user_notification_blocked",
      });
      return apiError(
        403,
        "You can only send notifications to your own devices.",
        "ownership_denied",
      );
    }

    const targetUserId = user.id;
    const type = body.type ?? "upcoming_sessions";
    const template = PUSH_NOTIFICATION_TEMPLATES[type];
    if (!template) {
      return apiError(400, "Unsupported notification type.", "validation_failed");
    }

    const { data: preferences, error: prefError } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (prefError) {
      await recordJobOutcome({
        job: "notification_send",
        outcome: "failed",
        message: "Unable to load notification preferences",
        error: prefError,
      });
      return apiError(500, "Unable to load notification preferences.", "internal_error");
    }
    if (preferences && preferences[type] === false) {
      await recordJobOutcome({
        job: "notification_send",
        outcome: "skipped",
        message: "Notification skipped by preference",
        metadata: { type },
      });
      return NextResponse.json({ skipped: true, reason: "preference_disabled" });
    }

    const { data: tokens, error: tokensError } = await supabase
      .from("device_tokens")
      .select("token")
      .eq("user_id", targetUserId);

    if (tokensError) {
      await recordJobOutcome({
        job: "notification_send",
        outcome: "failed",
        message: "Unable to load device tokens",
        error: tokensError,
      });
      return apiError(500, "Unable to load device tokens.", "internal_error");
    }

    const result = await sendPushNotification({
      tokens: (tokens ?? []).map((row) => row.token as string),
      title: body.title ?? template.title,
      message: body.message ?? template.body,
      url: body.url,
    });

    await recordJobOutcome({
      job: "notification_send",
      outcome: "success",
      message: "Push notification send completed",
      metadata: { type, tokenCount: tokens?.length ?? 0 },
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    return safeApiError({
      request,
      route,
      error,
      clientMessage: "Unable to send push notification.",
    });
  }
}
