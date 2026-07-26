import type { PublicFixture } from "@/lib/academy-website-types";
import {
  isMatchCompetitionType,
  isMatchStatus,
  MATCH_COMPETITION_LABELS,
  MATCH_STATUS_LABELS,
} from "@/lib/match-types";
import { cn } from "@/lib/utils";

type AcademyFixtureCardProps = {
  fixture: PublicFixture;
  featured?: boolean;
};

function formatFixtureDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function formatKickoffTime(time: string | null): string | null {
  if (!time?.trim()) return null;
  const [hours, minutes] = time.split(":");
  if (!hours || !minutes) return time;
  return `${hours}:${minutes}`;
}

function competitionLabel(fixture: PublicFixture): string {
  const typeLabel = isMatchCompetitionType(fixture.competitionType)
    ? MATCH_COMPETITION_LABELS[fixture.competitionType]
    : fixture.competitionType;
  const name = fixture.competitionName?.trim();
  return name ? `${typeLabel} · ${name}` : typeLabel;
}

function statusLabel(status: string): string {
  return isMatchStatus(status) ? MATCH_STATUS_LABELS[status] : status;
}

export function AcademyFixtureCard({ fixture, featured = false }: AcademyFixtureCardProps) {
  const headingId = featured
    ? `featured-fixture-${fixture.id}-heading`
    : `fixture-${fixture.id}-heading`;
  const kickoff = formatKickoffTime(fixture.kickoffTime);
  const competition = competitionLabel(fixture);
  const status = statusLabel(fixture.status);
  const venueParts = [fixture.venue?.trim(), fixture.pitch?.trim()].filter(Boolean);

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
          Next upcoming fixture
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
          vs {fixture.opposition}
        </h2>
        <span
          className="inline-flex items-center rounded-full bg-black/[0.06] px-3 py-1 text-xs font-medium dark:bg-white/[0.08]"
          aria-label={`Competition: ${competition}`}
        >
          {competition}
        </span>
      </div>

      <dl className="text-muted mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="sr-only">Home or away</dt>
          <dd>{fixture.isHome ? "Home" : "Away"}</dd>
        </div>
        <div>
          <dt className="sr-only">Date</dt>
          <dd>{formatFixtureDate(fixture.kickoffDate)}</dd>
        </div>
        {kickoff ? (
          <div>
            <dt className="sr-only">Kick-off time</dt>
            <dd>Kick-off {kickoff}</dd>
          </div>
        ) : null}
        {venueParts.length > 0 ? (
          <div>
            <dt className="sr-only">Venue</dt>
            <dd>{venueParts.join(" · ")}</dd>
          </div>
        ) : null}
        <div>
          <dt className="sr-only">Team</dt>
          <dd>{fixture.teamName}</dd>
        </div>
        <div>
          <dt className="sr-only">Match status</dt>
          <dd>
            <span
              className="inline-flex items-center rounded-full bg-black/[0.06] px-3 py-1 text-xs font-medium dark:bg-white/[0.08]"
              aria-label={`Match status: ${status}`}
            >
              {status}
            </span>
          </dd>
        </div>
      </dl>
    </article>
  );
}
