import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AcademyNewsCard } from "@/components/academy-news-card";
import {
  buildAcademyWebsitePageMetadata,
  getAcademyNewsArticlePath,
  getAcademyWebsitePaths,
} from "@/lib/academy-website";
import { getPublicAcademyContext, getPublicNews } from "@/lib/academy-website-data";

type NewsPageProps = {
  params: Promise<{ academySlug: string }>;
};

export async function generateMetadata(props: NewsPageProps): Promise<Metadata> {
  const { academySlug } = await props.params;
  const context = await getPublicAcademyContext(academySlug);
  return buildAcademyWebsitePageMetadata({
    academy: context?.academy ?? null,
    academySlug,
    page: "news",
  });
}

export default async function AcademyNewsPage(props: NewsPageProps) {
  const { academySlug } = await props.params;
  const context = await getPublicAcademyContext(academySlug);
  if (!context) notFound();

  const articles = await getPublicNews(context);
  const paths = getAcademyWebsitePaths(academySlug);

  return (
    <div>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <header className="max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">News</h1>
          <p className="text-muted mt-3 text-sm sm:text-base">
            Updates from {context.academy.name}.
          </p>
        </header>

        {articles.length === 0 ? (
          <section className="mt-10" aria-labelledby="news-empty-heading">
            <h2 id="news-empty-heading" className="sr-only">
              No news published
            </h2>
            <div className="rounded-3xl bg-black/[0.02] px-5 py-8 dark:bg-white/[0.03]">
              <p className="text-muted text-sm">No news articles have been published yet.</p>
              <Link
                href={paths.book}
                className="bg-accent text-accent-foreground hover:opacity-90 focus:ring-accent/40 mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full px-6 text-sm font-semibold transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 sm:w-auto"
              >
                Book Training
              </Link>
            </div>
          </section>
        ) : (
          <section className="mt-10" aria-labelledby="news-list-heading">
            <h2 id="news-list-heading" className="sr-only">
              Latest articles
            </h2>
            <ul className="grid gap-4" role="list">
              {articles.map((article) => (
                <li key={article.id}>
                  <AcademyNewsCard
                    article={article}
                    href={getAcademyNewsArticlePath(academySlug, article.slug)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="sticky bottom-3 z-30 px-4 pb-3 lg:hidden">
        <Link
          href={paths.book}
          className="bg-accent text-accent-foreground focus:ring-accent/40 shadow-lg inline-flex min-h-12 w-full items-center justify-center rounded-full px-6 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2"
        >
          Book Training
        </Link>
      </div>
    </div>
  );
}
