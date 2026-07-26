"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Award,
  FileText,
  HeartPulse,
  UserRound,
} from "lucide-react";
import {
  formatSeasonTimelineDate,
  formatSessionTrendDate,
  getFormLevelLabel,
  getTrendDirectionLabel,
  type AttendanceLeader,
  type CategorizedSupportPlayer,
  type MissingReportPlayer,
  type TeamActivityTimelineItem,
  type TeamAttendanceTrend,
  type TeamFormIndicators,
  type TeamSeasonOverview,
} from "@/lib/team-season-insights";

type TeamSeasonInsightsPanelProps = {
  season: TeamSeasonOverview;
  attendanceTrend: TeamAttendanceTrend;
  formIndicators: TeamFormIndicators;
  missingReports: MissingReportPlayer[];
  attendanceLeaders: AttendanceLeader[];
  supportPlayers: CategorizedSupportPlayer[];
  timeline: TeamActivityTimelineItem[];
};

function TrendIndicator({
  direction,
}: {
  direction: "improving" | "stable" | "declining" | null;
}) {
  if (!direction) return null;

  const Icon =
    direction === "improving" ? ArrowUp : direction === "declining" ? ArrowDown : ArrowRight;
  const label = getTrendDirectionLabel(direction);

  return (
    <span className="text-muted inline-flex items-center gap-1 text-sm">
      <Icon className="size-4 shrink-0" aria-hidden />
      {label}
    </span>
  );
}

function TimelineIcon({ item }: { item: TeamActivityTimelineItem }) {
  if (item.type === "report") {
    return <FileText className="size-4 shrink-0" aria-hidden />;
  }
  if (item.type === "injury") {
    return <HeartPulse className="size-4 shrink-0" aria-hidden />;
  }
  return <AlertTriangle className="size-4 shrink-0" aria-hidden />;
}

function timelineTitle(item: TeamActivityTimelineItem): string {
  if (item.type === "report") return "Report created";
  if (item.type === "injury") return "Injury recorded";
  return "Attendance concern";
}

