"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Circle,
  Copy,
  Loader2,
  Rocket,
} from "lucide-react";
import {
  buildOnboardingProgress,
  parseOnboardingMetadata,
  type OnboardingStepId,
} from "@/lib/onboarding";
import { markBookingLinkShared } from "@/lib/onboarding-metadata";
import {
  fetchOnboardingCounts,
  loadOnboardingCoachContext,
  resolveBookingPortalUrl,
} from "@/lib/onboarding-setup";
import { trackActivationEvent } from "@/lib/activation-client";
import { BookingLinkGuidance } from "@/components/booking-link-guidance";
import { dispatchResumeOnboarding, useOnboardingState } from "@/components/onboarding-host";
import { createClient } from "@/lib/supabase";

export function GettingStartedCard() {
  const { loading: stateLoading, completed, paused, currentStep } = useOnboardingState();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(() =>
    buildOnboardingProgress({
      hasAcademy: false,
      hasSession: false,
      hasBookingPage: false,
      bookingLinkShared: false,
    }),
  );
  const [bookingUrl, setBookingUrl] = useState<string | null>(null);
  const [coachSlug, setCoachSlug] = useState<string | null>(null);
  const [academySlug, setAcademySlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const metadata = parseOnboardingMetadata(user.user_metadata);
      const counts = await fetchOnboardingCounts(supabase, user.id);
      setProgress(
        buildOnboardingProgress({
          hasAcademy: counts.hasAcademy,
          hasSession: counts.hasSession,
          hasBookingPage: counts.hasBookingPage,
          bookingLinkShared: metadata.bookingLinkShared,
        }),
      );

      const context = await loadOnboardingCoachContext(supabase, user.id);
      setBookingUrl(resolveBookingPortalUrl(context));
      setCoachSlug(context.coachSlug);
      setAcademySlug(context.academySlug);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const metadata = parseOnboardingMetadata(user.user_metadata);
        const counts = await fetchOnboardingCounts(supabase, user.id);
        if (cancelled) return;

        setProgress(
          buildOnboardingProgress({
            hasAcademy: counts.hasAcademy,
            hasSession: counts.hasSession,
            hasBookingPage: counts.hasBookingPage,
            bookingLinkShared: metadata.bookingLinkShared,
          }),
        );

        const context = await loadOnboardingCoachContext(supabase, user.id);
        if (cancelled) return;
        setBookingUrl(resolveBookingPortalUrl(context));
        setCoachSlug(context.coachSlug);
        setAcademySlug(context.academySlug);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    function handleUpdate() {
      void refresh();
    }
    window.addEventListener("awarix:onboarding-updated", handleUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener("awarix:onboarding-updated", handleUpdate);
    };
  }, [refresh]);

  const showCard = useMemo(() => {
    if (stateLoading || loading) return true;
    return !completed || !progress.isComplete;
  }, [completed, loading, progress.isComplete, stateLoading]);

  const nextStep: OnboardingStepId =
    progress.nextIncomplete?.resumeStep ?? currentStep;

  async function handleCopyBookingUrl() {
    if (!bookingUrl) return;
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      const supabase = createClient();
      await markBookingLinkShared(supabase);
      await trackActivationEvent("booking_link_copied");
      await refresh();
      window.dispatchEvent(new CustomEvent("awarix:onboarding-updated"));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError("Could not copy automatically. Select the link below and copy it manually.");
    }
  }

  if (!showCard) return null;

  return (
    <section
      id="getting-started"
      className="football-panel relative scroll-mt-24 overflow-hidden rounded-2xl ring-1 ring-accent/20"
    >
      <div className="from-accent/8 pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent to-transparent opacity-80" />
      <div className="relative p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="bg-accent/12 ring-accent/20 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
              <Rocket className="text-accent size-5" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                {paused || !completed ? "Continue match-ready setup" : "Match-ready checklist"}
              </h2>
              <p className="text-muted mt-1 text-sm leading-relaxed">
                {progress.nextIncomplete
                  ? `Next: ${progress.nextIncomplete.label}`
                  : "Get families onto training in a few minutes."}
              </p>
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-2xl font-semibold tracking-tight">{progress.percent}%</p>
            <p className="text-muted text-xs">
              {progress.completedCount} of {progress.totalCount} ready
            </p>
          </div>
        </div>

        <div className="bg-muted/40 mt-6 h-2 overflow-hidden rounded-full">
          <div
            className="bg-accent h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress.percent}%` }}
          />
        </div>

        {loading || stateLoading ? (
          <div className="text-muted mt-6 flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading match-ready steps…
          </div>
        ) : (
          <ul className="mt-6 space-y-2">
            {progress.items.map((item) => (
              <li key={item.key}>
                {item.complete ? (
                  <div className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm">
                    <span className="bg-accent/12 text-accent flex size-6 items-center justify-center rounded-full">
                      <Check className="size-3.5" aria-hidden />
                    </span>
                    <span className="font-medium">{item.label}</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      dispatchResumeOnboarding(item.resumeStep ?? nextStep)
                    }
                    className="hover:bg-surface-hover text-muted flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors"
                  >
                    <Circle className="size-6 shrink-0 opacity-40" aria-hidden />
                    <span>{item.label}</span>
                    <ArrowRight className="ml-auto size-4 opacity-50" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {!completed || !progress.isComplete ? (
            <button
              type="button"
              onClick={() => dispatchResumeOnboarding(nextStep)}
              className="bg-foreground text-background hover:opacity-90 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity"
            >
              {paused ? "Resume match-ready setup" : "Continue match-ready setup"}
              <ArrowRight className="ml-2 size-4" aria-hidden />
            </button>
          ) : null}

          {bookingUrl && !progress.items.find((item) => item.key === "booking_link")?.complete ? (
            <button
              type="button"
              onClick={() => void handleCopyBookingUrl()}
              className="border-border hover:bg-surface-hover inline-flex h-11 items-center justify-center rounded-full border px-6 text-sm font-medium transition-colors"
            >
              {copied ? (
                <>
                  <Check className="mr-2 size-4" aria-hidden />
                  Link copied
                </>
              ) : (
                <>
                  <Copy className="mr-2 size-4" aria-hidden />
                  Copy booking link
                </>
              )}
            </button>
          ) : null}

          {progress.nextIncomplete?.href &&
          progress.nextIncomplete.key === "session" ? (
            <Link
              href="/dashboard/sessions"
              className="text-accent inline-flex h-11 items-center justify-center px-2 text-sm font-medium underline-offset-4 hover:underline"
            >
              Open Training Sessions
            </Link>
          ) : null}
        </div>

        <p className="text-muted mt-4 text-xs leading-relaxed">
          Squads, development reports, and finance can wait — finish these four steps first.
        </p>

        {copyError ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
            {copyError}
          </p>
        ) : null}

        {bookingUrl ? (
          <div className="mt-6">
            <BookingLinkGuidance
              coachSlug={coachSlug}
              academySlug={academySlug}
              primaryUrl={bookingUrl}
              variant="compact"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
