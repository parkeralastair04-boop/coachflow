"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Award,
  BarChart3,
  ClipboardList,
  CreditCard,
  FileText,
  HeartPulse,
  Loader2,
  Mail,
  UserRound,
  Users,
} from "lucide-react";
import { buildParentMailtoLink } from "@/lib/attendance-alerts";
import {
  formatCampCurrency,
  formatCampDateRange,
  type CampActivityItem,
  type CampAttendeeCard,
  type CampAttendanceSummary,
  type CampInsightConcern,
  type CampInsightLeader,
  type CampWithStats,
} from "@/lib/camp-insights";
import { formatTeamInsightDate } from "@/lib/team-insights";

type CampHubPanelProps = {
  camp: CampWithStats;
  summaryCopy: string;
  incomeSummary: {
    incomeReceived: number;
    spacesFilled: number;
    averageAttendance: number;
    familiesWaiting: number;
    summaryCopy: string;
  };
  attendance: CampAttendanceSummary;
  attendeeCards: CampAttendeeCard[];
  leaders: CampInsightLeader[];
  missingReports: CampAttendeeCard[];
  concerns: CampInsightConcern[];
  lateArrivals: CampInsightConcern[];
  timeline: CampActivityItem[];
  linkedSessionCount: number;
  loading?: boolean;
};

function TimelineIcon({ item }: { item: CampActivityItem }) {
  if (item.type === "report") return <FileText className="size-4 shrink-0" aria-hidden />;
  if (item.title === "Injury recorded") {
    return <HeartPulse className="size-4 shrink-0" aria-hidden />;
  }
  if (item.type === "booking") return <Users className="size-4 shrink-0" aria-hidden />;
  return <AlertTriangle className="size-4 shrink-0" aria-hidden />;
}

