import Link from "next/link";
import {
  CalendarDays,
  ClipboardList,
  FileText,
  Users,
} from "lucide-react";
import { TeamRoleBadge } from "@/components/team-role-badge";
import {
  formatNextSessionLabel,
  type TeamOverviewMetrics,
} from "@/lib/team-insights";
import { getTeamDisplayName, type TeamRow } from "@/lib/team-management";
import { cn } from "@/lib/utils";

type TeamOverviewCardProps = {
  team: TeamRow;
  metrics: TeamOverviewMetrics;
  selected: boolean;
  onSelect: () => void;
};

export function TeamOverviewCard({
  team,
  metrics,
  selected,
  onSelect,
}: TeamOverviewCardProps) {
  const captainMembership = (team.team_players ?? []).find(
    (membership) => membership.role === "captain",
  );
  const viceCaptainMembership = (team.team_players ?? []).find(
    (membership) => membership.role === "vice_captain",
  );

  return (
    <article
      className={cn(
        "glass-panel interactive-surface rounded-2xl p-5 transition-[box-shadow,border-color,transform] duration-[180ms] sm:p-6",
        selected ? "ring-accent/25 ring-1" : "interactive-surface",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="focus-visible:ring-accent/40 w-full rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex size-3 shrink-0 rounded-full"
                style={{
                  backgroundColor: team.team_color ?? "var(--color-accent)",
                }}
                aria-hidden
              />
              <h3 className="truncate text-base font-semibold tracking-tight">
                {team.team_name}
              </h3>
            </div>
            <p className="text-muted mt-1 text-sm">
              {team.age_group?.trim() || "No age group set"}
            </p>
          </div>
          <span className="bg-accent/10 text-accent ring-accent/20 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1">
            {metrics.squadSize} player{metrics.squadSize === 1 ? "" : "s"}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {captainMembership?.role ? (
            <TeamRoleBadge role={captainMembership.role} />
          ) : null}
          {viceCaptainMembership?.role ? (
            <TeamRoleBadge role={viceCaptainMembership.role} />
          ) : null}
        </div>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-muted text-xs">Next session</dt>
            <dd className="mt-1 text-sm font-medium">
              {formatNextSessionLabel(metrics.nextSession)}
            </dd>
          </div>
          <div>
            <dt className="text-muted text-xs">Attendance</dt>
            <dd className="mt-1 text-sm font-medium">
              {metrics.squadSize > 0 ? `${Math.round(metrics.attendanceRate)}%` : "—"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted text-xs">Reports this season</dt>
            <dd className="mt-1 text-sm font-medium">{metrics.reportsThisSeason}</dd>
          </div>
        </dl>
      </button>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSelect}
          className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Users className="size-4" aria-hidden />
          View squad
        </button>
        <Link
          href="/dashboard/sessions"
          className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
        >
          <CalendarDays className="size-4" aria-hidden />
          Sessions
        </Link>
        <Link
          href={
            metrics.firstPlayerId
              ? `/dashboard/reports?player=${metrics.firstPlayerId}`
              : "/dashboard/reports"
          }
          className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
        >
          <FileText className="size-4" aria-hidden />
          Create report
        </Link>
        <Link
          href={
            metrics.nextSession
              ? `/dashboard/registers?session=${metrics.nextSession.id}`
              : "/dashboard/registers"
          }
          className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
        >
          <ClipboardList className="size-4" aria-hidden />
          Take register
        </Link>
      </div>
    </article>
  );
}

export function getTeamOverviewHeading(team: TeamRow): string {
  return getTeamDisplayName(team);
}
