"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  PartyPopper,
  Sparkles,
  X,
} from "lucide-react";
import { BookingLinkGuidance } from "@/components/booking-link-guidance";
import { FormErrorAlert } from "@/components/form-error-alert";
import { SESSION_TYPE_OPTIONS } from "@/lib/booking-system";
import {
  getDefaultSessionDateTime,
  ONBOARDING_STEP_COUNT,
  type OnboardingStepId,
} from "@/lib/onboarding";
import {
  completeOnboarding,
  markBookingLinkShared,
  pauseOnboarding,
  setOnboardingStep,
} from "@/lib/onboarding-metadata";
import {
  createOnboardingSession,
  loadOnboardingCoachContext,
  resolveBookingPortalUrl,
  saveAcademyBusinessName,
  type OnboardingCoachContext,
} from "@/lib/onboarding-setup";
import { trackActivationEvent, markCelebrationSeen } from "@/lib/activation-client";
import { createClient } from "@/lib/supabase";
import { sanitizeDashboardSaveError } from "@/lib/user-facing-errors";
import { cn } from "@/lib/utils";

type OnboardingWizardProps = {
  open: boolean;
  initialStep?: OnboardingStepId;
  onClose: () => void;
  onComplete: () => void;
  onProgressChange?: () => void;
};

const STEP_LABELS = [
  "Name academy",
  "First session",
  "Share booking link",
  "Ready to coach",
] as const;

