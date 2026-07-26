import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { AcademyWebsiteMobileNav } from "@/components/academy-website-mobile-nav";
import { AcademyWebsiteNavLink } from "@/components/academy-website-nav-link";
import {
  getAcademyWebsiteNavItems,
  getAcademyWebsitePaths,
} from "@/lib/academy-website";
import type { AcademyWebsiteNavAvailability } from "@/lib/academy-website-nav";
import type { PublicAcademy } from "@/lib/academy-website-types";
import { cn } from "@/lib/utils";

type AcademyWebsiteHeaderProps = {
  academy: PublicAcademy;
  academySlug: string;
  navAvailability?: AcademyWebsiteNavAvailability;
};

export function AcademyWebsiteHeader({
  academy,
  academySlug,
  navAvailability,
}: AcademyWebsiteHeaderProps) {
  const paths = getAcademyWebsitePaths(academySlug);
  const navItems = getAcademyWebsiteNavItems(academySlug, navAvailability);
  const primaryItems = navItems.filter((item) => item.id !== "book" && item.id !== "parent");
  const logoSrc = academy.logoUrl?.trim() || undefined;

  return (
    <header className="border-border/80 sticky top-0 z-40 border-b bg-[color-mix(in_srgb,var(--background)_92%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href={paths.home}
          className="focus-visible:ring-accent/40 inline-flex min-h-11 max-w-[min(100%,16rem)] items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={`${academy.name} home`}
        >
          {logoSrc ? (
            <BrandLogo src={logoSrc} alt={`${academy.name} logo`} className="h-10 w-auto" />
          ) : (
            <span
              className="bg-accent/15 text-accent inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold"
              aria-hidden
            >
              {academy.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="truncate text-sm font-semibold tracking-tight sm:text-base">
            {academy.name}
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Academy">
          {primaryItems.map((item) =>
            item.href ? (
              <AcademyWebsiteNavLink
                key={item.id}
                href={item.href}
                exact={item.id === "home"}
                className="hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
                activeClassName="bg-black/[0.05] text-foreground dark:bg-white/[0.08]"
              >
                {item.label}
              </AcademyWebsiteNavLink>
            ) : null,
          )}
          <AcademyWebsiteNavLink
            href={paths.parentLogin}
            className="hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
            activeClassName="bg-black/[0.05] dark:bg-white/[0.08]"
          >
            Parent Login
          </AcademyWebsiteNavLink>
          <AcademyWebsiteNavLink
            href={paths.book}
            className={cn(
              "bg-accent text-accent-foreground hover:opacity-90 focus-visible:ring-accent/40 ml-1 inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
            activeClassName="ring-2 ring-offset-2 ring-[color-mix(in_srgb,var(--accent)_50%,transparent)]"
          >
            Book Training
          </AcademyWebsiteNavLink>
        </nav>

        <div className="flex items-center gap-2 lg:hidden">
          <AcademyWebsiteNavLink
            href={paths.book}
            className="bg-accent text-accent-foreground hover:opacity-90 focus-visible:ring-accent/40 inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            activeClassName="ring-2 ring-offset-2 ring-[color-mix(in_srgb,var(--accent)_50%,transparent)]"
          >
            Book
          </AcademyWebsiteNavLink>
          <AcademyWebsiteMobileNav
            academyName={academy.name}
            items={navItems}
            bookHref={paths.book}
            parentLoginHref={paths.parentLogin}
          />
        </div>
      </div>
    </header>
  );
}
