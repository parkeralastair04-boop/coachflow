import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AcademyCoachCard } from "@/components/academy-coach-card";
import { buildAcademyWebsitePageMetadata } from "@/lib/academy-website";
import { getPublicAcademyContext, getPublicCoaches } from "@/lib/academy-website-data";

type CoachesPageProps = {
  params: Promise<{ academySlug: string }>;
};

export async function generateMetadata(props: CoachesPageProps): Promise<Metadata> {
  const { academySlug } = await props.params;
  const context = await getPublicAcademyContext(academySlug);
  return buildAcademyWebsitePageMetadata({
    academy: context?.academy ?? null,
    academySlug,
    page: "coaches",
  });
}

export default async function AcademyCoachesPage(props: CoachesPageProps) {
  const { academySlug } = await props.params;
  const context = await getPublicAcademyContext(academySlug);
  if (!context) notFound();

  const coaches = await getPublicCoaches(context);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Coaches</h1>
        <p className="text-muted mt-3 text-sm sm:text-base">
          Meet the coaching team at {context.academy.name}.
        </p>
      </header>

      <section className="mt-10" aria-labelledby="coaches-list-heading">
        <h2 id="coaches-list-heading" className="sr-only">
          Coach list
        </h2>
        {coaches.length === 0 ? (
          <p className="text-muted rounded-3xl bg-black/[0.02] px-5 py-8 text-sm dark:bg-white/[0.03]">
            No coaches have been published yet.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2" role="list">
            {coaches.map((coach) => (
              <li key={coach.id}>
                <AcademyCoachCard coach={coach} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
