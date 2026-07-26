import {
  getAttendanceRate,
  isCountedAttendanceStatus,
  isMissedAttendanceStatus,
  isPositiveAttendanceStatus,
  type PlayerAttendanceStatus,
} from "@/lib/attendance";
import {
  ATTENDANCE_RISK_RATE_THRESHOLD,
  hasConsecutiveAbsences,
  type AttendanceRecordRef,
} from "@/lib/attendance-alerts";
import { formatAttendanceSessionDate } from "@/lib/attendance-history";
import { getReportTrendCopy } from "@/lib/structured-report";
import {
  getTeamMembershipPlayer,
  type TeamPlayerMembership,
  type TeamRow,
} from "@/lib/team-management";

export type TeamSessionRow = {
  id: string;
  team_id: string | null;
  session_date: string;
  session_type: string | null;
  group_name: string | null;
};

export type TeamAttendanceRow = {
  session_id: string;
  player_id: string;
  status: PlayerAttendanceStatus;
  recorded_at: string;
};

export type TeamReportRow = {
  id: string;
  player_id: string;
  created_at: string;
};

export type SquadPlayerProfile = {
  id: string;
  player_name: string;
  preferred_foot: string | null;
  primary_position: string | null;
  parent_email: string | null;
};

export type TeamOverviewMetrics = {
  squadSize: number;
  captainName: string | null;
  viceCaptainName: string | null;
  captainPlayerId: string | null;
  viceCaptainPlayerId: string | null;
  firstPlayerId: string | null;
  nextSession: {
    id: string;
    sessionDate: string;
    label: string;
  } | null;
  attendanceRate: number;
  reportsThisSeason: number;
};

export type TeamAttendanceInsights = {
  presentRate: number;
  missedRate: number;
  playersNeedingAttention: Array<{
    playerId: string;
    playerName: string;
    rate: number;
    concerns: string[];
  }>;
  recentTrend: Array<{
    sessionId: string;
    sessionDate: string;
    sessionLabel: string;
    rate: number;
  }>;
};

export type TeamReportsInsights = {
  reportsThisMonth: number;
  reportsThisSeason: number;
  lastReportDate: string | null;
  playersWithoutReports: Array<{ playerId: string; playerName: string }>;
  trendCopy: string;
};

export type SquadPlayerCard = {
  membership: TeamPlayerMembership;
  playerId: string;
  playerName: string;
  primaryPosition: string | null;
  preferredFoot: string | null;
  parentEmail: string | null;
  attendanceRate: number;
  lastReportDate: string | null;
};

export type SquadSupportPlayer = {
  playerId: string;
  playerName: string;
  parentEmail: string | null;
  reasons: string[];
  attendanceRate: number;
  lastReportDate: string | null;
};

const REPORT_STALE_DAYS = 60;
const MAX_SUPPORT_PLAYERS = 5;

function getTeamPlayerIds(team: TeamRow): string[] {
  return (team.team_players ?? [])
    .map((membership) => membership.player_id)
    .filter(Boolean);
}

export function getSessionLabel(session: TeamSessionRow): string {
  if (session.group_name?.trim()) return session.group_name.trim();
  if (session.session_type?.trim()) return session.session_type.trim();
  return formatAttendanceSessionDate(session.session_date);
}

function monthKeyFromDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function isReportStale(lastReportDate: string | null, now = new Date()): boolean {
  if (!lastReportDate) return true;
  const parsed = new Date(lastReportDate);
  if (Number.isNaN(parsed.getTime())) return true;
  const diffMs = now.getTime() - parsed.getTime();
  return diffMs > REPORT_STALE_DAYS * 24 * 60 * 60 * 1000;
}

export function buildAttendanceByPlayer(
  rows: TeamAttendanceRow[],
): Map<string, AttendanceRecordRef[]> {
  const map = new Map<string, AttendanceRecordRef[]>();
  for (const row of rows) {
    const current = map.get(row.player_id) ?? [];
    current.push({ status: row.status, recorded_at: row.recorded_at });
    map.set(row.player_id, current);
  }
  return map;
}

export function buildReportsByPlayer(
  rows: TeamReportRow[],
): Map<string, Array<{ created_at: string }>> {
  const map = new Map<string, Array<{ created_at: string }>>();
  for (const row of rows) {
    const current = map.get(row.player_id) ?? [];
    current.push({ created_at: row.created_at });
    map.set(row.player_id, current);
  }
  for (const [playerId, reports] of map.entries()) {
    map.set(
      playerId,
      [...reports].sort(
        (left, right) =>
          new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
      ),
    );
  }
  return map;
}

