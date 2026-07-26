import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AcademyResultCard } from "@/components/academy-result-card";
import { buildAcademyWebsitePageMetadata, getAcademyWebsitePaths } from "@/lib/academy-website";
import { getPublicAcademyContext, getPublicResults } from "@/lib/academy-website-data";

type ResultsPageProps = {
  params: Promise<{ academySlug: string }>;
};

export async function generateMetadata(props: ResultsPageProps): Promise<Metadata> {
  const { academySlug } = await props.params;
  const context = await getPublicAcademyContext(academySlug);
  return buildAcademyWebsitePageMetadata({
    academy: context?.academy ?? null,
    academySlug,
    page: "results",
  });
}

export default async function AcademyResultsPage(props: ResultsPageProps) {
  const { academySlug } = await props.params;
  const context = await getPublicAcademyContext(academySlug);
  if (!context) notFound();

  const results = await getPublicResults(context);
  const paths = getAcademyWebsitePaths(academySlug);
  const featuredResult = results[0] ?? null;
  const remainingResults = featuredResult ? results.slice(1) : results;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Results</h1>
        <p className="text-muted mt-3 text-sm sm:text-base">
          Recent match results for {context.academy.name}.
        </p>
      </header>

      {results.length === 0 ? (
        <section className="mt-10" aria-labelledby="results-empty-heading">
          <h2 id="results-empty-heading" className="sr-only">
            No results published
          </h2>
          <div className="rounded-3xl bg-black/[0.02] px-5 py-8 dark:bg-white/[0.03]">
            <p className="text-muted text-sm">No match results have been published yet.</p>
            <Link
              href={paths.book}
              className="bg-accent text-accent-foreground hover:opacity-90 focus:ring-accent/40 mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full px-6 text-sm font-semibold transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 sm:w-auto"
            >
              Book Training
            </Link>
          </div>
        </section>
      ) : (
        <>
          {featuredResult ? (
            <section
              className="mt-10"
              aria-labelledby={`featured-result-${featuredResult.id}-heading`}
            >
              <AcademyResultCard result={featuredResult} featured />
            </section>
          ) : null}

          {remainingResults.length > 0 ? (
            <section className="mt-10" aria-labelledby="results-list-heading">
              <h2 id="results-list-heading" className="text-xl font-semibold tracking-tight">
                More results
              </h2>
              <ul className="mt-5 grid gap-4" role="list">
                {remainingResults.map((result) => (
                  <li key={result.id}>
                    <AcademyResultCard result={result} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
