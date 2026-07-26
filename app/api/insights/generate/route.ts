import OpenAI from "openai";
import { NextResponse } from "next/server";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isMissedAttendanceStatus, type PlayerAttendanceStatus } from "@/lib/attendance";
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
  preferred_foot: string;
  primary_position: string | null;
  secondary_positions: string[];
  team_names: string[];
  parent_name: string | null;
  parent_email: string | null;
};

type SessionRow = {
  id: string;
  player_id: string | null;
  team_id?: string | null;
  team_name?: string | null;
  session_date: string;
  attendance_status: PlayerAttendanceStatus;
};

type AttendanceQueryRow = {
  session_id: string;
  player_id: string;
  status: PlayerAttendanceStatus;
  recorded_at: string;
  session:
    | {
        session_date: string;
        team_id: string | null;
        team: { team_name: string }[] | { team_name: string } | null;
      }[]
    | {
        session_date: string;
        team_id: string | null;
        team: { team_name: string }[] | { team_name: string } | null;
      }
    | null;
};

type TeamRow = {
  id: string;
  team_name: string;
  age_group: string | null;
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
  teams: TeamRow[];
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
    if (isMissedAttendanceStatus(session.attendance_status) && session.player_id) {
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

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit({
      request,
      config: RATE_LIMITS.aiGenerate,
      route: "/api/insights/generate",
    });
    if (limited) return limited;

    const allowed = await hasFeatureAccess("insights");
    if (!allowed) {
      return NextResponse.json(
        { error: "AI business insights are available on Awarix Academy." },
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
      teamsResult,
      attendanceResult,
      sessionBookingsResult,
      reportsResult,
      subscriptionsResult,
      campsResult,
      enrolmentsResult,
      referralsResult,
    ] = await Promise.all([
      supabase
        .from("players")
        .select(
          "id, player_name, preferred_foot, primary_position, secondary_positions, team_players(team:teams(team_name, age_group)), parent_name, parent_email",
        )
        .eq("coach_id", user.id),
      supabase
        .from("teams")
        .select("id, team_name, age_group")
        .eq("coach_id", user.id),
      supabase
        .from("session_attendance")
        .select(
          `
            session_id,
            player_id,
            status,
            recorded_at,
            session:sessions (
              session_date,
              team_id,
              team:teams (
                team_name
              )
            )
          `,
        )
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
      teamsResult.error ??
      attendanceResult.error ??
      sessionBookingsResult.error ??
      reportsResult.error ??
      subscriptionsResult.error ??
      campsResult.error ??
      enrolmentsResult.error ??
      referralsResult.error;

    if (firstError) {
      return NextResponse.json({ error: firstError.message }, { status: 500 });
    }

    const sessionBookings = (sessionBookingsResult.data ?? []) as BookingRow[];
    const safePlayers = ((playersResult.data ?? []) as Array<
      Omit<PlayerRow, "team_names"> & {
        team_players?: Array<{
          team?: { team_name: string; age_group: string | null }[] | {
            team_name: string;
            age_group: string | null;
          } | null;
        }> | null;
      }
    >).map((player) => ({
      ...player,
      team_names: (player.team_players ?? [])
        .map((membership) => {
          const team = Array.isArray(membership.team)
            ? membership.team[0]
            : membership.team;
          if (!team?.team_name) return null;
          return team.age_group?.trim()
            ? `${team.team_name} · ${team.age_group.trim()}`
            : team.team_name;
        })
        .filter((value): value is string => Boolean(value)),
    }));
    const attendanceSessions = ((attendanceResult.data ?? []) as AttendanceQueryRow[]).map(
      (row) => {
        const session = Array.isArray(row.session) ? row.session[0] : row.session;
        const team = Array.isArray(session?.team) ? session?.team[0] : session?.team;
        return {
          id: row.session_id,
          player_id: row.player_id,
          team_id: session?.team_id ?? null,
          team_name: team?.team_name ?? null,
          session_date: session?.session_date ?? row.recorded_at,
          attendance_status: row.status,
        } satisfies SessionRow;
      },
    );

    const businessData: BusinessData = {
      players: safePlayers,
      teams: (teamsResult.data ?? []) as TeamRow[],
      sessions: attendanceSessions,
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
            "You are the Awarix commercial intelligence partner for football academies. Return only valid JSON with an `insights` array. Each insight must include id, priority (High/Medium/Low), category, title, summary, recommendedAction. Be specific and practical.",
        },
        {
          role: "user",
          content: JSON.stringify({
            instruction:
              "Generate 5-7 AI business insights for this coach. Cover attendance risk and attendance patterns by player or squad, payment failures, camps, revenue growth, follow-up actions, and referrals where relevant.",
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
