import type { PlayerAttendanceStatus } from "@/lib/attendance";

export const MATCH_STATUSES = [
  "scheduled",
  "live",
  "completed",
  "postponed",
  "cancelled",
] as const;

export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const MATCH_COMPETITION_TYPES = ["league", "cup", "friendly"] as const;

export type MatchCompetitionType = (typeof MATCH_COMPETITION_TYPES)[number];

export const PARENT_MATCH_AVAILABILITY = [
  "available",
  "unavailable",
  "running_late",
  "no_response",
] as const;

export type ParentMatchAvailability = (typeof PARENT_MATCH_AVAILABILITY)[number];

export const MATCH_EVENT_TYPES = [
  "goal",
  "assist",
  "yellow_card",
  "red_card",
  "own_goal",
  "substitution",
] as const;

export type MatchEventType = (typeof MATCH_EVENT_TYPES)[number];

export type MatchEvent = {
  id: string;
  type: MatchEventType;
  playerId: string | null;
  relatedPlayerId: string | null;
  minute: number | null;
  note: string | null;
  createdAt: string;
};

export type MatchResult = {
  homeScore: number | null;
  awayScore: number | null;
  halfTimeHomeScore: number | null;
  halfTimeAwayScore: number | null;
  competitionName: string | null;
  venue: string | null;
  weather: string | null;
  coachNotes: string | null;
  finalWhistleAt: string | null;
  playerOfTheMatchId: string | null;
  scorers: Array<{ playerId: string; goals: number }>;
};

export type MatchData = {
  events: MatchEvent[];
  result: MatchResult | null;
  reportNotes: string | null;
};

export type MatchRow = {
  id: string;
  coach_id: string;
  academy_id: string | null;
  team_id: string;
  session_id: string | null;
  opposition: string;
  competition_type: MatchCompetitionType;
  competition_name: string | null;
  venue: string | null;
  is_home: boolean;
  kickoff_date: string;
  kickoff_time: string | null;
  meet_time: string | null;
  pitch: string | null;
  notes: string | null;
  status: MatchStatus;
  squad_published: boolean;
  max_squad_size: number | null;
  match_data: MatchData | unknown;
  report_id: string | null;
  created_at: string;
  updated_at: string;
};

export type MatchSquadPlayerRow = {
  id: string;
  match_id: string;
  player_id: string;
  squad_order: number;
  role: "captain" | "vice_captain" | null;
  is_goalkeeper: boolean;
  is_starter: boolean;
  parent_availability: ParentMatchAvailability;
  minutes_played: number;
  player?: {
    id: string;
    player_name: string;
    primary_position: string | null;
  } | null;
};

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  scheduled: "Scheduled",
  live: "Live",
  completed: "Completed",
  postponed: "Postponed",
  cancelled: "Cancelled",
};

export const MATCH_COMPETITION_LABELS: Record<MatchCompetitionType, string> = {
  league: "League",
  cup: "Cup",
  friendly: "Friendly",
};

export const PARENT_MATCH_AVAILABILITY_LABELS: Record<ParentMatchAvailability, string> = {
  available: "Available",
  unavailable: "Unavailable",
  running_late: "Running late",
  no_response: "No response",
};

export const MATCH_EVENT_LABELS: Record<MatchEventType, string> = {
  goal: "Goal",
  assist: "Assist",
  yellow_card: "Yellow card",
  red_card: "Red card",
  own_goal: "Own goal",
  substitution: "Substitution",
};

export const DEFAULT_MAX_SQUAD_SIZE = 18;

export function isMatchStatus(value: unknown): value is MatchStatus {
  return typeof value === "string" && MATCH_STATUSES.includes(value as MatchStatus);
}

export function isMatchCompetitionType(value: unknown): value is MatchCompetitionType {
  return (
    typeof value === "string" &&
    MATCH_COMPETITION_TYPES.includes(value as MatchCompetitionType)
  );
}

export function isParentMatchAvailability(value: unknown): value is ParentMatchAvailability {
  return (
    typeof value === "string" &&
    PARENT_MATCH_AVAILABILITY.includes(value as ParentMatchAvailability)
  );
}

export function parseMatchData(raw: unknown): MatchData {
  if (!raw || typeof raw !== "object") {
    return { events: [], result: null, reportNotes: null };
  }
  const data = raw as Record<string, unknown>;
  const events = Array.isArray(data.events) ? (data.events as MatchEvent[]) : [];
  const result =
    data.result && typeof data.result === "object" ? (data.result as MatchResult) : null;
  const reportNotes = typeof data.reportNotes === "string" ? data.reportNotes : null;
  return { events, result, reportNotes };
}

export function getMatchTitle(match: Pick<MatchRow, "is_home" | "opposition">, teamName: string) {
  return match.is_home ? `${teamName} vs ${match.opposition}` : `${match.opposition} vs ${teamName}`;
}

export function formatMatchKickoff(
  kickoffDate: string,
  kickoffTime: string | null,
): string {
  const date = new Date(`${kickoffDate}T${kickoffTime ?? "12:00:00"}`);
  if (Number.isNaN(date.getTime())) return kickoffDate;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(kickoffTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

export function getRegisterAttendanceForSquad(
  squad: MatchSquadPlayerRow[],
  attendanceRows: Array<{ player_id: string; status: PlayerAttendanceStatus }>,
): Record<string, PlayerAttendanceStatus | null> {
  const byPlayer = new Map(attendanceRows.map((row) => [row.player_id, row.status]));
  return Object.fromEntries(
    squad.map((player) => [player.player_id, byPlayer.get(player.player_id) ?? null]),
  );
}
