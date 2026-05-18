export const PUSH_NOTIFICATION_TYPES = [
  "upcoming_sessions",
  "new_bookings",
  "payment_failures",
  "camp_enrolments",
  "ai_report_completed",
  "referral_conversions",
] as const;

export type PushNotificationType = (typeof PUSH_NOTIFICATION_TYPES)[number];

export type PushTemplate = {
  type: PushNotificationType;
  title: string;
  body: string;
};

export const PUSH_NOTIFICATION_TEMPLATES: Record<PushNotificationType, PushTemplate> = {
  upcoming_sessions: {
    type: "upcoming_sessions",
    title: "Upcoming session",
    body: "You have a coaching session coming up soon.",
  },
  new_bookings: {
    type: "new_bookings",
    title: "New booking request",
    body: "A parent has submitted a new booking request.",
  },
  payment_failures: {
    type: "payment_failures",
    title: "Payment needs attention",
    body: "A parent payment has failed or is overdue.",
  },
  camp_enrolments: {
    type: "camp_enrolments",
    title: "New camp enrolment",
    body: "A player has been added to a camp.",
  },
  ai_report_completed: {
    type: "ai_report_completed",
    title: "AI report ready",
    body: "Your AI progress report has finished generating.",
  },
  referral_conversions: {
    type: "referral_conversions",
    title: "Referral converted",
    body: "A referred coach became a paying customer. Reward earned.",
  },
};

type SendPushArgs = {
  tokens: string[];
  title: string;
  message: string;
  url?: string;
};

export async function sendPushNotification({
  tokens,
  title,
  message,
  url,
}: SendPushArgs) {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_API_KEY;

  if (!appId || !apiKey) {
    throw new Error("Missing ONESIGNAL_APP_ID or ONESIGNAL_API_KEY.");
  }
  if (tokens.length === 0) {
    return { id: null, recipients: 0 };
  }

  const response = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${apiKey}`,
    },
    body: JSON.stringify({
      app_id: appId,
      include_player_ids: tokens,
      headings: { en: title },
      contents: { en: message },
      url,
    }),
  });

  const payload = (await response.json()) as {
    id?: string;
    recipients?: number;
    errors?: unknown;
  };

  if (!response.ok) {
    throw new Error(
      typeof payload.errors === "string"
        ? payload.errors
        : "Unable to send push notification.",
    );
  }

  return {
    id: payload.id ?? null,
    recipients: payload.recipients ?? tokens.length,
  };
}
