import Link from "next/link";
import { formatCampCurrency } from "@/lib/camp-insights";
import type { PublicCamp } from "@/lib/academy-website-types";
import { cn } from "@/lib/utils";

type AcademyCampCardProps = {
  camp: PublicCamp;
  bookHref: string;
  featured?: boolean;
};

export function AcademyCampCard({ camp, bookHref, featured = false }: AcademyCampCardProps) {
  const headingId = featured ? `featured-camp-${camp.id}-heading` : `camp-${camp.id}-heading`;

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
              Next upcoming camp
            </p>
          ) : null}
          <h2
            id={headingId}
            className={cn("font-semibold tracking-tight", featured ? "text-2xl sm:text-3xl" : "text-lg")}
          >
            {camp.name}
          </h2>
          <dl className="text-muted mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="sr-only">Dates</dt>
              <dd>{camp.dateLabel}</dd>
            </div>
            {camp.ageGroup ? (
              <div>
                <dt className="sr-only">Age group</dt>
                <dd>Age group: {camp.ageGroup}</dd>
              </div>
            ) : null}
            {camp.location ? (
              <div>
                <dt className="sr-only">Location</dt>
                <dd>{camp.location}</dd>
              </div>
            ) : null}
            <div>
              <dt className="sr-only">Price</dt>
              <dd>{formatCampCurrency(camp.price)}</dd>
            </div>
            {camp.remainingSpaces != null ? (
              <div>
                <dt className="sr-only">Remaining spaces</dt>
                <dd>
                  {camp.remainingSpaces === 0
                    ? "Fully booked"
                    : `${camp.remainingSpaces} space${camp.remainingSpaces === 1 ? "" : "s"} remaining`}
                </dd>
              </div>
            ) : null}
          </dl>
          <p className={cn("text-muted mt-4 leading-relaxed", featured ? "text-base" : "text-sm")}>
            {camp.summary}
          </p>
        </div>

        <Link
          href={bookHref}
          className="bg-accent text-accent-foreground hover:opacity-90 focus-visible:ring-accent/40 inline-flex min-h-12 w-full shrink-0 items-center justify-center rounded-full px-6 text-sm font-semibold transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:w-auto"
        >
          Book Camp
        </Link>
      </div>
    </article>
  );
}