export function buildTeamOverviewMetrics(args: {
  team: TeamRow;
  sessions: TeamSessionRow[];
  attendanceByPlayer: Map<string, AttendanceRecordRef[]>;
  reportsByPlayer: Map<string, Array<{ created_at: string }>>;
  now?: Date;
}): TeamOverviewMetrics {
  const { team, sessions, attendanceByPlayer, reportsByPlayer } = args;
  const now = args.now ?? new Date();
  const playerIds = getTeamPlayerIds(team);
  const memberships = team.team_players ?? [];

  const captain = memberships.find((membership) => membership.role === "captain");
  const viceCaptain = memberships.find(
    (membership) => membership.role === "vice_captain",
  );

  const teamSessions = sessions
    .filter((session) => session.team_id === team.id)
    .filter((session) => new Date(session.session_date) >= now)
    .sort(
      (left, right) =>
        new Date(left.session_date).getTime() - new Date(right.session_date).getTime(),
    );

  const nextSession = teamSessions[0] ?? null;

  const attendanceRecords = playerIds.flatMap(
    (playerId) => attendanceByPlayer.get(playerId) ?? [],
  );

  const seasonYear = String(now.getFullYear());
  const reportsThisSeason = playerIds.reduce((count, playerId) => {
    const reports = reportsByPlayer.get(playerId) ?? [];
    return (
      count +
      reports.filter((report) => report.created_at.startsWith(seasonYear)).length
    );
  }, 0);

  return {
    squadSize: playerIds.length,
    captainName: captain ? getTeamMembershipPlayer(captain)?.player_name ?? null : null,
    viceCaptainName: viceCaptain
      ? getTeamMembershipPlayer(viceCaptain)?.player_name ?? null
      : null,
    captainPlayerId: captain?.player_id ?? null,
    viceCaptainPlayerId: viceCaptain?.player_id ?? null,
    firstPlayerId: playerIds[0] ?? null,
    nextSession: nextSession
      ? {
          id: nextSession.id,
          sessionDate: nextSession.session_date,
          label: getSessionLabel(nextSession),
        }
      : null,
    attendanceRate: getAttendanceRate(attendanceRecords),
    reportsThisSeason,
  };
}

export function buildTeamAttendanceInsights(args: {
  team: TeamRow;
  sessions: TeamSessionRow[];
  attendanceRows: TeamAttendanceRow[];
  attendanceByPlayer: Map<string, AttendanceRecordRef[]>;
}): TeamAttendanceInsights {
  const playerIds = new Set(getTeamPlayerIds(args.team));
  const teamSessions = args.sessions
    .filter((session) => session.team_id === args.team.id)
    .sort(
      (left, right) =>
        new Date(right.session_date).getTime() - new Date(left.session_date).getTime(),
    )
    .slice(0, 6);

  const squadAttendance = args.attendanceRows.filter((row) =>
    playerIds.has(row.player_id),
  );
  const counted = squadAttendance.filter((row) => isCountedAttendanceStatus(row.status));
  const present = counted.filter((row) => isPositiveAttendanceStatus(row.status)).length;
  const missed = counted.filter((row) => isMissedAttendanceStatus(row.status)).length;
  const total = counted.length;

  const playersNeedingAttention: TeamAttendanceInsights["playersNeedingAttention"] = [];
  for (const membership of args.team.team_players ?? []) {
    const player = getTeamMembershipPlayer(membership);
    if (!player) continue;
    const records = args.attendanceByPlayer.get(membership.player_id) ?? [];
    const countedRecords = records.filter((record) =>
      isCountedAttendanceStatus(record.status),
    );
    if (countedRecords.length === 0) continue;

    const rate = getAttendanceRate(records);
    const concerns: string[] = [];
    if (hasConsecutiveAbsences(records)) {
      concerns.push("Three consecutive absences");
    }
    if (rate < ATTENDANCE_RISK_RATE_THRESHOLD) {
      concerns.push(`Attendance below ${ATTENDANCE_RISK_RATE_THRESHOLD}%`);
    }
    if (concerns.length === 0) continue;

    playersNeedingAttention.push({
      playerId: membership.player_id,
      playerName: player.player_name,
      rate,
      concerns,
    });
  }

  const recentTrend = teamSessions
    .map((session) => {
      const sessionAttendance = squadAttendance.filter(
        (row) => row.session_id === session.id,
      );
      const countedSession = sessionAttendance.filter((row) =>
        isCountedAttendanceStatus(row.status),
      );
      return {
        sessionId: session.id,
        sessionDate: session.session_date,
        sessionLabel: getSessionLabel(session),
        rate: getAttendanceRate(countedSession),
      };
    })
    .filter((entry) => entry.rate > 0 || squadAttendance.some((row) => row.session_id === entry.sessionId));

  return {
    presentRate: total > 0 ? (present / total) * 100 : 0,
    missedRate: total > 0 ? (missed / total) * 100 : 0,
    playersNeedingAttention: playersNeedingAttention
      .sort((left, right) => left.rate - right.rate)
      .slice(0, 5),
    recentTrend,
  };
}

