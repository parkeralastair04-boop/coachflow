import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { AcademyWebsiteCta } from "@/components/academy-website-cta";
import { getAcademyWebsiteIntroduction, getAcademyWebsitePaths } from "@/lib/academy-website";
import type { PublicAcademy } from "@/lib/academy-website-types";

type AcademyInfoCardProps = {
  academy: PublicAcademy;
  academySlug: string;
  showActions?: boolean;
};

export function AcademyInfoCard({
  academy,
  academySlug,
  showActions = true,
}: AcademyInfoCardProps) {
  const paths = getAcademyWebsitePaths(academySlug);
  const introduction = getAcademyWebsiteIntroduction(academy);
  const logoSrc = academy.logoUrl?.trim() || undefined;
  const supportEmail = academy.supportEmail?.trim() || null;

  return (
    <article
      className="rounded-3xl bg-black/[0.02] p-6 sm:p-8 dark:bg-white/[0.03]"
      aria-labelledby="academy-info-card-heading"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {logoSrc ? (
          <BrandLogo
            src={logoSrc}
            alt={`${academy.name} logo`}
            className="h-16 w-auto shrink-0 sm:h-20"
          />
        ) : (
          <span
            className="bg-accent/15 text-accent inline-flex size-16 shrink-0 items-center justify-center rounded-2xl text-xl font-semibold"
            aria-hidden
          >
            {academy.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 id="academy-info-card-heading" className="text-2xl font-semibold tracking-tight">
            {academy.name}
          </h2>
          <p className="text-muted mt-3 text-sm leading-relaxed sm:text-base">{introduction}</p>
          {supportEmail ? (
            <p className="mt-4 text-sm">
              <span className="text-muted">Email: </span>
              <a
                href={`mailto:${supportEmail}`}
                className="hover:text-accent focus-visible:ring-accent/40 rounded-sm font-medium underline-offset-4 hover:underline outline-none focus-visible:ring-2"
              >
                {supportEmail}
              </a>
            </p>
          ) : null}
        </div>
      </div>

      {showActions ? (
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href={paths.book}
            className="bg-accent text-accent-foreground hover:opacity-90 focus-visible:ring-accent/40 inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-semibold transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Book Training
          </Link>
          <Link
            href={paths.parentLogin}
            className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-12 items-center justify-center rounded-full border px-6 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
          >
            Parent Login
          </Link>
        </div>
      ) : null}
    </article>
  );
}

type AcademyAboutBookingPanelProps = {
  academyName: string;
  bookHref: string;
};

export function AcademyAboutBookingPanel({
  academyName,
  bookHref,
}: AcademyAboutBookingPanelProps) {
  return (
    <AcademyWebsiteCta
      title="Book training with us"
      description={`Browse available sessions and book online with ${academyName}.`}
      bookHref={bookHref}
    />
  );
}
