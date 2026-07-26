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
import { FOOTBALL_LABELS } from "@/lib/football-identity";
import { SetupRequiredPanel } from "@/components/setup-required-panel";
import { FormErrorAlert } from "@/components/form-error-alert";
import {
  isCountedAttendanceStatus,
  isMissedAttendanceStatus,
  isPositiveAttendanceStatus,
  type PlayerAttendanceStatus,
} from "@/lib/attendance";
import { getTeamDisplayName, unwrapSingleRelation, type TeamSummary } from "@/lib/team-management";
import { createClient } from "@/lib/supabase";
import { summarizeSessionBookings } from "@/lib/session-booking-state";
import {
  getSetupRequiredMessage,
  isMissingTableError,
  resolveQueryError,
} from "@/lib/supabase-errors";
import { cn } from "@/lib/utils";
import { buildTrainingAnalyticsSummary } from "@/lib/training-insights";
import type { TrainingDrillRow, TrainingPlanRow } from "@/lib/training-types";
import { buildFinanceOverview, formatFinanceCurrency } from "@/lib/finance-insights";
import type { FinanceExpenseRow, FinanceInvoiceRow } from "@/lib/finance-types";
import { attachPlayersToClips, buildVideoAnalyticsSummary } from "@/lib/video-insights";
import type { VideoAssetRow, VideoClipRow } from "@/lib/video-types";
import { sanitizeDashboardSaveError } from "@/lib/user-facing-errors";
import { PanelSkeleton } from "@/components/branded-loading";

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
  team_id: string | null;
  group_name: string | null;
  session_type: string | null;
  session_date: string;
  session_players: SessionPlayerLink[] | null;
  capacity: number;
  is_public: boolean;
  team: TeamSummary[] | TeamSummary | null;
};

type SessionAttendanceRow = {
  id: string;
  session_id: string;
  player_id: string;
  status: PlayerAttendanceStatus;
  recorded_at: string;
};

type TeamRow = {
  id: string;
  team_name: string;
  age_group: string | null;
  team_color: string | null;
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
  subscription_kind?: "manual" | "recurring_series";
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
  teams: TeamRow[];
  sessions: SessionRow[];
  attendance: SessionAttendanceRow[];
  sessionBookings: SessionBookingRow[];
  reports: ReportRow[];
  subscriptions: ParentSubscriptionRow[];
  camps: CampRow[];
  enrolments: CampEnrolmentRow[];
  trainingPlans: TrainingPlanRow[];
  trainingDrills: TrainingDrillRow[];
  financeExpenses: FinanceExpenseRow[];
  financeInvoices: FinanceInvoiceRow[];
  videoAssets: VideoAssetRow[];
  videoClips: VideoClipRow[];
  videoClipPlayers: Array<{ clip_id: string; player_id: string }>;
};

function getErrorMessage(error: unknown): string {
  return sanitizeDashboardSaveError(error, { logLabel: "analytics" });
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
  valueAriaLabel,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  valueAriaLabel?: string;
  hint: string;
  icon: typeof Users;
}) {
  return (
    <div className="football-panel football-panel-interactive rounded-2xl p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-muted text-sm font-medium">{label}</p>
          <p
            className="mt-2 text-3xl font-semibold tracking-tight"
            aria-label={valueAriaLabel ?? `${label}: ${value}`}
          >
            {value}
          </p>
          <p className="text-muted mt-1 text-xs leading-relaxed">{hint}</p>
        </div>
        <div className="bg-accent/12 ring-accent/25 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
          <Icon className="text-accent size-5" aria-hidden />
        </div>
      </div>
    </div>
  );
}

