import Link from "next/link";
import type { ReactNode } from "react";
import { LandPlot } from "lucide-react";
import { DemoResetButton } from "@/components/demo-mode-banner";
import { DemoProductTour } from "@/components/demo-product-tour";
import { BrandLogo } from "@/components/brand-logo";
import { PitchSurface } from "@/components/football/pitch-surface";
import { buttonVariants } from "@/components/ui/button";
import { DEMO_ACADEMY_SLUG } from "@/lib/demo/constants";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/demo/dashboard", label: "Academy Pulse" },
  { href: "/demo/dashboard/players", label: "Active Squad" },
  { href: "/demo/dashboard/sessions", label: "Training" },
  { href: "/demo/dashboard/bookings", label: "Parent Bookings" },
  { href: "/demo/dashboard/reports", label: "Development" },
  { href: "/demo/dashboard/analytics", label: "Insights" },
  { href: "/demo/dashboard/family", label: "Parent View" },
  { href: "/demo/dashboard/billing", label: "Your Plan" },
  { href: `/academy/${DEMO_ACADEMY_SLUG}`, label: "Website" },
] as const;

export default function DemoDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mesh-gradient min-h-full">
      <header className="football-demo-header sticky top-0 z-40 border-b backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/demo" aria-label="Demo hub">
              <BrandLogo size="sidebar" />
            </Link>
            <div>
              <p className="text-sm font-semibold tracking-tight">Riverside United</p>
              <p className="text-white/45 text-xs">Demo academy</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DemoProductTour />
            <DemoResetButton />
            <Link href="/signup" className={buttonVariants({ variant: "accent", size: "sm" })}>
              Start coaching free
            </Link>
          </div>
        </div>
        <nav
          className="mx-auto flex max-w-6xl gap-1 overflow-x-auto border-t border-white/[0.08] px-2 py-2 sm:px-4"
          aria-label="Demo dashboard"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white/90",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <PitchSurface variant="subtle">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 page-content-enter">
          <div className="dashboard-hero-band relative mb-10 overflow-hidden rounded-2xl px-5 py-6 sm:px-7 sm:py-8">
            <div className="pointer-events-none absolute inset-0 tactical-grid opacity-[0.12]" aria-hidden />
            <div className="relative flex items-start gap-3">
              <LandPlot className="text-accent size-5 shrink-0" aria-hidden />
              <div>
                <p className="text-accent text-[11px] font-bold tracking-[0.24em] uppercase">
                  Demo coaching hub
                </p>
                <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  Riverside United Academy
                </h1>
                <p className="mt-1.5 text-sm text-white/50">
                  Explore how Awarix runs squads, sessions, and parent communication.
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
