import Link from "next/link";
import type { PublicTraining } from "@/lib/academy-website-types";
import { cn } from "@/lib/utils";

type AcademyTrainingCardProps = {
  training: PublicTraining;
  bookHref?: string;
  featured?: boolean;
};

function formatDuration(minutes: number | null): string | null {
  if (minutes == null || minutes <= 0) return null;
  return `${minutes} min`;
}

export function AcademyTrainingCard({
  training,
  bookHref,
  featured = false,
}: AcademyTrainingCardProps) {
  const headingId = featured
    ? `featured-training-${training.id}-heading`
    : `training-${training.id}-heading`;
  const duration = formatDuration(training.durationMinutes);

  return (
    <article
      className={cn(
        "rounded-3xl bg-black/[0.02] p-5 sm:p-6 dark:bg-white/[0.03]",
        featured &&
          "bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--accent)_28%,transparent)] sm:p-8",
      )}
      aria-labelledby={headingId}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          {featured ? (
            <p className="text-accent mb-2 text-xs font-medium tracking-wide uppercase">
              Featured training theme
            </p>
          ) : null}
          <h2
            id={headingId}
            className={cn(
              "font-semibold tracking-tight",
              featured ? "text-2xl sm:text-3xl" : "text-lg",
            )}
          >
            {training.title}
          </h2>

          <dl className="text-muted mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {training.theme ? (
              <div>
                <dt className="sr-only">Theme</dt>
                <dd>Theme: {training.theme}</dd>
              </div>
            ) : null}
            {training.ageGroup ? (
              <div>
                <dt className="sr-only">Age group</dt>
                <dd>Age group: {training.ageGroup}</dd>
              </div>
            ) : null}
            {duration ? (
              <div>
                <dt className="sr-only">Duration</dt>
                <dd>Duration: {duration}</dd>
              </div>
            ) : null}
            {training.difficulty ? (
              <div>
                <dt className="sr-only">Difficulty</dt>
                <dd>Difficulty: {training.difficulty}</dd>
              </div>
            ) : null}
            {training.equipmentSummary ? (
              <div className="sm:col-span-2">
                <dt className="sr-only">Equipment</dt>
                <dd>Equipment: {training.equipmentSummary}</dd>
              </div>
            ) : null}
          </dl>

          {training.developmentFocus.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2" role="list" aria-label="Development focus">
              {training.developmentFocus.map((tag) => (
                <li key={tag}>
                  <span className="inline-flex items-center rounded-full bg-black/[0.06] px-3 py-1 text-xs font-medium dark:bg-white/[0.08]">
                    {tag}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {training.summary ? (
            <p
              className={cn(
                "text-muted mt-4 leading-relaxed",
                featured ? "text-base" : "text-sm",
              )}
            >
              {training.summary}
            </p>
          ) : null}
        </div>

        {featured && bookHref ? (
          <Link
            href={bookHref}
            className="bg-accent text-accent-foreground hover:opacity-90 focus-visible:ring-accent/40 inline-flex min-h-12 w-full shrink-0 items-center justify-center rounded-full px-6 text-sm font-semibold transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:w-auto"
          >
            Book Training
          </Link>
        ) : null}
      </div>
    </article>
  );
}
