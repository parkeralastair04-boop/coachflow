import {
  getAttendanceRate,
  getAttendanceSummary,
  type PlayerAttendanceStatus,
} from "@/lib/attendance";
import {
  getPlayerAttendanceConcerns,
  isPlayerAttendanceAtRisk,
} from "@/lib/attendance-alerts";

export type AttendanceSessionMeta = {
  session_date: string;
  session_type: string | null;
  group_name: string | null;
  team:
    | { team_name: string; age_group: string | null }
    | { team_name: string; age_group: string | null }[]
    | null;
};

export type AttendanceHistoryRow = {
  id?: string;
  session_id: string;
  player_id: string;
  status: PlayerAttendanceStatus;
  notes: string | null;
  recorded_at: string;
  session: AttendanceSessionMeta | AttendanceSessionMeta[] | null;
};

export type AttendanceHistoryEntry = {
  sessionId: string;
  sessionDate: string;
  sessionName: string;
  status: PlayerAttendanceStatus;
  recordedAt: string;
};

export type PlayerAttendanceHistory = {
  rate: number;
  counts: Record<PlayerAttendanceStatus, number>;
  recent: AttendanceHistoryEntry[];
  records: Array<{ status: PlayerAttendanceStatus; recorded_at: string }>;
  isAtRisk: boolean;
  concerns: string[];
};

export const PLAYER_ATTENDANCE_HISTORY_SELECT = `
  id,
  session_id,
  player_id,
  status,
  notes,
  recorded_at,
  session:sessions (
    session_date,
    session_type,
    group_name,
    team:teams (
      team_name,
      age_group
    )
  )
`;

export function unwrapAttendanceSession(
  session: AttendanceHistoryRow["session"],
): AttendanceSessionMeta | null {
  if (!session) return null;
  return Array.isArray(session) ? (session[0] ?? null) : session;
}

export function getAttendanceSessionName(
  session: AttendanceSessionMeta | null,
  recordedAt: string,
): string {
  const team = session?.team
    ? Array.isArray(session.team)
      ? session.team[0]
      : session.team
    : null;

  if (session?.group_name?.trim()) return session.group_name.trim();
  if (team?.team_name?.trim()) return team.team_name.trim();
  if (session?.session_type?.trim()) return session.session_type.trim();

  const parsed = new Date(session?.session_date ?? recordedAt);
  if (Number.isNaN(parsed.getTime())) return "Session";
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
  }).format(parsed);
}

export function formatAttendanceSessionDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

export function parsePlayerAttendanceHistory(
  rows: AttendanceHistoryRow[],
): PlayerAttendanceHistory {
  const entries = rows.map((row) => {
    const session = unwrapAttendanceSession(row.session);
    return {
      sessionId: row.session_id,
      sessionDate: session?.session_date ?? row.recorded_at,
      sessionName: getAttendanceSessionName(session, row.recorded_at),
      status: row.status,
      recordedAt: row.recorded_at,
    } satisfies AttendanceHistoryEntry;
  });

  const records = rows.map((row) => ({
    status: row.status,
    recorded_at: row.recorded_at,
  }));
  const rate = getAttendanceRate(rows);

  return {
    rate,
    counts: getAttendanceSummary(rows),
    recent: entries.slice(0, 5),
    records,
    isAtRisk: isPlayerAttendanceAtRisk(rate, records),
    concerns: getPlayerAttendanceConcerns(rate, records),
  };
}
