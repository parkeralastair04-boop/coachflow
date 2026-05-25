import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  isInsightPriority,
  type BusinessInsight,
  type InsightsResponse,
} from "@/lib/insights";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasFeatureAccess } from "@/lib/subscription";

type PlayerRow = {
  id: string;
  player_name: string;
  parent_name: string | null;
  parent_email: string | null;
};

type SessionRow = {
  id: string;
  player_id: string | null;
  session_date: string;
  attendance_status: string;
  session_players?: { player_id: string }[] | null;
};

type ReportRow = {
  id: string;
  player_id: string;
  created_at: string;
};

type SubscriptionRow = {
  id: string;
  player_id: string;
  amount: number;
  interval: "monthly" | "weekly" | null;
  status: string;
  current_period_end: string | null;
};

type CampRow = {
  id: string;
  name: string;
  capacity: number;
  price: number | string;
  start_date: string;
};

type CampEnrolmentRow = {
  camp_id: string;
  status: "enrolled" | "waitlist";
};

type BookingRow = {
  id: string;
  session_id: string;
  player_id: string;
  booking_status: string;
  amount: number;
  created_at: string;
};

type ReferralRow = {
  id: string;
  status: string;
  reward_value: number;
  created_at: string;
};

type BusinessData = {
  players: PlayerRow[];
  sessions: SessionRow[];
  reports: ReportRow[];
  subscriptions: SubscriptionRow[];
  camps: CampRow[];
  enrolments: CampEnrolmentRow[];
  bookings: BookingRow[];
  referrals: ReferralRow[];
};

export const runtime = "nodejs";

function subscriptionMrr(subscription: SubscriptionRow): number {
  const pounds = subscription.amount / 100;
  if (subscription.interval === "weekly") return (pounds * 52) / 12;
  if (subscription.interval === "monthly") return pounds;
  return 0;
}

function fallbackInsights(data: BusinessData): BusinessInsight[] {
  const byPlayer = new Map(data.players.map((player) => [player.id, player]));
  const failedPayments = data.subscriptions.filter((subscription) =>
    ["past_due", "unpaid", "incomplete", "incomplete_expired"].includes(
      subscription.status,
    ),
  );

  const missedByPlayer = new Map<string, number>();
  for (const session of data.sessions) {
    if (session.attendance_status === "missed" && session.player_id) {
      missedByPlayer.set(
        session.player_id,
        (missedByPlayer.get(session.player_id) ?? 0) + 1,
      );
    }
  }
  const decliningPlayer = [...missedByPlayer.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([playerId, count]) => ({ player: byPlayer.get(playerId), count }))
    .find((entry) => entry.player && entry.count >= 2);

  const enrolledByCamp = new Map<string, number>();
  for (const enrolment of data.enrolments) {
    if (enrolment.status === "enrolled") {
      enrolledByCamp.set(
        enrolment.camp_id,
        (enrolledByCamp.get(enrolment.camp_id) ?? 0) + 1,
      );
    }
  }
  const lowCamp = data.camps
    .map((camp) => ({
      camp,
      occupancy:
        camp.capacity > 0
          ? ((enrolledByCamp.get(camp.id) ?? 0) / camp.capacity) * 100
          : 0,
    }))
    .filter((row) => row.camp.capacity > 0)
    .sort((a, b) => a.occupancy - b.occupancy)[0];

  const activeSubscriptions = data.subscriptions.filter((subscription) =>
    ["active", "trialing"].includes(subscription.status),
  );
  const mrr = activeSubscriptions.reduce(
    (sum, subscription) => sum + subscriptionMrr(subscription),
    0,
  );
  const bookingPendingCount = data.bookings.filter(
    (booking) => booking.booking_status === "pending",
  ).length;
  const convertedReferrals = data.referrals.filter(
    (referral) => referral.status === "converted",
  ).length;

  return [
    {
      id: "attendance-risk",
      priority: decliningPlayer ? "High" : "Medium",
      category: "Attendance",
      title: decliningPlayer
        ? `${decliningPlayer.player?.player_name} may be disengaging`
        : "Monitor player attendance consistency",
      summary: decliningPlayer
        ? `${decliningPlayer.player?.player_name} has ${decliningPlayer.count} missed sessions.`
        : "No severe attendance risk stands out, but regular monitoring can reduce churn.",
      recommendedAction: decliningPlayer
        ? "Send a personal parent check-in and offer an alternative session slot."
        : "Review missed sessions weekly and follow up before patterns become churn risk.",
    },
    {
      id: "payment-recovery",
      priority: failedPayments.length > 0 ? "High" : "Low",
      category: "Revenue",
      title:
        failedPayments.length > 0
          ? "Recover failed parent payments"
          : "Payment base looks stable",
      summary: `${failedPayments.length} parent subscriptions currently need payment attention.`,
      recommendedAction:
        failedPayments.length > 0
          ? "Contact affected parents and resend payment setup links."
          : "Keep parent payment automations enabled to prevent future overdue invoices.",
    },
    {
      id: "camp-occupancy",
      priority: lowCamp && lowCamp.occupancy < 50 ? "Medium" : "Low",
      category: "Camps",
      title:
        lowCamp && lowCamp.occupancy < 50
          ? `${lowCamp.camp.name} has low occupancy`
          : "Camp occupancy is healthy",
      summary: lowCamp
        ? `${lowCamp.camp.name} is at ${Math.round(lowCamp.occupancy)}% occupancy.`
        : "No camp data is available yet.",
      recommendedAction:
        lowCamp && lowCamp.occupancy < 50
          ? "Promote this camp to recent triallists and offer sibling/early-bird messaging."
          : "Use camp demand to schedule the next block before spaces run out.",
    },
    {
      id: "growth-opportunity",
      priority: "Medium",
      category: "Growth",
      title: "Convert bookings into recurring revenue",
      summary: `${bookingPendingCount} bookings are pending and current MRR is approximately £${Math.round(mrr)}.`,
      recommendedAction:
        "Turn pending bookings into trials, then offer a monthly subscription plan within 48 hours.",
    },
    {
      id: "referral-performance",
      priority: convertedReferrals > 0 ? "Low" : "Medium",
      category: "Referrals",
      title: "Referral engine can compound growth",
      summary: `${convertedReferrals} referred coaches have converted to paid accounts.`,
      recommendedAction:
        "Share referral links after strong product moments, such as report generation or first payment setup.",
    },
  ];
}

