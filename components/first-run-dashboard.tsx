"use client";

import Link from "next/link";
import { Cone, Flag, Link2 } from "lucide-react";
import { GettingStartedCard } from "@/components/getting-started-card";
import { FirstBookingCelebration } from "@/components/first-booking-celebration";
import { MilestoneCelebrations } from "@/components/milestone-celebrations";
import { dispatchResumeOnboarding } from "@/components/onboarding-host";
import { EmptyState } from "@/components/empty-state";
import { footballEmptyPreset } from "@/lib/football-identity";

/**
 * Simplified home for coaches with no players, sessions, or bookings yet.
 */
export function FirstRunDashboard() {
  return (
    <div className="space-y-8">
      <div className="stadium-gradient pitch-surface-subtle relative overflow-hidden rounded-2xl px-1 py-2 sm:px-2">
        <div className="pointer-events-none absolute inset-0 tactical-grid opacity-[0.25]" aria-hidden />
        <div className="relative px-4 py-6 sm:px-6">
          <p className="text-accent text-xs font-medium tracking-wide uppercase">
            Welcome, Coach
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Get your academy match-ready in under 10 minutes
          </h1>
          <p className="text-muted mt-2 max-w-2xl text-sm leading-relaxed">
            Finish the four match-ready steps below. Squads, development reports, finance,
            and your public website can wait until parents can book training online.
          </p>
        </div>
      </div>

      <MilestoneCelebrations />
      <FirstBookingCelebration />
      <GettingStartedCard />

      <div className="grid gap-4 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => dispatchResumeOnboarding(1)}
          className="football-panel pitch-card-accent hover:bg-surface-hover flex flex-col items-start rounded-2xl p-5 text-left transition-colors"
        >
          <span className="bg-accent/10 text-accent flex size-10 items-center justify-center rounded-xl">
            <Flag className="size-5" aria-hidden />
          </span>
          <span className="mt-4 text-sm font-semibold">1. Name your academy</span>
          <span className="text-muted mt-1 text-xs leading-relaxed">
            Set up your club and publish a booking page.
          </span>
        </button>
        <button
          type="button"
          onClick={() => dispatchResumeOnboarding(2)}
          className="football-panel pitch-card-accent hover:bg-surface-hover flex flex-col items-start rounded-2xl p-5 text-left transition-colors"
        >
          <span className="bg-accent/10 text-accent flex size-10 items-center justify-center rounded-xl">
            <Cone className="size-5" aria-hidden />
          </span>
          <span className="mt-4 text-sm font-semibold">2. Schedule training</span>
          <span className="text-muted mt-1 text-xs leading-relaxed">
            Publish a session parents can book onto the pitch.
          </span>
        </button>
        <button
          type="button"
          onClick={() => dispatchResumeOnboarding(3)}
          className="football-panel pitch-card-accent hover:bg-surface-hover flex flex-col items-start rounded-2xl p-5 text-left transition-colors"
        >
          <span className="bg-accent/10 text-accent flex size-10 items-center justify-center rounded-xl">
            <Link2 className="size-5" aria-hidden />
          </span>
          <span className="mt-4 text-sm font-semibold">3. Share your link</span>
          <span className="text-muted mt-1 text-xs leading-relaxed">
            Send the booking URL to parents and squads.
          </span>
        </button>
      </div>

      <EmptyState
        {...footballEmptyPreset("welcome")}
        actionLabel="Continue match-ready setup"
        onAction={() => dispatchResumeOnboarding(1)}
        secondaryLabel="Browse training sessions"
        secondaryHref="/dashboard/sessions"
      />

      <p className="text-muted text-center text-xs">
        Need help?{" "}
        <Link href="/dashboard/help" className="text-accent font-medium underline-offset-4 hover:underline">
          Open Help & Support
        </Link>
      </p>
    </div>
  );
}
