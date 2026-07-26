"use client";

import Link from "next/link";
import {
  BarChart3,
  ClipboardList,
  FileText,
  PoundSterling,
  Users,
} from "lucide-react";
import {
  formatCampCurrency,
  formatCampDateRange,
  type CampOverviewMetrics,
  type CampWithStats,
} from "@/lib/camp-insights";

type CampOverviewCardProps = {
  camp: CampWithStats;
  metrics: CampOverviewMetrics;
  registerSessionId?: string | null;
  selected: boolean;
  onSelect: () => void;
};

export function CampOverviewCard({
  camp,
  metrics,
  registerSessionId,
  selected,
  onSelect,
}: CampOverviewCardProps) {
  return (
    <article
      className={`glass-panel interactive-surface rounded-2xl p-5 sm:p-6 ${selected ? "ring-accent/25 ring-1" : ""}`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="focus-visible:ring-accent/40 w-full rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <h3 className="text-lg font-semibold tracking-tight">{camp.name}</h3>
        <p className="text-muted mt-1 text-sm">{formatCampDateRange(camp.start_date, camp.end_date)}</p>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-muted text-xs">Spaces filled</dt>
            <dd className="mt-1 text-sm font-medium">
              {metrics.spacesFilled} / {camp.capacity}
            </dd>
          </div>
          <div>
            <dt className="text-muted text-xs">Revenue</dt>
            <dd className="mt-1 text-sm font-medium">{formatCampCurrency(metrics.revenue)}</dd>
          </div>
          <div>
            <dt className="text-muted text-xs">Players booked</dt>
            <dd className="mt-1 text-sm font-medium">{metrics.playersBooked}</dd>
          </div>
          <div>
            <dt className="text-muted text-xs">Waitlist</dt>
            <dd className="mt-1 text-sm font-medium">{metrics.waitlistCount}</dd>
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
          View camp
        </button>
        <button
          type="button"
          onClick={onSelect}
          className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
        >
          <PoundSterling className="size-4" aria-hidden />
          Bookings
        </button>
        <Link
          href={
            registerSessionId
              ? `/dashboard/registers?session=${registerSessionId}`
              : "/dashboard/registers"
          }
          className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
        >
          <ClipboardList className="size-4" aria-hidden />
          Attendance
        </Link>
        <Link
          href="/dashboard/reports"
          className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
        >
          <FileText className="size-4" aria-hidden />
          Reports
        </Link>
        <Link
          href="/dashboard/analytics"
          className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
        >
          <BarChart3 className="size-4" aria-hidden />
          Analytics
        </Link>
      </div>
    </article>
  );
}
