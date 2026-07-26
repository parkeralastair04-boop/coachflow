import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AcademyWebsiteEmptyState } from "@/components/academy-website-empty-state";
import { AcademyTeamCard } from "@/components/academy-team-card";
import { buildAcademyWebsitePageMetadata, getAcademyWebsitePaths } from "@/lib/academy-website";
import { getPublicAcademyContext, getPublicTeams } from "@/lib/academy-website-data";

type TeamsPageProps = {
  params: Promise<{ academySlug: string }>;
};

export async function generateMetadata(props: TeamsPageProps): Promise<Metadata> {
  const { academySlug } = await props.params;
  const context = await getPublicAcademyContext(academySlug);
  return buildAcademyWebsitePageMetadata({
    academy: context?.academy ?? null,
    academySlug,
    page: "teams",
  });
}

export default async function AcademyTeamsPage(props: TeamsPageProps) {
  const { academySlug } = await props.params;
  const context = await getPublicAcademyContext(academySlug);
  if (!context) notFound();

  const teams = await getPublicTeams(context);
  const paths = getAcademyWebsitePaths(academySlug);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Teams</h1>
        <p className="text-muted mt-3 text-sm sm:text-base">
          Age groups and squads at {context.academy.name}.
        </p>
      </header>

      <section className="mt-10" aria-labelledby="teams-list-heading">
        <h2 id="teams-list-heading" className="sr-only">
          Team list
        </h2>
        {teams.length === 0 ? (
          <AcademyWebsiteEmptyState
            title="Teams will appear here soon"
            description={`${context.academy.name} has not published public team pages yet. You can still book training online.`}
            bookHref={paths.book}
            contactHref={paths.contact}
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2" role="list">
            {teams.map((team) => (
              <li key={team.id}>
                <AcademyTeamCard team={team} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