export function CampHubPanel({
  camp,
  summaryCopy,
  incomeSummary,
  attendance,
  attendeeCards,
  leaders,
  missingReports,
  concerns,
  lateArrivals,
  timeline,
  linkedSessionCount,
  loading = false,
}: CampHubPanelProps) {
  const firstAttendeeId = attendeeCards[0]?.playerId;

  return (
    <div className="space-y-6">
      <section
        className="glass-panel interactive-surface rounded-2xl p-5 sm:p-6"
        aria-labelledby="camp-overview-heading"
      >
        <h2 id="camp-overview-heading" className="text-lg font-semibold tracking-tight">
          Camp overview
        </h2>
        <p className="text-muted mt-1 text-sm">{formatCampDateRange(camp.start_date, camp.end_date)}</p>
        <p className="mt-3 text-sm leading-relaxed" role="status">
          {summaryCopy}
        </p>

        {loading ? (
          <p className="text-muted mt-4 flex items-center gap-2 text-sm" role="status" aria-live="polite">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading camp insights...
          </p>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
            <p className="text-muted text-xs">Capacity</p>
            <p className="mt-1 font-semibold">{camp.capacity}</p>
          </div>
          <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
            <p className="text-muted text-xs">Confirmed bookings</p>
            <p className="mt-1 font-semibold">{camp.enrolled}</p>
          </div>
          <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
            <p className="text-muted text-xs">Waiting list</p>
            <p className="mt-1 font-semibold">{camp.waitlist}</p>
          </div>
          <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
            <p className="text-muted text-xs">Income</p>
            <p className="mt-1 font-semibold">{formatCampCurrency(camp.revenue)}</p>
          </div>
          <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
            <p className="text-muted text-xs">Remaining spaces</p>
            <p className="mt-1 font-semibold">{camp.remaining}</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="camp-quick-actions-heading">
        <h2 id="camp-quick-actions-heading" className="sr-only">
          Camp quick actions
        </h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href={
              attendance.primarySessionId
                ? `/dashboard/registers?session=${attendance.primarySessionId}`
                : "/dashboard/registers"
            }
            className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ClipboardList className="size-4" aria-hidden />
            Take register
          </Link>
          <Link
            href={
              firstAttendeeId
                ? `/dashboard/reports?player=${firstAttendeeId}`
                : "/dashboard/reports"
            }
            className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
          >
            <FileText className="size-4" aria-hidden />
            Create report
          </Link>
          <Link
            href="/dashboard/payments"
            className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
          >
            <CreditCard className="size-4" aria-hidden />
            Payments
          </Link>
          <Link
            href="/dashboard/analytics"
            className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
          >
            <BarChart3 className="size-4" aria-hidden />
            Analytics
          </Link>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section
          className="glass-panel interactive-surface rounded-2xl p-5 sm:p-6"
          aria-labelledby="camp-attendance-heading"
        >
          <h2 id="camp-attendance-heading" className="text-lg font-semibold tracking-tight">
            Camp attendance
          </h2>
          {linkedSessionCount === 0 ? (
            <p className="text-muted mt-4 text-sm">
              Create camp sessions with a matching group name, then take the register to track attendance.
            </p>
          ) : (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
                  <p className="text-muted text-xs">Present</p>
                  <p className="mt-1 font-semibold">{attendance.present}</p>
                </div>
                <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
                  <p className="text-muted text-xs">Absent</p>
                  <p className="mt-1 font-semibold">{attendance.absent}</p>
                </div>
                <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
                  <p className="text-muted text-xs">Late</p>
                  <p className="mt-1 font-semibold">{attendance.late}</p>
                </div>
              </div>
              <p className="text-muted mt-4 text-sm" role="status">
                Register completion: {attendance.registerMarked} of {attendance.registerTotal} marks
                recorded
                {attendance.registerComplete ? " — complete" : ""}.
              </p>
              {attendance.registerTotal === 0 ? (
                <p className="text-muted mt-2 text-sm">Take the register to track attendance.</p>
              ) : null}
            </>
          )}
        </section>

        <section
          className="glass-panel interactive-surface rounded-2xl p-5 sm:p-6"
          aria-labelledby="camp-income-heading"
        >
          <h2 id="camp-income-heading" className="text-lg font-semibold tracking-tight">
            Camp income summary
          </h2>
          <p className="text-muted mt-2 text-sm" role="status">
            {incomeSummary.summaryCopy}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
              <p className="text-muted text-xs">Income received</p>
              <p className="mt-1 font-semibold">
                {formatCampCurrency(incomeSummary.incomeReceived)}
              </p>
            </div>
            <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
              <p className="text-muted text-xs">Spaces filled</p>
              <p className="mt-1 font-semibold">{incomeSummary.spacesFilled}</p>
            </div>
            <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
              <p className="text-muted text-xs">Average attendance</p>
              <p className="mt-1 font-semibold">
                {Math.round(incomeSummary.averageAttendance)}%
              </p>
            </div>
            <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
              <p className="text-muted text-xs">Families waiting</p>
              <p className="mt-1 font-semibold">{incomeSummary.familiesWaiting}</p>
            </div>
          </div>
        </section>
      </div>

      <section
        className="glass-panel interactive-surface rounded-2xl p-5 sm:p-6"
        aria-labelledby="camp-insights-heading"
      >
        <h2 id="camp-insights-heading" className="text-lg font-semibold tracking-tight">
          Camp insights
        </h2>

        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold">Top attendees</h3>
            {leaders.length > 0 ? (
              <ul className="mt-3 space-y-2" role="list" aria-label="Top attendees">
                {leaders.map((leader) => (
                  <li
                    key={leader.playerId}
                    className="rounded-xl bg-black/[0.02] px-3 py-2 text-sm dark:bg-white/[0.03]"
                    role="listitem"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{leader.playerName}</span>
                      {leader.excellentAttendance ? (
                        <span className="bg-accent/10 text-accent ring-accent/20 inline-flex min-h-6 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1">
                          <Award className="size-3.5 shrink-0" aria-hidden />
                          Excellent attendance
                        </span>
                      ) : null}
                    </div>
                    <p className="text-muted mt-1">
                      {Math.round(leader.attendanceRate)}% · Last report:{" "}
                      {formatTeamInsightDate(leader.lastReportDate)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted mt-3 text-sm">No attendance data yet.</p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold">Players without recent reports</h3>
            {missingReports.length > 0 ? (
              <ul className="mt-3 space-y-2" role="list" aria-label="Players without recent reports">
                {missingReports.map((player) => (
                  <li
                    key={player.playerId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/[0.02] px-3 py-2 text-sm dark:bg-white/[0.03]"
                    role="listitem"
                  >
                    <span>{player.playerName}</span>
                    <Link
                      href={`/dashboard/reports?player=${player.playerId}`}
                      className="text-accent focus-visible:ring-accent/40 inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      Create report
                    </Link>
                  </li>
                ))}
              </ul>
            ) : attendeeCards.length > 0 ? (
              <p className="text-muted mt-3 text-sm" role="status">
                All linked attendees have a recent report.
              </p>
            ) : (
              <p className="text-muted mt-3 text-sm">No linked players yet.</p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold">Attendance concerns</h3>
            {concerns.length > 0 ? (
              <ul className="mt-3 space-y-2" role="list" aria-label="Attendance concerns">
                {concerns.map((item) => (
                  <li
                    key={item.playerId}
                    className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm ring-1 ring-amber-500/20"
                    role="listitem"
                  >
                    <span className="font-medium">{item.playerName}</span>
                    <span className="text-muted"> — {item.label}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted mt-3 text-sm">No attendance concerns flagged.</p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold">Late arrivals</h3>
            {lateArrivals.length > 0 ? (
              <ul className="mt-3 space-y-2" role="list" aria-label="Late arrivals">
                {lateArrivals.map((item) => (
                  <li
                    key={item.playerId}
                    className="rounded-xl bg-black/[0.02] px-3 py-2 text-sm dark:bg-white/[0.03]"
                    role="listitem"
                  >
                    <span className="font-medium">{item.playerName}</span>
                    <span className="text-muted"> — {item.label}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted mt-3 text-sm">No late arrivals recorded.</p>
            )}
          </div>
        </div>
      </section>

      <section
        className="glass-panel interactive-surface rounded-2xl p-5 sm:p-6"
        aria-labelledby="camp-reports-heading"
      >
        <h2 id="camp-reports-heading" className="text-lg font-semibold tracking-tight">
          Camp reports
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={
              firstAttendeeId
                ? `/dashboard/reports?player=${firstAttendeeId}`
                : "/dashboard/reports"
            }
            className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Create report
          </Link>
          {attendeeCards.length > 0 ? (
            <span className="text-muted inline-flex min-h-11 items-center text-sm">
              Create reports for all attendees using the player list below.
            </span>
          ) : null}
        </div>
      </section>

      <section
        className="glass-panel interactive-surface rounded-2xl p-5 sm:p-6"
        aria-labelledby="camp-timeline-heading"
      >
        <h2 id="camp-timeline-heading" className="text-lg font-semibold tracking-tight">
          Camp timeline
        </h2>
        <p className="text-muted mt-1 text-sm">Newest first</p>

        {timeline.length > 0 ? (
          <ol className="mt-4 space-y-3" role="list" aria-label="Camp activity timeline">
            {timeline.map((item) => (
              <li
                key={item.id}
                role="listitem"
                className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={
                      item.type === "report"
                        ? "bg-accent/10 text-accent ring-accent/20 inline-flex size-9 shrink-0 items-center justify-center rounded-xl ring-1"
                        : item.type === "booking"
                          ? "bg-sky-500/10 text-sky-800 ring-sky-500/20 inline-flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 dark:text-sky-200"
                          : "bg-amber-500/10 text-amber-800 ring-amber-500/20 inline-flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 dark:text-amber-200"
                    }
                  >
                    <TimelineIcon item={item} />
                  </span>
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-muted mt-1 text-sm">
                      {formatTeamInsightDate(item.created_at)}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed">{item.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted mt-4 text-sm" role="status">
            {camp.enrolled === 0
              ? "Share your booking page to start camp activity."
              : "No camp activity recorded yet."}
          </p>
        )}
      </section>

      <section
        className="glass-panel interactive-surface rounded-2xl p-5 sm:p-6"
        aria-labelledby="camp-attendees-heading"
      >
        <h2 id="camp-attendees-heading" className="text-lg font-semibold tracking-tight">
          Players attending
        </h2>

        {camp.enrolled === 0 && attendeeCards.length === 0 ? (
          <p className="text-muted mt-4 text-sm">Share your booking page.</p>
        ) : attendeeCards.length === 0 ? (
          <p className="text-muted mt-4 text-sm">
            {camp.enrolled} booking{camp.enrolled === 1 ? "" : "s"} confirmed. Link camp sessions
            using the camp name as the group name to see player attendance here.
          </p>
        ) : (
          <ul className="mt-4 space-y-3" role="list" aria-label="Players attending">
            {attendeeCards.map((player) => (
              <li
                key={player.playerId}
                className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]"
                role="listitem"
              >
                <p className="font-medium">{player.playerName}</p>
                <p className="text-muted mt-1 text-sm">
                  {player.teamLabel} · {player.primaryPosition ?? "Position not set"} ·{" "}
                  {Math.round(player.attendanceRate)}% attendance
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/dashboard/players?player=${player.playerId}`}
                    className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
                  >
                    <UserRound className="size-4" aria-hidden />
                    View player
                  </Link>
                  <Link
                    href={`/dashboard/reports?player=${player.playerId}`}
                    className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
                  >
                    <FileText className="size-4" aria-hidden />
                    Create report
                  </Link>
                  {player.parentEmail ? (
                    <a
                      href={buildParentMailtoLink(player.parentEmail, player.playerName)}
                      className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
                    >
                      <Mail className="size-4" aria-hidden />
                      Contact parent
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
