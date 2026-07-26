import { getAttendanceLabel, type PlayerAttendanceStatus } from "@/lib/attendance";
import {
  ATTENDANCE_RISK_RATE_THRESHOLD,
  hasConsecutiveAbsences,
  type AttendanceRecordRef,
} from "@/lib/attendance-alerts";
import { formatAttendanceSessionDate } from "@/lib/attendance-history";
import {
  buildSquadSupportPlayers,
  formatTeamInsightDate,
  getSessionLabel,
  isReportStale,
  type SquadPlayerCard,
  type SquadSupportPlayer,
  type TeamAttendanceInsights,
  type TeamAttendanceRow,
  type TeamOverviewMetrics,
  type TeamReportRow,
  type TeamReportsInsights,
  type TeamSessionRow,
} from "@/lib/team-insights";
import { type TeamRow } from "@/lib/team-management";

export type AttendanceTrendDirection = "improving" | "stable" | "declining";

export type TeamFormLevel = "strong" | "steady" | "needs_attention";

export type SupportCategory =
  | "attendance_concern"
  | "development_follow_up"
  | "no_recent_report";

export type TeamSeasonOverview = {
  squadSize: number;
  attendanceRate: number;
  reportsThisSeason: number;
  upcomingSessions: number;
  playersNeedingSupport: number;
  summaryCopy: string;
  teamSummaryCopy: string;
};

export type TeamAttendanceTrend = {
  direction: AttendanceTrendDirection;
  directionLabel: string;
  trendCopy: string;
  sessions: Array<{
    sessionId: string;
    sessionLabel: string;
    sessionDate: string;
    rate: number;
    direction: AttendanceTrendDirection | null;
  }>;
};

export type TeamFormIndicators = {
  present: number;
  late: number;
  absent: number;
  level: TeamFormLevel;
  levelLabel: string;
};

export type MissingReportPlayer = {
  playerId: string;
  playerName: string;
  primaryPosition: string | null;
  attendanceRate: number;
};

export type AttendanceLeader = {
  playerId: string;
  playerName: string;
  attendanceRate: number;
  lastReportDate: string | null;
  excellentAttendance: boolean;
};

export type CategorizedSupportPlayer = SquadSupportPlayer & {
  categories: SupportCategory[];
  categoryLabels: string[];
};

export type TeamActivityTimelineItem =
  | {
      type: "report";
      id: string;
      created_at: string;
      playerName: string;
      body: string;
    }
  | {
      type: "attendance_concern";
      id: string;
      created_at: string;
      playerName: string;
      body: string;
      status: Extract<PlayerAttendanceStatus, "absent" | "late">;
    }
  | {
      type: "injury";
      id: string;
      created_at: string;
      playerName: string;
      body: string;
    };

const TREND_THRESHOLD = 5;
const EXCELLENT_ATTENDANCE_THRESHOLD = 85;
const MAX_TIMELINE_EVENTS = 10;
const MAX_MISSING_REPORTS = 5;
const MAX_LEADERS = 5;

function getSupportCategoryLabel(category: SupportCategory): string {
  if (category === "attendance_concern") return "Attendance concern";
  if (category === "development_follow_up") return "Development follow-up";
  return "No recent report";
}

function getTrendDirectionLabel(direction: AttendanceTrendDirection): string {
  if (direction === "improving") return "Improving";
  if (direction === "declining") return "Declining";
  return "Stable";
}

function getFormLevelLabel(level: TeamFormLevel): string {
  if (level === "strong") return "Strong";
  if (level === "steady") return "Steady";
  return "Needs attention";
}

function compareSessionTrend(rates: number[]): AttendanceTrendDirection {
  if (rates.length < 2) return "stable";

  const midpoint = Math.floor(rates.length / 2);
  const earlier = rates.slice(0, midpoint);
  const recent = rates.slice(midpoint);
  if (earlier.length === 0 || recent.length === 0) return "stable";

  const earlierAvg = earlier.reduce((sum, rate) => sum + rate, 0) / earlier.length;
  const recentAvg = recent.reduce((sum, rate) => sum + rate, 0) / recent.length;
  const delta = recentAvg - earlierAvg;

  if (delta >= TREND_THRESHOLD) return "improving";
  if (delta <= -TREND_THRESHOLD) return "declining";
  return "stable";
}

function getAttendanceTrendCopy(direction: AttendanceTrendDirection): string {
  if (direction === "improving") {
    return "Attendance has improved over recent sessions.";
  }
  if (direction === "declining") {
    return "Attendance has dipped over recent sessions.";
  }
  return "Attendance has been steady over recent sessions.";
}