function MiniBarChart({
  title,
  titleId,
  points,
  formatter = String,
  accent = "bg-accent",
  emptyMessage,
}: {
  title: string;
  titleId: string;
  points: ChartPoint[];
  formatter?: (value: number) => string;
  accent?: string;
  emptyMessage?: string;
}) {
  const max = Math.max(...points.map((point) => point.value), 1);
  const hasData = points.some((point) => point.value > 0);

  return (
    <section
      className="football-panel football-panel-interactive rounded-2xl p-6 sm:p-7"
      aria-labelledby={titleId}
    >
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 id={titleId} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <BarChart3 className="text-muted size-5" aria-hidden />
      </div>
      {!hasData && emptyMessage ? (
        <div role="status" aria-live="polite" className="text-muted text-sm leading-relaxed">
          <p className="font-medium text-foreground">No booking information yet.</p>
          <p className="mt-2">{emptyMessage}</p>
        </div>
      ) : (
        <div className="flex h-56 items-end gap-3" role="list" aria-label={`${title} chart`}>
          {points.map((point) => (
            <div key={point.label} className="flex h-full flex-1 flex-col justify-end gap-2" role="listitem">
              <div className="flex flex-1 items-end rounded-xl bg-black/[0.03] p-1 dark:bg-white/[0.04]">
                <div
                  className={cn("w-full rounded-lg transition-all", accent)}
                  style={{ height: `${Math.max((point.value / max) * 100, point.value > 0 ? 6 : 0)}%` }}
                  title={formatter(point.value)}
                  aria-label={`${point.label}: ${formatter(point.value)}`}
                />
              </div>
              <div className="text-center">
                <p className="text-muted text-[11px]">{point.label}</p>
                <p className="mt-0.5 text-xs font-medium">{formatter(point.value)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AttendanceBreakdownList({
  title,
  titleId,
  rows,
  emptyMessage,
}: {
  title: string;
  titleId: string;
  rows: AttendanceBreakdownRow[];
  emptyMessage: string;
}) {
  return (
    <section className="football-panel football-panel-interactive rounded-2xl p-6 sm:p-7" aria-labelledby={titleId}>
      <h2 id={titleId} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="text-muted mt-4 text-sm leading-relaxed" role="status" aria-live="polite">
          {emptyMessage}
        </p>
      ) : (
        <div className="mt-5 space-y-4" role="list">
          {rows.map((row) => (
            <div key={row.label} role="listitem">
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-medium">{row.label}</p>
                <p className="text-muted text-xs">
                  {row.attended}/{row.total} attended
                </p>
              </div>
              <div
                className="mt-2 h-2 rounded-full bg-black/[0.05] dark:bg-white/[0.06]"
                aria-hidden
              >
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
        setError(getErrorMessage(userError));
        return;
      }
      if (!user) {
        setError("You must be signed in to view analytics.");
        return;
      }

      const [
        playersResult,
        teamsResult,
        sessionsResult,
        attendanceResult,
        sessionBookingsResult,
        reportsResult,
        subscriptionsResult,
        campsResult,
        enrolmentsResult,
        trainingPlansResult,
        trainingDrillsResult,
        financeExpensesResult,
        financeInvoicesResult,
        videoAssetsResult,
        videoClipsResult,
        videoClipPlayersResult,
      ] = await Promise.all([
        supabase
          .from("players")
          .select("id, player_name")
          .eq("coach_id", user.id),
        supabase
          .from("teams")
          .select("id, team_name, age_group, team_color")
          .eq("coach_id", user.id),
        supabase
          .from("sessions")
          .select(
            `
              id,
              coach_id,
              player_id,
              team_id,
              group_name,
              session_type,
              session_date,
              capacity,
              is_public,
              team:teams (
                id,
                team_name,
                age_group,
                team_color
              ),
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
          .from("session_attendance")
          .select("id, session_id, player_id, status, recorded_at")
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
          .select(
            "id, coach_id, amount, currency, interval, status, subscription_kind, created_at",
          )
          .eq("coach_id", user.id),
        supabase
          .from("camps")
          .select("id, coach_id, price, capacity, start_date")
          .eq("coach_id", user.id),
        supabase
          .from("camp_enrolments")
          .select("camp_id, coach_id, status")
          .eq("coach_id", user.id),
        supabase.from("training_plans").select("*").eq("coach_id", user.id),
        supabase.from("training_drills").select("*").eq("coach_id", user.id),
        supabase.from("finance_expenses").select("*").eq("coach_id", user.id),
        supabase.from("finance_invoices").select("*").eq("coach_id", user.id),
        supabase.from("video_assets").select("*").eq("coach_id", user.id),
        supabase.from("video_clips").select("*").eq("coach_id", user.id),
        supabase.from("video_clip_players").select("clip_id, player_id"),
      ]);

      const requiredResults = [
        { table: "players", error: playersResult.error },
        { table: "sessions", error: sessionsResult.error },
        { table: "session_attendance", error: attendanceResult.error },
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

      const optionalMissing = [
        { table: "teams", error: teamsResult.error },
        { table: "camps", error: campsResult.error },
        { table: "camp_enrolments", error: enrolmentsResult.error },
      ]
        .filter((result) => isMissingTableError(result.error))
        .map((result) => result.table);
      if (optionalMissing.length > 0) {
        setSetupTables(optionalMissing);
      }

      const firstError = [
        ...requiredResults,
        { table: "teams", error: teamsResult.error },
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
        teams: isMissingTableError(teamsResult.error)
          ? []
          : ((teamsResult.data ?? []) as TeamRow[]),
        sessions: (sessionsResult.data ?? []) as SessionRow[],
        attendance: (attendanceResult.data ?? []) as SessionAttendanceRow[],
        sessionBookings: (sessionBookingsResult.data ?? []) as SessionBookingRow[],
        reports: (reportsResult.data ?? []) as ReportRow[],
        subscriptions: (subscriptionsResult.data ?? []) as ParentSubscriptionRow[],
        camps: isMissingTableError(campsResult.error)
          ? []
          : ((campsResult.data ?? []) as CampRow[]),
        enrolments: isMissingTableError(enrolmentsResult.error)
          ? []
          : ((enrolmentsResult.data ?? []) as CampEnrolmentRow[]),
        trainingPlans: isMissingTableError(trainingPlansResult.error)
          ? []
          : ((trainingPlansResult.data ?? []) as unknown as TrainingPlanRow[]),
        trainingDrills: isMissingTableError(trainingDrillsResult.error)
          ? []
          : ((trainingDrillsResult.data ?? []) as unknown as TrainingDrillRow[]),
        financeExpenses: isMissingTableError(financeExpensesResult.error)
          ? []
          : ((financeExpensesResult.data ?? []) as unknown as FinanceExpenseRow[]),
        financeInvoices: isMissingTableError(financeInvoicesResult.error)
          ? []
          : ((financeInvoicesResult.data ?? []) as unknown as FinanceInvoiceRow[]),
        videoAssets: isMissingTableError(videoAssetsResult.error)
          ? []
          : ((videoAssetsResult.data ?? []) as unknown as VideoAssetRow[]),
        videoClips: isMissingTableError(videoClipsResult.error)
          ? []
          : ((videoClipsResult.data ?? []) as unknown as VideoClipRow[]),
        videoClipPlayers: isMissingTableError(videoClipPlayersResult.error)
          ? []
          : ((videoClipPlayersResult.data ?? []) as Array<{ clip_id: string; player_id: string }>),
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
    const activeRecurringSubscriptions = activeSubscriptions.filter(
      (subscription) => subscription.subscription_kind === "recurring_series",
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
    const attendanceByTeam = new Map<
      string,
      { label: string; total: number; attended: number }
    >();
    const attendanceByGroup = new Map<
      string,
      { label: string; total: number; attended: number }
    >();
    let totalAttendanceEvents = 0;
    let attendedEvents = 0;

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
    const missedSeries = emptySeries();
    const occupancySeries = emptySeries();
    const occupancySessionCounts = emptySeries();
    for (const session of data.sessions) {
      const key = monthKey(new Date(session.session_date));
      if (!(key in sessionVolumeSeries)) continue;

      sessionVolumeSeries[key] += 1;
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

    const sessionsById = new Map(data.sessions.map((session) => [session.id, session]));
    for (const entry of data.attendance) {
      if (!isCountedAttendanceStatus(entry.status)) {
        continue;
      }

      const session = sessionsById.get(entry.session_id);
      const playerLabel = playerNameById.get(entry.player_id) ?? "Unknown player";
      const currentPlayer = attendanceByPlayer.get(entry.player_id) ?? {
        label: playerLabel,
        total: 0,
        attended: 0,
      };
      currentPlayer.total += 1;
      if (isPositiveAttendanceStatus(entry.status)) {
        currentPlayer.attended += 1;
      }
      attendanceByPlayer.set(entry.player_id, currentPlayer);

      if (session) {
        const team = unwrapSingleRelation(session.team);
        if (team) {
          const currentTeam = attendanceByTeam.get(team.id) ?? {
            label: getTeamDisplayName(team),
            total: 0,
            attended: 0,
          };
          currentTeam.total += 1;
          if (isPositiveAttendanceStatus(entry.status)) {
            currentTeam.attended += 1;
          }
          attendanceByTeam.set(team.id, currentTeam);
        }

        const groupLabel = getGroupLabel(session);
        const currentGroup = attendanceByGroup.get(groupLabel) ?? {
          label: groupLabel,
          total: 0,
          attended: 0,
        };
        currentGroup.total += 1;
        if (isPositiveAttendanceStatus(entry.status)) {
          currentGroup.attended += 1;
        }
        attendanceByGroup.set(groupLabel, currentGroup);

        const key = monthKey(new Date(session.session_date));
        if (key in attendanceTotalSeries) {
          attendanceTotalSeries[key] += 1;
          totalAttendanceEvents += 1;
          if (isPositiveAttendanceStatus(entry.status)) {
            attendedSeries[key] += 1;
            attendedEvents += 1;
          }
          if (isMissedAttendanceStatus(entry.status)) {
            missedSeries[key] += 1;
          }
        }
      } else {
        totalAttendanceEvents += 1;
        if (isPositiveAttendanceStatus(entry.status)) {
          attendedEvents += 1;
        }
      }
    }

    const attendanceRate =
      totalAttendanceEvents > 0 ? (attendedEvents / totalAttendanceEvents) * 100 : 0;
    const bookingRevenue = paidBookings.reduce((sum, booking) => sum + booking.amount / 100, 0);
    const recurringSubscriptionMrr = activeRecurringSubscriptions.reduce(
      (sum, subscription) => sum + subscriptionMrr(subscription),
      0,
    );
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

    const trainingSummary = buildTrainingAnalyticsSummary({
      plans: data.trainingPlans,
      drills: data.trainingDrills,
    });

    const financeOverview = buildFinanceOverview({
      bookings: data.sessionBookings,
      subscriptions: data.subscriptions,
      camps: data.camps as never,
      enrolments: data.enrolments as never,
      expenses: data.financeExpenses,
      invoices: data.financeInvoices,
    });

    const videoSummary = buildVideoAnalyticsSummary({
      assets: data.videoAssets,
      clips: attachPlayersToClips(data.videoClips, data.videoClipPlayers),
      players: data.players,
    });

    return {
      metrics: {
        totalPlayers: data.players.length,
        totalTeams: data.teams.length,
        totalSessions,
        publicSessions: publicSessions.length,
        attendanceRate,
        missedSessions: data.attendance.filter((entry) =>
          isMissedAttendanceStatus(entry.status),
        ).length,
        reportsGenerated: data.reports.length,
        activeParentSubscriptions: activeSubscriptions.length,
        activeRecurringSubscriptions: activeRecurringSubscriptions.length,
        mrr,
        recurringSubscriptionMrr,
        bookingRevenue,
        bookingConversion,
        averagePublicOccupancy,
        remainingPublicCapacity,
        campRevenue,
        averageCampOccupancy,
        trainingHours: trainingSummary.trainingHours,
        trainingPlansCompleted: trainingSummary.plansCompleted,
        financeProfitThisMonth: financeOverview.profitThisMonth,
        financeExpensesThisMonth: financeOverview.expensesThisMonth,
        financeCashFlowThisMonth: financeOverview.cashFlowThisMonth,
        videoClipsTotal: videoSummary.totalClips,
        videoSharedClips: videoSummary.sharedClips,
        videoReviewCompletion: videoSummary.reviewCompletionRate,
        videoMatchClips: videoSummary.matchClips,
        videoTrainingClips: videoSummary.trainingClips,
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
        missed: monthKeys.map((key) => ({
          label: monthLabel(key),
          value: missedSeries[key],
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
        teams: [...attendanceByTeam.values()]
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
    <div className="page-content-enter space-y-10">
      <FeaturePageHeader
        featureKey="analytics"
        title={FOOTBALL_LABELS.analytics}
        subtitle="See how training sessions, parent bookings, attendance, and academy income are performing."
      />

      {setupTables.length > 0 ? (
        <SetupRequiredPanel
          {...getSetupRequiredMessage(setupTables)}
          tables={setupTables}
        />
      ) : null}

      {error ? <FormErrorAlert message={error} /> : null}

      {loading ? (
        <PanelSkeleton />
      ) : null}

      {!loading && !error && analytics ? (
        <>
          <section
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            aria-label="Analytics summary"
          >
            <StatCard
              label="Players and parents"
              value={String(analytics.metrics.totalPlayers)}
              valueAriaLabel={`${analytics.metrics.totalPlayers} players and parents`}
              hint="Families in your squad"
              icon={Users}
            />
            <StatCard
              label="Total teams"
              value={String(analytics.metrics.totalTeams)}
              valueAriaLabel={`${analytics.metrics.totalTeams} teams`}
              hint="Squads you coach"
              icon={Users}
            />
            <StatCard
              label="Total sessions"
              value={String(analytics.metrics.totalSessions)}
              valueAriaLabel={`${analytics.metrics.totalSessions} sessions`}
              hint="Sessions on your calendar"
              icon={CalendarClock}
            />
            <StatCard
              label="Public sessions"
              value={String(analytics.metrics.publicSessions)}
              valueAriaLabel={`${analytics.metrics.publicSessions} public sessions`}
              hint="Sessions parents can book online"
              icon={CalendarClock}
            />
            <StatCard
              label="Attendance rate"
              value={percentage(analytics.metrics.attendanceRate)}
              valueAriaLabel={`${percentage(analytics.metrics.attendanceRate)} attendance rate`}
              hint="How often players attend when marked on a register"
              icon={TrendingUp}
            />
            <StatCard
              label="Missed sessions"
              value={String(analytics.metrics.missedSessions)}
              valueAriaLabel={`${analytics.metrics.missedSessions} missed sessions`}
              hint="Absences recorded on registers"
              icon={CalendarClock}
            />
            <StatCard
              label="Player reports"
              value={String(analytics.metrics.reportsGenerated)}
              valueAriaLabel={`${analytics.metrics.reportsGenerated} player reports`}
              hint="Progress reports you have saved"
              icon={FileText}
            />
            <StatCard
              label="Active monthly payment plans"
              value={String(analytics.metrics.activeParentSubscriptions)}
              valueAriaLabel={`${analytics.metrics.activeParentSubscriptions} active monthly payment plans`}
              hint="Parents paying regularly each month"
              icon={PoundSterling}
            />
            <StatCard
              label="Active weekly training packages"
              value={String(analytics.metrics.activeRecurringSubscriptions)}
              valueAriaLabel={`${analytics.metrics.activeRecurringSubscriptions} active weekly training packages`}
              hint="Families on weekly training packages"
              icon={Users}
            />
            <StatCard
              label="Monthly income from regular payments"
              value={currency(analytics.metrics.mrr)}
              valueAriaLabel={`${currency(analytics.metrics.mrr)} monthly income from regular payments`}
              hint="Regular monthly payments from parents"
              icon={PoundSterling}
            />
            <StatCard
              label="Monthly income from weekly training packages"
              value={currency(analytics.metrics.recurringSubscriptionMrr)}
              valueAriaLabel={`${currency(analytics.metrics.recurringSubscriptionMrr)} monthly income from weekly training packages`}
              hint="Weekly package payments shown as a monthly amount"
              icon={PoundSterling}
            />
            <StatCard
              label="Income from bookings"
              value={currency(analytics.metrics.bookingRevenue)}
              valueAriaLabel={`${currency(analytics.metrics.bookingRevenue)} income from bookings`}
              hint="Paid session bookings"
              icon={PoundSterling}
            />
            <StatCard
              label="Parent booking rate"
              value={percentage(analytics.metrics.bookingConversion)}
              valueAriaLabel={`${percentage(analytics.metrics.bookingConversion)} parent booking rate`}
              hint="The percentage of parents who complete bookings"
              icon={TrendingUp}
            />
            <StatCard
              label="Session spaces filled"
              value={percentage(analytics.metrics.averagePublicOccupancy)}
              valueAriaLabel={`${percentage(analytics.metrics.averagePublicOccupancy)} session spaces filled`}
              hint="How full your sessions are on average"
              icon={TrendingUp}
            />
            <StatCard
              label="Camp income"
              value={currency(analytics.metrics.campRevenue)}
              valueAriaLabel={`${currency(analytics.metrics.campRevenue)} camp income`}
              hint="Income from camp enrolments"
              icon={PoundSterling}
            />
            <StatCard
              label="Camp spaces filled"
              value={percentage(analytics.metrics.averageCampOccupancy)}
              valueAriaLabel={`${percentage(analytics.metrics.averageCampOccupancy)} camp spaces filled`}
              hint="How full your camps are on average"
              icon={TrendingUp}
            />
            <StatCard
              label="Training hours planned"
              value={`${analytics.metrics.trainingHours}h`}
              valueAriaLabel={`${analytics.metrics.trainingHours} training hours planned`}
              hint="Estimated from your active training plans"
              icon={TrendingUp}
            />
            <StatCard
              label="Training reflections completed"
              value={String(analytics.metrics.trainingPlansCompleted)}
              valueAriaLabel={`${analytics.metrics.trainingPlansCompleted} training reflections completed`}
              hint="Plans with a saved post-session reflection"
              icon={TrendingUp}
            />
            <StatCard
              label="Profit this month"
              value={formatFinanceCurrency(analytics.metrics.financeProfitThisMonth)}
              valueAriaLabel={`${formatFinanceCurrency(analytics.metrics.financeProfitThisMonth)} profit this month`}
              hint="Income minus expenses from Finance Centre"
              icon={PoundSterling}
            />
            <StatCard
              label="Expenses this month"
              value={formatFinanceCurrency(analytics.metrics.financeExpensesThisMonth)}
              valueAriaLabel={`${formatFinanceCurrency(analytics.metrics.financeExpensesThisMonth)} expenses this month`}
              hint="Logged academy costs"
              icon={PoundSterling}
            />
            <StatCard
              label="Cash flow this month"
              value={formatFinanceCurrency(analytics.metrics.financeCashFlowThisMonth)}
              valueAriaLabel={`${formatFinanceCurrency(analytics.metrics.financeCashFlowThisMonth)} cash flow this month`}
              hint="Income minus paid expenses"
              icon={PoundSterling}
            />
            <StatCard
              label="Video clips"
              value={String(analytics.metrics.videoClipsTotal)}
              valueAriaLabel={`${analytics.metrics.videoClipsTotal} video clips`}
              hint={`${analytics.metrics.videoMatchClips} match · ${analytics.metrics.videoTrainingClips} training`}
              icon={TrendingUp}
            />
            <StatCard
              label="Shared clips"
              value={String(analytics.metrics.videoSharedClips)}
              valueAriaLabel={`${analytics.metrics.videoSharedClips} shared clips`}
              hint="Clips visible to parents"
              icon={TrendingUp}
            />
            <StatCard
              label="Clip review completion"
              value={percentage(analytics.metrics.videoReviewCompletion)}
              valueAriaLabel={`${percentage(analytics.metrics.videoReviewCompletion)} clip review completion`}
              hint="Reviewed clips as a share of all clips"
              icon={TrendingUp}
            />
          </section>

          <section
            className="football-panel football-panel-interactive rounded-2xl p-6 sm:p-7"
            aria-labelledby="monthly-payment-income-explainer-heading"
          >
            <h2
              id="monthly-payment-income-explainer-heading"
              className="text-base font-semibold tracking-tight"
            >
              About monthly payment income
            </h2>
            <p className="text-muted mt-2 text-sm leading-relaxed">
              Regular monthly payments from parents. Weekly payments are shown as a monthly amount
              so you can compare different plans side by side.
            </p>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <MiniBarChart
              titleId="income-over-time-heading"
              title="Income over time"
              points={analytics.charts.revenue}
              formatter={currency}
              accent="bg-accent"
              emptyMessage="Complete sessions and receive bookings to see trends."
            />
            <MiniBarChart
              titleId="session-attendance-trend-heading"
              title="Session attendance trend"
              points={analytics.charts.attendance}
              formatter={percentage}
              accent="bg-sky-500"
              emptyMessage="Complete sessions and receive bookings to see trends."
            />
            <MiniBarChart
              titleId="session-spaces-filled-heading"
              title="Session spaces filled"
              points={analytics.charts.occupancy}
              formatter={percentage}
              accent="bg-emerald-500"
              emptyMessage="Complete sessions and receive bookings to see trends."
            />
            <MiniBarChart
              titleId="session-volume-heading"
              title="Sessions by month"
              points={analytics.charts.sessions}
              emptyMessage="Complete sessions and receive bookings to see trends."
              accent="bg-violet-500"
            />
            <MiniBarChart
              titleId="missed-sessions-heading"
              title="Missed sessions by month"
              points={analytics.charts.missed}
              emptyMessage="Complete sessions and receive bookings to see trends."
              accent="bg-rose-500"
            />
            <MiniBarChart
              titleId="player-reports-heading"
              title="Player reports by month"
              points={analytics.charts.reports}
              emptyMessage="Complete sessions and receive bookings to see trends."
              accent="bg-amber-500"
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-3">
            <AttendanceBreakdownList
              titleId="attendance-per-player-heading"
              title="Attendance per player"
              rows={analytics.breakdowns.players}
              emptyMessage="No booking information yet. Complete sessions and receive bookings to see trends."
            />
            <AttendanceBreakdownList
              titleId="attendance-per-team-heading"
              title="Attendance per team"
              rows={analytics.breakdowns.teams}
              emptyMessage="No booking information yet. Complete sessions and receive bookings to see trends."
            />
            <AttendanceBreakdownList
              titleId="attendance-per-group-heading"
              title="Attendance per group"
              rows={analytics.breakdowns.groups}
              emptyMessage="No booking information yet. Complete sessions and receive bookings to see trends."
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
