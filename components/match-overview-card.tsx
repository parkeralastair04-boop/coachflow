"use client";

import Link from "next/link";
import { ClipboardList, FileText, Trophy, Users } from "lucide-react";
import {
  formatMatchKickoff,
  getMatchTitle,
  MATCH_COMPETITION_LABELS,
  MATCH_STATUS_LABELS,
  type MatchRow,
} from "@/lib/match-types";
import type { MatchOverviewMetrics } from "@/lib/match-insights";

type MatchOverviewCardProps = {
  match: MatchRow & { team?: { team_name: string } | null };
  metrics: MatchOverviewMetrics;
  scoreLabel?: string;
  selected: boolean;
  onSelect: () => void;
};

export function MatchOverviewCard({
  match,
  metrics,
  scoreLabel,
  selected,
  onSelect,
}: MatchOverviewCardProps) {
  const teamName = match.team?.team_name ?? "Your team";
  const title = getMatchTitle(match, teamName);

  return (
    <article
      className={`glass-panel interactive-surface rounded-2xl p-5 sm:p-6 ${selected ? "ring-accent/25 ring-1" : ""}`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="focus-visible:ring-accent/40 w-full rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <span className="text-muted rounded-full bg-black/[0.04] px-2 py-0.5 text-xs font-medium dark:bg-white/[0.06]">
            {MATCH_STATUS_LABELS[match.status]}
          </span>
        </div>
        <p className="text-muted mt-1 text-sm">
          {MATCH_COMPETITION_LABELS[match.competition_type]}
          {match.competition_name ? ` · ${match.competition_name}` : ""}
        </p>
        <p className="text-muted mt-1 text-sm">
          {formatMatchKickoff(match.kickoff_date, match.kickoff_time)}
          {match.venue ? ` · ${match.venue}` : ""}
        </p>
        {scoreLabel ? <p className="mt-2 text-sm font-medium">{scoreLabel}</p> : null}

        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-muted text-xs">Squad</dt>
            <dd className="mt-1 text-sm font-medium">{metrics.squadSize}</dd>
          </div>
          <div>
            <dt className="text-muted text-xs">Availability responses</dt>
            <dd className="mt-1 text-sm font-medium">{metrics.availabilityResponded}</dd>
          </div>
          <div>
            <dt className="text-muted text-xs">Unavailable</dt>
            <dd className="mt-1 text-sm font-medium">{metrics.availabilityUnavailable}</dd>
          </div>
          <div>
            <dt className="text-muted text-xs">Register marked</dt>
            <dd className="mt-1 text-sm font-medium">{metrics.registerMarked}</dd>
          </div>
        </dl>
      </button>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSelect}
          className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Trophy className="size-4" aria-hidden />
          Open match
        </button>
        <button
          type="button"
          onClick={onSelect}
          className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
        >
          <Users className="size-4" aria-hidden />
          Squad
        </button>
        <Link
          href={
            match.session_id
              ? `/dashboard/registers?session=${match.session_id}`
              : "/dashboard/registers"
          }
          className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
        >
          <ClipboardList className="size-4" aria-hidden />
          Register
        </Link>
        <Link
          href="/dashboard/reports"
          className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
        >
          <FileText className="size-4" aria-hidden />
          Reports
        </Link>
      </div>
    </article>
  );
}
