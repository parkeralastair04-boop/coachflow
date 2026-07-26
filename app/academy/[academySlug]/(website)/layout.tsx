import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AcademyWebsiteShell } from "@/components/academy-website-shell";
import {
  getAcademyWebsiteNavAvailability,
  getPublicAcademyContext,
} from "@/lib/academy-website-data";

type AcademyWebsiteLayoutProps = {
  children: ReactNode;
  params: Promise<{ academySlug: string }>;
};

export default async function AcademyWebsiteLayout({
  children,
  params,
}: AcademyWebsiteLayoutProps) {
  const { academySlug } = await params;
  const context = await getPublicAcademyContext(academySlug);

  if (!context) {
    notFound();
  }

  const navAvailability = await getAcademyWebsiteNavAvailability(context);

  return (
    <AcademyWebsiteShell
      academy={context.academy}
      academySlug={academySlug}
      navAvailability={navAvailability}
    >
      {children}
    </AcademyWebsiteShell>
  );
}
