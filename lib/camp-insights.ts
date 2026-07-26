import {
  getAttendanceRate,
  getAttendanceSummary,
  isCountedAttendanceStatus,
  type PlayerAttendanceStatus,
} from "@/lib/attendance";
import {
  ATTENDANCE_RISK_RATE_THRESHOLD,
  hasConsecutiveAbsences,
  type AttendanceRecordRef,
} from "@/lib/attendance-alerts";
import { buildAttendanceByPlayer, isReportStale } from "@/lib/team-insights";
import { getPlayerTeams, getTeamDisplayName, type TeamSummary } from "@/lib/team-management";

export type CampRow = {
  id: string;
  coach_id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  age_group: string | null;
  capacity: number;
  price: number;
  location: string | null;
  notes: string | null;
  created_at: string;
  website_visible?: boolean;
};

export type CampEnrolmentRow = {
  id: string;
  camp_id: string;
  status: "enrolled" | "waitlist";
  created_at: string;
};

export type CampSessionRow = {
  id: string;
  session_date: string;
  group_name: string | null;
  session_type: string | null;
  session_players?: { player_id: string }[] | null;
};

export type CampBookingRow = {
  id: string;
  session_id: string;
  player_id: string;
  booking_status: string;
  payment_status: string | null;
  amount: number | null;
  created_at: string;
};

export type CampAttendanceRow = {
  session_id: string;
  player_id: string;
  status: PlayerAttendanceStatus;
  recorded_at: string;
};

export type CampReportRow = {
  id: string;
  player_id: string;
  created_at: string;
};

export type CampPlayerSource = {
  id: string;
  player_name: string;
  primary_position: string | null;
  parent_email: string | null;
  team_players?: { team?: TeamSummary[] | TeamSummary | null }[] | null;
};

export type CampWithStats = CampRow & {
  enrolled: number;
  waitlist: number;
  remaining: number;
  revenue: number;
};

export type CampOverviewMetrics = {
  spacesFilled: number;
  revenue: number;
  playersBooked: number;
  waitlistCount: number;
  incomeReceived: number;
};

export type CampAttendeeCard = {
  playerId: string;
  playerName: string;
  teamLabel: string;
  primaryPosition: string | null;
  attendanceRate: number;
  parentEmail: string | null;
  lastReportDate: string | null;
};

export type CampAttendanceSummary = {
  present: number;
  absent: number;
  late: number;
  registerMarked: number;
  registerTotal: number;
  registerComplete: boolean;
  averageRate: number;
  primarySessionId: string | null;
};

export type CampInsightLeader = {
  playerId: string;
  playerName: string;
  attendanceRate: number;
  lastReportDate: string | null;
  excellentAttendance: boolean;
};

export type CampInsightConcern = {
  playerId: string;
  playerName: string;
  label: string;
};

export type CampActivityItem =
  | {
      type: "booking";
      id: string;
      created_at: string;
      title: string;
      body: string;
    }
  | {
      type: "attendance_concern";
      id: string;
      created_at: string;
      title: string;
      body: string;
    }
  | {
      type: "report";
      id: string;
      created_at: string;
      title: string;
      body: string;
    };

const MAX_TIMELINE = 10;
const MAX_INSIGHT_LIST = 5;
const EXCELLENT_ATTENDANCE = 85;

