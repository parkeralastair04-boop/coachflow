"use client";

import Link from "next/link";
import { DIFFICULTY_LABELS, type TrainingPlanRow } from "@/lib/training-types";

type TrainingPlanOverviewCardProps = {
  plan: TrainingPlanRow;
  durationMinutes: number;
  linkedSessionId?: string | null;
  selected: boolean;
  onSelect: () => void;
};

export function TrainingPlanOverviewCard({
  plan,
  durationMinutes,
  linkedSessionId,
  selected,
  onSelect,
}: TrainingPlanOverviewCardProps) {
  return (
    <article
      className={`glass-panel interactive-surface rounded-2xl p-5 sm:p-6 ${selected ? "ring-accent/25 ring-1" : ""}`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="focus-visible:ring-accent/40 w-full rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <h3 className="text-lg font-semibold tracking-tight">{plan.title}</h3>
        <p className="text-muted mt-1 text-sm">
          {plan.theme ?? "No theme"} · {DIFFICULTY_LABELS[plan.difficulty]}
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-muted text-xs">Duration</dt>
            <dd className="mt-1 text-sm font-medium">{durationMinutes} min</dd>
          </div>
          <div>
            <dt className="text-muted text-xs">Age group</dt>
            <dd className="mt-1 text-sm font-medium">{plan.age_group ?? "Any"}</dd>
          </div>
        </dl>
      </button>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSelect}
          className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Open plan
        </button>
        {linkedSessionId ? (
          <Link
            href={`/dashboard/registers?session=${linkedSessionId}`}
            className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Register
          </Link>
        ) : null}
      </div>
    </article>
  );
}