export function buildTeamReportsInsights(args: {
  team: TeamRow;
  reportsByPlayer: Map<string, Array<{ created_at: string }>>;
  now?: Date;
}): TeamReportsInsights {
  const now = args.now ?? new Date();
  const monthKey = monthKeyFromDate(now);
  const seasonYear = String(now.getFullYear());

  let reportsThisMonth = 0;
  let reportsThisSeason = 0;
  let lastReportDate: string | null = null;
  const playersWithoutReports: Array<{ playerId: string; playerName: string }> = [];

  for (const membership of args.team.team_players ?? []) {
    const player = getTeamMembershipPlayer(membership);
    if (!player) continue;

    const reports = args.reportsByPlayer.get(membership.player_id) ?? [];
    if (reports.length === 0) {
      playersWithoutReports.push({
        playerId: membership.player_id,
        playerName: player.player_name,
      });
      continue;
    }

    const latest = reports[0]?.created_at ?? null;
    if (latest && (!lastReportDate || new Date(latest) > new Date(lastReportDate))) {
      lastReportDate = latest;
    }

    for (const report of reports) {
      if (monthKeyFromDate(report.created_at) === monthKey) reportsThisMonth += 1;
      if (report.created_at.startsWith(seasonYear)) reportsThisSeason += 1;
    }
  }

  return {
    reportsThisMonth,
    reportsThisSeason,
    lastReportDate,
    playersWithoutReports,
    trendCopy: getReportTrendCopy(reportsThisSeason),
  };
}

export function buildSquadPlayerCards(args: {
  memberships: TeamPlayerMembership[];
  attendanceByPlayer: Map<string, AttendanceRecordRef[]>;
  reportsByPlayer: Map<string, Array<{ created_at: string }>>;
}): SquadPlayerCard[] {
  return args.memberships.map((membership) => {
    const player = getTeamMembershipPlayer(membership);
    const records = args.attendanceByPlayer.get(membership.player_id) ?? [];
    const reports = args.reportsByPlayer.get(membership.player_id) ?? [];

    return {
      membership,
      playerId: membership.player_id,
      playerName: player?.player_name ?? "Unknown player",
      primaryPosition: player?.primary_position ?? null,
      preferredFoot: player?.preferred_foot ?? null,
      parentEmail: null,
      attendanceRate: getAttendanceRate(records),
      lastReportDate: reports[0]?.created_at ?? null,
    };
  });
}

export function buildSquadSupportPlayers(args: {
  team: TeamRow;
  attendanceByPlayer: Map<string, AttendanceRecordRef[]>;
  reportsByPlayer: Map<string, Array<{ created_at: string }>>;
  parentEmailByPlayerId?: Map<string, string | null>;
  now?: Date;
}): SquadSupportPlayer[] {
  const now = args.now ?? new Date();
  const support: SquadSupportPlayer[] = [];

  for (const membership of args.team.team_players ?? []) {
    const player = getTeamMembershipPlayer(membership);
    if (!player) continue;

    const records = args.attendanceByPlayer.get(membership.player_id) ?? [];
    const counted = records.filter((record) => isCountedAttendanceStatus(record.status));
    const rate = getAttendanceRate(records);
    const reports = args.reportsByPlayer.get(membership.player_id) ?? [];
    const lastReportDate = reports[0]?.created_at ?? null;
    const reasons: string[] = [];

    if (counted.length > 0 && rate < ATTENDANCE_RISK_RATE_THRESHOLD) {
      reasons.push(`Attendance below ${ATTENDANCE_RISK_RATE_THRESHOLD}%`);
    }
    if (hasConsecutiveAbsences(records)) {
      reasons.push("Three consecutive absences");
    }
    if (isReportStale(lastReportDate, now)) {
      reasons.push("No report in the last 60 days");
    }

    if (reasons.length === 0) continue;

    support.push({
      playerId: membership.player_id,
      playerName: player.player_name,
      parentEmail: args.parentEmailByPlayerId?.get(membership.player_id) ?? null,
      reasons,
      attendanceRate: rate,
      lastReportDate,
    });
  }

  return support
    .sort((left, right) => {
      const leftPriority =
        (left.reasons.some((reason) => reason.includes("absences")) ? 2 : 0) +
        (left.attendanceRate < ATTENDANCE_RISK_RATE_THRESHOLD ? 1 : 0);
      const rightPriority =
        (right.reasons.some((reason) => reason.includes("absences")) ? 2 : 0) +
        (right.attendanceRate < ATTENDANCE_RISK_RATE_THRESHOLD ? 1 : 0);
      if (rightPriority !== leftPriority) return rightPriority - leftPriority;
      return left.attendanceRate - right.attendanceRate;
    })
    .slice(0, MAX_SUPPORT_PLAYERS);
}

export function formatTeamInsightDate(value: string | null): string {
  if (!value) return "Not yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
  }).format(parsed);
}

export function formatNextSessionLabel(
  session: TeamOverviewMetrics["nextSession"],
): string {
  if (!session) return "No upcoming session";
  return `${session.label} · ${formatAttendanceSessionDate(session.sessionDate)}`;
}
