"use client";

import { Sparkles } from "lucide-react";
import { useDashboardUser } from "@/components/dashboard-shell";
import { FOOTBALL_LABELS } from "@/lib/football-identity";
import { TYPE } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

function getCoachingGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning, Coach";
  if (hour < 17) return "Good afternoon, Coach";
  return "Good evening, Coach";
}

export function DashboardHeader({ variant = "default" }: { variant?: "default" | "hero" }) {
  const { email, isFounder, isBetaTester } = useDashboardUser();
  const label = email?.trim() || "Coach";
  const showMemberBadge = isFounder || isBetaTester;
  const isHero = variant === "hero";

  return (
    <header className={cn(!isHero && "page-content-enter")}>
      <div className="flex flex-wrap items-center gap-3">
        {isHero ? (
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
            {getCoachingGreeting()}
          </h1>
        ) : (
          <h1 className={TYPE.pageTitle}>{FOOTBALL_LABELS.dashboardOverview}</h1>
        )}
        {showMemberBadge ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1",
              isHero
                ? "bg-white/10 text-white ring-white/20"
                : "bg-accent/12 text-accent ring-accent/25",
            )}
          >
            <Sparkles className="size-3.5" aria-hidden />
            Awarix member
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-2 text-sm sm:text-base",
          isHero ? "text-white/55" : cn(TYPE.description),
        )}
      >
        {isHero ? (
          <>
            {FOOTBALL_LABELS.dashboardOverview} for{" "}
            <span className="font-medium text-white/80">{label}</span> — what needs attention
            before the next session.
          </>
        ) : (
          <>Signed in as {label}</>
        )}
      </p>
    </header>
  );
}
