import { NextResponse } from "next/server";
import { getMinimumPlanForGateFeature } from "@/lib/feature-definitions";
import {
  PUSH_NOTIFICATION_TEMPLATES,
  sendPushNotification,
  type PushNotificationType,
} from "@/lib/push-notifications";
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
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 401 });
    }
    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to send notifications." },
        { status: 401 },
      );
    }

    const allowed = await hasFeatureAccess("push_notifications");
    if (!allowed) {
      return NextResponse.json(
        {
          error: "Push notifications require CoachFlow Academy.",
          requiredPlan: getMinimumPlanForGateFeature("push_notifications"),
        },
        { status: 403 },
      );
    }

    const body = (await request.json()) as SendNotificationBody;
    const targetUserId = body.userId ?? user.id;
    const type = body.type ?? "upcoming_sessions";
    const template = PUSH_NOTIFICATION_TEMPLATES[type];
    if (!template) {
      return NextResponse.json(
        { error: "Unsupported notification type." },
        { status: 400 },
      );
    }

    const { data: preferences, error: prefError } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (prefError) {
      return NextResponse.json({ error: prefError.message }, { status: 500 });
    }
    if (preferences && preferences[type] === false) {
      return NextResponse.json({ skipped: true, reason: "preference_disabled" });
    }

    const { data: tokens, error: tokensError } = await supabase
      .from("device_tokens")
      .select("token")
      .eq("user_id", targetUserId);

    if (tokensError) {
      return NextResponse.json({ error: tokensError.message }, { status: 500 });
    }

    const result = await sendPushNotification({
      tokens: (tokens ?? []).map((row) => row.token as string),
      title: body.title ?? template.title,
      message: body.message ?? template.body,
      url: body.url,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unable to send push notification.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
