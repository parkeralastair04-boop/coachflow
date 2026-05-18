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
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type AttendanceStatus = "scheduled" | "attended" | "missed" | "cancelled";

type PlayerRow = {
  id: string;
};

type SessionRow = {
  id: string;
  coach_id: string;
  session_datetime: string;
  attendance_status: AttendanceStatus;
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

type AnalyticsData = {
  players: PlayerRow[];
  sessions: SessionRow[];
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

export function AnalyticsManager() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

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
        reportsResult,
        subscriptionsResult,
        campsResult,
        enrolmentsResult,
      ] = await Promise.all([
        supabase.from("players").select("id").eq("coach_id", user.id),
        supabase
          .from("sessions")
          .select("id, coach_id, session_datetime, attendance_status")
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

      const firstError =
        playersResult.error ??
        sessionsResult.error ??
        reportsResult.error ??
        subscriptionsResult.error ??
        campsResult.error ??
        enrolmentsResult.error;

      if (firstError) {
        setError(firstError.message);
        return;
      }

      setData({
        players: (playersResult.data ?? []) as PlayerRow[],
        sessions: (sessionsResult.data ?? []) as SessionRow[],
        reports: (reportsResult.data ?? []) as ReportRow[],
        subscriptions: (subscriptionsResult.data ?? []) as ParentSubscriptionRow[],
        camps: (campsResult.data ?? []) as CampRow[],
        enrolments: (enrolmentsResult.data ?? []) as CampEnrolmentRow[],
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

    const activeSubscriptions = data.subscriptions.filter((subscription) =>
      isActiveSubscription(subscription.status),
    );
    const totalSessions = data.sessions.length;
    const attendedSessions = data.sessions.filter(
      (session) => session.attendance_status === "attended",
    ).length;
    const attendanceRate = totalSessions > 0 ? (attendedSessions / totalSessions) * 100 : 0;

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
    for (const camp of data.camps) {
      const key = monthKey(new Date(`${camp.start_date}T12:00:00`));
      if (key in revenueSeries) {
        revenueSeries[key] += parsePrice(camp.price) * (enrolledByCamp.get(camp.id) ?? 0);
      }
    }

    const sessionVolumeSeries = emptySeries();
    const attendedSeries = emptySeries();
    const attendanceTotalSeries = emptySeries();
    for (const session of data.sessions) {
      const key = monthKey(new Date(session.session_datetime));
      if (!(key in sessionVolumeSeries)) continue;
      sessionVolumeSeries[key] += 1;
      attendanceTotalSeries[key] += 1;
      if (session.attendance_status === "attended") {
        attendedSeries[key] += 1;
      }
    }

    const reportsSeries = emptySeries();
    for (const report of data.reports) {
      const key = monthKey(new Date(report.created_at));
      if (key in reportsSeries) reportsSeries[key] += 1;
    }

    return {
      metrics: {
        totalPlayers: data.players.length,
        totalSessions,
        attendanceRate,
        reportsGenerated: data.reports.length,
        activeParentSubscriptions: activeSubscriptions.length,
        mrr,
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
        sessions: monthKeys.map((key) => ({
          label: monthLabel(key),
          value: sessionVolumeSeries[key],
        })),
        reports: monthKeys.map((key) => ({
          label: monthLabel(key),
          value: reportsSeries[key],
        })),
      },
    };
  }, [data]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Analytics
        </h1>
        <p className="text-muted mt-1 text-sm">
          Track growth, delivery, revenue, and engagement across your coaching
          business.
        </p>
      </div>

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
        </>
      ) : null}
    </div>
  );
}