function scrollFocusedFieldIntoView(event: React.FocusEvent<HTMLElement>) {
  event.target.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

export function OnboardingWizard({
  open,
  initialStep = 1,
  onClose,
  onComplete,
  onProgressChange,
}: OnboardingWizardProps) {
  const [step, setStep] = useState<OnboardingStepId>(initialStep);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [context, setContext] = useState<OnboardingCoachContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [sessionDateTime, setSessionDateTime] = useState(getDefaultSessionDateTime);
  const [sessionType, setSessionType] = useState<string>("Group Session");
  const [sessionLocation, setSessionLocation] = useState("");

  const bookingUrl = useMemo(() => {
    if (!context) return null;
    return resolveBookingPortalUrl(context);
  }, [context]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (!cancelled) setError("You must be signed in to continue setup.");
          return;
        }

        if (cancelled) return;
        setCoachId(user.id);
        setEmail(user.email ?? null);
        setStep(initialStep);

        const coachContext = await loadOnboardingCoachContext(supabase, user.id);
        if (cancelled) return;
        setContext(coachContext);

        if (coachContext.academyId) {
          const { data: academy } = await supabase
            .from("academies")
            .select("name")
            .eq("id", coachContext.academyId)
            .maybeSingle();
          if (!cancelled && academy?.name && academy.name !== "My Academy") {
            setBusinessName(academy.name as string);
          }
        }
      } catch (caughtError: unknown) {
        if (!cancelled) setError(sanitizeDashboardSaveError(caughtError, { logLabel: "onboarding" }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, initialStep]);

  const handlePause = useCallback(async () => {
    try {
      const supabase = createClient();
      await pauseOnboarding(supabase);
    } catch {
      // Allow closing even if metadata update fails.
    }
    onClose();
    window.requestAnimationFrame(() => {
      previouslyFocusedRef.current?.focus();
    });
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    const focusDialog = () => {
      const root = dialogRef.current;
      if (!root) return;
      const preferred = root.querySelector<HTMLElement>(
        'input:not([disabled]), button:not([disabled]), [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      (preferred ?? root).focus();
    };
    window.requestAnimationFrame(focusDialog);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        void handlePause();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((element) => !element.hasAttribute("disabled") && element.tabIndex !== -1);

      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialogRef.current.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handlePause]);

  async function goToStep(nextStep: OnboardingStepId) {
    setStep(nextStep);
    setError(null);
    try {
      const supabase = createClient();
      await setOnboardingStep(supabase, nextStep);
    } catch {
      // Non-blocking if metadata update fails.
    }
  }

  async function handleFinish() {
    try {
      const supabase = createClient();
      await completeOnboarding(supabase);
    } catch {
      // Still close on completion attempt.
    }
    onProgressChange?.();
    onComplete();
    onClose();
  }

  async function handleStepContinue() {
    if (!coachId) {
      setError("You must be signed in to continue. Refresh and try again.");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();

      if (step === 1) {
        const updated = await saveAcademyBusinessName(supabase, {
          coachId,
          email,
          businessName,
        });
        setContext(updated);
        await trackActivationEvent("academy_created");
        await trackActivationEvent("booking_page_published");
        await markCelebrationSeen(supabase, "academy_created");
        await goToStep(2);
        onProgressChange?.();
        return;
      }

      if (step === 2) {
        if (sessionDateTime) {
          await createOnboardingSession(supabase, {
            coachId,
            academyId: context?.academyId ?? null,
            sessionDateTime,
            sessionType,
            location: sessionLocation,
          });
          await trackActivationEvent("first_session");
          await markCelebrationSeen(supabase, "session_published");
          onProgressChange?.();
        }
        const refreshed = await loadOnboardingCoachContext(supabase, coachId);
        setContext(refreshed);
        await goToStep(3);
        return;
      }

      if (step === 3) {
        await goToStep(4);
        return;
      }

      await handleFinish();
    } catch (caughtError: unknown) {
      setError(sanitizeDashboardSaveError(caughtError, { logLabel: "onboarding" }));
    } finally {
      setSaving(false);
    }
  }

  async function handleSkipStep() {
    if (step >= ONBOARDING_STEP_COUNT) return;
    const next = (step + 1) as OnboardingStepId;
    if (step === 2 && coachId) {
      try {
        const supabase = createClient();
        const refreshed = await loadOnboardingCoachContext(supabase, coachId);
        setContext(refreshed);
      } catch {
        // Continue to booking link step even if refresh fails.
      }
    }
    await goToStep(next);
  }

  async function handleCopyBookingUrl() {
    if (!bookingUrl) return;
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      const supabase = createClient();
      await markBookingLinkShared(supabase);
      await trackActivationEvent("booking_link_copied");
      await markCelebrationSeen(supabase, "booking_link_copied");
      onProgressChange?.();
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy the booking link. Please copy it manually.");
    }
  }

  if (!open) return null;

  const progressPercent = Math.round((step / ONBOARDING_STEP_COUNT) * 100);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-wizard-title"
        className="glass-panel border-border flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border shadow-2xl sm:max-h-[90vh] sm:rounded-3xl"
      >
        <div className="border-border flex items-center justify-between border-b px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-accent text-xs font-medium tracking-wide uppercase">
              Match-ready
            </p>
            <h2 id="onboarding-wizard-title" className="truncate text-lg font-semibold tracking-tight">
              {step === 4 ? "Ready for the pitch" : `Step ${step} of ${ONBOARDING_STEP_COUNT}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => void handlePause()}
            className="text-muted hover:text-foreground hover:bg-surface-hover inline-flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors"
            aria-label="Continue later"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="px-5 pt-4 sm:px-6">
          <div
            className="bg-muted/40 h-2 overflow-hidden rounded-full"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
            aria-label={`Onboarding progress: step ${step} of ${ONBOARDING_STEP_COUNT}`}
          >
            <div
              className="bg-accent h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-muted mt-2 text-xs">
            {STEP_LABELS[step - 1]} · {progressPercent}% complete
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-6">
          {loading ? (
            <div className="text-muted flex min-h-[220px] items-center justify-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Preparing your academy...
            </div>
          ) : error && step !== 1 ? (
            <FormErrorAlert message={error} className="mb-4" />
          ) : null}

          {!loading ? (
            <>
              {step === 1 ? (
                <StepAcademyName
                  businessName={businessName}
                  onBusinessNameChange={setBusinessName}
                  error={error}
                />
              ) : null}
              {step === 2 ? (
                <StepFirstSession
                  sessionDateTime={sessionDateTime}
                  sessionType={sessionType}
                  sessionLocation={sessionLocation}
                  onSessionDateTimeChange={setSessionDateTime}
                  onSessionTypeChange={setSessionType}
                  onSessionLocationChange={setSessionLocation}
                />
              ) : null}
              {step === 3 ? (
                <StepBookingLink
                  bookingUrl={bookingUrl}
                  coachSlug={context?.coachSlug ?? null}
                  academySlug={context?.academySlug ?? null}
                  copied={copied}
                  onCopy={() => void handleCopyBookingUrl()}
                />
              ) : null}
              {step === 4 ? <StepComplete businessName={businessName} /> : null}
            </>
          ) : null}
        </div>

        <div className="border-border flex flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex gap-2">
            {step > 1 && step < 4 ? (
              <button
                type="button"
                onClick={() => void goToStep((step - 1) as OnboardingStepId)}
                disabled={saving}
                className="border-border hover:bg-surface-hover inline-flex h-11 items-center justify-center rounded-full border px-5 text-sm font-medium transition-colors disabled:opacity-60"
              >
                <ArrowLeft className="mr-2 size-4" aria-hidden />
                Back
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handlePause()}
                className="text-muted hover:text-foreground inline-flex h-11 items-center justify-center px-4 text-sm font-medium transition-colors"
              >
                Continue later
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {step > 1 && step < 4 ? (
              <button
                type="button"
                onClick={() => void handleSkipStep()}
                disabled={saving}
                className="text-muted hover:text-foreground inline-flex h-11 items-center justify-center px-4 text-sm font-medium transition-colors disabled:opacity-60"
              >
                Skip for now
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void handleStepContinue()}
              disabled={saving || loading || (step === 1 && !businessName.trim())}
              className="bg-foreground text-background hover:opacity-90 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Saving...
                </>
              ) : step === 4 ? (
                <>
                  Go to my dashboard
                  <ArrowRight className="ml-2 size-4" aria-hidden />
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="ml-2 size-4" aria-hidden />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepAcademyName({
  businessName,
  onBusinessNameChange,
  error,
}: {
  businessName: string;
  onBusinessNameChange: (value: string) => void;
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="bg-accent/10 ring-accent/20 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
          <Sparkles className="text-accent size-5" aria-hidden />
        </div>
        <div>
          <h3 className="text-base font-semibold tracking-tight">Name your club or academy</h3>
          <p className="text-muted mt-1 text-sm leading-relaxed">
            This is the name parents see on your booking page, session confirmations, and progress reports.
            It also creates your unique booking link.
          </p>
        </div>
      </div>
      <label className="block space-y-2">
        <span className="text-sm font-medium">Academy / business name</span>
        <input
          type="text"
          value={businessName}
          onChange={(event) => onBusinessNameChange(event.target.value)}
          onFocus={scrollFocusedFieldIntoView}
          placeholder="e.g. Riverside Football Academy"
          className="border-border bg-background h-11 w-full rounded-xl border px-3 text-sm"
          autoFocus
        />
      </label>
      {error ? <FormErrorAlert message={error} /> : null}
    </div>
  );
}

function StepFirstSession({
  sessionDateTime,
  sessionType,
  sessionLocation,
  onSessionDateTimeChange,
  onSessionTypeChange,
  onSessionLocationChange,
}: {
  sessionDateTime: string;
  sessionType: string;
  sessionLocation: string;
  onSessionDateTimeChange: (value: string) => void;
  onSessionTypeChange: (value: string) => void;
  onSessionLocationChange: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold tracking-tight">Publish your first session</h3>
        <p className="text-muted mt-1 text-sm leading-relaxed">
          This creates a bookable training slot on your parent portal — for example a 1-to-1, skills group, or trial session.
        </p>
      </div>
      <p className="rounded-xl bg-black/[0.02] px-3 py-2 text-xs text-muted dark:bg-white/[0.03]">
        Optional step: skip if you prefer to build sessions from the Sessions page later. Without a session, your booking link will look empty to parents.
      </p>
      <label className="block space-y-2">
        <span className="text-sm font-medium">Date & time</span>
        <input
          type="datetime-local"
          value={sessionDateTime}
          onChange={(event) => onSessionDateTimeChange(event.target.value)}
          onFocus={scrollFocusedFieldIntoView}
          className="border-border bg-background h-11 w-full rounded-xl border px-3 text-sm"
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium">Session type</span>
        <select
          value={sessionType}
          onChange={(event) => onSessionTypeChange(event.target.value)}
          onFocus={scrollFocusedFieldIntoView}
          className="border-border bg-background h-11 w-full rounded-xl border px-3 text-sm"
        >
          {SESSION_TYPE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium">Location (optional)</span>
        <input
          type="text"
          value={sessionLocation}
          onChange={(event) => onSessionLocationChange(event.target.value)}
          onFocus={scrollFocusedFieldIntoView}
          placeholder="e.g. Pitch A, Riverside Sports Centre"
          className="border-border bg-background h-11 w-full rounded-xl border px-3 text-sm"
        />
      </label>
    </div>
  );
}

function StepBookingLink({
  bookingUrl,
  coachSlug,
  academySlug,
  copied,
  onCopy,
}: {
  bookingUrl: string | null;
  coachSlug: string | null;
  academySlug: string | null;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold tracking-tight">Share your booking link with parents</h3>
        <p className="text-muted mt-1 text-sm leading-relaxed">
          Send your link on WhatsApp or email. Parents pick a session, enter their child&apos;s details, and book without you chasing replies.
        </p>
      </div>
      {bookingUrl ? (
        <div className="border-border bg-background/60 rounded-2xl border p-4">
          <p className="text-muted text-xs font-medium tracking-wide uppercase">Link to share</p>
          <p className="mt-2 break-all text-sm font-medium">{bookingUrl}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onCopy}
              className={cn(
                "inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition-opacity",
                copied
                  ? "bg-accent/12 text-accent ring-accent/25 ring-1"
                  : "bg-foreground text-background hover:opacity-90",
              )}
            >
              {copied ? (
                <>
                  <Check className="mr-2 size-4" aria-hidden />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-2 size-4" aria-hidden />
                  Copy link
                </>
              )}
            </button>
            <a
              href={bookingUrl}
              target="_blank"
              rel="noreferrer"
              className="border-border hover:bg-surface-hover inline-flex h-11 items-center justify-center rounded-full border px-5 text-sm font-medium transition-colors"
            >
              <ExternalLink className="mr-2 size-4" aria-hidden />
              Open booking page
            </a>
          </div>
        </div>
      ) : (
        <p className="text-muted text-sm">
          Complete the club name step to generate your booking link.
        </p>
      )}
      <BookingLinkGuidance
        coachSlug={coachSlug}
        academySlug={academySlug}
        primaryUrl={bookingUrl}
        variant="full"
      />
    </div>
  );
}

function StepComplete({ businessName }: { businessName: string }) {
  return (
    <div className="space-y-5 text-center">
      <div className="bg-accent/10 ring-accent/20 mx-auto flex size-16 items-center justify-center rounded-2xl ring-1">
        <PartyPopper className="text-accent size-8" aria-hidden />
      </div>
      <div>
        <h3 className="text-xl font-semibold tracking-tight">You&apos;re match-ready</h3>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          {businessName.trim()
            ? `${businessName} is ready. Share your booking link with parents, then return to your dashboard whenever you need to manage training.`
            : "Your academy is ready. Share your booking link with parents, then use your dashboard to manage training."}
        </p>
      </div>
      <div className="border-border text-muted rounded-2xl border p-4 text-left text-sm">
        <p className="text-foreground font-medium">Your quickest path to the first booking</p>
        <ul className="mt-2 space-y-2">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="text-accent mt-0.5 size-4 shrink-0" aria-hidden />
            Share your booking link with parents
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="text-accent mt-0.5 size-4 shrink-0" aria-hidden />
            Add players later when you need registers — optional for your first booking
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="text-accent mt-0.5 size-4 shrink-0" aria-hidden />
            Explore development reports, squads, and finance once parents start booking
          </li>
        </ul>
      </div>
    </div>
  );
}