export function TeamSeasonInsightsPanel({
  season,
  attendanceTrend,
  formIndicators,
  missingReports,
  attendanceLeaders,
  supportPlayers,
  timeline,
}: TeamSeasonInsightsPanelProps) {
  return (
    <div className="space-y-6">
      <section
        className="glass-panel interactive-surface rounded-2xl p-5 sm:p-6"
        aria-labelledby="team-season-overview-heading"
      >
        <h2 id="team-season-overview-heading" className="text-lg font-semibold tracking-tight">
          Season overview
        </h2>
        <p className="text-muted mt-2 text-sm" role="status">
          {season.summaryCopy}
        </p>
        <p className="mt-2 text-sm leading-relaxed">{season.teamSummaryCopy}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
            <p className="text-muted text-xs">Squad size</p>
            <p className="mt-1 font-semibold">{season.squadSize}</p>
          </div>
          <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
            <p className="text-muted text-xs">Team attendance</p>
            <p className="mt-1 font-semibold">
              {season.squadSize > 0 ? `${Math.round(season.attendanceRate)}%` : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
            <p className="text-muted text-xs">Reports created</p>
            <p className="mt-1 font-semibold">{season.reportsThisSeason}</p>
          </div>
          <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
            <p className="text-muted text-xs">Upcoming sessions</p>
            <p className="mt-1 font-semibold">{season.upcomingSessions}</p>
          </div>
          <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
            <p className="text-muted text-xs">Players needing support</p>
            <p className="mt-1 font-semibold">{season.playersNeedingSupport}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section
          className="glass-panel interactive-surface rounded-2xl p-5 sm:p-6"
          aria-labelledby="team-attendance-trend-heading"
        >
          <h2 id="team-attendance-trend-heading" className="text-lg font-semibold tracking-tight">
            Attendance trend
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TrendIndicator direction={attendanceTrend.direction} />
            <p className="text-muted text-sm" role="status">
              {attendanceTrend.trendCopy}
            </p>
          </div>

          {attendanceTrend.sessions.length > 0 ? (
            <ul className="mt-4 space-y-2" role="list" aria-label="Last six sessions attendance">
              {attendanceTrend.sessions.map((session) => (
                <li
                  key={session.sessionId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-black/[0.02] px-3 py-2 text-sm dark:bg-white/[0.03]"
                  role="listitem"
                >
                  <div>
                    <p className="font-medium">{session.sessionLabel}</p>
                    <p className="text-muted text-xs">
                      {formatSessionTrendDate(session.sessionDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{Math.round(session.rate)}%</span>
                    <TrendIndicator direction={session.direction} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted mt-4 text-sm">Create a training session.</p>
          )}
        </section>

        <section
          className="glass-panel interactive-surface rounded-2xl p-5 sm:p-6"
          aria-labelledby="team-form-heading"
        >
          <h2 id="team-form-heading" className="text-lg font-semibold tracking-tight">
            Team form
          </h2>
          <p className="text-muted mt-2 text-sm" role="status">
            Overall trend: {getFormLevelLabel(formIndicators.level)}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
              <p className="text-muted text-xs">Present</p>
              <p className="mt-1 font-semibold">{formIndicators.present}</p>
            </div>
            <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
              <p className="text-muted text-xs">Late</p>
              <p className="mt-1 font-semibold">{formIndicators.late}</p>
            </div>
            <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
              <p className="text-muted text-xs">Absent</p>
              <p className="mt-1 font-semibold">{formIndicators.absent}</p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section
          className="glass-panel interactive-surface rounded-2xl p-5 sm:p-6"
          aria-labelledby="missing-reports-heading"
        >
          <h2 id="missing-reports-heading" className="text-lg font-semibold tracking-tight">
            Missing report insights
          </h2>
          <p className="text-muted mt-2 text-sm">
            Players without a report in the last 60 days.
          </p>

          {missingReports.length > 0 ? (
            <ul className="mt-4 space-y-3" role="list" aria-label="Players without recent reports">
              {missingReports.map((player) => (
                <li
                  key={player.playerId}
                  className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]"
                  role="listitem"
                >
                  <p className="font-medium">{player.playerName}</p>
                  <p className="text-muted mt-1 text-sm">
                    {player.primaryPosition ?? "Position not set"} ·{" "}
                    {Math.round(player.attendanceRate)}% attendance
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/dashboard/reports?player=${player.playerId}`}
                      className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
                    >
                      Create report
                    </Link>
                    <Link
                      href={`/dashboard/players?player=${player.playerId}`}
                      className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
                    >
                      View player
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted mt-4 text-sm" role="status">
              All squad players have a recent report.
            </p>
          )}
        </section>

        <section
          className="glass-panel interactive-surface rounded-2xl p-5 sm:p-6"
          aria-labelledby="attendance-leaders-heading"
        >
          <h2 id="attendance-leaders-heading" className="text-lg font-semibold tracking-tight">
            Session attendance leaders
          </h2>

          {attendanceLeaders.length > 0 ? (
            <ul className="mt-4 space-y-3" role="list" aria-label="Highest attendance players">
              {attendanceLeaders.map((leader) => (
                <li
                  key={leader.playerId}
                  className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]"
                  role="listitem"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{leader.playerName}</p>
                    {leader.excellentAttendance ? (
                      <span className="bg-accent/10 text-accent ring-accent/20 inline-flex min-h-6 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1">
                        <Award className="size-3.5 shrink-0" aria-hidden />
                        Excellent attendance
                      </span>
                    ) : null}
                  </div>
                  <p className="text-muted mt-2 text-sm">
                    {Math.round(leader.attendanceRate)}% attendance · Last report:{" "}
                    {formatSeasonTimelineDate(leader.lastReportDate)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted mt-4 text-sm">Add players to build your squad.</p>
          )}
        </section>
      </div>

      {supportPlayers.length > 0 ? (
        <section
          className="glass-panel interactive-surface rounded-2xl p-5 sm:p-6"
          aria-labelledby="season-support-heading"
        >
          <h2 id="season-support-heading" className="text-lg font-semibold tracking-tight">
            Players needing support
          </h2>
          <ul className="mt-4 space-y-3" role="list" aria-label="Players needing support">
            {supportPlayers.map((player) => (
              <li
                key={player.playerId}
                className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]"
                role="listitem"
              >
                <p className="font-medium">{player.playerName}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {player.categoryLabels.map((label) => (
                    <span
                      key={label}
                      className="border-border text-muted inline-flex min-h-6 items-center rounded-full border px-2.5 py-1 text-xs font-medium"
                    >
                      {label}
                    </span>
                  ))}
                </div>
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
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        className="glass-panel interactive-surface rounded-2xl p-5 sm:p-6"
        aria-labelledby="team-activity-timeline-heading"
      >
        <h2 id="team-activity-timeline-heading" className="text-lg font-semibold tracking-tight">
          Team activity timeline
        </h2>
        <p className="text-muted mt-1 text-sm">Newest first</p>

        {timeline.length > 0 ? (
          <ol className="mt-4 space-y-3" role="list" aria-label="Team activity timeline">
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
                        : item.type === "injury"
                          ? "bg-rose-500/10 text-rose-700 ring-rose-500/20 inline-flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 dark:text-rose-200"
                          : "bg-amber-500/10 text-amber-800 ring-amber-500/20 inline-flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 dark:text-amber-200"
                    }
                  >
                    <TimelineIcon item={item} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{timelineTitle(item)}</p>
                    <p className="text-muted mt-1 text-sm">
                      {formatSeasonTimelineDate(item.created_at)}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed">
                      {item.playerName} — {item.body}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted mt-4 text-sm" role="status">
            No team activity recorded yet.
          </p>
        )}
      </section>
    </div>
  );
}
