import type { ReactNode } from "react";
import { AcademyWebsiteFooter } from "@/components/academy-website-footer";
import { AcademyWebsiteHeader } from "@/components/academy-website-header";
import { DemoAcademyWebsiteBanner } from "@/components/demo-academy-website-banner";
import { getAcademyWebsiteThemeStyle } from "@/lib/academy-website";
import type { AcademyWebsiteNavAvailability } from "@/lib/academy-website-nav";
import {
  buildSportsClubJsonLd,
  JsonLdScript,
} from "@/lib/academy-website-jsonld";
import type { PublicAcademy } from "@/lib/academy-website-types";
import { isDemoAcademySlug } from "@/lib/demo/constants";

type AcademyWebsiteShellProps = {
  academy: PublicAcademy;
  academySlug: string;
  navAvailability?: AcademyWebsiteNavAvailability;
  children: ReactNode;
};

export function AcademyWebsiteShell({
  academy,
  academySlug,
  navAvailability,
  children,
}: AcademyWebsiteShellProps) {
  const isDemo = isDemoAcademySlug(academySlug);

  return (
    <div
      className="bg-background text-foreground flex min-h-screen flex-col"
      style={getAcademyWebsiteThemeStyle(academy)}
    >
      <JsonLdScript data={buildSportsClubJsonLd({ academy, academySlug })} />
      {isDemo ? <DemoAcademyWebsiteBanner /> : null}
      <a
        href="#academy-main-content"
        className="bg-accent text-accent-foreground focus-visible:ring-accent/40 sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-full focus:px-4 focus:text-sm focus:font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Skip to main content
      </a>
      <AcademyWebsiteHeader
        academy={academy}
        academySlug={academySlug}
        navAvailability={navAvailability}
      />
      <main id="academy-main-content" className="flex-1">
        {children}
      </main>
      <AcademyWebsiteFooter academy={academy} academySlug={academySlug} />
    </div>
  );
}
