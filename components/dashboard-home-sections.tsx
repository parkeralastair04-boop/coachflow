"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock3,
  CreditCard,
  FileText,
  HelpCircle,
  Loader2,
  MapPin,
  Plus,
  UserPlus,
} from "lucide-react";
import {
  computeCoachingIncomeMetrics,
  formatCoachingIncome,
} from "@/lib/coaching-income";
import {
  loadOnboardingCoachContext,
  resolveBookingPortalUrl,
} from "@/lib/onboarding-setup";
import { getBookingDisplayStatus } from "@/lib/session-booking-display";
import type { SessionBookingStatus } from "@/lib/booking-system";
import { FOOTBALL_LABELS } from "@/lib/football-identity";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type UpcomingSession = {
  id: string;
  session_date: string;
  session_type: string | null;
  group_name: string | null;
  location: string | null;
  team: { team_name: string } | { team_name: string }[] | null;
  confirmedCount: number;
};

type RecentBooking = {
  id: string;
  created_at: string;
  parent_name: string | null;
  booking_status: SessionBookingStatus;
  payment_status: string;
  expires_at: string | null;
  childName: string;
  sessionName: string;
};

type BusinessSummary = {
  players: number;
  upcomingSessions: number;
  confirmedBookings: number;
  monthlyIncome: number;
};

type DashboardHomeData = {
  upcomingSessions: UpcomingSession[];
  recentBookings: RecentBooking[];
  summary: BusinessSummary;
  bookingUrl: string | null;
  hasBooking: boolean;
};

function startOfTodayIso(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString();
}

function unwrapRelation<T>(value: T | T[] | null): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function formatSessionDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function formatSessionTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function formatBookingDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(parsed);
}

function getSessionTitle(session: {
  group_name: string | null;
  session_type: string | null;
  team: UpcomingSession["team"];
}): string {
  if (session.group_name?.trim()) return session.group_name;
  const team = unwrapRelation(session.team);
  if (team?.team_name?.trim()) return team.team_name;
  return session.session_type?.trim() || "Training session";
}

function BookingStatusBadge({
  booking,
}: {
  booking: Pick<RecentBooking, "booking_status" | "payment_status" | "expires_at">;
}) {
  const status = getBookingDisplayStatus(booking);
  const StatusIcon =
    status.tone === "confirmed"
      ? CheckCircle2
      : status.tone === "pending"
        ? Clock3
        : status.tone === "waitlist"
          ? ClipboardList
          : CheckCircle2;
  const toneClass =
    status.tone === "confirmed"
      ? "bg-accent/10 text-accent ring-accent/25"
      : status.tone === "pending"
        ? "bg-amber-500/10 text-amber-800 ring-amber-500/25 dark:text-amber-200"
        : status.tone === "waitlist"
          ? "bg-sky-500/10 text-sky-800 ring-sky-500/25 dark:text-sky-200"
          : "bg-black/[0.04] text-muted ring-black/[0.08] dark:bg-white/[0.06] dark:ring-white/[0.08]";

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1",
        toneClass,
      )}
    >
      <StatusIcon className="size-3 shrink-0" aria-hidden />
      {status.label}
    </span>
  );
}

function ViewSessionsLink({ className }: { className?: string }) {
  return (
    <Link
      href="/dashboard/sessions"
      className={cn(
        "border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-full border px-5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]",
        className,
      )}
    >
      View sessions
      <ArrowRight className="ml-2 size-4" aria-hidden />
    </Link>
  );
}

function ResourceLinkCard({
  href,
  label,
  icon: Icon,
  guidance,
}: {
  href: string;
  label: string;
  icon: typeof CreditCard;
  guidance?: string;
}) {
  return (
    <Link
      href={href}
      className="football-panel focus-visible:ring-accent/40 flex h-full flex-col rounded-2xl p-5 outline-none transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="flex items-center gap-3">
        <div className="bg-accent/12 ring-accent/25 flex size-10 shrink-0 items-center justify-center rounded-xl ring-1">
          <Icon className="text-accent size-4" aria-hidden />
        </div>
        <span className="font-medium">{label}</span>
      </div>
      {guidance ? (
        <p className="text-muted mt-3 text-sm leading-relaxed">{guidance}</p>
      ) : (
        <span className="text-accent mt-4 inline-flex items-center gap-1.5 text-sm font-medium">
          Open
          <ArrowRight className="size-3.5" aria-hidden />
        </span>
      )}
    </Link>
  );
}

