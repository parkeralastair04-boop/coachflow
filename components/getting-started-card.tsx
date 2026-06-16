"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "@/lib/onboarding";
import { markBookingLinkShared } from "@/lib/onboarding-metadata";
import {
  fetchOnboardingCounts,
  loadOnboardingCoachContext,
  resolveBookingPortalUrl,
} from "@/lib/onboarding-setup";
import { dispatchResumeOnboarding, useOnboardingState } from "@/components/onboarding-host";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export function GettingStartedCard() {
  const { loading: stateLoading, completed, paused, currentStep } = useOnboardingState();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(() =>
    buildOnboardingProgress({
      hasPlayer: false,
      hasTeam: false,
      hasSession: false,
      bookingLinkShared: false,
    }),
  );
  const [bookingUrl, setBookingUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
          ...counts,
          bookingLinkShared: metadata.bookingLinkShared,
        }),
      );

      const context = await loadOnboardingCoachContext(supabase, user.id);
      setBookingUrl(resolveBookingPortalUrl(context));
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
            ...counts,
            bookingLinkShared: metadata.bookingLinkShared,
          }),
        );

        const context = await loadOnboardingCoachContext(supabase, user.id);
        if (cancelled) return;
        setBookingUrl(resolveBookingPortalUrl(context));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    function handleUpdate() {
      void refresh();
    }
    window.addEventListener("coachflow:onboarding-updated", handleUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener("coachflow:onboarding-updated", handleUpdate);
    };
  }, [refresh]);

  const showCard = useMemo(() => {
    if (stateLoading || loading) return true;
    return !completed || !progress.isComplete;
  }, [completed, loading, progress.isComplete, stateLoading]);

  async function handleCopyBookingUrl() {
    if (!bookingUrl) return;
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      const supabase = createClient();
      await markBookingLinkShared(supabase);
      await refresh();
      window.dispatchEvent(new CustomEvent("coachflow:onboarding-updated"));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard errors silently on dashboard card.
    }
  }

  if (!showCard) return null;

  return (
    <section id="getting-started" className="glass-panel relative scroll-mt-24 overflow-hidden rounded-2xl">
      <div className="from-accent/8 pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent to-transparent opacity-80" />
      <div className="relative p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="bg-accent/12 ring-accent/20 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
              <Rocket className="text-accent size-5" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Getting Started</h2>
              <p className="text-muted mt-1 text-sm leading-relaxed">
                Complete these steps to launch your coaching workspace.
              </p>
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-2xl font-semibold tracking-tight">{progress.percent}%</p>
            <p className="text-muted text-xs">
              {progress.completedCount} of {progress.totalCount} complete
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
            Loading checklist...
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {progress.items.map((item) => (
              <li
                key={item.key}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm",
                  item.complete ? "text-foreground" : "text-muted",
                )}
              >
                {item.complete ? (
                  <span className="bg-accent/12 text-accent flex size-6 items-center justify-center rounded-full">
                    <Check className="size-3.5" aria-hidden />
                  </span>
                ) : (
                  <Circle className="size-6 shrink-0 opacity-40" aria-hidden />
                )}
                <span className={item.complete ? "font-medium" : undefined}>{item.label}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {!completed ? (
            <button
              type="button"
              onClick={() => dispatchResumeOnboarding(currentStep)}
              className="bg-foreground text-background hover:opacity-90 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity"
            >
              {paused ? "Resume setup" : "Continue setup"}
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
        </div>
      </div>
    </section>
  );
}
