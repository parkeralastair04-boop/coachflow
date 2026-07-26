import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  AcademyAboutBookingPanel,
  AcademyInfoCard,
} from "@/components/academy-website-info-card";
import { buildAcademyWebsitePageMetadata, getAcademyWebsitePaths } from "@/lib/academy-website";
import { getPublicAcademyContext } from "@/lib/academy-website-data";

type AboutPageProps = {
  params: Promise<{ academySlug: string }>;
};

export async function generateMetadata(props: AboutPageProps): Promise<Metadata> {
  const { academySlug } = await props.params;
  const context = await getPublicAcademyContext(academySlug);
  return buildAcademyWebsitePageMetadata({
    academy: context?.academy ?? null,
    academySlug,
    page: "about",
  });
}

export default async function AcademyAboutPage(props: AboutPageProps) {
  const { academySlug } = await props.params;
  const context = await getPublicAcademyContext(academySlug);
  if (!context) notFound();

  const paths = getAcademyWebsitePaths(academySlug);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">About</h1>
        <p className="text-muted mt-3 text-sm sm:text-base">
          Learn more about {context.academy.name}.
        </p>
      </header>

      <section className="mt-10" aria-labelledby="academy-info-card-heading">
        <AcademyInfoCard academy={context.academy} academySlug={academySlug} />
      </section>

      <section className="mt-10" aria-label="Book training">
        <AcademyAboutBookingPanel academyName={context.academy.name} bookHref={paths.book} />
      </section>
    </div>
  );
}