export function DashboardHomeSections() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardHomeData | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const coachContext = await loadOnboardingCoachContext(supabase, user.id);
        const bookingUrl = resolveBookingPortalUrl(coachContext);

        const [
          { count: playerCount },
          { count: upcomingSessionCount },
          { count: confirmedBookingCount },
          { data: upcomingSessionRows },
          { data: recentBookingRows },
          { data: allBookings },
          { data: subscriptions },
          { data: sessionBookingRows },
        ] = await Promise.all([
          supabase
            .from("players")
            .select("id", { count: "exact", head: true })
            .eq("coach_id", user.id),
          supabase
            .from("sessions")
            .select("id", { count: "exact", head: true })
            .eq("coach_id", user.id)
            .gte("session_date", startOfTodayIso()),
          supabase
            .from("session_bookings")
            .select("id", { count: "exact", head: true })
            .eq("coach_id", user.id)
            .eq("booking_status", "confirmed"),
          supabase
            .from("sessions")
            .select(
              "id, session_date, session_type, group_name, location, team:teams(team_name)",
            )
            .eq("coach_id", user.id)
            .gte("session_date", startOfTodayIso())
            .order("session_date", { ascending: true })
            .limit(3),
          supabase
            .from("session_bookings")
            .select(
              "id, created_at, parent_name, booking_status, payment_status, expires_at, player:players(player_name), session:sessions(session_type, group_name, team:teams(team_name))",
            )
            .eq("coach_id", user.id)
            .eq("booking_status", "confirmed")
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("session_bookings")
            .select(
              "booking_status, payment_status, expires_at, amount, created_at",
            )
            .eq("coach_id", user.id),
          supabase
            .from("parent_subscriptions")
            .select("status, amount, interval")
            .eq("coach_id", user.id),
          supabase
            .from("session_bookings")
            .select("session_id, booking_status")
            .eq("coach_id", user.id)
            .eq("booking_status", "confirmed"),
        ]);

        if (cancelled) return;

        const confirmedBySession = new Map<string, number>();
        for (const booking of sessionBookingRows ?? []) {
          if (!booking.session_id) continue;
          confirmedBySession.set(
            booking.session_id,
            (confirmedBySession.get(booking.session_id) ?? 0) + 1,
          );
        }

        const upcomingSessions: UpcomingSession[] = (upcomingSessionRows ?? []).map(
          (session) => ({
            ...session,
            confirmedCount: confirmedBySession.get(session.id) ?? 0,
          }),
        );

        const recentBookings: RecentBooking[] = (recentBookingRows ?? []).map((booking) => {
          const player = unwrapRelation(booking.player);
          const session = unwrapRelation(booking.session);
          return {
            id: booking.id,
            created_at: booking.created_at,
            parent_name: booking.parent_name,
            booking_status: booking.booking_status,
            payment_status: booking.payment_status,
            expires_at: booking.expires_at,
            childName: player?.player_name ?? booking.parent_name ?? "Parent booking",
            sessionName: session ? getSessionTitle(session) : "Training session",
          };
        });

        const incomeMetrics = computeCoachingIncomeMetrics(
          allBookings ?? [],
          subscriptions ?? [],
        );
        const monthlyIncome =
          incomeMetrics.monthlyBookingIncome + incomeMetrics.activeMonthlyPaymentIncome;

        setData({
          upcomingSessions,
          recentBookings,
          summary: {
            players: playerCount ?? 0,
            upcomingSessions: upcomingSessionCount ?? 0,
            confirmedBookings: confirmedBookingCount ?? 0,
            monthlyIncome,
          },
          bookingUrl,
          hasBooking: (confirmedBookingCount ?? 0) > 0,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="football-panel flex items-center gap-3 rounded-2xl p-6 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading your dashboard...
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { upcomingSessions, recentBookings, summary, bookingUrl, hasBooking } = data;
  const isBusinessEmpty =
    summary.players === 0 &&
    summary.upcomingSessions === 0 &&
    summary.confirmedBookings === 0;

  return (
    <div className="space-y-10">
      <section id="sessions" className="scroll-mt-24 space-y-4" aria-labelledby="upcoming-sessions-heading">
        <h2 id="upcoming-sessions-heading" className="text-lg font-semibold tracking-tight">
          Upcoming training sessions
        </h2>

        {upcomingSessions.length > 0 ? (
          <div className="football-panel football-panel-interactive rounded-2xl p-6 sm:p-8">
            <ul className="space-y-4" role="list">
              {upcomingSessions.map((session) => (
                <li
                  key={session.id}
                  className="border-border rounded-2xl border p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <p className="font-medium">{getSessionTitle(session)}</p>
                      <dl className="text-muted grid gap-2 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="sr-only">Date</dt>
                          <dd>{formatSessionDate(session.session_date)}</dd>
                        </div>
                        <div>
                          <dt className="sr-only">Time</dt>
                          <dd>{formatSessionTime(session.session_date)}</dd>
                        </div>
                        <div>
                          <dt className="sr-only">Confirmed bookings</dt>
                          <dd>
                            {session.confirmedCount === 1
                              ? "1 confirmed booking"
                              : `${session.confirmedCount} confirmed bookings`}
                          </dd>
                        </div>
                        {session.location ? (
                          <div className="flex items-start gap-1.5 sm:col-span-2">
                            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                            <div>
                              <dt className="sr-only">Location</dt>
                              <dd>{session.location}</dd>
                            </div>
                          </div>
                        ) : null}
                      </dl>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <ViewSessionsLink className="mt-6" />
          </div>
        ) : (
          <div
            className="football-panel football-panel-interactive rounded-2xl p-8 text-center"
            role="status"
            aria-live="polite"
          >
            <CalendarClock className="text-muted mx-auto size-8" aria-hidden />
            <p className="mt-3 font-medium">No upcoming sessions yet</p>
            <p className="text-muted mx-auto mt-2 max-w-md text-sm leading-relaxed">
              Publish a training slot so parents have something to book on your booking page.
            </p>
            <Link
              href="/dashboard/sessions"
              className="bg-foreground text-background hover:opacity-90 focus-visible:ring-accent/40 mt-6 inline-flex min-h-11 items-center justify-center rounded-full px-6 text-sm font-medium outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Create your first session
              <ArrowRight className="ml-2 size-4" aria-hidden />
            </Link>
          </div>
        )}
      </section>

      <section
        id="parents"
        className="scroll-mt-24 space-y-4"
        aria-labelledby="recent-bookings-heading"
      >
        <h2 id="recent-bookings-heading" className="text-lg font-semibold tracking-tight">
          Recent bookings
        </h2>

        {recentBookings.length > 0 ? (
          <div className="football-panel football-panel-interactive rounded-2xl p-6 sm:p-8">
            <ul className="space-y-3" role="list">
              {recentBookings.map((booking) => (
                <li
                  key={booking.id}
                  className="flex flex-col gap-3 rounded-2xl bg-black/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between dark:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{booking.childName}</p>
                    <p className="text-muted mt-1 text-sm">
                      {booking.sessionName} · {formatBookingDate(booking.created_at)}
                    </p>
                  </div>
                  <BookingStatusBadge booking={booking} />
                </li>
              ))}
            </ul>
            <ViewSessionsLink className="mt-6" />
          </div>
        ) : (
          <div
            className="football-panel football-panel-interactive rounded-2xl p-8 text-center"
            role="status"
            aria-live="polite"
          >
            <ClipboardList className="text-muted mx-auto size-8" aria-hidden />
            <p className="mt-3 font-medium">No parent bookings yet</p>
            <p className="text-muted mx-auto mt-2 max-w-md text-sm leading-relaxed">
              Copy your booking link from the checklist, then send it on WhatsApp or email.
              Confirmed places will show here.
            </p>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4" aria-labelledby="quick-actions-heading">
          <h2 id="quick-actions-heading" className="text-lg font-semibold tracking-tight">
            Quick actions
          </h2>
          <div className="football-panel football-panel-interactive rounded-2xl p-6 sm:p-8">
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/dashboard/players"
                className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-4 text-center text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
              >
                <UserPlus className="text-accent size-5" aria-hidden />
                Add player
              </Link>
              <Link
                href="/dashboard/sessions"
                className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-4 text-center text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
              >
                <Plus className="text-accent size-5" aria-hidden />
                Create session
              </Link>
              {bookingUrl ? (
                <a
                  href={bookingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-4 text-center text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
                >
                  <CalendarClock className="text-accent size-5" aria-hidden />
                  Open booking page
                </a>
              ) : (
                <span className="border-border text-muted flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-4 text-center text-sm font-medium opacity-60">
                  <CalendarClock className="size-5" aria-hidden />
                  Open booking page
                </span>
              )}
              <Link
                href="/dashboard/payments"
                className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-4 text-center text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
              >
                <CreditCard className="text-accent size-5" aria-hidden />
                Parent payments
              </Link>
            </div>
          </div>
        </section>

        <section className="space-y-4" aria-labelledby="business-summary-heading">
          <h2 id="business-summary-heading" className="text-lg font-semibold tracking-tight">
            Your academy at a glance
          </h2>
          <div className="football-panel pitch-card-accent relative h-full overflow-hidden rounded-2xl p-6 sm:p-8">
            <div className="pointer-events-none absolute inset-0 tactical-grid opacity-[0.15]" aria-hidden />
            <dl className="relative grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted text-xs font-medium">{FOOTBALL_LABELS.players}</dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight" aria-label={`${summary.players} players`}>
                  {summary.players}
                </dd>
              </div>
              <div>
                <dt className="text-muted text-xs font-medium">{FOOTBALL_LABELS.sessions}</dt>
                <dd
                  className="mt-1 text-2xl font-semibold tracking-tight"
                  aria-label={`${summary.upcomingSessions} upcoming sessions`}
                >
                  {summary.upcomingSessions}
                </dd>
              </div>
              <div>
                <dt className="text-muted text-xs font-medium">{FOOTBALL_LABELS.bookings}</dt>
                <dd
                  className="mt-1 text-2xl font-semibold tracking-tight"
                  aria-label={`${summary.confirmedBookings} confirmed bookings`}
                >
                  {summary.confirmedBookings}
                </dd>
              </div>
              <div>
                <dt className="text-muted text-xs font-medium">Monthly income</dt>
                <dd
                  className="mt-1 text-2xl font-semibold tracking-tight"
                  aria-label={`${formatCoachingIncome(summary.monthlyIncome)} monthly income`}
                >
                  {formatCoachingIncome(summary.monthlyIncome)}
                </dd>
              </div>
            </dl>
            <p className="text-muted mt-6 text-sm leading-relaxed">
              {isBusinessEmpty
                ? "You're ready to start sharing your booking page with parents."
                : `You currently have ${summary.players} ${summary.players === 1 ? "player" : "players"} and ${summary.confirmedBookings} confirmed ${summary.confirmedBookings === 1 ? "booking" : "bookings"}.`}
            </p>
          </div>
        </section>
      </div>

      <section className="space-y-4" aria-labelledby="resources-heading">
        <h2 id="resources-heading" className="sr-only">
          Coaching tools
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ResourceLinkCard
            href="/dashboard/payments"
            label="Payments"
            icon={CreditCard}
            guidance={
              hasBooking
                ? undefined
                : "Set up parent payments once families start booking regularly."
            }
          />
          <ResourceLinkCard
            href="/dashboard/reports"
            label="Reports"
            icon={FileText}
            guidance={
              hasBooking ? undefined : "Send player progress reports after your first bookings."
            }
          />
          <ResourceLinkCard
            href="/dashboard/analytics"
            label="Analytics"
            icon={BarChart3}
            guidance={hasBooking ? undefined : "Income and bookings appear after parents start booking."}
          />
          <ResourceLinkCard href="/dashboard/help" label="Help" icon={HelpCircle} />
        </div>
      </section>
    </div>
  );
}
