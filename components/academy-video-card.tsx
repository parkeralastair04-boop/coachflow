import Image from "next/image";
import type { PublicVideo } from "@/lib/academy-website-types";
import { cn } from "@/lib/utils";

type AcademyVideoCardProps = {
  video: PublicVideo;
  featured?: boolean;
};

function formatDuration(seconds: number | null): string | null {
  if (seconds == null || seconds <= 0) return null;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes === 0) return `${remainder}s`;
  if (remainder === 0) return `${minutes} min`;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function formatPublishedDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export function AcademyVideoCard({ video, featured = false }: AcademyVideoCardProps) {
  const headingId = featured
    ? `featured-video-${video.id}-heading`
    : `video-${video.id}-heading`;
  const duration = formatDuration(video.durationSeconds);
  const thumbnailSrc = video.thumbnailUrl?.trim() || null;
  const watchHref = video.sourceUrl?.trim() || null;

  return (
    <article
      className={cn(
        "rounded-3xl bg-black/[0.02] p-5 sm:p-6 dark:bg-white/[0.03]",
        featured &&
          "bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--accent)_28%,transparent)] sm:p-8",
      )}
      aria-labelledby={headingId}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {thumbnailSrc ? (
          <div
            className={cn(
              "relative w-full overflow-hidden rounded-2xl bg-black/[0.04] dark:bg-white/[0.06]",
              featured ? "aspect-video lg:max-w-md" : "aspect-video lg:max-w-xs",
            )}
          >
            <Image
              src={thumbnailSrc}
              alt={`Thumbnail for ${video.title}`}
              fill
              unoptimized={thumbnailSrc.startsWith("http")}
              className="object-cover"
              sizes={featured ? "(max-width: 1024px) 100vw, 28rem" : "(max-width: 1024px) 100vw, 20rem"}
            />
          </div>
        ) : (
          <div
            className={cn(
              "bg-accent/10 text-accent flex w-full items-center justify-center rounded-2xl",
              featured ? "aspect-video lg:max-w-md" : "aspect-video lg:max-w-xs",
            )}
            aria-hidden
          >
            <span className="text-sm font-medium tracking-wide uppercase">Video</span>
          </div>
        )}

        <div className="min-w-0 flex-1">
          {featured ? (
            <p className="text-accent mb-2 text-xs font-medium tracking-wide uppercase">
              Latest video
            </p>
          ) : null}
          <h2
            id={headingId}
            className={cn(
              "font-semibold tracking-tight",
              featured ? "text-2xl sm:text-3xl" : "text-lg",
            )}
          >
            {video.title}
          </h2>

          <dl className="text-muted mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {video.categoryLabel ? (
              <div>
                <dt className="sr-only">Category</dt>
                <dd>
                  <span
                    className="inline-flex items-center rounded-full bg-black/[0.06] px-3 py-1 text-xs font-medium dark:bg-white/[0.08]"
                    aria-label={`Category: ${video.categoryLabel}`}
                  >
                    {video.categoryLabel}
                  </span>
                </dd>
              </div>
            ) : null}
            {duration ? (
              <div>
                <dt className="sr-only">Duration</dt>
                <dd>Duration: {duration}</dd>
              </div>
            ) : null}
            <div>
              <dt className="sr-only">Published date</dt>
              <dd>Published {formatPublishedDate(video.publishedAt)}</dd>
            </div>
          </dl>

          {video.developmentFocus.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2" role="list" aria-label="Development focus">
              {video.developmentFocus.map((tag) => (
                <li key={tag}>
                  <span className="inline-flex items-center rounded-full bg-black/[0.06] px-3 py-1 text-xs font-medium dark:bg-white/[0.08]">
                    {tag}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {video.summary ? (
            <p
              className={cn(
                "text-muted mt-4 leading-relaxed",
                featured ? "text-base" : "text-sm",
              )}
            >
              {video.summary}
            </p>
          ) : null}

          {watchHref ? (
            <a
              href={watchHref}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-accent text-accent-foreground hover:opacity-90 focus-visible:ring-accent/40 mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full px-6 text-sm font-semibold transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
              aria-label={`Watch ${video.title} (opens in a new tab)`}
            >
              Watch video
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
