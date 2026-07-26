"use client";

import Link from "next/link";
import {
  CalendarDays,
  ClipboardList,
  FileText,
  Loader2,
  Mail,
  UserRound,
  Users,
} from "lucide-react";
import { TeamRoleBadge } from "@/components/team-role-badge";
import { TeamSeasonInsightsPanel } from "@/components/team-season-insights-panel";
import { buildParentMailtoLink } from "@/lib/attendance-alerts";
import {
  formatTeamInsightDate,
  type SquadPlayerCard,
  type TeamOverviewMetrics,
  type TeamSessionRow,
} from "@/lib/team-insights";
import {
  getTeamDisplayName,
  sortSquadDisplayOrder,
  type TeamRow,
} from "@/lib/team-management";
import type {
  AttendanceLeader,
  CategorizedSupportPlayer,
  MissingReportPlayer,
  TeamActivityTimelineItem,
  TeamAttendanceTrend,
  TeamFormIndicators,
  TeamSeasonOverview,
} from "@/lib/team-season-insights";

type TeamSquadPanelProps = {
  team: TeamRow;
  overview: TeamOverviewMetrics;
  squadCards: SquadPlayerCard[];
  upcomingSessions: TeamSessionRow[];
  season: TeamSeasonOverview;
  attendanceTrend: TeamAttendanceTrend;
  formIndicators: TeamFormIndicators;
  missingReports: MissingReportPlayer[];
  attendanceLeaders: AttendanceLeader[];
  supportPlayers: CategorizedSupportPlayer[];
  timeline: TeamActivityTimelineItem[];
  loading?: boolean;
};

function SquadPlayerCardItem({ card }: { card: SquadPlayerCard }) {
  const { membership } = card;

  return (
    <li className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{card.playerName}</p>
            {membership.role ? <TeamRoleBadge role={membership.role} /> : null}
          </div>
          <p className="text-muted mt-2 text-sm">
            {card.primaryPosition ?? "Position not set"}
            {card.preferredFoot ? ` · ${card.preferredFoot} foot` : ""}
          </p>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-muted text-xs">Attendance</dt>
              <dd className="mt-1 text-sm font-medium">
                {Math.round(card.attendanceRate)}%
              </dd>
            </div>
            <div>
              <dt className="text-muted text-xs">Last report</dt>
              <dd className="mt-1 text-sm font-medium">
                {formatTeamInsightDate(card.lastReportDate)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/reports?player=${card.playerId}`}
            className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
          >
            <FileText className="size-4" aria-hidden />
            Create report
          </Link>
          <Link
            href={`/dashboard/players?player=${card.playerId}`}
            className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
          >
            <UserRound className="size-4" aria-hidden />
            View player
          </Link>
          {card.parentEmail ? (
            <a
              href={buildParentMailtoLink(card.parentEmail, card.playerName)}
              className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
            >
              <Mail className="size-4" aria-hidden />
              Contact parent
            </a>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function TeamSquadPanel({
  team,
  overview,
  squadCards,
  season,
  attendanceTrend,
  formIndicators,
  missingReports,
  attendanceLeaders,
  supportPlayers,
  timeline,
  loading = false,
}: TeamSquadPanelProps) {
  const orderedCards = sortSquadDisplayOrder(
    squadCards.map((card) => card.membership),
  )
    .map((membership) => squadCards.find((card) => card.membership.id === membership.id))
    .filter((card): card is SquadPlayerCard => Boolean(card));

  const firstPlayerId = orderedCards[0]?.playerId;

  return (
    <div className="space-y-6">
      <section
        className="glass-panel interactive-surface rounded-2xl p-5 sm:p-6"
        aria-labelledby="team-squad-heading"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex size-3 shrink-0 rounded-full"
                style={{
                  backgroundColor: team.team_color ?? "var(--color-accent)",
                }}
                aria-hidden
              />
              <h2 id="team-squad-heading" className="text-xl font-semibold tracking-tight">
                {getTeamDisplayName(team)}
              </h2>
            </div>
            <p className="text-muted mt-2 text-sm">
              {team.notes?.trim() || "Season insights, squad planning, and player development."}
            </p>
          </div>

          {loading ? (
            <p className="text-muted flex items-center gap-2 text-sm" role="status" aria-live="polite">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading squad insights...
            </p>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="team-actions-heading">
        <h2 id="team-actions-heading" className="sr-only">
          Team actions
        </h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href={
              overview.nextSession
                ? `/dashboard/registers?session=${overview.nextSession.id}`
                : "/dashboard/registers"
            }
            className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ClipboardList className="size-4" aria-hidden />
            Take register
          </Link>
          <Link
            href="/dashboard/sessions"
            className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
          >
            <CalendarDays className="size-4" aria-hidden />
            Create session
          </Link>
          <Link
            href={
              firstPlayerId
                ? `/dashboard/reports?player=${firstPlayerId}`
                : "/dashboard/reports"
            }
            className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
          >
            <FileText className="size-4" aria-hidden />
            Create report
          </Link>
          <Link
            href="/dashboard/players"
            className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
          >
            <Users className="size-4" aria-hidden />
            View players
          </Link>
        </div>
      </section>

      <TeamSeasonInsightsPanel
        season={season}
        attendanceTrend={attendanceTrend}
        formIndicators={formIndicators}
        missingReports={missingReports}
        attendanceLeaders={attendanceLeaders}
        supportPlayers={supportPlayers}
        timeline={timeline}
      />

      <section
        className="glass-panel interactive-surface rounded-2xl p-5 sm:p-6"
        aria-labelledby="team-squad-list-heading"
      >
        <h2 id="team-squad-list-heading" className="text-lg font-semibold tracking-tight">
          Squad list
        </h2>
        {orderedCards.length === 0 ? (
          <p className="text-muted mt-4 text-sm">Add players to build your squad.</p>
        ) : (
          <ul className="mt-4 space-y-3" role="list" aria-label="Squad list">
            {orderedCards.map((card) => (
              <SquadPlayerCardItem key={card.membership.id} card={card} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
