import type { PublicResult } from "@/lib/academy-website-types";
import {
  isMatchCompetitionType,
  MATCH_COMPETITION_LABELS,
} from "@/lib/match-types";
import { cn } from "@/lib/utils";

type AcademyResultCardProps = {
  result: PublicResult;
  featured?: boolean;
};

type ResultOutcome = "win" | "draw" | "loss";

function formatResultDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function competitionLabel(result: PublicResult): string {
  const typeLabel = isMatchCompetitionType(result.competitionType)
    ? MATCH_COMPETITION_LABELS[result.competitionType]
    : result.competitionType;
  const name = result.competitionName?.trim();
  return name ? `${typeLabel} · ${name}` : typeLabel;
}

function getResultOutcome(result: PublicResult): ResultOutcome | null {
  if (result.homeScore == null || result.awayScore == null) return null;
  const goalsFor = result.isHome ? result.homeScore : result.awayScore;
  const goalsAgainst = result.isHome ? result.awayScore : result.homeScore;
  if (goalsFor > goalsAgainst) return "win";
  if (goalsFor < goalsAgainst) return "loss";
  return "draw";
}

const OUTCOME_LABELS: Record<ResultOutcome, string> = {
  win: "Win",
  draw: "Draw",
  loss: "Loss",
};

export function AcademyResultCard({ result, featured = false }: AcademyResultCardProps) {
  const headingId = featured
    ? `featured-result-${result.id}-heading`
    : `result-${result.id}-heading`;
  const competition = competitionLabel(result);
  const outcome = getResultOutcome(result);
  const score = result.scoreLabel ?? "Score TBC";

  return (
    <article
      className={cn(
        "rounded-3xl bg-black/[0.02] p-5 sm:p-6 dark:bg-white/[0.03]",
        featured &&
          "bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--accent)_28%,transparent)] sm:p-8",
      )}
      aria-labelledby={headingId}
    >
      {featured ? (
        <p className="text-accent mb-2 text-xs font-medium tracking-wide uppercase">
          Latest result
        </p>
      ) : null}

      <div className="flex flex-wrap items-start gap-2">
        <h2
          id={headingId}
          className={cn(
            "min-w-0 flex-1 font-semibold tracking-tight",
            featured ? "text-2xl sm:text-3xl" : "text-lg",
          )}
        >
          vs {result.opposition}
        </h2>
        {outcome ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
              outcome === "win" &&
                "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
              outcome === "draw" && "bg-amber-500/15 text-amber-900 dark:text-amber-200",
              outcome === "loss" && "bg-rose-500/15 text-rose-900 dark:text-rose-200",
            )}
            aria-label={`Result: ${OUTCOME_LABELS[outcome]}`}
          >
            {OUTCOME_LABELS[outcome]}
          </span>
        ) : null}
      </div>

      <p
        className={cn(
          "mt-3 font-semibold tracking-tight",
          featured ? "text-2xl sm:text-3xl" : "text-xl",
        )}
        aria-label={`Final score ${score}`}
      >
        {score}
      </p>

      <dl className="text-muted mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="sr-only">Home or away</dt>
          <dd>{result.isHome ? "Home" : "Away"}</dd>
        </div>
        <div>
          <dt className="sr-only">Competition</dt>
          <dd>
            <span
              className="inline-flex items-center rounded-full bg-black/[0.06] px-3 py-1 text-xs font-medium dark:bg-white/[0.08]"
              aria-label={`Competition: ${competition}`}
            >
              {competition}
            </span>
          </dd>
        </div>
        <div>
          <dt className="sr-only">Date</dt>
          <dd>{formatResultDate(result.kickoffDate)}</dd>
        </div>
        <div>
          <dt className="sr-only">Team</dt>
          <dd>{result.teamName}</dd>
        </div>
      </dl>
    </article>
  );
}