function sanitizeInsight(value: unknown, index: number): BusinessInsight | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const priority = isInsightPriority(record.priority) ? record.priority : "Medium";
  const category = typeof record.category === "string" ? record.category : "Business";
  const title = typeof record.title === "string" ? record.title : `Insight ${index + 1}`;
  const summary = typeof record.summary === "string" ? record.summary : "";
  const recommendedAction =
    typeof record.recommendedAction === "string" ? record.recommendedAction : "";

  if (!summary || !recommendedAction) return null;

  return {
    id: typeof record.id === "string" ? record.id : `insight-${index + 1}`,
    priority,
    category,
    title,
    summary,
    recommendedAction,
  };
}

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
}

export async function POST() {
  try {
    const allowed = await hasFeatureAccess("insights");
    if (!allowed) {
      return NextResponse.json(
        { error: "AI business insights are available on CoachFlow Academy." },
        { status: 403 },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY environment variable." },
        { status: 500 },
      );
    }

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
        { error: "You must be signed in to generate insights." },
        { status: 401 },
      );
    }

    const [
      playersResult,
      sessionsResult,
      sessionPlayersResult,
      sessionBookingsResult,
      reportsResult,
      subscriptionsResult,
      campsResult,
      enrolmentsResult,
      referralsResult,
    ] = await Promise.all([
      supabase
        .from("players")
        .select("id, player_name, parent_name, parent_email")
        .eq("coach_id", user.id),
      supabase
        .from("sessions")
        .select("id, player_id, session_date, attendance_status")
        .eq("coach_id", user.id),
      supabase
        .from("session_players")
        .select("session_id, player_id")
        .eq("coach_id", user.id),
      supabase
        .from("session_bookings")
        .select("id, session_id, player_id, booking_status, amount, created_at")
        .eq("coach_id", user.id),
      supabase
        .from("progress_reports")
        .select("id, player_id, created_at")
        .eq("coach_id", user.id),
      supabase
        .from("parent_subscriptions")
        .select("id, player_id, amount, interval, status, current_period_end")
        .eq("coach_id", user.id),
      supabase
        .from("camps")
        .select("id, name, capacity, price, start_date")
        .eq("coach_id", user.id),
      supabase
        .from("camp_enrolments")
        .select("camp_id, status")
        .eq("coach_id", user.id),
      supabase
        .from("referrals")
        .select("id, status, reward_value, created_at")
        .eq("referrer_id", user.id),
    ]);

    const firstError =
      playersResult.error ??
      sessionsResult.error ??
      sessionPlayersResult.error ??
      sessionBookingsResult.error ??
      reportsResult.error ??
      subscriptionsResult.error ??
      campsResult.error ??
      enrolmentsResult.error ??
      referralsResult.error;

    if (firstError) {
      return NextResponse.json({ error: firstError.message }, { status: 500 });
    }

    const sessionPlayerLinks = (sessionPlayersResult.data ?? []) as Array<{
      session_id: string;
      player_id: string;
    }>;
    const sessionBookings = (sessionBookingsResult.data ?? []) as BookingRow[];
    const playerIdsBySession = new Map<string, Set<string>>();

    for (const session of (sessionsResult.data ?? []) as SessionRow[]) {
      const assigned = new Set<string>();
      if (session.player_id) assigned.add(session.player_id);
      playerIdsBySession.set(session.id, assigned);
    }

    for (const link of sessionPlayerLinks) {
      const current = playerIdsBySession.get(link.session_id) ?? new Set<string>();
      current.add(link.player_id);
      playerIdsBySession.set(link.session_id, current);
    }

    for (const booking of sessionBookings) {
      if (booking.booking_status !== "confirmed") continue;
      const current = playerIdsBySession.get(booking.session_id) ?? new Set<string>();
      current.add(booking.player_id);
      playerIdsBySession.set(booking.session_id, current);
    }

    const sessionAssignments = ((sessionsResult.data ?? []) as SessionRow[]).flatMap((session) => {
      const playerIds = [...(playerIdsBySession.get(session.id) ?? new Set<string>())];
      if (playerIds.length === 0) {
        return [] as SessionRow[];
      }
      return playerIds.map(
        (playerId) =>
          ({
            id: session.id,
            player_id: playerId,
            session_date: session.session_date,
            attendance_status: session.attendance_status,
          }) satisfies SessionRow,
      );
    });

    const businessData: BusinessData = {
      players: (playersResult.data ?? []) as PlayerRow[],
      sessions: sessionAssignments,
      reports: (reportsResult.data ?? []) as ReportRow[],
      subscriptions: (subscriptionsResult.data ?? []) as SubscriptionRow[],
      camps: (campsResult.data ?? []) as CampRow[],
      enrolments: (enrolmentsResult.data ?? []) as CampEnrolmentRow[],
      bookings: sessionBookings,
      referrals: (referralsResult.data ?? []) as ReferralRow[],
    };

    const deterministic = fallbackInsights(businessData);
    const openai = new OpenAI({ apiKey });
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      temperature: 0.4,
      max_output_tokens: 1200,
      input: [
        {
          role: "system",
          content:
            "You are a commercial operating partner for football academies. Return only valid JSON with an `insights` array. Each insight must include id, priority (High/Medium/Low), category, title, summary, recommendedAction. Be specific and practical.",
        },
        {
          role: "user",
          content: JSON.stringify({
            instruction:
              "Generate 5-7 AI business insights for this coach. Cover attendance risk, payment failures, camps, revenue growth, follow-up actions, and referrals where relevant.",
            data: businessData,
            baselineInsights: deterministic,
          }),
        },
      ],
    });

    const parsed = extractJson(response.output_text?.trim() ?? "") as {
      insights?: unknown[];
    } | null;
    const insights =
      parsed?.insights
        ?.map((item, index) => sanitizeInsight(item, index))
        .filter((item): item is BusinessInsight => Boolean(item))
        .slice(0, 7) ?? [];

    const payload: InsightsResponse = {
      generatedAt: new Date().toISOString(),
      insights: insights.length > 0 ? insights : deterministic,
    };

    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unable to generate insights.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
