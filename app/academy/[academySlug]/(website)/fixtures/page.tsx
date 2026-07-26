import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AcademyFixtureCard } from "@/components/academy-fixture-card";
import { AcademyWebsiteEmptyState } from "@/components/academy-website-empty-state";
import { buildAcademyWebsitePageMetadata, getAcademyWebsitePaths } from "@/lib/academy-website";
import { getPublicAcademyContext, getPublicFixtures } from "@/lib/academy-website-data";
import {
  buildSportsEventJsonLd,
  JsonLdScript,
} from "@/lib/academy-website-jsonld";

type FixturesPageProps = {
  params: Promise<{ academySlug: string }>;
};

export async function generateMetadata(props: FixturesPageProps): Promise<Metadata> {
  const { academySlug } = await props.params;
  const context = await getPublicAcademyContext(academySlug);
  return buildAcademyWebsitePageMetadata({
    academy: context?.academy ?? null,
    academySlug,
    page: "fixtures",
  });
}

export default async function AcademyFixturesPage(props: FixturesPageProps) {
  const { academySlug } = await props.params;
  const context = await getPublicAcademyContext(academySlug);
  if (!context) notFound();

  const fixtures = await getPublicFixtures(context);
  const paths = getAcademyWebsitePaths(academySlug);
  const featuredFixture = fixtures[0] ?? null;
  const remainingFixtures = featuredFixture ? fixtures.slice(1) : fixtures;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      {fixtures.length > 0 ? (
        <JsonLdScript
          data={fixtures.map((fixture) =>
            buildSportsEventJsonLd({
              fixture,
              academyName: context.academy.name,
              academySlug,
            }),
          )}
        />
      ) : null}
      <header className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Fixtures</h1>
        <p className="text-muted mt-3 text-sm sm:text-base">
          Upcoming matches for {context.academy.name}.
        </p>
      </header>

      {fixtures.length === 0 ? (
        <section className="mt-10">
          <AcademyWebsiteEmptyState
            title="No upcoming fixtures published"
            description={`Check back soon for match dates from ${context.academy.name}, or book a training session online.`}
            bookHref={paths.book}
            contactHref={paths.contact}
          />
        </section>
      ) : (
        <>
          {featuredFixture ? (
            <section
              className="mt-10"
              aria-labelledby={`featured-fixture-${featuredFixture.id}-heading`}
            >
              <AcademyFixtureCard fixture={featuredFixture} featured />
            </section>
          ) : null}

          {remainingFixtures.length > 0 ? (
            <section className="mt-10" aria-labelledby="fixtures-list-heading">
              <h2 id="fixtures-list-heading" className="text-xl font-semibold tracking-tight">
                More fixtures
              </h2>
              <ul className="mt-5 grid gap-4" role="list">
                {remainingFixtures.map((fixture) => (
                  <li key={fixture.id}>
                    <AcademyFixtureCard fixture={fixture} />
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
