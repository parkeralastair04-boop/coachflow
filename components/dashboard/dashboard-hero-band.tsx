"use client";

import { LandPlot } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { DashboardPitchStrip } from "@/components/dashboard/dashboard-pitch-strip";
import { DashboardStats } from "@/components/dashboard-stats";
import { cn } from "@/lib/utils";

/** Full-width pitch command centre — greeting, zone nav, and metrics. */
export function DashboardHeroBand({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "dashboard-hero-band relative overflow-hidden rounded-none sm:rounded-3xl",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 tactical-grid opacity-[0.14]" aria-hidden />
      <div className="pointer-events-none absolute inset-0 pitch-surface-subtle opacity-60" aria-hidden />
      <div
        className="pointer-events-none absolute -right-20 top-0 size-80 rounded-full bg-emerald-500/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-10 bottom-0 size-64 rounded-full bg-amber-500/5 blur-3xl"
        aria-hidden
      />

      <div className="relative px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] xl:items-end xl:gap-10">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <LandPlot className="text-accent size-5" aria-hidden />
              <p className="text-accent text-[11px] font-bold tracking-[0.28em] uppercase">
                Your coaching hub
              </p>
            </div>
            <DashboardHeader variant="hero" />
            <div className="mt-6 hidden xl:block">
              <DashboardPitchStrip />
            </div>
          </div>

          <div className="xl:pb-1">
            <DashboardStats variant="hero" />
          </div>
        </div>

        <div className="mt-6 xl:hidden">
          <DashboardPitchStrip />
        </div>
      </div>
    </div>
  );
}