function categorizeSupportPlayer(args: {
  attendanceRate: number;
  records: AttendanceRecordRef[];
  lastReportDate: string | null;
  now: Date;
}): SupportCategory[] {
  const categories: SupportCategory[] = [];
  const counted = args.records.filter(
    (record) =>
      record.status === "present" ||
      record.status === "late" ||
      record.status === "absent",
  );

  if (
    (counted.length > 0 && args.attendanceRate < ATTENDANCE_RISK_RATE_THRESHOLD) ||
    hasConsecutiveAbsences(args.records)
  ) {
    categories.push("attendance_concern");
  }

  if (isReportStale(args.lastReportDate, args.now)) {
    categories.push("no_recent_report");
    if (
      counted.length > 0 &&
      args.attendanceRate >= ATTENDANCE_RISK_RATE_THRESHOLD &&
      !hasConsecutiveAbsences(args.records)
    ) {
      categories.push("development_follow_up");
    }
  }

  return categories;
}

export function buildTeamSeasonOverview(args: {
  overview: TeamOverviewMetrics;
  reports: TeamReportsInsights;
  upcomingSessionCount: number;
  supportCount: number;
}): TeamSeasonOverview {
  const { overview, reports, upcomingSessionCount, supportCount } = args;
  const squadLabel =
    overview.squadSize === 1 ? "1 player" : `${overview.squadSize} players`;
  const attendanceLabel =
    overview.squadSize > 0 ? `${Math.round(overview.attendanceRate)}% attendance` : "no attendance data yet";

  const summaryCopy =
    overview.squadSize > 0
      ? `${squadLabel} with ${attendanceLabel} this season.`
      : "Add players to build your squad.";

  let teamSummaryCopy = summaryCopy;
  if (overview.squadSize > 0) {
    if (supportCount > 0) {
      const playerLabel = supportCount === 1 ? "One player may" : `${supportCount} players may`;
      teamSummaryCopy = `${playerLabel} benefit from additional support.`;
    } else if (reports.reportsThisSeason > 0) {
      const reportLabel =
        reports.reportsThisSeason === 1
          ? "1 report has"
          : `${reports.reportsThisSeason} reports have`;
      teamSummaryCopy = `Attendance has been steady and ${reportLabel} been created this season.`;
    } else {
      teamSummaryCopy = "Attendance has been steady. Create your first player report to track development.";
    }
  }

  return {
    squadSize: overview.squadSize,
    attendanceRate: overview.attendanceRate,
    reportsThisSeason: reports.reportsThisSeason,
    upcomingSessions: upcomingSessionCount,
    playersNeedingSupport: supportCount,
    summaryCopy,
    teamSummaryCopy,
  };
}

export function buildTeamAttendanceTrend(
  attendance: TeamAttendanceInsights,
): TeamAttendanceTrend {
  const chronological = [...attendance.recentTrend].reverse();
  const rates = chronological.map((entry) => entry.rate);
  const direction = compareSessionTrend(rates);

  return {
    direction,
    directionLabel: getTrendDirectionLabel(direction),
    trendCopy: getAttendanceTrendCopy(direction),
    sessions: chronological.map((entry, index) => {
      const priorRates = rates.slice(0, index + 1);
      const sessionDirection =
        priorRates.length >= 2 ? compareSessionTrend(priorRates) : null;
      return {
        sessionId: entry.sessionId,
        sessionLabel: entry.sessionLabel,
        sessionDate: entry.sessionDate,
        rate: entry.rate,
        direction: sessionDirection,
      };
    }),
  };
}

export function buildTeamFormIndicators(args: {
  team: TeamRow;
  sessions: TeamSessionRow[];
  attendanceRows: TeamAttendanceRow[];
  attendanceRate: number;
  trendDirection: AttendanceTrendDirection;
}): TeamFormIndicators {
  const playerIds = new Set(
    (args.team.team_players ?? []).map((membership) => membership.player_id),
  );
  const sessionIds = new Set(
    args.sessions
      .filter((session) => session.team_id === args.team.id)
      .sort(
        (left, right) =>
          new Date(right.session_date).getTime() - new Date(left.session_date).getTime(),
      )
      .slice(0, 6)
      .map((session) => session.id),
  );

  let present = 0;
  let late = 0;
  let absent = 0;

  for (const row of args.attendanceRows) {
    if (!playerIds.has(row.player_id) || !sessionIds.has(row.session_id)) continue;
    if (row.status === "present") present += 1;
    if (row.status === "late") late += 1;
    if (row.status === "absent") absent += 1;
  }

  let level: TeamFormLevel = "steady";
  if (
    args.attendanceRate >= 80 &&
    args.trendDirection !== "declining"
  ) {
    level = "strong";
  } else if (
    args.attendanceRate < ATTENDANCE_RISK_RATE_THRESHOLD ||
    args.trendDirection === "declining"
  ) {
    level = "needs_attention";
  }

  return {
    present,
    late,
    absent,
    level,
    levelLabel: getFormLevelLabel(level),
  };
}

