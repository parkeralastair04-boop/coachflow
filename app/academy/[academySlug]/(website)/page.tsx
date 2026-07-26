import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { AcademyWebsiteCta } from "@/components/academy-website-cta";
import {
  buildAcademyWebsitePageMetadata,
  getAcademyNewsArticlePath,
  getAcademyWebsiteIntroduction,
  getAcademyWebsitePaths,
} from "@/lib/academy-website";
import { getPublicAcademyContext, getPublicNews } from "@/lib/academy-website-data";
import { formatNewsPublishedDate } from "@/lib/academy-news";
import { AcademyNewsCard } from "@/components/academy-news-card";
import {
  buildOrganizationJsonLd,
  JsonLdScript,
} from "@/lib/academy-website-jsonld";

type AcademyHomePageProps = {
  params: Promise<{ academySlug: string }>;
};

export async function generateMetadata(props: AcademyHomePageProps): Promise<Metadata> {
  const { academySlug } = await props.params;
  const context = await getPublicAcademyContext(academySlug);
  return buildAcademyWebsitePageMetadata({
    academy: context?.academy ?? null,
    academySlug,
    page: "home",
  });
}

export default async function AcademyHomePage(props: AcademyHomePageProps) {
  const { academySlug } = await props.params;
  const context = await getPublicAcademyContext(academySlug);

  if (!context) {
    notFound();
  }

  const { academy } = context;
  const paths = getAcademyWebsitePaths(academySlug);
  const supportEmail = academy.supportEmail;
  const supportPhone = academy.supportPhone;
  const introduction = getAcademyWebsiteIntroduction(academy);
  const logoSrc = academy.logoUrl?.trim() || undefined;
  const latestNews = (await getPublicNews(context))[0] ?? null;
  const latestNewsDate = latestNews
    ? formatNewsPublishedDate(latestNews.publishedAt)
    : null;

  return (
    <div>
      <JsonLdScript data={buildOrganizationJsonLd({ academy, academySlug })} />
      <section
        className="relative overflow-hidden border-b border-[color-mix(in_srgb,var(--academy-secondary)_14%,transparent)]"
        aria-labelledby="academy-hero-heading"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 10% 0%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 55%), radial-gradient(ellipse 60% 50% at 90% 20%, color-mix(in srgb, var(--academy-secondary) 12%, transparent), transparent 50%)`,
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="flex flex-col gap-8 lg:max-w-3xl">
            {logoSrc ? (
              <BrandLogo
                src={logoSrc}
                alt={`${academy.name} logo`}
                priority
                className="h-16 w-auto sm:h-20"
              />
            ) : null}
            <div>
              <h1
                id="academy-hero-heading"
                className="text-4xl font-semibold tracking-tight sm:text-5xl sm:leading-[1.08]"
              >
                {academy.name}
              </h1>
              {supportEmail ? (
                <p className="text-muted mt-4 text-base sm:text-lg">
                  <a
                    href={`mailto:${supportEmail}`}
                    className="hover:text-foreground focus:ring-accent/40 rounded-sm underline-offset-4 hover:underline focus:outline-none focus:ring-2"
                  >
                    {supportEmail}
                  </a>
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href={paths.book}
                className="bg-accent text-accent-foreground hover:opacity-90 focus:ring-accent/40 inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-semibold transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2"
              >
                Book Training
              </Link>
              <Link
                href={paths.parentLogin}
                className="border-border hover:bg-black/[0.03] focus:ring-accent/40 inline-flex min-h-12 items-center justify-center rounded-full border px-6 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:hover:bg-white/[0.06]"
              >
                Parent Login
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section
        className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8"
        aria-labelledby="academy-intro-heading"
      >
        <h2 id="academy-intro-heading" className="text-2xl font-semibold tracking-tight">
          About {academy.name}
        </h2>
        <p className="text-muted mt-4 max-w-3xl text-base leading-relaxed">{introduction}</p>
      </section>

      <section
        className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8"
        aria-labelledby="academy-info-heading"
      >
        <h2 id="academy-info-heading" className="text-2xl font-semibold tracking-tight">
          Quick information
        </h2>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-black/[0.02] px-5 py-4 dark:bg-white/[0.03]">
            <dt className="text-muted text-xs font-medium tracking-wide uppercase">Academy</dt>
            <dd className="mt-1 text-sm font-medium">{academy.name}</dd>
          </div>
          <div className="rounded-2xl bg-black/[0.02] px-5 py-4 dark:bg-white/[0.03]">
            <dt className="text-muted text-xs font-medium tracking-wide uppercase">Email</dt>
            <dd className="mt-1 text-sm font-medium">
              {supportEmail ? (
                <a
                  href={`mailto:${supportEmail}`}
                  className="hover:text-accent focus:ring-accent/40 rounded-sm underline-offset-4 hover:underline focus:outline-none focus:ring-2"
                >
                  {supportEmail}
                </a>
              ) : (
                <span className="text-muted">Not published yet</span>
              )}
            </dd>
          </div>
          {supportPhone ? (
            <div className="rounded-2xl bg-black/[0.02] px-5 py-4 dark:bg-white/[0.03]">
              <dt className="text-muted text-xs font-medium tracking-wide uppercase">Phone</dt>
              <dd className="mt-1 text-sm font-medium">
                <a
                  href={`tel:${supportPhone}`}
                  className="hover:text-accent focus:ring-accent/40 rounded-sm underline-offset-4 hover:underline focus:outline-none focus:ring-2"
                >
                  {supportPhone}
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      {latestNews ? (
        <section
          className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8"
          aria-labelledby="academy-latest-news-heading"
        >
          <h2 id="academy-latest-news-heading" className="text-2xl font-semibold tracking-tight">
            Latest news
          </h2>
          <p className="text-muted mt-2 text-sm">
            {latestNewsDate ? `Published ${latestNewsDate}` : "From the academy"}
          </p>
          <div className="mt-6">
            <AcademyNewsCard
              article={latestNews}
              href={getAcademyNewsArticlePath(academySlug, latestNews.slug)}
            />
          </div>
        </section>
      ) : null}

      <section
        className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8"
        aria-labelledby="academy-contact-teaser-heading"
      >
        <div className="rounded-3xl bg-black/[0.02] px-6 py-8 dark:bg-white/[0.03]">
          <h2 id="academy-contact-teaser-heading" className="text-2xl font-semibold tracking-tight">
            Questions?
          </h2>
          <p className="text-muted mt-2 text-sm sm:text-base">Get in touch.</p>
          <Link
            href={paths.contact}
            className="border-border hover:bg-black/[0.03] focus:ring-accent/40 mt-6 inline-flex min-h-12 items-center justify-center rounded-full border px-6 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:hover:bg-white/[0.06]"
          >
            Contact
          </Link>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <AcademyWebsiteCta
          title="Ready to book training?"
          description={`Browse available sessions and book online with ${academy.name}.`}
          bookHref={paths.book}
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
