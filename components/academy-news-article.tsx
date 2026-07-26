import Image from "next/image";
import Link from "next/link";
import { AcademyWebsiteCta } from "@/components/academy-website-cta";
import { formatNewsPublishedDate } from "@/lib/academy-news";
import type { PublicNewsArticle } from "@/lib/academy-website-types";

type AcademyNewsArticleProps = {
  article: PublicNewsArticle;
  bookHref: string;
  parentLoginHref: string;
  academyName: string;
  previousHref?: string | null;
  previousTitle?: string | null;
  nextHref?: string | null;
  nextTitle?: string | null;
  newsIndexHref: string;
};

export function AcademyNewsArticle({
  article,
  bookHref,
  parentLoginHref,
  academyName,
  previousHref,
  previousTitle,
  nextHref,
  nextTitle,
  newsIndexHref,
}: AcademyNewsArticleProps) {
  const publishedLabel = formatNewsPublishedDate(article.publishedAt);
  const coverSrc = article.coverImageUrl?.trim() || null;
  const paragraphs = article.content
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return (
    <article className="mx-auto max-w-3xl" aria-labelledby="news-article-heading">
      <p className="mb-4">
        <Link
          href={newsIndexHref}
          className="text-muted hover:text-foreground focus-visible:ring-accent/40 inline-flex min-h-11 items-center rounded-sm text-sm font-medium underline-offset-4 hover:underline outline-none focus-visible:ring-2"
        >
          ← All news
        </Link>
      </p>

      <header>
        <h1
          id="news-article-heading"
          className="text-3xl font-semibold tracking-tight sm:text-4xl sm:leading-tight"
        >
          {article.title}
        </h1>
        {publishedLabel ? (
          <p className="text-muted mt-3 text-sm sm:text-base">
            <time dateTime={article.publishedAt}>{publishedLabel}</time>
          </p>
        ) : null}
      </header>

      {coverSrc ? (
        <div className="relative mt-8 aspect-[16/9] w-full overflow-hidden rounded-3xl bg-black/[0.04] dark:bg-white/[0.06]">
          <Image
            src={coverSrc}
            alt={`Cover image for ${article.title}`}
            fill
            unoptimized={coverSrc.startsWith("http")}
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 48rem"
            priority
          />
        </div>
      ) : null}

      <div className="mt-8 space-y-5 text-base leading-relaxed sm:text-lg sm:leading-8">
        {paragraphs.length > 0 ? (
          paragraphs.map((paragraph, index) => (
            <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
          ))
        ) : (
          <p className="text-muted">This article has no content yet.</p>
        )}
      </div>

      <div className="mt-12">
        <AcademyWebsiteCta
          title="Ready to book training?"
          description={`Browse available sessions and book online with ${academyName}.`}
          bookHref={bookHref}
          parentLoginHref={parentLoginHref}
        />
      </div>

      {previousHref || nextHref ? (
        <nav
          className="border-border mt-12 flex flex-col gap-4 border-t pt-8 sm:flex-row sm:justify-between"
          aria-label="Article navigation"
        >
          {previousHref ? (
            <Link
              href={previousHref}
              className="hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-12 flex-col justify-center rounded-2xl px-4 py-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
            >
              <span className="text-muted text-xs font-medium tracking-wide uppercase">
                Previous
              </span>
              <span className="mt-1 font-semibold">{previousTitle ?? "Previous article"}</span>
            </Link>
          ) : (
            <span />
          )}
          {nextHref ? (
            <Link
              href={nextHref}
              className="hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-12 flex-col justify-center rounded-2xl px-4 py-3 text-right text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:ml-auto dark:hover:bg-white/[0.06]"
            >
              <span className="text-muted text-xs font-medium tracking-wide uppercase">Next</span>
              <span className="mt-1 font-semibold">{nextTitle ?? "Next article"}</span>
            </Link>
          ) : null}
        </nav>
      ) : null}
    </article>
  );
}