export function buildMissingReportPlayers(args: {
  squadCards: SquadPlayerCard[];
  now?: Date;
}): MissingReportPlayer[] {
  const now = args.now ?? new Date();

  return args.squadCards
    .filter((card) => isReportStale(card.lastReportDate, now))
    .sort((left, right) => left.attendanceRate - right.attendanceRate)
    .slice(0, MAX_MISSING_REPORTS)
    .map((card) => ({
      playerId: card.playerId,
      playerName: card.playerName,
      primaryPosition: card.primaryPosition,
      attendanceRate: card.attendanceRate,
    }));
}

export function buildAttendanceLeaders(squadCards: SquadPlayerCard[]): AttendanceLeader[] {
  return [...squadCards]
    .filter((card) => card.attendanceRate > 0)
    .sort((left, right) => right.attendanceRate - left.attendanceRate)
    .slice(0, MAX_LEADERS)
    .map((card) => ({
      playerId: card.playerId,
      playerName: card.playerName,
      attendanceRate: card.attendanceRate,
      lastReportDate: card.lastReportDate,
      excellentAttendance: card.attendanceRate >= EXCELLENT_ATTENDANCE_THRESHOLD,
    }));
}

export function buildCategorizedSupportPlayers(args: {
  team: TeamRow;
  attendanceByPlayer: Map<string, AttendanceRecordRef[]>;
  reportsByPlayer: Map<string, Array<{ created_at: string }>>;
  parentEmailByPlayerId?: Map<string, string | null>;
  now?: Date;
}): CategorizedSupportPlayer[] {
  const base = buildSquadSupportPlayers(args);

  return base.map((player) => {
    const records = args.attendanceByPlayer.get(player.playerId) ?? [];
    const reports = args.reportsByPlayer.get(player.playerId) ?? [];
    const categories = categorizeSupportPlayer({
      attendanceRate: player.attendanceRate,
      records,
      lastReportDate: reports[0]?.created_at ?? null,
      now: args.now ?? new Date(),
    });

    return {
      ...player,
      categories,
      categoryLabels: categories.map(getSupportCategoryLabel),
    };
  });
}

export function buildTeamActivityTimeline(args: {
  team: TeamRow;
  sessions: TeamSessionRow[];
  attendanceRows: TeamAttendanceRow[];
  reportRows: Array<TeamReportRow & { id: string }>;
  playerNameById: Map<string, string>;
}): TeamActivityTimelineItem[] {
  const playerIds = new Set(
    (args.team.team_players ?? []).map((membership) => membership.player_id),
  );
  const sessionById = new Map(
    args.sessions
      .filter((session) => session.team_id === args.team.id)
      .map((session) => [session.id, session]),
  );

  const items: TeamActivityTimelineItem[] = [];

  for (const report of args.reportRows) {
    if (!playerIds.has(report.player_id)) continue;
    items.push({
      type: "report",
      id: report.id,
      created_at: report.created_at,
      playerName: args.playerNameById.get(report.player_id) ?? "Player",
      body: "Progress report created",
    });
  }

  for (const row of args.attendanceRows) {
    if (!playerIds.has(row.player_id)) continue;
    const session = sessionById.get(row.session_id);
    const playerName = args.playerNameById.get(row.player_id) ?? "Player";
    const sessionLabel = session ? getSessionLabel(session) : "Session";

    if (row.status === "injured") {
      items.push({
        type: "injury",
        id: `${row.session_id}:${row.player_id}:injured:${row.recorded_at}`,
        created_at: row.recorded_at,
        playerName,
        body: `Injury recorded for ${sessionLabel}.`,
      });
      continue;
    }

    if (row.status === "absent" || row.status === "late") {
      items.push({
        type: "attendance_concern",
        id: `${row.session_id}:${row.player_id}:${row.status}:${row.recorded_at}`,
        created_at: row.recorded_at,
        playerName,
        body: `${getAttendanceLabel(row.status)} for ${sessionLabel}.`,
        status: row.status,
      });
    }
  }

  return items
    .sort(
      (left, right) =>
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    )
    .slice(0, MAX_TIMELINE_EVENTS);
}

export function formatSeasonTimelineDate(value: string | null): string {
  return formatTeamInsightDate(value);
}

export function formatSessionTrendDate(value: string): string {
  return formatAttendanceSessionDate(value);
}

export { getSupportCategoryLabel, getTrendDirectionLabel, getFormLevelLabel };
