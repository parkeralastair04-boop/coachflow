import { NextResponse } from "next/server";
import { isMissedAttendanceStatus, type PlayerAttendanceStatus } from "@/lib/attendance";
import {
  renderAutomationText,
  type AutomationRow,
  type AutomationType,
} from "@/lib/automations";
import { getResendServerClient, resendFromEmail } from "@/lib/resend";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasFeatureAccess } from "@/lib/subscription";

type PlayerRow = {
  id: string;
  player_name: string;
  date_of_birth: string | null;
  parent_name: string | null;
  parent_email: string | null;
};

type SessionRow = {
  id: string;
  player_id: string | null;
  team_id: string | null;
  session_date: string;
};

type SessionPlayerRow = {
  session_id: string;
  player_id: string;
};

type TeamPlayerRow = {
  team_id: string;
  player_id: string;
};

type SessionBookingRow = {
  session_id: string;
  player_id: string;
  booking_status: string;
};

type SessionAssignment = {
  session_id: string;
  player_id: string;
  session_date: string;
};

type AttendanceRecord = {
  session_id: string;
  player_id: string;
  status: PlayerAttendanceStatus;
  recorded_at: string;
};

type SubscriptionRow = {
  player_id: string;
  status: string;
  current_period_end: string | null;
};

type ReportRow = {
  player_id: string;
  created_at: string;
};

type AutomationCandidate = {
  automation: AutomationRow;
  player: PlayerRow;
  values: Record<string, string | number | null | undefined>;
};

