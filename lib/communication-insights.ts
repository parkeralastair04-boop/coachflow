import {
  getAttendanceRate,
  isCountedAttendanceStatus,
} from "@/lib/attendance";
import {
  ATTENDANCE_RISK_RATE_THRESHOLD,
  CONSECUTIVE_ABSENCE_THRESHOLD,
  hasConsecutiveAbsences,
  sortAttendanceByRecordedAtDesc,
  type AttendanceRecordRef,
} from "@/lib/attendance-alerts";
import { getCampLinkedSessions, type CampRow, type CampSessionRow } from "@/lib/camp-insights";
import {
  getCommunicationTemplate,
  renderCommunicationTemplate,
} from "@/lib/communication-templates";
import { getTeamDisplayName, type TeamSummary } from "@/lib/team-management";

export type CommunicationPlayer = {
  id: string;
  player_name: string;
  parent_name: string | null;
  parent_email: string | null;
  teamIds: string[];
  teamLabels: string[];
};

export type CommunicationTeam = {
  id: string;
  team_name: string;
  age_group: string | null;
  playerCount: number;
};

export type CommunicationCamp = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
};

export type AttendanceFollowUpSuggestion = {
  id: string;
  playerId: string;
  playerName: string;
  parentEmail: string;
  parentName: string | null;
  category: "consecutive_absences" | "low_attendance" | "late_arrivals";
  categoryLabel: string;
  attendanceRate: number;
  suggestedSubject: string;
  suggestedBody: string;
};

export type TomorrowSessionReminder = {
  sessionId: string;
  sessionDate: string;
  sessionTitle: string;
  location: string | null;
  families: Array<{
    playerId: string;
    playerName: string;
    parentEmail: string;
    parentName: string | null;
  }>;
};

export type CommunicationReportItem = {
  id: string;
  playerId: string;
  playerName: string;
  parentEmail: string | null;
  parentName: string | null;
  created_at: string;
  subject: string;
  report: string;
};

export type ScheduledAutomationMessage = {
  id: string;
  type: string;
  title: string;
  subject: string;
  isEnabled: boolean;
  timingLabel: string;
};

export type CommunicationDashboardData = {
  players: CommunicationPlayer[];
  teams: CommunicationTeam[];
  camps: CommunicationCamp[];
  attendanceFollowUps: AttendanceFollowUpSuggestion[];
  tomorrowSessions: TomorrowSessionReminder[];
  reports: CommunicationReportItem[];
  scheduledMessages: ScheduledAutomationMessage[];
};

type PlayerRow = {
  id: string;
  player_name: string;
  parent_name: string | null;
  parent_email: string | null;
  team_players?: { team?: TeamSummary[] | TeamSummary | null }[] | null;
};

type SessionRow = {
  id: string;
  session_date: string;
  group_name: string | null;
  session_type: string | null;
  location: string | null;
  team_id: string | null;
  player_id: string | null;
};


function isSameCalendarDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isTomorrow(sessionDateIso: string, now = new Date()): boolean {
  const sessionDate = new Date(sessionDateIso);
  if (Number.isNaN(sessionDate.getTime())) return false;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return isSameCalendarDay(sessionDate, tomorrow);
}

function formatSessionDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function formatCampDates(start: string, end: string): string {
  const startLabel = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
    new Date(start),
  );
  const endLabel = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
    new Date(end),
  );
  return `${startLabel} – ${endLabel}`;
}

function getSessionTitle(session: SessionRow): string {
  if (session.group_name?.trim()) return session.group_name.trim();
  if (session.session_type?.trim()) return session.session_type.trim();
  return "Training session";
}

function getPlayerTeamsFromRow(row: PlayerRow): TeamSummary[] {
  const memberships = row.team_players ?? [];
  const teams: TeamSummary[] = [];
  for (const membership of memberships) {
    const team = membership.team;
    if (!team) continue;
    if (Array.isArray(team)) teams.push(...team);
    else teams.push(team);
  }
  return teams;
}

export function mapCommunicationPlayers(rows: PlayerRow[]): CommunicationPlayer[] {
  return rows.map((row) => {
    const teams = getPlayerTeamsFromRow(row);
    return {
      id: row.id,
      player_name: row.player_name,
      parent_name: row.parent_name,
      parent_email: row.parent_email,
      teamIds: teams.map((team) => team.id),
      teamLabels: teams.map((team) => getTeamDisplayName(team)),
    };
  });
}

