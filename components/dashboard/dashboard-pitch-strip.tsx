"use client";

import Link from "next/link";
import { CalendarClock, ClipboardCheck, Cone, Goal, LandPlot, Shirt } from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK_LINKS = [
  { href: "#pitch-week", label: "This week", icon: LandPlot },
  { href: "#families", label: "Families", icon: Shirt },
  { href: "#match-training", label: "Match day", icon: Goal },
  { href: "#operations", label: "Operations", icon: CalendarClock },
] as const;

/** Horizontal pitch status strip — today's coaching focus at a glance. */
export function DashboardPitchStrip({ className }: { className?: string }) {
  return (
    <nav
      className={cn(
        "dashboard-pitch-strip relative overflow-hidden rounded-2xl border border-emerald-500/15 px-4 py-3 sm:px-5",
        className,
      )}
      aria-label="Dashboard quick navigation"
    >
      <div className="pointer-events-none absolute inset-0 tactical-grid opacity-[0.12]" aria-hidden />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Cone className="text-accent size-4 shrink-0" aria-hidden />
          <p className="text-[11px] font-bold tracking-[0.2em] text-white/45 uppercase">
            Academy zones
          </p>
        </div>
        <ul className="flex flex-wrap gap-2">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/75 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-white"
                >
                  <Icon className="text-accent size-3.5" aria-hidden />
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <span className="hidden items-center gap-1.5 text-xs text-emerald-400/70 sm:inline-flex">
          <ClipboardCheck className="size-3.5" aria-hidden />
          Registers · Bookings · Reports
        </span>
      </div>
    </nav>
  );
}
