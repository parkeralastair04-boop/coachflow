import { NextResponse } from "next/server";
import { buildAttendanceByPlayer } from "@/lib/team-insights";
import {
  buildAttendanceFollowUpSuggestions,
  buildCommunicationReports,
  buildTomorrowSessionReminders,
  mapCommunicationPlayers,
  type CommunicationCamp,
  type CommunicationDashboardData,
  type CommunicationTeam,
  type ScheduledAutomationMessage,
} from "@/lib/communication-insights";
import {
  getAutomationScheduleLabel,
  requireCommunicationAccess,
} from "@/lib/communication-access";

export const runtime = "nodejs";

export async function GET() {
  try {
    const access = await requireCommunicationAccess();
    if (!access.ok) return access.response;

    const today = new Date().toISOString().slice(0, 10);

    const [
      { data: playerRows, error: playersError },
      { data: teamRows, error: teamsError },
      { data: campRows, error: campsError },
      { data: sessionRows, error: sessionsError },
      { data: bookingRows, error: bookingsError },
      { data: sessionPlayerRows, error: sessionPlayersError },
      { data: attendanceRows, error: attendanceError },
      { data: reportRows, error: reportsError },
      { data: automationRows, error: automationsError },
    ] = await Promise.all([
      access.supabase
        .from("players")
        .select(
          "id, player_name, parent_name, parent_email, team_players(team:teams(id, team_name, age_group, team_color))",
        )
        .eq("coach_id", access.coachId)
        .order("player_name", { ascending: true }),
      access.supabase
        .from("teams")
        .select("id, team_name, age_group, team_players(player_id)")
        .eq("coach_id", access.coachId)
        .order("team_name", { ascending: true }),
      access.supabase
        .from("camps")
        .select("id, name, start_date, end_date")
        .eq("coach_id", access.coachId)
        .gte("end_date", today)
        .order("start_date", { ascending: true }),
      access.supabase
        .from("sessions")
        .select(
          "id, session_date, group_name, session_type, location, team_id, player_id, session_players(player_id)",
        )
        .eq("coach_id", access.coachId),
      access.supabase
        .from("session_bookings")
        .select("session_id, player_id, booking_status")
        .eq("coach_id", access.coachId)
        .eq("booking_status", "confirmed"),
      access.supabase.from("session_players").select("session_id, player_id"),
      access.supabase
        .from("session_attendance")
        .select("session_id, player_id, status, recorded_at")
        .eq("coach_id", access.coachId),
      access.supabase
        .from("progress_reports")
        .select("id, player_id, report, created_at")
        .eq("coach_id", access.coachId)
        .order("created_at", { ascending: false })
        .limit(50),
      access.supabase
        .from("automations")
        .select("id, type, subject, is_enabled, timing_offset")
        .eq("coach_id", access.coachId)
        .order("created_at", { ascending: false }),
    ]);

    const queryError =
      playersError?.message ??
      teamsError?.message ??
      campsError?.message ??
      sessionsError?.message ??
      bookingsError?.message ??
      sessionPlayersError?.message ??
      attendanceError?.message ??
      reportsError?.message ??
      automationsError?.message;

    if (queryError) {
      return NextResponse.json({ error: queryError }, { status: 500 });
    }

    const players = mapCommunicationPlayers(playerRows ?? []);
    const playersById = new Map(players.map((player) => [player.id, player]));

    const teams: CommunicationTeam[] = (teamRows ?? []).map((team) => ({
      id: team.id as string,
      team_name: team.team_name as string,
      age_group: (team.age_group as string | null) ?? null,
      playerCount: Array.isArray(team.team_players) ? team.team_players.length : 0,
    }));

    const camps: CommunicationCamp[] = (campRows ?? []).map((camp) => ({
      id: camp.id as string,
      name: camp.name as string,
      start_date: camp.start_date as string,
      end_date: camp.end_date as string,
    }));

    const sessions = (sessionRows ?? []) as Array<{
      id: string;
      session_date: string;
      group_name: string | null;
      session_type: string | null;
      location: string | null;
      team_id: string | null;
      player_id: string | null;
      session_players?: { player_id: string }[] | null;
    }>;

    const sessionPlayerIds = new Map<string, Set<string>>();
    for (const session of sessions) {
      const ids = new Set<string>();
      for (const link of session.session_players ?? []) {
        ids.add(link.player_id);
      }
      if (session.player_id) ids.add(session.player_id);
      sessionPlayerIds.set(session.id, ids);
    }

    for (const booking of bookingRows ?? []) {
      const ids = sessionPlayerIds.get(booking.session_id as string) ?? new Set<string>();
      ids.add(booking.player_id as string);
      sessionPlayerIds.set(booking.session_id as string, ids);
    }

    for (const link of sessionPlayerRows ?? []) {
      const ids = sessionPlayerIds.get(link.session_id as string) ?? new Set<string>();
      ids.add(link.player_id as string);
      sessionPlayerIds.set(link.session_id as string, ids);
    }

    const attendanceByPlayer = buildAttendanceByPlayer(
      (attendanceRows ?? []).map((row) => ({
        session_id: row.session_id as string,
        player_id: row.player_id as string,
        status: row.status,
        recorded_at: row.recorded_at as string,
      })),
    );

    const scheduledMessages: ScheduledAutomationMessage[] = (automationRows ?? []).map(
      (automation) => {
        const template = getAutomationScheduleLabel(
          automation.type as string,
          automation.timing_offset as number,
        );
        return {
          id: automation.id as string,
          type: automation.type as string,
          title: (automation.type as string).replaceAll("_", " "),
          subject: automation.subject as string,
          isEnabled: Boolean(automation.is_enabled),
          timingLabel: template,
        };
      },
    );

    const dashboard: CommunicationDashboardData = {
      players,
      teams,
      camps,
      attendanceFollowUps: buildAttendanceFollowUpSuggestions({
        players,
        attendanceByPlayer,
      }),
      tomorrowSessions: buildTomorrowSessionReminders({
        sessions,
        playersById,
        sessionPlayerIds,
      }),
      reports: buildCommunicationReports({
        reports: (reportRows ?? []) as Array<{
          id: string;
          player_id: string;
          created_at: string;
          report: string;
        }>,
        playersById,
      }),
      scheduledMessages,
    };

    return NextResponse.json(dashboard);
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unable to load communication centre.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
