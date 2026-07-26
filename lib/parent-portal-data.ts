import "server-only";

import {
  getAttendanceLabel,
  getAttendanceRate,
  getAttendanceSummary,
} from "@/lib/attendance";
import {
  getAttendanceSessionName,
  parsePlayerAttendanceHistory,
  unwrapAttendanceSession,
  type AttendanceHistoryRow,
} from "@/lib/attendance-history";
import {
  getCampLinkedSessions,
  type CampRow,
  type CampSessionRow,
} from "@/lib/camp-insights";
import {
  getParentBookingStatusLabel,
  getParentCampStatusLabel,
  getParentIntervalLabel,
  getParentPackageStatusLabel,
  getParentPaymentStatusLabel,
} from "@/lib/parent-portal-labels";
import type {
  ParentAttendanceEntry,
  ParentCampItem,
  ParentChildCard,
  ParentCoachContact,
  ParentFamilyDashboard,
  ParentPaymentItem,
  ParentPortalPlayerRow,
  ParentReportItem,
  ParentSubscriptionItem,
  ParentUpcomingSession,
} from "@/lib/parent-portal-types";
import { getPlayerTeams, getTeamDisplayName } from "@/lib/team-management";
import { createAdminClient } from "@/lib/supabase/admin";

type SessionBookingSource = {
  id: string;
  player_id: string;
  booking_status: string;
  payment_status: string | null;
  amount: number;
  currency: string;
  created_at: string;
  session: {
    id: string;
    session_date: string;
    location: string | null;
    group_name: string | null;
    session_type: string | null;
    duration_minutes: number | null;
    team: { team_name: string; age_group: string | null } | null;
  } | {
    id: string;
    session_date: string;
    location: string | null;
    group_name: string | null;
    session_type: string | null;
    duration_minutes: number | null;
    team: { team_name: string; age_group: string | null } | null;
  }[] | null;
};

type SessionJoin = {
  id: string;
  session_date: string;
  location: string | null;
  group_name: string | null;
  session_type: string | null;
  duration_minutes: number | null;
  team: { team_name: string; age_group: string | null } | null;
};

function unwrapSession(session: SessionBookingSource["session"]): SessionJoin | null {
  if (!session) return null;
  return (Array.isArray(session) ? session[0] : session) ?? null;
}

function getWelcomeName(
  parentDisplayName: string | null,
  players: ParentPortalPlayerRow[],
): string {
  const parentName = players.find((player) => player.parent_name?.trim())?.parent_name?.trim();
  if (parentName) {
    return parentName.split(/\s+/)[0] ?? parentName;
  }
  if (parentDisplayName) {
    return parentDisplayName.split(/\s+/)[0] ?? parentDisplayName;
  }
  return "there";
}

function getSessionTitle(session: SessionJoin | null): string {
  if (!session) return "Training session";
  if (session.group_name?.trim()) return session.group_name.trim();
  if (session.team?.team_name?.trim()) return session.team.team_name.trim();
  if (session.session_type?.trim()) return session.session_type.trim();
  return "Training session";
}

function resolveCampStatusForPlayer(
  playerId: string,
  linkedSessions: CampSessionRow[],
  bookings: Array<{ player_id: string; session_id: string; booking_status: string }>,
): "booked" | "waitlist" | "available" {
  const linkedIds = new Set(linkedSessions.map((session) => session.id));
  const playerBookings = bookings.filter(
    (booking) =>
      booking.player_id === playerId &&
      linkedIds.has(booking.session_id) &&
      booking.booking_status !== "cancelled",
  );

  if (playerBookings.some((booking) => booking.booking_status === "confirmed")) {
    return "booked";
  }
  if (playerBookings.some((booking) => booking.booking_status === "waitlist")) {
    return "waitlist";
  }

  if (
    linkedSessions.length === 0 &&
    bookings.some(
      (booking) =>
        booking.player_id === playerId && booking.booking_status === "confirmed",
    )
  ) {
    return "booked";
  }

  return "available";
}