export function buildAttendanceFollowUpSuggestions(args: {
  players: CommunicationPlayer[];
  attendanceByPlayer: Map<string, AttendanceRecordRef[]>;
}): AttendanceFollowUpSuggestion[] {
  const template = getCommunicationTemplate("attendance_follow_up");
  const suggestions: AttendanceFollowUpSuggestion[] = [];

  for (const player of args.players) {
    const parentEmail = player.parent_email?.trim();
    if (!parentEmail) continue;

    const records = args.attendanceByPlayer.get(player.id) ?? [];
    const counted = records.filter((record) => isCountedAttendanceStatus(record.status));
    if (counted.length === 0) continue;

    const rate = getAttendanceRate(records);
    const sorted = sortAttendanceByRecordedAtDesc(records);
    const recentLateCount = sorted
      .slice(0, 5)
      .filter((record) => record.status === "late").length;

    let category: AttendanceFollowUpSuggestion["category"] | null = null;
    let categoryLabel = "";
    let attendanceNote = "";

    if (hasConsecutiveAbsences(records, CONSECUTIVE_ABSENCE_THRESHOLD)) {
      category = "consecutive_absences";
      categoryLabel = `${CONSECUTIVE_ABSENCE_THRESHOLD} consecutive absences`;
      attendanceNote = `${player.player_name} has missed the last ${CONSECUTIVE_ABSENCE_THRESHOLD} sessions.`;
    } else if (rate < ATTENDANCE_RISK_RATE_THRESHOLD) {
      category = "low_attendance";
      categoryLabel = `Below ${ATTENDANCE_RISK_RATE_THRESHOLD}% attendance`;
      attendanceNote = `${player.player_name}'s attendance is currently ${Math.round(rate)}%.`;
    } else if (recentLateCount >= 2) {
      category = "late_arrivals";
      categoryLabel = "Late arrivals";
      attendanceNote = `${player.player_name} has been late to recent sessions.`;
    }

    if (!category) continue;

    const values = {
      parent_name: player.parent_name,
      player_name: player.player_name,
      attendance_note: attendanceNote,
    };

    suggestions.push({
      id: `${player.id}-${category}`,
      playerId: player.id,
      playerName: player.player_name,
      parentEmail,
      parentName: player.parent_name,
      category,
      categoryLabel,
      attendanceRate: rate,
      suggestedSubject: renderCommunicationTemplate(template.defaultSubject, values),
      suggestedBody: renderCommunicationTemplate(template.defaultBody, values),
    });
  }

  return suggestions.sort((left, right) => left.attendanceRate - right.attendanceRate);
}

export function buildTomorrowSessionReminders(args: {
  sessions: SessionRow[];
  playersById: Map<string, CommunicationPlayer>;
  sessionPlayerIds: Map<string, Set<string>>;
}): TomorrowSessionReminder[] {
  const reminders: TomorrowSessionReminder[] = [];

  for (const session of args.sessions) {
    if (!isTomorrow(session.session_date)) continue;

    const playerIds = args.sessionPlayerIds.get(session.id) ?? new Set<string>();
    const families = [...playerIds]
      .map((playerId) => args.playersById.get(playerId))
      .filter((player): player is CommunicationPlayer => Boolean(player?.parent_email?.trim()))
      .map((player) => ({
        playerId: player.id,
        playerName: player.player_name,
        parentEmail: player.parent_email!.trim(),
        parentName: player.parent_name,
      }));

    if (families.length === 0) continue;

    reminders.push({
      sessionId: session.id,
      sessionDate: session.session_date,
      sessionTitle: getSessionTitle(session),
      location: session.location,
      families,
    });
  }

  return reminders.sort(
    (left, right) => new Date(left.sessionDate).getTime() - new Date(right.sessionDate).getTime(),
  );
}

export function buildCommunicationReports(args: {
  reports: Array<{ id: string; player_id: string; created_at: string; report: string }>;
  playersById: Map<string, CommunicationPlayer>;
}): CommunicationReportItem[] {
  return args.reports.map((report) => {
    const player = args.playersById.get(report.player_id);
    const playerName = player?.player_name ?? "Player";
    return {
      id: report.id,
      playerId: report.player_id,
      playerName,
      parentEmail: player?.parent_email ?? null,
      parentName: player?.parent_name ?? null,
      created_at: report.created_at,
      subject: `Progress report for ${playerName}`,
      report: report.report,
    };
  });
}

export function getCampAttendeePlayerIds(args: {
  camp: CampRow;
  sessions: CampSessionRow[];
  bookings: Array<{ session_id: string; player_id: string; booking_status: string }>;
}): string[] {
  const linkedSessions = getCampLinkedSessions(args.camp, args.sessions);
  const linkedIds = new Set(linkedSessions.map((session) => session.id));
  const ids = new Set<string>();

  for (const session of linkedSessions) {
    for (const link of session.session_players ?? []) {
      ids.add(link.player_id);
    }
  }

  for (const booking of args.bookings) {
    if (!linkedIds.has(booking.session_id)) continue;
    if (booking.booking_status === "confirmed" || booking.booking_status === "waitlist") {
      ids.add(booking.player_id);
    }
  }

  return [...ids];
}

export function resolveAnnouncementRecipients(args: {
  audience: "all_families" | "team" | "camp" | "selected";
  players: CommunicationPlayer[];
  teamId?: string | null;
  campPlayerIds?: string[];
  selectedPlayerIds?: string[];
}): CommunicationPlayer[] {
  const withEmail = args.players.filter((player) => player.parent_email?.trim());

  if (args.audience === "all_families") {
    return withEmail;
  }

  if (args.audience === "team" && args.teamId) {
    return withEmail.filter((player) => player.teamIds.includes(args.teamId!));
  }

  if (args.audience === "camp" && args.campPlayerIds) {
    const campSet = new Set(args.campPlayerIds);
    return withEmail.filter((player) => campSet.has(player.id));
  }

  if (args.audience === "selected" && args.selectedPlayerIds) {
    const selected = new Set(args.selectedPlayerIds);
    return withEmail.filter((player) => selected.has(player.id));
  }

  return [];
}

export function formatCommunicationPreview(body: string, maxLength = 120): string {
  const compact = body.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1)}…`;
}

export {
  formatSessionDate,
  formatCampDates,
};
