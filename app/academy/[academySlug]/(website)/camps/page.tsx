import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AcademyCampCard } from "@/components/academy-camp-card";
import { AcademyWebsiteEmptyState } from "@/components/academy-website-empty-state";
import { buildAcademyWebsitePageMetadata, getAcademyWebsitePaths } from "@/lib/academy-website";
import { getPublicAcademyContext, getPublicCamps } from "@/lib/academy-website-data";

type CampsPageProps = {
  params: Promise<{ academySlug: string }>;
};

export async function generateMetadata(props: CampsPageProps): Promise<Metadata> {
  const { academySlug } = await props.params;
  const context = await getPublicAcademyContext(academySlug);
  return buildAcademyWebsitePageMetadata({
    academy: context?.academy ?? null,
    academySlug,
    page: "camps",
  });
}

export default async function AcademyCampsPage(props: CampsPageProps) {
  const { academySlug } = await props.params;
  const context = await getPublicAcademyContext(academySlug);
  if (!context) notFound();

  const camps = await getPublicCamps(context);
  const paths = getAcademyWebsitePaths(academySlug);
  const featuredCamp = camps[0] ?? null;
  const remainingCamps = featuredCamp ? camps.slice(1) : camps;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Holiday camps</h1>
        <p className="text-muted mt-3 text-sm sm:text-base">
          Upcoming camps with {context.academy.name}.
        </p>
      </header>

      {camps.length === 0 ? (
        <section className="mt-10">
          <AcademyWebsiteEmptyState
            title="No holiday camps published"
            description={`${context.academy.name} has not published any public camps yet. Book regular training online in the meantime.`}
            bookHref={paths.book}
            contactHref={paths.contact}
          />
        </section>
      ) : (
        <>
          {featuredCamp ? (
            <section className="mt-10" aria-labelledby={`featured-camp-${featuredCamp.id}-heading`}>
              <AcademyCampCard camp={featuredCamp} bookHref={paths.book} featured />
            </section>
          ) : null}

          {remainingCamps.length > 0 ? (
            <section className="mt-10" aria-labelledby="camps-list-heading">
              <h2 id="camps-list-heading" className="text-xl font-semibold tracking-tight">
                More camps
              </h2>
              <ul className="mt-5 grid gap-4" role="list">
                {remainingCamps.map((camp) => (
                  <li key={camp.id}>
                    <AcademyCampCard camp={camp} bookHref={paths.book} />
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
