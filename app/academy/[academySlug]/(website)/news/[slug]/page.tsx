import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AcademyNewsArticle } from "@/components/academy-news-article";
import {
  buildAcademyWebsitePageMetadata,
  getAcademyNewsArticlePath,
  getAcademyWebsitePaths,
} from "@/lib/academy-website";
import {
  getPublicAcademyContext,
  getPublicArticle,
  getPublicArticleNeighbours,
} from "@/lib/academy-website-data";
import {
  buildNewsArticleJsonLd,
  JsonLdScript,
} from "@/lib/academy-website-jsonld";

type ArticlePageProps = {
  params: Promise<{ academySlug: string; slug: string }>;
};

export async function generateMetadata(props: ArticlePageProps): Promise<Metadata> {
  const { academySlug, slug } = await props.params;
  const context = await getPublicAcademyContext(academySlug);
  const article = context ? await getPublicArticle(context, slug) : null;

  return buildAcademyWebsitePageMetadata({
    academy: context?.academy ?? null,
    academySlug,
    page: "article",
    pageTitle: article?.title,
    pageDescription: article?.summary,
    pathSuffix: `/news/${encodeURIComponent(slug)}`,
    imageUrl: article?.coverImageUrl,
  });
}

export default async function AcademyNewsArticlePage(props: ArticlePageProps) {
  const { academySlug, slug } = await props.params;
  const context = await getPublicAcademyContext(academySlug);
  if (!context) notFound();

  const article = await getPublicArticle(context, slug);
  if (!article) notFound();

  const neighbours = await getPublicArticleNeighbours(context, article.slug);
  const paths = getAcademyWebsitePaths(academySlug);

  return (
    <div>
      <JsonLdScript
        data={buildNewsArticleJsonLd({
          article,
          academyName: context.academy.name,
          academySlug,
        })}
      />
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <AcademyNewsArticle
          article={article}
          academyName={context.academy.name}
          bookHref={paths.book}
          parentLoginHref={paths.parentLogin}
          newsIndexHref={paths.news}
          previousHref={
            neighbours.previous
              ? getAcademyNewsArticlePath(academySlug, neighbours.previous.slug)
              : null
          }
          previousTitle={neighbours.previous?.title ?? null}
          nextHref={
            neighbours.next
              ? getAcademyNewsArticlePath(academySlug, neighbours.next.slug)
              : null
          }
          nextTitle={neighbours.next?.title ?? null}
        />
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
