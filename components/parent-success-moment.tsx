"use client";

import Link from "next/link";
import { CalendarPlus, FileText, Sparkles, UserRound } from "lucide-react";
import type { ParentFamilyDashboard } from "@/lib/parent-portal-types";

export function ParentSuccessMoment({
  data,
  onContinue,
}: {
  data: ParentFamilyDashboard;
  onContinue: () => void;
}) {
  const nextSession = data.upcomingSessions[0] ?? null;
  const sharedReports = data.summary.reportsAvailable;
  const childNames = data.children.map((child) => child.playerName).join(", ");

  return (
    <section
      className="football-panel overflow-hidden rounded-3xl border border-accent/20 p-6 sm:p-8"
      aria-labelledby="parent-success-heading"
    >
      <div className="flex items-start gap-3">
        <div className="bg-accent/15 text-accent flex size-11 shrink-0 items-center justify-center rounded-2xl">
          <Sparkles className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-muted text-sm font-medium">Welcome to your academy hub</p>
          <h2 id="parent-success-heading" className="mt-1 text-2xl font-semibold tracking-tight">
            You&apos;re match-ready, {data.welcomeName}
          </h2>
          <p className="text-muted mt-2 max-w-2xl text-sm leading-relaxed">
            Here is what matters next for{" "}
            {childNames || "your family"} — sessions, reports, and anything waiting for you.
          </p>
        </div>
      </div>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2" role="list">
        <li className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CalendarPlus className="size-4 text-accent" aria-hidden />
            Sessions booked
          </div>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            {nextSession
              ? `${data.summary.upcomingSessions} upcoming. Next: ${nextSession.sessionTitle}.`
              : "No upcoming sessions yet — book from your coach when you are ready."}
          </p>
        </li>
        <li className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="size-4 text-accent" aria-hidden />
            Shared reports
          </div>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            {sharedReports > 0
              ? `${sharedReports} report${sharedReports === 1 ? "" : "s"} shared with you.`
              : "No reports shared yet. Your coach will share them when ready."}
          </p>
        </li>
        <li className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]">
          <div className="flex items-center gap-2 text-sm font-medium">
            <UserRound className="size-4 text-accent" aria-hidden />
            Kit & contacts
          </div>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            Update contacts, availability, and preferences in Family details.
          </p>
        </li>
        <li className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]">
          <div className="text-sm font-medium">Awaiting action</div>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            {data.awaitingActions.filter((item) => item.tone === "action").length > 0
              ? data.awaitingActions
                  .filter((item) => item.tone === "action")
                  .map((item) => item.label)
                  .join(" · ")
              : "Nothing urgent — you are ready for training."}
          </p>
        </li>
      </ul>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onContinue}
          className="bg-accent text-accent-foreground hover:bg-accent/90 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium"
        >
          Continue to training
        </button>
        <Link
          href="/family/manage"
          className="border-border hover:bg-surface-hover inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-medium dark:hover:bg-white/[0.06]"
        >
          Manage family
        </Link>
      </div>
    </section>
  );
}
