"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarClock,
  FileText,
  Loader2,
  PoundSterling,
  TrendingUp,
  Users,
} from "lucide-react";
import { FeaturePageHeader } from "@/components/feature-page-header";
import { SetupRequiredPanel } from "@/components/setup-required-panel";
import { createClient } from "@/lib/supabase";
import { summarizeSessionBookings } from "@/lib/session-booking-state";
import {
  getSetupRequiredMessage,
  isMissingTableError,
  resolveQueryError,
} from "@/lib/supabase-errors";
import { cn } from "@/lib/utils";

type AttendanceStatus = "scheduled" | "attended" | "missed" | "cancelled";

type PlayerRow = {
  id: string;
  player_name: string;
};

type SessionPlayerLink = {
  player_id: string;
  player: {
    id: string;
    player_name: string;
  }[] | {
    id: string;
    player_name: string;
  } | null;
};

type SessionRow = {
  id: string;
  coach_id: string;
  player_id: string | null;
  group_name: string | null;
  session_type: string | null;
  session_date: string;
  attendance_status: AttendanceStatus;
  session_players: SessionPlayerLink[] | null;
  capacity: number;
  is_public: boolean;
};

type SessionBookingRow = {
  id: string;
  coach_id: string;
  session_id: string;
  player_id: string;
  booking_status: "pending" | "confirmed" | "waitlist" | "cancelled";
  payment_status: "requires_payment" | "paid" | "not_required" | "failed" | "refunded";
  amount: number;
  created_at: string;
};

type ReportRow = {
  id: string;
  coach_id: string;
  created_at: string;
};

type ParentSubscriptionRow = {
  id: string;
  coach_id: string;
  amount: number;
  currency: string;
  interval: "monthly" | "weekly" | null;
  status: string;
  created_at: string;
};

type CampRow = {
  id: string;
  coach_id: string;
  price: number | string;
  capacity: number;
  start_date: string;
};

type CampEnrolmentRow = {
  camp_id: string;
  coach_id: string;
  status: "enrolled" | "waitlist";
};

type ChartPoint = {
  label: string;
  value: number;
};

type AttendanceBreakdownRow = {
  label: string;
  total: number;
  attended: number;
  rate: number;
};

type AnalyticsData = {
  players: PlayerRow[];
  sessions: SessionRow[];
  sessionBookings: SessionBookingRow[];
  reports: ReportRow[];
  subscriptions: ParentSubscriptionRow[];
  camps: CampRow[];
  enrolments: CampEnrolmentRow[];
};

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "An unexpected error occurred.";
}

function currency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function percentage(value: number): string {
  return `${Math.round(value)}%`;
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
  }).format(new Date(year, (month ?? 1) - 1, 1));
}

function getLastSixMonthKeys(): string[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return monthKey(date);
  });
}