export const runtime = "nodejs";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(a: Date, b: Date) {
  const ms = startOfDay(a).getTime() - startOfDay(b).getTime();
  return Math.round(ms / 86_400_000);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function playerValues(player: PlayerRow) {
  return {
    parent_name: player.parent_name || "there",
    player_name: player.player_name,
  };
}

function buildEmailHtml(subject: string, body: string) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f7f9;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="padding:28px 32px;background:#0f172a;color:#ffffff;">
                <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#86efac;">CoachFlow</div>
                <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25;">${subject}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;color:#374151;line-height:1.65;">
                ${body
                  .split(/\n{2,}/)
                  .map((paragraph) => `<p style="margin:0 0 16px;">${paragraph.replaceAll("\n", "<br />")}</p>`)
                  .join("")}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildSessionAssignments(args: {
  sessions: SessionRow[];
  sessionPlayers: SessionPlayerRow[];
  sessionBookings: SessionBookingRow[];
  teamPlayers: TeamPlayerRow[];
}): SessionAssignment[] {
  const sessionPlayersBySession = new Map<string, Set<string>>();
  const teamPlayersByTeam = new Map<string, Set<string>>();

  for (const membership of args.teamPlayers) {
    const current = teamPlayersByTeam.get(membership.team_id) ?? new Set<string>();
    current.add(membership.player_id);
    teamPlayersByTeam.set(membership.team_id, current);
  }

  for (const link of args.sessionPlayers) {
    const current = sessionPlayersBySession.get(link.session_id) ?? new Set<string>();
    current.add(link.player_id);
    sessionPlayersBySession.set(link.session_id, current);
  }

  for (const booking of args.sessionBookings) {
    if (booking.booking_status !== "confirmed") continue;
    const current = sessionPlayersBySession.get(booking.session_id) ?? new Set<string>();
    current.add(booking.player_id);
    sessionPlayersBySession.set(booking.session_id, current);
  }

  return args.sessions.flatMap((session) => {
    const assignedPlayerIds = sessionPlayersBySession.get(session.id) ?? new Set<string>();
    if (assignedPlayerIds.size === 0 && session.team_id) {
      for (const playerId of teamPlayersByTeam.get(session.team_id) ?? new Set<string>()) {
        assignedPlayerIds.add(playerId);
      }
    }
    if (assignedPlayerIds.size === 0 && session.player_id) {
      assignedPlayerIds.add(session.player_id);
    }

    return [...assignedPlayerIds].map((playerId) => ({
      session_id: session.id,
      player_id: playerId,
      session_date: session.session_date,
    }));
  });
}

function candidatesForAutomation(args: {
  automation: AutomationRow;
  players: PlayerRow[];
  sessionAssignments: SessionAssignment[];
  attendanceRecords: AttendanceRecord[];
  subscriptions: SubscriptionRow[];
  reports: ReportRow[];
  now: Date;
}): AutomationCandidate[] {
  const {
    automation,
    players,
    sessionAssignments,
    attendanceRecords,
    subscriptions,
    reports,
    now,
  } = args;
  const byPlayer = new Map(players.map((player) => [player.id, player]));

  switch (automation.type as AutomationType) {
    case "session_reminder":
      return sessionAssignments
        .filter((session) => {
          const hoursUntil =
            (new Date(session.session_date).getTime() - now.getTime()) / 3_600_000;
          return hoursUntil > 0 && hoursUntil <= automation.timing_offset;
        })
        .flatMap((session) => {
          const player = byPlayer.get(session.player_id);
          if (!player?.parent_email) return [];
          return [
            {
              automation,
              player,
              values: {
                ...playerValues(player),
                session_date: formatDate(session.session_date),
              },
            },
          ];
        });

    case "payment_reminder":
    case "subscription_renewal":
      return subscriptions
        .filter((subscription) => subscription.status === "active")
        .filter((subscription) => {
          if (!subscription.current_period_end) return false;
          return daysBetween(new Date(subscription.current_period_end), now) <= automation.timing_offset;
        })
        .flatMap((subscription) => {
          const player = byPlayer.get(subscription.player_id);
          if (!player?.parent_email) return [];
          return [
            {
              automation,
              player,
              values: {
                ...playerValues(player),
                due_date: formatDate(subscription.current_period_end),
              },
            },
          ];
        });

    case "birthday_email":
      return players.flatMap((player) => {
        if (!player.parent_email || !player.date_of_birth) return [];
        const birthday = new Date(player.date_of_birth);
        const isBirthday =
          birthday.getUTCMonth() === now.getUTCMonth() &&
          birthday.getUTCDate() === now.getUTCDate();
        return isBirthday
          ? [{ automation, player, values: playerValues(player) }]
          : [];
      });

    case "report_follow_up":
      return reports
        .filter(
          (report) =>
            daysBetween(now, new Date(report.created_at)) === automation.timing_offset,
        )
        .flatMap((report) => {
          const player = byPlayer.get(report.player_id);
          return player?.parent_email
            ? [{ automation, player, values: playerValues(player) }]
            : [];
        });

    case "attendance_alert":
      return players.flatMap((player) => {
        if (!player.parent_email) return [];
        const recent = attendanceRecords
          .filter((record) => record.player_id === player.id)
          .sort(
            (a, b) =>
              new Date(b.recorded_at).getTime() -
              new Date(a.recorded_at).getTime(),
          )
          .slice(0, automation.timing_offset);
        const missed =
          recent.length >= automation.timing_offset &&
          recent.every((record) => isMissedAttendanceStatus(record.status));
        return missed ? [{ automation, player, values: playerValues(player) }] : [];
      });
  }
}

export async function POST() {
  try {
    const allowed = await hasFeatureAccess("automations");
    if (!allowed) {
      return NextResponse.json(
        { error: "Automations are available on CoachFlow Pro and Academy." },
        { status: 403 },
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
        { error: "You must be signed in to run automations." },
        { status: 401 },
      );
    }

    const [
      automationsResult,
      playersResult,
      sessionsResult,
      sessionPlayersResult,
      teamPlayersResult,
      attendanceResult,
      sessionBookingsResult,
      subscriptionsResult,
      reportsResult,
    ] = await Promise.all([
      supabase
        .from("automations")
        .select("id, coach_id, type, is_enabled, subject, template, timing_offset, created_at")
        .eq("coach_id", user.id)
        .eq("is_enabled", true),
      supabase
        .from("players")
        .select("id, player_name, date_of_birth, parent_name, parent_email")
        .eq("coach_id", user.id),
      supabase
        .from("sessions")
        .select("id, player_id, team_id, session_date")
        .eq("coach_id", user.id),
      supabase
        .from("session_players")
        .select("session_id, player_id"),
      supabase
        .from("team_players")
        .select("team_id, player_id"),
      supabase
        .from("session_attendance")
        .select("session_id, player_id, status, recorded_at")
        .eq("coach_id", user.id),
      supabase
        .from("session_bookings")
        .select("session_id, player_id, booking_status")
        .eq("coach_id", user.id),
      supabase
        .from("parent_subscriptions")
        .select("player_id, status, current_period_end")
        .eq("coach_id", user.id),
      supabase
        .from("progress_reports")
        .select("player_id, created_at")
        .eq("coach_id", user.id),
    ]);

    const firstError =
      automationsResult.error ??
      playersResult.error ??
      sessionsResult.error ??
      sessionPlayersResult.error ??
      teamPlayersResult.error ??
      attendanceResult.error ??
      sessionBookingsResult.error ??
      subscriptionsResult.error ??
      reportsResult.error;

    if (firstError) {
      return NextResponse.json({ error: firstError.message }, { status: 500 });
    }

    const automations = (automationsResult.data ?? []) as AutomationRow[];
    const players = (playersResult.data ?? []) as PlayerRow[];
    const sessions = (sessionsResult.data ?? []) as SessionRow[];
    const sessionAssignments = buildSessionAssignments({
      sessions,
      sessionPlayers: (sessionPlayersResult.data ?? []) as SessionPlayerRow[],
      teamPlayers: (teamPlayersResult.data ?? []) as TeamPlayerRow[],
      sessionBookings: (sessionBookingsResult.data ?? []) as SessionBookingRow[],
    });
    const attendanceRecords = (attendanceResult.data ?? []) as AttendanceRecord[];
    const subscriptions = (subscriptionsResult.data ?? []) as SubscriptionRow[];
    const reports = (reportsResult.data ?? []) as ReportRow[];
    const resend = getResendServerClient();
    const now = new Date();
    const candidates = automations.flatMap((automation) =>
      candidatesForAutomation({
        automation,
        players,
        sessionAssignments,
        attendanceRecords,
        subscriptions,
        reports,
        now,
      }),
    );

    let sent = 0;
    for (const candidate of candidates.slice(0, 25)) {
      const subject = renderAutomationText(
        candidate.automation.subject,
        candidate.values,
      );
      const body = renderAutomationText(
        candidate.automation.template,
        candidate.values,
      );

      await resend.emails.send({
        from: resendFromEmail,
        to: candidate.player.parent_email as string,
        subject,
        text: body,
        html: buildEmailHtml(subject, body),
      });
      sent += 1;
    }

    return NextResponse.json({
      evaluated: candidates.length,
      sent,
    });
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unable to run automations.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