export async function loadParentFamilyDashboard(args: {
  parentEmail: string;
  parentDisplayName: string | null;
}): Promise<ParentFamilyDashboard> {
  const admin = createAdminClient();
  const parentEmail = args.parentEmail.trim().toLowerCase();
  const today = new Date().toISOString().slice(0, 10);

  const { data: playerRows, error: playersError } = await admin
    .from("players")
    .select(
      "id, coach_id, player_name, parent_name, parent_email, parent_phone, primary_position, team_players(team:teams(team_name, age_group, team_color))",
    )
    .ilike("parent_email", parentEmail)
    .order("player_name", { ascending: true });

  if (playersError) {
    throw new Error(playersError.message);
  }

  const players = (playerRows ?? []) as unknown as ParentPortalPlayerRow[];

  if (players.length === 0) {
    return {
      welcomeName: getWelcomeName(args.parentDisplayName, players),
      summary: {
        upcomingSessions: 0,
        attendancePercent: 0,
        reportsAvailable: 0,
        activeWeeklyPackages: 0,
        upcomingCamps: 0,
      },
      awaitingActions: [
        {
          id: "link-email",
          label: "Ask your coach to use this email on your child’s profile",
          href: "/family/manage",
          tone: "info",
        },
      ],
      children: [],
      upcomingSessions: [],
      attendanceHistory: [],
      reports: [],
      camps: [],
      subscriptions: [],
      recentPayments: [],
      coachContacts: [],
    };
  }

  const playerIds = players.map((player) => player.id);
  const coachIds = [...new Set(players.map((player) => player.coach_id))];
  const playerById = new Map(players.map((player) => [player.id, player]));

  const [
    { data: bookingRows },
    { data: attendanceRows },
    { data: reportRows },
    { data: subscriptionRows },
    { data: campRows },
    { data: sessionRows },
    { data: profileRows },
  ] = await Promise.all([
    admin
      .from("session_bookings")
      .select(
        "id, player_id, booking_status, payment_status, amount, currency, created_at, session:sessions(id, session_date, location, group_name, session_type, duration_minutes, team:teams(team_name, age_group))",
      )
      .in("player_id", playerIds)
      .neq("booking_status", "cancelled")
      .order("created_at", { ascending: false }),
    admin
      .from("session_attendance")
      .select(
        "id, session_id, player_id, status, recorded_at, session:sessions(session_date, session_type, group_name, team:teams(team_name, age_group))",
      )
      .in("player_id", playerIds)
      .order("recorded_at", { ascending: false }),
    admin
      .from("progress_reports")
      .select("id, player_id, report, created_at")
      .in("player_id", playerIds)
      .eq("parent_visible", true)
      .order("created_at", { ascending: false }),
    admin
      .from("parent_subscriptions")
      .select(
        "id, coach_id, player_id, stripe_customer_id, amount, currency, interval, status, current_period_end, created_at",
      )
      .in("player_id", playerIds)
      .order("created_at", { ascending: false }),
    admin
      .from("camps")
      .select(
        "id, coach_id, name, start_date, end_date, location, capacity, price, start_time, end_time, age_group, description, notes, created_at",
      )
      .in("coach_id", coachIds)
      .gte("end_date", today)
      .order("start_date", { ascending: true }),
    admin
      .from("sessions")
      .select("id, session_date, group_name, session_type, session_players(player_id)")
      .in("coach_id", coachIds),
    admin
      .from("coach_public_profiles")
      .select(
        "coach_id, display_name, support_email, slug, academy:academies(support_email, support_phone)",
      )
      .in("coach_id", coachIds),
  ]);

  const bookings = (bookingRows ?? []) as unknown as SessionBookingSource[];
  const attendance = (attendanceRows ?? []) as AttendanceHistoryRow[];
  const reports = (reportRows ?? []) as Array<{
    id: string;
    player_id: string;
    report: string;
    created_at: string;
  }>;
  const subscriptions = (subscriptionRows ?? []) as Array<{
    id: string;
    coach_id: string;
    player_id: string;
    stripe_customer_id: string;
    amount: number;
    currency: string;
    interval: "weekly" | "monthly" | null;
    status: string;
    current_period_end: string | null;
    created_at: string;
  }>;
  const camps = (campRows ?? []) as CampRow[];
  const sessions = (sessionRows ?? []) as CampSessionRow[];

  const coachContacts: ParentCoachContact[] = (profileRows ?? []).map((row) => {
    const academy = Array.isArray(row.academy) ? row.academy[0] : row.academy;
    return {
      coachId: row.coach_id as string,
      displayName: (row.display_name as string) ?? "Your coach",
      supportEmail:
        (row.support_email as string | null) ??
        (academy?.support_email as string | null) ??
        null,
      supportPhone: (academy?.support_phone as string | null) ?? null,
      bookingSlug: (row.slug as string | null) ?? null,
    };
  });

  const attendanceByPlayer = new Map<string, AttendanceHistoryRow[]>();
  for (const row of attendance) {
    const current = attendanceByPlayer.get(row.player_id) ?? [];
    current.push(row);
    attendanceByPlayer.set(row.player_id, current);
  }

  const reportsByPlayer = new Map<string, Array<{ created_at: string }>>();
  for (const report of reports) {
    const current = reportsByPlayer.get(report.player_id) ?? [];
    current.push({ created_at: report.created_at });
    reportsByPlayer.set(report.player_id, current);
  }

  const children: ParentChildCard[] = players.map((player) => {
    const teams = getPlayerTeams(player.team_players);
    const playerAttendance = attendanceByPlayer.get(player.id) ?? [];
    const history = parsePlayerAttendanceHistory(playerAttendance);
    const playerReports = reportsByPlayer.get(player.id) ?? [];

    return {
      playerId: player.id,
      playerName: player.player_name,
      primaryPosition: player.primary_position,
      teamLabel:
        teams.length > 0
          ? teams.map((team) => getTeamDisplayName(team)).join(", ")
          : "No team assigned",
      attendanceRate: history.rate,
      lastReportDate: playerReports[0]?.created_at ?? null,
      coachId: player.coach_id,
    };
  });

  const now = Date.now();
  const upcomingSessions: ParentUpcomingSession[] = bookings
    .map((booking) => {
      const session = unwrapSession(booking.session);
      if (!session) return null;
      const sessionTime = new Date(session.session_date).getTime();
      if (Number.isNaN(sessionTime) || sessionTime < now) return null;

      const player = playerById.get(booking.player_id);
      if (!player) return null;

      return {
        id: booking.id,
        playerId: booking.player_id,
        playerName: player.player_name,
        sessionId: session.id,
        sessionDate: session.session_date,
        durationMinutes: session.duration_minutes ?? 60,
        location: session.location,
        sessionTitle: getSessionTitle(session),
        bookingStatus: booking.booking_status,
        bookingStatusLabel: getParentBookingStatusLabel(booking.booking_status),
        paymentStatusLabel: getParentPaymentStatusLabel(booking.payment_status),
      } satisfies ParentUpcomingSession;
    })
    .filter((item): item is ParentUpcomingSession => item !== null)
    .sort(
      (left, right) =>
        new Date(left.sessionDate).getTime() - new Date(right.sessionDate).getTime(),
    );

  const attendanceHistory: ParentAttendanceEntry[] = attendance.slice(0, 5).map((row) => {
    const player = playerById.get(row.player_id);
    const session = unwrapAttendanceSession(row.session);
    return {
      sessionId: row.session_id,
      sessionDate: session?.session_date ?? row.recorded_at,
      sessionName: getAttendanceSessionName(session, row.recorded_at),
      status: row.status,
      statusLabel: getAttendanceLabel(row.status),
      playerId: row.player_id,
      playerName: player?.player_name ?? "Player",
    };
  });

  const attendanceRates = children
    .map((child) => child.attendanceRate)
    .filter((rate) => rate > 0);
  const attendancePercent =
    attendanceRates.length > 0
      ? Math.round(
          attendanceRates.reduce((sum, rate) => sum + rate, 0) / attendanceRates.length,
        )
      : getAttendanceRate(attendance);

  const reportItems: ParentReportItem[] = reports.map((report) => ({
    id: report.id,
    playerId: report.player_id,
    playerName: playerById.get(report.player_id)?.player_name ?? "Player",
    created_at: report.created_at,
    report: report.report,
  }));

  const bookingRefs = bookings.map((booking) => {
    const session = unwrapSession(booking.session);
    return {
      player_id: booking.player_id,
      session_id: session?.id ?? "",
      booking_status: booking.booking_status,
    };
  });

  const campItems: ParentCampItem[] = [];
  for (const camp of camps) {
    const linkedSessions = getCampLinkedSessions(camp, sessions);
    let bestStatus: "booked" | "waitlist" | "available" = "available";
    let matchedPlayer: ParentPortalPlayerRow | null = null;

    for (const player of players.filter((row) => row.coach_id === camp.coach_id)) {
      const status = resolveCampStatusForPlayer(player.id, linkedSessions, bookingRefs);
      if (status === "booked") {
        bestStatus = "booked";
        matchedPlayer = player;
        break;
      }
      if (status === "waitlist" && bestStatus === "available") {
        bestStatus = "waitlist";
        matchedPlayer = player;
      }
    }

    campItems.push({
      id: camp.id,
      name: camp.name,
      startDate: camp.start_date,
      endDate: camp.end_date,
      location: camp.location,
      playerId: matchedPlayer?.id ?? null,
      playerName: matchedPlayer?.player_name ?? null,
      status: bestStatus,
      statusLabel: getParentCampStatusLabel(bestStatus),
    });
  }

  const subscriptionItems: ParentSubscriptionItem[] = subscriptions.map((subscription) => {
    const player = playerById.get(subscription.player_id);
    return {
      id: subscription.id,
      playerId: subscription.player_id,
      playerName: player?.player_name ?? "Player",
      interval: subscription.interval,
      intervalLabel: getParentIntervalLabel(subscription.interval),
      status: subscription.status,
      statusLabel: getParentPackageStatusLabel(subscription.status),
      amount: subscription.amount,
      currency: subscription.currency,
      currentPeriodEnd: subscription.current_period_end,
      stripeCustomerId: subscription.stripe_customer_id,
      isWeeklyActive:
        subscription.interval === "weekly" &&
        (subscription.status === "active" || subscription.status === "trialing"),
    };
  });

  const recentPayments: ParentPaymentItem[] = bookings
    .filter((booking) => booking.payment_status === "paid" && booking.amount > 0)
    .slice(0, 5)
    .map((booking) => {
      const player = playerById.get(booking.player_id);
      const session = unwrapSession(booking.session);
      return {
        id: booking.id,
        playerName: player?.player_name ?? "Player",
        amount: booking.amount,
        currency: booking.currency,
        statusLabel: getParentPaymentStatusLabel(booking.payment_status),
        created_at: booking.created_at,
        description: session ? getSessionTitle(session) : "Session payment",
      };
    });

  const activeWeeklyPackages = subscriptionItems.filter((item) => item.isWeeklyActive).length;

  const awaitingActions: ParentFamilyDashboard["awaitingActions"] = [];
  if (upcomingSessions.length > 0) {
    awaitingActions.push({
      id: "next-session",
      label: `Next up: ${upcomingSessions[0]!.sessionTitle} · ${upcomingSessions[0]!.playerName}`,
      href: "#family-sessions",
      tone: "info",
    });
  }
  if (reportItems.length > 0) {
    awaitingActions.push({
      id: "shared-report",
      label: `${reportItems.length} shared report${reportItems.length === 1 ? "" : "s"} ready to view`,
      href: "#family-reports",
      tone: "action",
    });
  }
  const waitlistCamps = campItems.filter((camp) => camp.status === "waitlist");
  if (waitlistCamps.length > 0) {
    awaitingActions.push({
      id: "camp-waitlist",
      label: `${waitlistCamps.length} camp waitlist response${waitlistCamps.length === 1 ? "" : "s"} to review`,
      href: "/family/manage",
      tone: "action",
    });
  }
  if (children.length > 0) {
    awaitingActions.push({
      id: "manage-child",
      label: "Update availability, contacts, and preferences",
      href: "/family/manage",
      tone: "info",
    });
  }

  return {
    welcomeName: getWelcomeName(args.parentDisplayName, players),
    summary: {
      upcomingSessions: upcomingSessions.length,
      attendancePercent,
      reportsAvailable: reportItems.length,
      activeWeeklyPackages,
      upcomingCamps: campItems.length,
    },
    awaitingActions,
    children,
    upcomingSessions,
    attendanceHistory,
    reports: reportItems,
    camps: campItems,
    subscriptions: subscriptionItems,
    recentPayments,
    coachContacts,
  };
}

export function buildParentAttendanceBreakdown(rows: AttendanceHistoryRow[]) {
  const summary = getAttendanceSummary(rows);
  const counted = rows.filter((row) =>
    ["present", "absent", "late"].includes(row.status),
  );
  const total = counted.length || 1;

  return {
    present: summary.present,
    late: summary.late,
    absent: summary.absent,
    presentPercent: Math.round((summary.present / total) * 100),
    latePercent: Math.round((summary.late / total) * 100),
    absentPercent: Math.round((summary.absent / total) * 100),
  };
}