export function parseCampPrice(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function aggregateCampEnrolments(
  camps: CampRow[],
  rows: Array<{ camp_id: string; status: string }> | null,
): CampWithStats[] {
  const byCamp = new Map<string, { enrolled: number; waitlist: number }>();
  for (const camp of camps) {
    byCamp.set(camp.id, { enrolled: 0, waitlist: 0 });
  }
  for (const row of rows ?? []) {
    const current = byCamp.get(row.camp_id);
    if (!current) continue;
    if (row.status === "enrolled") current.enrolled += 1;
    else if (row.status === "waitlist") current.waitlist += 1;
  }
  return camps.map((camp) => {
    const { enrolled, waitlist } = byCamp.get(camp.id) ?? { enrolled: 0, waitlist: 0 };
    const remaining = Math.max(0, camp.capacity - enrolled);
    const price = parseCampPrice(camp.price);
    return {
      ...camp,
      enrolled,
      waitlist,
      remaining,
      revenue: price * enrolled,
    };
  });
}

export function isSessionLinkedToCamp(
  session: Pick<CampSessionRow, "session_date" | "group_name" | "session_type">,
  camp: Pick<CampRow, "start_date" | "end_date" | "name">,
): boolean {
  const sessionDate = new Date(`${session.session_date}T12:00:00`);
  const start = new Date(`${camp.start_date}T12:00:00`);
  const end = new Date(`${camp.end_date}T12:00:00`);
  if (Number.isNaN(sessionDate.getTime()) || sessionDate < start || sessionDate > end) {
    return false;
  }

  const campName = camp.name.trim().toLowerCase();
  if (!campName) return false;

  const groupName = (session.group_name ?? "").trim().toLowerCase();
  const sessionType = (session.session_type ?? "").trim().toLowerCase();

  if (groupName === campName) return true;
  if (groupName.includes(campName) || campName.includes(groupName)) return true;
  if (sessionType.includes("camp")) return true;
  return false;
}

export function getCampLinkedSessions(
  camp: CampRow,
  sessions: CampSessionRow[],
): CampSessionRow[] {
  return sessions
    .filter((session) => isSessionLinkedToCamp(session, camp))
    .sort(
      (left, right) =>
        new Date(right.session_date).getTime() - new Date(left.session_date).getTime(),
    );
}

export function getCampPlayerIds(args: {
  linkedSessions: CampSessionRow[];
  bookings: CampBookingRow[];
}): string[] {
  const ids = new Set<string>();

  for (const session of args.linkedSessions) {
    for (const link of session.session_players ?? []) {
      ids.add(link.player_id);
    }
  }

  const sessionIds = new Set(args.linkedSessions.map((session) => session.id));
  for (const booking of args.bookings) {
    if (!sessionIds.has(booking.session_id)) continue;
    if (booking.booking_status === "confirmed" || booking.booking_status === "pending") {
      ids.add(booking.player_id);
    }
  }

  return [...ids];
}

export function buildCampOverviewMetrics(
  camp: CampWithStats,
  paidBookingIncome = 0,
): CampOverviewMetrics {
  const incomeReceived = camp.revenue + paidBookingIncome;
  return {
    spacesFilled: camp.enrolled,
    revenue: camp.revenue,
    playersBooked: camp.enrolled,
    waitlistCount: camp.waitlist,
    incomeReceived,
  };
}

export function buildCampIncomeSummary(args: {
  camp: CampWithStats;
  paidBookingIncome: number;
  averageAttendanceRate: number;
}): {
  incomeReceived: number;
  spacesFilled: number;
  averageAttendance: number;
  familiesWaiting: number;
  summaryCopy: string;
} {
  const incomeReceived = args.camp.revenue + args.paidBookingIncome;
  const summaryCopy =
    args.camp.enrolled > 0
      ? `${args.camp.enrolled} space${args.camp.enrolled === 1 ? "" : "s"} filled with ${formatCampCurrency(incomeReceived)} estimated income.`
      : "Share your booking page to start filling camp spaces.";

  return {
    incomeReceived,
    spacesFilled: args.camp.enrolled,
    averageAttendance: args.averageAttendanceRate,
    familiesWaiting: args.camp.waitlist,
    summaryCopy,
  };
}

export function buildCampAttendanceSummary(args: {
  linkedSessions: CampSessionRow[];
  attendanceRows: CampAttendanceRow[];
  playerIds: string[];
}): CampAttendanceSummary {
  const sessionIds = new Set(args.linkedSessions.map((session) => session.id));
  const playerIds = new Set(args.playerIds);
  const relevant = args.attendanceRows.filter(
    (row) => sessionIds.has(row.session_id) && playerIds.has(row.player_id),
  );

  const summary = getAttendanceSummary(relevant);
  const averageRate = getAttendanceRate(relevant);

  let registerMarked = 0;
  let registerTotal = 0;

  for (const session of args.linkedSessions) {
    const rosterIds = new Set<string>();
    for (const link of session.session_players ?? []) {
      rosterIds.add(link.player_id);
    }
    for (const row of relevant) {
      if (row.session_id === session.id) rosterIds.add(row.player_id);
    }
    for (const playerId of args.playerIds) {
      rosterIds.add(playerId);
    }

    const markedForSession = new Set(
      relevant
        .filter((row) => row.session_id === session.id)
        .map((row) => row.player_id),
    ).size;

    registerTotal += rosterIds.size;
    registerMarked += markedForSession;
  }

  const primarySession =
    args.linkedSessions.find((session) =>
      args.attendanceRows.some((row) => row.session_id === session.id),
    ) ?? args.linkedSessions[0] ?? null;

  return {
    present: summary.present,
    absent: summary.absent,
    late: summary.late,
    registerMarked,
    registerTotal,
    registerComplete: registerTotal > 0 && registerMarked >= registerTotal,
    averageRate,
    primarySessionId: primarySession?.id ?? null,
  };
}

export function buildCampAttendeeCards(args: {
  playerIds: string[];
  players: CampPlayerSource[];
  attendanceByPlayer: Map<string, AttendanceRecordRef[]>;
  reportsByPlayer: Map<string, Array<{ created_at: string }>>;
}): CampAttendeeCard[] {
  const playerById = new Map(args.players.map((player) => [player.id, player]));

  return args.playerIds
    .flatMap((playerId) => {
      const player = playerById.get(playerId);
      if (!player) return [];

      const teams = getPlayerTeams(player.team_players);
      const reports = args.reportsByPlayer.get(playerId) ?? [];
      const card: CampAttendeeCard = {
        playerId,
        playerName: player.player_name,
        teamLabel:
          teams.length > 0
            ? teams.map((team) => getTeamDisplayName(team)).join(", ")
            : "No team assigned",
        primaryPosition: player.primary_position,
        attendanceRate: getAttendanceRate(args.attendanceByPlayer.get(playerId) ?? []),
        parentEmail: player.parent_email,
        lastReportDate: reports[0]?.created_at ?? null,
      };

      return [card];
    })
    .sort((left, right) => left.playerName.localeCompare(right.playerName, "en-GB"));
}

export function buildCampInsightLeaders(cards: CampAttendeeCard[]): CampInsightLeader[] {
  return [...cards]
    .filter((card) => card.attendanceRate > 0)
    .sort((left, right) => right.attendanceRate - left.attendanceRate)
    .slice(0, MAX_INSIGHT_LIST)
    .map((card) => ({
      playerId: card.playerId,
      playerName: card.playerName,
      attendanceRate: card.attendanceRate,
      lastReportDate: card.lastReportDate,
      excellentAttendance: card.attendanceRate >= EXCELLENT_ATTENDANCE,
    }));
}

export function buildCampMissingReportPlayers(
  cards: CampAttendeeCard[],
  now = new Date(),
): CampAttendeeCard[] {
  return cards
    .filter((card) => isReportStale(card.lastReportDate, now))
    .slice(0, MAX_INSIGHT_LIST);
}

export function buildCampAttendanceConcerns(args: {
  cards: CampAttendeeCard[];
  attendanceByPlayer: Map<string, AttendanceRecordRef[]>;
}): CampInsightConcern[] {
  const concerns: CampInsightConcern[] = [];

  for (const card of args.cards) {
    const records = args.attendanceByPlayer.get(card.playerId) ?? [];
    const counted = records.filter((record) => isCountedAttendanceStatus(record.status));
    if (counted.length === 0) continue;

    if (hasConsecutiveAbsences(records)) {
      concerns.push({
        playerId: card.playerId,
        playerName: card.playerName,
        label: "Three consecutive absences",
      });
      continue;
    }

    if (card.attendanceRate < ATTENDANCE_RISK_RATE_THRESHOLD) {
      concerns.push({
        playerId: card.playerId,
        playerName: card.playerName,
        label: `Attendance below ${ATTENDANCE_RISK_RATE_THRESHOLD}%`,
      });
    }
  }

  return concerns.slice(0, MAX_INSIGHT_LIST);
}

export function buildCampLateArrivals(args: {
  cards: CampAttendeeCard[];
  attendanceRows: CampAttendanceRow[];
  linkedSessionIds: Set<string>;
}): CampInsightConcern[] {
  const lateCounts = new Map<string, number>();
  for (const row of args.attendanceRows) {
    if (!args.linkedSessionIds.has(row.session_id) || row.status !== "late") continue;
    lateCounts.set(row.player_id, (lateCounts.get(row.player_id) ?? 0) + 1);
  }

  return args.cards
    .filter((card) => (lateCounts.get(card.playerId) ?? 0) > 0)
    .map((card) => ({
      playerId: card.playerId,
      playerName: card.playerName,
      label: `${lateCounts.get(card.playerId)} late arrival${(lateCounts.get(card.playerId) ?? 0) === 1 ? "" : "s"}`,
    }))
    .slice(0, MAX_INSIGHT_LIST);
}

export function buildCampActivityTimeline(args: {
  camp: CampRow;
  enrolments: CampEnrolmentRow[];
  bookings: CampBookingRow[];
  linkedSessionIds: Set<string>;
  attendanceRows: CampAttendanceRow[];
  reports: CampReportRow[];
  playerNameById: Map<string, string>;
}): CampActivityItem[] {
  const items: CampActivityItem[] = [];

  for (const enrolment of args.enrolments) {
    if (enrolment.camp_id !== args.camp.id) continue;
    items.push({
      type: "booking",
      id: enrolment.id,
      created_at: enrolment.created_at,
      title: enrolment.status === "waitlist" ? "Added to waitlist" : "Camp booking confirmed",
      body:
        enrolment.status === "waitlist"
          ? "A family joined the camp waitlist."
          : "A camp place was confirmed.",
    });
  }

  for (const booking of args.bookings) {
    if (!args.linkedSessionIds.has(booking.session_id)) continue;
    if (booking.booking_status !== "confirmed") continue;
    const playerName = args.playerNameById.get(booking.player_id) ?? "Player";
    items.push({
      type: "booking",
      id: booking.id,
      created_at: booking.created_at,
      title: "Session booking confirmed",
      body: `${playerName} booked onto a linked camp session.`,
    });
  }

  for (const report of args.reports) {
    const playerName = args.playerNameById.get(report.player_id);
    if (!playerName) continue;
    items.push({
      type: "report",
      id: report.id,
      created_at: report.created_at,
      title: "Report created",
      body: `Progress report created for ${playerName}.`,
    });
  }

  for (const row of args.attendanceRows) {
    if (!args.linkedSessionIds.has(row.session_id)) continue;
    if (row.status !== "absent" && row.status !== "late" && row.status !== "injured") continue;
    const playerName = args.playerNameById.get(row.player_id) ?? "Player";
    const label =
      row.status === "injured"
        ? "Injury recorded"
        : row.status === "late"
          ? "Late arrival"
          : "Attendance concern";
    items.push({
      type: "attendance_concern",
      id: `${row.session_id}:${row.player_id}:${row.status}:${row.recorded_at}`,
      created_at: row.recorded_at,
      title: label,
      body: `${playerName} marked ${row.status} for a camp session.`,
    });
  }

  return items
    .sort(
      (left, right) =>
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    )
    .slice(0, MAX_TIMELINE);
}

export function buildCampHubSummaryCopy(args: {
  camp: CampWithStats;
  attendanceRate: number;
  attendeeCount: number;
  concernCount: number;
  missingReportCount: number;
}): string {
  if (args.camp.enrolled === 0 && args.attendeeCount === 0) {
    return "Share your booking page to start taking camp bookings.";
  }
  if (args.concernCount > 0 || args.missingReportCount > 0) {
    const parts: string[] = [];
    if (args.concernCount > 0) {
      parts.push(
        `${args.concernCount} player${args.concernCount === 1 ? "" : "s"} may need attendance follow-up`,
      );
    }
    if (args.missingReportCount > 0) {
      parts.push(
        `${args.missingReportCount} attendee${args.missingReportCount === 1 ? "" : "s"} without a recent report`,
      );
    }
    return `${parts.join(" and ")}.`;
  }
  if (args.attendanceRate >= 75) {
    return `Attendance has been strong across linked camp sessions with ${args.camp.enrolled} confirmed booking${args.camp.enrolled === 1 ? "" : "s"}.`;
  }
  return `Camp is underway with ${args.attendeeCount || args.camp.enrolled} player${(args.attendeeCount || args.camp.enrolled) === 1 ? "" : "s"} involved.`;
}

export function sumPaidCampBookingIncome(
  bookings: CampBookingRow[],
  linkedSessionIds: Set<string>,
): number {
  let total = 0;
  for (const booking of bookings) {
    if (!linkedSessionIds.has(booking.session_id)) continue;
    if (booking.payment_status !== "paid") continue;
    total += (booking.amount ?? 0) / 100;
  }
  return total;
}

export function formatCampCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

export function formatCampDateRange(start: string, end: string): string {
  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return `${start} – ${end}`;
  }
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${formatter.format(startDate)} – ${formatter.format(endDate)}`;
}

export function filterCampAttendanceRows(
  rows: CampAttendanceRow[],
  linkedSessionIds: Set<string>,
  playerIds: Set<string>,
): CampAttendanceRow[] {
  return rows.filter(
    (row) => linkedSessionIds.has(row.session_id) && playerIds.has(row.player_id),
  );
}

export function buildCampReportsByPlayer(
  reports: CampReportRow[],
): Map<string, Array<{ created_at: string }>> {
  const map = new Map<string, Array<{ created_at: string }>>();
  for (const report of reports) {
    const current = map.get(report.player_id) ?? [];
    current.push({ created_at: report.created_at });
    map.set(report.player_id, current);
  }
  for (const [playerId, playerReports] of map.entries()) {
    map.set(
      playerId,
      [...playerReports].sort(
        (left, right) =>
          new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
      ),
    );
  }
  return map;
}

export { buildAttendanceByPlayer, isReportStale };