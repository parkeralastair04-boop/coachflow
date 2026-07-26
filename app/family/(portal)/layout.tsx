import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { FamilyPortalNav } from "@/components/family-portal-nav";
import { PitchSurface } from "@/components/football/pitch-surface";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserAccountMenu } from "@/components/user-account-menu";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { privateRouteMetadata } from "@/lib/private-route-metadata";
import { LAYOUT } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  ...privateRouteMetadata,
  title: "Family training hub",
  description: "View sessions, attendance, reports, camps, and payments for your children.",
};

export default async function FamilyPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/family");
  }

  return (
    <div className="mesh-gradient min-h-full">
      <header className="football-family-header sticky top-0 z-30 backdrop-blur-xl">
        <div className={cn(LAYOUT.pageMax, "flex max-w-5xl flex-col gap-3 px-4 py-4 sm:px-6")}>
          <div className="flex items-center justify-between gap-4">
            <Link href="/family" className="inline-flex" aria-label="Family training hub home">
              <BrandLogo size="auth" />
            </Link>
            <FamilyPortalNav className="hidden sm:flex" />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <UserAccountMenu
                email={user.email}
                variant="family"
                layout="header"
              />
            </div>
          </div>
          <FamilyPortalNav className="sm:hidden -mx-1 overflow-x-auto pb-0.5" />
        </div>
      </header>

      <PitchSurface variant="subtle" className="min-h-[calc(100vh-4.5rem)]">
        <div className={cn(LAYOUT.pageMax, "page-content-enter max-w-5xl px-4 py-8 sm:px-6 sm:py-10")}>
          <div className="football-page-band mb-8">
            <div className="pointer-events-none absolute inset-0 tactical-grid opacity-[0.1]" aria-hidden />
            <div className="relative flex items-start gap-3">
              <div className="bg-accent/12 ring-accent/25 flex size-10 shrink-0 items-center justify-center rounded-xl ring-1">
                <Users className="text-accent size-5" aria-hidden />
              </div>
              <div>
                <p className="text-accent text-[11px] font-bold tracking-[0.22em] uppercase">
                  Parent portal
                </p>
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  Your family&apos;s football journey
                </h1>
                <p className="text-muted mt-1 text-sm leading-relaxed">
                  Sessions, attendance, reports, and payments for your players.
                </p>
              </div>
            </div>
          </div>
          {children}
        </div>
      </PitchSurface>
    </div>
  );
}
