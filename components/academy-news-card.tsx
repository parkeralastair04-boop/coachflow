import Image from "next/image";
import Link from "next/link";
import { formatNewsPublishedDate } from "@/lib/academy-news";
import type { PublicNewsArticle } from "@/lib/academy-website-types";

type AcademyNewsCardProps = {
  article: PublicNewsArticle;
  href: string;
};

export function AcademyNewsCard({ article, href }: AcademyNewsCardProps) {
  const headingId = `news-${article.id}-heading`;
  const publishedLabel = formatNewsPublishedDate(article.publishedAt);
  const coverSrc = article.coverImageUrl?.trim() || null;

  return (
    <article
      className="rounded-3xl bg-black/[0.02] p-5 sm:p-6 dark:bg-white/[0.03]"
      aria-labelledby={headingId}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        {coverSrc ? (
          <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-2xl bg-black/[0.04] sm:max-w-xs dark:bg-white/[0.06]">
            <Image
              src={coverSrc}
              alt={`Cover image for ${article.title}`}
              fill
              unoptimized={coverSrc.startsWith("http")}
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 20rem"
            />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="text-lg font-semibold tracking-tight sm:text-xl">
            {article.title}
          </h2>
          {publishedLabel ? (
            <p className="text-muted mt-2 text-sm">
              <time dateTime={article.publishedAt}>{publishedLabel}</time>
            </p>
          ) : null}
          {article.summary ? (
            <p className="text-muted mt-3 text-sm leading-relaxed">{article.summary}</p>
          ) : null}
          <Link
            href={href}
            className="bg-accent text-accent-foreground hover:opacity-90 focus-visible:ring-accent/40 mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full px-6 text-sm font-semibold transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
          >
            Read article
          </Link>
        </div>
      </div>
    </article>
  );
}