function parsePrice(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function subscriptionMrr(subscription: ParentSubscriptionRow): number {
  const pounds = subscription.amount / 100;
  if (subscription.interval === "weekly") return (pounds * 52) / 12;
  if (subscription.interval === "monthly") return pounds;
  return 0;
}

function isActiveSubscription(status: string): boolean {
  return status === "active" || status === "trialing";
}

function getAssignedPlayerLinks(
  session: SessionRow,
  playerNameById: Map<string, string>,
  sessionBookings: SessionBookingRow[],
): { player_id: string; player_name: string }[] {
  const playersById = new Map<string, { player_id: string; player_name: string }>();

  for (const booking of sessionBookings) {
    if (booking.session_id !== session.id || booking.booking_status !== "confirmed") continue;
    playersById.set(booking.player_id, {
      player_id: booking.player_id,
      player_name: playerNameById.get(booking.player_id) ?? "Unknown player",
    });
  }

  const linkedPlayers = (session.session_players ?? [])
    .map((link) => {
      const player = Array.isArray(link.player) ? link.player[0] : link.player;
      const resolved = {
        player_id: link.player_id,
        player_name:
          player?.player_name ?? playerNameById.get(link.player_id) ?? "Unknown player",
      };
      playersById.set(link.player_id, resolved);
      return resolved;
    })
    .filter((player) => Boolean(player.player_id));

  if (linkedPlayers.length > 0 || playersById.size > 0) return [...playersById.values()];
  return session.player_id
    ? [
        {
          player_id: session.player_id,
          player_name: playerNameById.get(session.player_id) ?? "Unknown player",
        },
      ]
    : [];
}

function getGroupLabel(session: SessionRow): string {
  return (
    session.group_name?.trim() ||
    session.session_type?.trim() ||
    "Ungrouped session"
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Users;
}) {
  return (
    <div className="glass-panel rounded-2xl p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-muted text-sm font-medium">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
          <p className="text-muted mt-1 text-xs">{hint}</p>
        </div>
        <div className="bg-accent/10 ring-accent/20 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
          <Icon className="text-accent size-5" aria-hidden />
        </div>
      </div>
    </div>
  );
}

function MiniBarChart({
  title,
  points,
  formatter = String,
  accent = "bg-accent",
}: {
  title: string;
  points: ChartPoint[];
  formatter?: (value: number) => string;
  accent?: string;
}) {
  const max = Math.max(...points.map((point) => point.value), 1);

  return (
    <section className="glass-panel rounded-2xl p-6 sm:p-7">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <BarChart3 className="text-muted size-5" aria-hidden />
      </div>
      <div className="flex h-56 items-end gap-3">
        {points.map((point) => (
          <div key={point.label} className="flex h-full flex-1 flex-col justify-end gap-2">
            <div className="flex flex-1 items-end rounded-xl bg-black/[0.03] p-1 dark:bg-white/[0.04]">
              <div
                className={cn("w-full rounded-lg transition-all", accent)}
                style={{ height: `${Math.max((point.value / max) * 100, point.value > 0 ? 6 : 0)}%` }}
                title={formatter(point.value)}
              />
            </div>
            <div className="text-center">
              <p className="text-muted text-[11px]">{point.label}</p>
              <p className="mt-0.5 text-xs font-medium">{formatter(point.value)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AttendanceBreakdownList({
  title,
  rows,
  emptyMessage,
}: {
  title: string;
  rows: AttendanceBreakdownRow[];
  emptyMessage: string;
}) {
  return (
    <section className="glass-panel rounded-2xl p-6 sm:p-7">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-muted mt-4 text-sm">{emptyMessage}</p>
      ) : (
        <div className="mt-5 space-y-4">
          {rows.map((row) => (
            <div key={row.label}>
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-medium">{row.label}</p>
                <p className="text-muted text-xs">
                  {row.attended}/{row.total} attended
                </p>
              </div>
              <div className="mt-2 h-2 rounded-full bg-black/[0.05] dark:bg-white/[0.06]">
                <div
                  className="bg-accent h-full rounded-full transition-all"
                  style={{ width: `${Math.max(row.rate, row.total > 0 ? 6 : 0)}%` }}
                />
              </div>
              <p className="text-muted mt-1 text-xs">{percentage(row.rate)} attendance rate</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function AnalyticsManager() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [setupTables, setSetupTables] = useState<string[]>([]);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSetupTables([]);

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        setError(userError.message);
        return;
      }
      if (!user) {
        setError("You must be signed in to view analytics.");
        return;
      }

      const [
        playersResult,
        sessionsResult,
        sessionBookingsResult,
        reportsResult,
        subscriptionsResult,
        campsResult,
        enrolmentsResult,
      ] = await Promise.all([
        supabase
          .from("players")
          .select("id, player_name")
          .eq("coach_id", user.id),
        supabase
          .from("sessions")
          .select(
            `
              id,
              coach_id,
              player_id,
              group_name,
              session_type,
              session_date,
              attendance_status,
              capacity,
              is_public,
              session_players (
                player_id,
                player:players (
                  id,
                  player_name
                )
              )
            `,
          )
          .eq("coach_id", user.id),
        supabase
          .from("session_bookings")
          .select(
            "id, coach_id, session_id, player_id, booking_status, payment_status, amount, created_at",
          )
          .eq("coach_id", user.id),
        supabase
          .from("progress_reports")
          .select("id, coach_id, created_at")
          .eq("coach_id", user.id),
        supabase
          .from("parent_subscriptions")
          .select("id, coach_id, amount, currency, interval, status, created_at")
          .eq("coach_id", user.id),
        supabase
          .from("camps")
          .select("id, coach_id, price, capacity, start_date")
          .eq("coach_id", user.id),
        supabase
          .from("camp_enrolments")
          .select("camp_id, coach_id, status")
          .eq("coach_id", user.id),
      ]);

      const requiredResults = [
        { table: "players", error: playersResult.error },
        { table: "sessions", error: sessionsResult.error },
        { table: "session_bookings", error: sessionBookingsResult.error },
        { table: "progress_reports", error: reportsResult.error },
        { table: "parent_subscriptions", error: subscriptionsResult.error },
      ];

      const missingRequired = requiredResults
        .filter((result) => isMissingTableError(result.error))
        .map((result) => result.table);

      if (missingRequired.length > 0) {
        setSetupTables(missingRequired);
        return;
      }

      const optionalMissing = ["camps", "camp_enrolments"].filter((table, index) => {
        const error = index === 0 ? campsResult.error : enrolmentsResult.error;
        return isMissingTableError(error);
      });
      if (optionalMissing.length > 0) {
        setSetupTables(optionalMissing);
      }

      const firstError = [
        ...requiredResults,
        { table: "camps", error: campsResult.error },
        { table: "camp_enrolments", error: enrolmentsResult.error },
      ].find((result) => result.error)?.error;
      if (firstError) {
        const resolved = resolveQueryError(firstError, "analytics");
        if (resolved.setupRequired) {
          setSetupTables([resolved.table]);
          return;
        }
        setError(resolved.message);
        return;
      }

      setData({
        players: (playersResult.data ?? []) as PlayerRow[],
        sessions: (sessionsResult.data ?? []) as SessionRow[],
        sessionBookings: (sessionBookingsResult.data ?? []) as SessionBookingRow[],
        reports: (reportsResult.data ?? []) as ReportRow[],
        subscriptions: (subscriptionsResult.data ?? []) as ParentSubscriptionRow[],
        camps: isMissingTableError(campsResult.error)
          ? []
          : ((campsResult.data ?? []) as CampRow[]),
        enrolments: isMissingTableError(enrolmentsResult.error)
          ? []
          : ((enrolmentsResult.data ?? []) as CampEnrolmentRow[]),
      });
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      await loadAnalytics();
    }

    void init();
  }, [loadAnalytics]);

  const analytics = useMemo(() => {
    if (!data) return null;

    const monthKeys = getLastSixMonthKeys();
    const emptySeries = () =>
      Object.fromEntries(monthKeys.map((key) => [key, 0])) as Record<string, number>;
    const playerNameById = new Map(
      data.players.map((player) => [player.id, player.player_name]),
    );

    const activeSubscriptions = data.subscriptions.filter((subscription) =>
      isActiveSubscription(subscription.status),
    );
    const totalSessions = data.sessions.length;
    const publicSessions = data.sessions.filter((session) => session.is_public);
    const confirmedBookings = data.sessionBookings.filter(
      (booking) => booking.booking_status === "confirmed",
    );
    const paidBookings = confirmedBookings.filter(
      (booking) => booking.payment_status === "paid",
    );
    const totalBookingAttempts = data.sessionBookings.filter(
      (booking) => booking.booking_status !== "cancelled",
    ).length;
    const attendanceByPlayer = new Map<
      string,
      { label: string; total: number; attended: number }
    >();
    const attendanceByGroup = new Map<
      string,
      { label: string; total: number; attended: number }
    >();
    let totalAssignments = 0;
    let attendedAssignments = 0;

    const enrolledByCamp = new Map<string, number>();
    for (const enrolment of data.enrolments) {
      if (enrolment.status !== "enrolled") continue;
      enrolledByCamp.set(
        enrolment.camp_id,
        (enrolledByCamp.get(enrolment.camp_id) ?? 0) + 1,
      );
    }

    const campRevenue = data.camps.reduce((sum, camp) => {
      const enrolled = enrolledByCamp.get(camp.id) ?? 0;
      return sum + parsePrice(camp.price) * enrolled;
    }, 0);

    const campsWithCapacity = data.camps.filter((camp) => camp.capacity > 0);
    const averageCampOccupancy =
      campsWithCapacity.length > 0
        ? campsWithCapacity.reduce((sum, camp) => {
            const enrolled = enrolledByCamp.get(camp.id) ?? 0;
            return sum + Math.min((enrolled / camp.capacity) * 100, 100);
          }, 0) / campsWithCapacity.length
        : 0;

    const mrr = activeSubscriptions.reduce(
      (sum, subscription) => sum + subscriptionMrr(subscription),
      0,
    );

    const revenueSeries = emptySeries();
    for (const subscription of data.subscriptions) {
      const key = monthKey(new Date(subscription.created_at));
      if (key in revenueSeries) {
        revenueSeries[key] += subscription.amount / 100;
      }
    }
    for (const booking of paidBookings) {
      const key = monthKey(new Date(booking.created_at));
      if (key in revenueSeries) {
        revenueSeries[key] += booking.amount / 100;
      }
    }
    for (const camp of data.camps) {
      const key = monthKey(new Date(`${camp.start_date}T12:00:00`));
      if (key in revenueSeries) {
        revenueSeries[key] += parsePrice(camp.price) * (enrolledByCamp.get(camp.id) ?? 0);
      }
    }

    const sessionVolumeSeries = emptySeries();
    const attendedSeries = emptySeries();
    const attendanceTotalSeries = emptySeries();
    const occupancySeries = emptySeries();
    const occupancySessionCounts = emptySeries();
    for (const session of data.sessions) {
      const key = monthKey(new Date(session.session_date));
      if (!(key in sessionVolumeSeries)) continue;

      const assignedPlayers = getAssignedPlayerLinks(
        session,
        playerNameById,
        data.sessionBookings,
      );
      const assignedCount = Math.max(assignedPlayers.length, 1);

      sessionVolumeSeries[key] += 1;
      attendanceTotalSeries[key] += assignedCount;
      totalAssignments += assignedCount;

      if (session.attendance_status === "attended") {
        attendedSeries[key] += assignedCount;
        attendedAssignments += assignedCount;
      }

      for (const player of assignedPlayers) {
        const current = attendanceByPlayer.get(player.player_id) ?? {
          label: player.player_name,
          total: 0,
          attended: 0,
        };
        current.total += 1;
        if (session.attendance_status === "attended") {
          current.attended += 1;
        }
        attendanceByPlayer.set(player.player_id, current);
      }

      const groupLabel = getGroupLabel(session);
      const currentGroup = attendanceByGroup.get(groupLabel) ?? {
        label: groupLabel,
        total: 0,
        attended: 0,
      };
      currentGroup.total += assignedCount;
      if (session.attendance_status === "attended") {
        currentGroup.attended += assignedCount;
      }
      attendanceByGroup.set(groupLabel, currentGroup);

      if (session.is_public && session.capacity > 0) {
        const bookingSummary = summarizeSessionBookings(
          data.sessionBookings.filter((booking) => booking.session_id === session.id),
          session.capacity,
        );
        occupancySeries[key] += Math.min(
          (bookingSummary.confirmed / session.capacity) * 100,
          100,
        );
        occupancySessionCounts[key] += 1;
      }
    }

    const attendanceRate =
      totalAssignments > 0 ? (attendedAssignments / totalAssignments) * 100 : 0;
    const bookingRevenue = paidBookings.reduce((sum, booking) => sum + booking.amount / 100, 0);
    const bookingConversion =
      totalBookingAttempts > 0 ? (confirmedBookings.length / totalBookingAttempts) * 100 : 0;
    const averagePublicOccupancy =
      publicSessions.length > 0
        ? publicSessions.reduce((sum, session) => {
            if (session.capacity <= 0) return sum;
            const bookingSummary = summarizeSessionBookings(
              data.sessionBookings.filter((booking) => booking.session_id === session.id),
              session.capacity,
            );
            return sum + Math.min((bookingSummary.confirmed / session.capacity) * 100, 100);
          }, 0) / publicSessions.length
        : 0;
    const remainingPublicCapacity = publicSessions.reduce((sum, session) => {
      const bookingSummary = summarizeSessionBookings(
        data.sessionBookings.filter((booking) => booking.session_id === session.id),
        session.capacity,
      );
      return sum + bookingSummary.remainingSpaces;
    }, 0);

    const reportsSeries = emptySeries();
    for (const report of data.reports) {
      const key = monthKey(new Date(report.created_at));
      if (key in reportsSeries) reportsSeries[key] += 1;
    }

    return {
      metrics: {
        totalPlayers: data.players.length,
        totalSessions,
        publicSessions: publicSessions.length,
        attendanceRate,
        reportsGenerated: data.reports.length,
        activeParentSubscriptions: activeSubscriptions.length,
        mrr,
        bookingRevenue,
        bookingConversion,
        averagePublicOccupancy,
        remainingPublicCapacity,
        campRevenue,
        averageCampOccupancy,
      },
      charts: {
        revenue: monthKeys.map((key) => ({
          label: monthLabel(key),
          value: Math.round(revenueSeries[key]),
        })),
        attendance: monthKeys.map((key) => ({
          label: monthLabel(key),
          value:
            attendanceTotalSeries[key] > 0
              ? Math.round((attendedSeries[key] / attendanceTotalSeries[key]) * 100)
              : 0,
        })),
        occupancy: monthKeys.map((key) => ({
          label: monthLabel(key),
          value:
            occupancySessionCounts[key] > 0
              ? Math.round(occupancySeries[key] / occupancySessionCounts[key])
              : 0,
        })),
        sessions: monthKeys.map((key) => ({
          label: monthLabel(key),
          value: sessionVolumeSeries[key],
        })),
        reports: monthKeys.map((key) => ({
          label: monthLabel(key),
          value: reportsSeries[key],
        })),
      },
      breakdowns: {
        players: [...attendanceByPlayer.values()]
          .map((row) => ({
            ...row,
            rate: row.total > 0 ? (row.attended / row.total) * 100 : 0,
          }))
          .sort((a, b) => b.total - a.total || b.rate - a.rate)
          .slice(0, 6),
        groups: [...attendanceByGroup.values()]
          .map((row) => ({
            ...row,
            rate: row.total > 0 ? (row.attended / row.total) * 100 : 0,
          }))
          .sort((a, b) => b.total - a.total || b.rate - a.rate)
          .slice(0, 6),
      },
    };
  }, [data]);

  return (
    <div className="space-y-10">
      <FeaturePageHeader
        featureKey="analytics"
        title="Analytics"
        subtitle="Track growth, delivery, revenue, and engagement across your coaching business."
      />

      {setupTables.length > 0 ? (
        <SetupRequiredPanel
          {...getSetupRequiredMessage(setupTables)}
          tables={setupTables}
        />
      ) : null}

      {error ? (
        <div className="glass-panel rounded-2xl p-6 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="glass-panel flex items-center gap-3 rounded-2xl p-6 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading analytics...
        </div>
      ) : null}

      {!loading && !error && analytics ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total Players"
              value={String(analytics.metrics.totalPlayers)}
              hint="Active CRM records"
              icon={Users}
            />
            <StatCard
              label="Total Sessions"
              value={String(analytics.metrics.totalSessions)}
              hint="Scheduled sessions"
              icon={CalendarClock}
            />
            <StatCard
              label="Public Sessions"
              value={String(analytics.metrics.publicSessions)}
              hint="Bookable upcoming sessions"
              icon={CalendarClock}
            />
            <StatCard
              label="Attendance Rate"
              value={percentage(analytics.metrics.attendanceRate)}
              hint="Attended sessions"
              icon={TrendingUp}
            />
            <StatCard
              label="AI Reports Generated"
              value={String(analytics.metrics.reportsGenerated)}
              hint="Saved progress reports"
              icon={FileText}
            />
            <StatCard
              label="Active Parent Subscriptions"
              value={String(analytics.metrics.activeParentSubscriptions)}
              hint="Stripe-backed plans"
              icon={PoundSterling}
            />
            <StatCard
              label="Monthly Recurring Revenue"
              value={currency(analytics.metrics.mrr)}
              hint="Normalised MRR"
              icon={PoundSterling}
            />
            <StatCard
              label="Booking Revenue"
              value={currency(analytics.metrics.bookingRevenue)}
              hint="Paid confirmed session bookings"
              icon={PoundSterling}
            />
            <StatCard
              label="Booking Conversion"
              value={percentage(analytics.metrics.bookingConversion)}
              hint="Confirmed vs all booking attempts"
              icon={TrendingUp}
            />
            <StatCard
              label="Public Session Occupancy"
              value={percentage(analytics.metrics.averagePublicOccupancy)}
              hint={`${analytics.metrics.remainingPublicCapacity} spaces still open`}
              icon={TrendingUp}
            />
            <StatCard
              label="Camp Revenue"
              value={currency(analytics.metrics.campRevenue)}
              hint="Camp price x enrolments"
              icon={PoundSterling}
            />
            <StatCard
              label="Average Camp Occupancy"
              value={percentage(analytics.metrics.averageCampOccupancy)}
              hint="Enrolled vs capacity"
              icon={TrendingUp}
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <MiniBarChart
              title="Revenue over time"
              points={analytics.charts.revenue}
              formatter={currency}
              accent="bg-accent"
            />
            <MiniBarChart
              title="Attendance trends"
              points={analytics.charts.attendance}
              formatter={percentage}
              accent="bg-sky-500"
            />
            <MiniBarChart
              title="Public occupancy"
              points={analytics.charts.occupancy}
              formatter={percentage}
              accent="bg-emerald-500"
            />
            <MiniBarChart
              title="Session volume by month"
              points={analytics.charts.sessions}
              accent="bg-violet-500"
            />
            <MiniBarChart
              title="Reports generated by month"
              points={analytics.charts.reports}
              accent="bg-amber-500"
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <AttendanceBreakdownList
              title="Attendance per player"
              rows={analytics.breakdowns.players}
              emptyMessage="Assigned players will appear here once sessions are linked."
            />
            <AttendanceBreakdownList
              title="Attendance per group"
              rows={analytics.breakdowns.groups}
              emptyMessage="Named session groups will appear here once you start scheduling them."
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
