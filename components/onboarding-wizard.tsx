"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  createOnboardingPlayer,
  createOnboardingSession,
  createOnboardingTeam,
  loadOnboardingCoachContext,
  resolveBookingPortalUrl,
  saveAcademyBusinessName,
  type OnboardingCoachContext,
} from "@/lib/onboarding-setup";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type OnboardingWizardProps = {
  open: boolean;
  initialStep?: OnboardingStepId;
  onClose: () => void;
  onComplete: () => void;
  onProgressChange?: () => void;
};

const STEP_LABELS = [
  "Academy name",
  "First player",
  "First team",
  "First session",
  "Booking link",
  "Complete",
] as const;

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
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

  const [businessName, setBusinessName] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [teamName, setTeamName] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
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
        if (!cancelled) setError(getErrorMessage(caughtError));
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
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        void handlePause();
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
    if (!coachId) return;
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
        await goToStep(2);
        onProgressChange?.();
        return;
      }

      if (step === 2) {
        if (playerName.trim()) {
          await createOnboardingPlayer(supabase, {
            coachId,
            academyId: context?.academyId ?? null,
            playerName,
            parentEmail,
          });
          onProgressChange?.();
        }
        await goToStep(3);
        return;
      }

      if (step === 3) {
        if (teamName.trim()) {
          await createOnboardingTeam(supabase, {
            coachId,
            academyId: context?.academyId ?? null,
            teamName,
            ageGroup,
          });
          onProgressChange?.();
        }
        await goToStep(4);
        return;
      }

      if (step === 4) {
        if (sessionDateTime) {
          await createOnboardingSession(supabase, {
            coachId,
            academyId: context?.academyId ?? null,
            sessionDateTime,
            sessionType,
            location: sessionLocation,
          });
          onProgressChange?.();
        }
        const refreshed = await loadOnboardingCoachContext(supabase, coachId);
        setContext(refreshed);
        await goToStep(5);
        return;
      }

      if (step === 5) {
        await goToStep(6);
        return;
      }

      await handleFinish();
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function handleSkipStep() {
    if (step >= ONBOARDING_STEP_COUNT) return;
    const next = (step + 1) as OnboardingStepId;
    if (step === 4 && coachId) {
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-wizard-title"
        className="glass-panel border-border flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border shadow-2xl sm:max-h-[90vh] sm:rounded-3xl"
      >
        <div className="border-border flex items-center justify-between border-b px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-accent text-xs font-medium tracking-wide uppercase">
              Getting started
            </p>
            <h2 id="onboarding-wizard-title" className="truncate text-lg font-semibold tracking-tight">
              {step === 6 ? "You are all set" : `Step ${step} of ${ONBOARDING_STEP_COUNT}`}
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
          <div className="bg-muted/40 h-2 overflow-hidden rounded-full">
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
              Preparing your setup...
            </div>
          ) : error && step !== 1 ? (
            <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
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
                <StepFirstPlayer
                  playerName={playerName}
                  parentEmail={parentEmail}
                  onPlayerNameChange={setPlayerName}
                  onParentEmailChange={setParentEmail}
                />
              ) : null}
              {step === 3 ? (
                <StepFirstTeam
                  teamName={teamName}
                  ageGroup={ageGroup}
                  onTeamNameChange={setTeamName}
                  onAgeGroupChange={setAgeGroup}
                />
              ) : null}
              {step === 4 ? (
                <StepFirstSession
                  sessionDateTime={sessionDateTime}
                  sessionType={sessionType}
                  sessionLocation={sessionLocation}
                  onSessionDateTimeChange={setSessionDateTime}
                  onSessionTypeChange={setSessionType}
                  onSessionLocationChange={setSessionLocation}
                />
              ) : null}
              {step === 5 ? (
                <StepBookingLink
                  bookingUrl={bookingUrl}
                  copied={copied}
                  onCopy={() => void handleCopyBookingUrl()}
                />
              ) : null}
              {step === 6 ? <StepComplete businessName={businessName} /> : null}
            </>
          ) : null}
        </div>

        <div className="border-border flex flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex gap-2">
            {step > 1 && step < 6 ? (
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
                className="text-muted hover:text-foreground text-sm font-medium transition-colors"
              >
                Continue later
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {step > 1 && step < 6 ? (
              <button
                type="button"
                onClick={() => void handleSkipStep()}
                disabled={saving}
                className="text-muted hover:text-foreground inline-flex h-11 items-center justify-center px-4 text-sm font-medium transition-colors disabled:opacity-60"
              >
                Skip this step
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
              ) : step === 6 ? (
                <>
                  Go to dashboard
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
          <h3 className="text-base font-semibold tracking-tight">Name your academy or business</h3>
          <p className="text-muted mt-1 text-sm leading-relaxed">
            This appears on your dashboard, reports, and public booking page.
          </p>
        </div>
      </div>
      <label className="block space-y-2">
        <span className="text-sm font-medium">Academy / business name</span>
        <input
          type="text"
          value={businessName}
          onChange={(event) => onBusinessNameChange(event.target.value)}
          placeholder="e.g. Riverside Football Academy"
          className="border-border bg-background h-11 w-full rounded-xl border px-3 text-sm"
          autoFocus
        />
      </label>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}

function StepFirstPlayer({
  playerName,
  parentEmail,
  onPlayerNameChange,
  onParentEmailChange,
}: {
  playerName: string;
  parentEmail: string;
  onPlayerNameChange: (value: string) => void;
  onParentEmailChange: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold tracking-tight">Add your first player</h3>
        <p className="text-muted mt-1 text-sm leading-relaxed">
          Start building your squad. You can add more details later in Player CRM.
        </p>
      </div>
      <label className="block space-y-2">
        <span className="text-sm font-medium">Player name</span>
        <input
          type="text"
          value={playerName}
          onChange={(event) => onPlayerNameChange(event.target.value)}
          placeholder="e.g. Jamie Smith"
          className="border-border bg-background h-11 w-full rounded-xl border px-3 text-sm"
          autoFocus
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium">Parent email (optional)</span>
        <input
          type="email"
          value={parentEmail}
          onChange={(event) => onParentEmailChange(event.target.value)}
          placeholder="parent@example.com"
          className="border-border bg-background h-11 w-full rounded-xl border px-3 text-sm"
        />
      </label>
    </div>
  );
}

function StepFirstTeam({
  teamName,
  ageGroup,
  onTeamNameChange,
  onAgeGroupChange,
}: {
  teamName: string;
  ageGroup: string;
  onTeamNameChange: (value: string) => void;
  onAgeGroupChange: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold tracking-tight">Create your first team</h3>
        <p className="text-muted mt-1 text-sm leading-relaxed">
          Organise players into squads for registers, sessions, and reports.
        </p>
      </div>
      <label className="block space-y-2">
        <span className="text-sm font-medium">Team name</span>
        <input
          type="text"
          value={teamName}
          onChange={(event) => onTeamNameChange(event.target.value)}
          placeholder="e.g. U12 Development"
          className="border-border bg-background h-11 w-full rounded-xl border px-3 text-sm"
          autoFocus
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium">Age group (optional)</span>
        <input
          type="text"
          value={ageGroup}
          onChange={(event) => onAgeGroupChange(event.target.value)}
          placeholder="e.g. U12"
          className="border-border bg-background h-11 w-full rounded-xl border px-3 text-sm"
        />
      </label>
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
        <h3 className="text-base font-semibold tracking-tight">Schedule your first session</h3>
        <p className="text-muted mt-1 text-sm leading-relaxed">
          Create a public session parents can discover through your booking portal.
        </p>
      </div>
      <label className="block space-y-2">
        <span className="text-sm font-medium">Date & time</span>
        <input
          type="datetime-local"
          value={sessionDateTime}
          onChange={(event) => onSessionDateTimeChange(event.target.value)}
          className="border-border bg-background h-11 w-full rounded-xl border px-3 text-sm"
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium">Session type</span>
        <select
          value={sessionType}
          onChange={(event) => onSessionTypeChange(event.target.value)}
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
          placeholder="e.g. Pitch A, Riverside Sports Centre"
          className="border-border bg-background h-11 w-full rounded-xl border px-3 text-sm"
        />
      </label>
    </div>
  );
}

function StepBookingLink({
  bookingUrl,
  copied,
  onCopy,
}: {
  bookingUrl: string | null;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold tracking-tight">Share your booking portal</h3>
        <p className="text-muted mt-1 text-sm leading-relaxed">
          Parents can book sessions and trials through this public link.
        </p>
      </div>
      {bookingUrl ? (
        <div className="border-border bg-background/60 rounded-2xl border p-4">
          <p className="text-muted text-xs font-medium tracking-wide uppercase">Public URL</p>
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
              Preview
            </a>
          </div>
        </div>
      ) : (
        <p className="text-muted text-sm">
          Complete the academy name step to generate your booking link.
        </p>
      )}
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
        <h3 className="text-xl font-semibold tracking-tight">Welcome to CoachFlow</h3>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          {businessName.trim()
            ? `${businessName} is ready to go. Explore your dashboard, invite parents, and start coaching.`
            : "Your coaching workspace is ready. Explore your dashboard and start building your academy."}
        </p>
      </div>
      <div className="border-border text-muted rounded-2xl border p-4 text-left text-sm">
        <p className="text-foreground font-medium">What is next?</p>
        <ul className="mt-2 space-y-2">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="text-accent mt-0.5 size-4 shrink-0" aria-hidden />
            Add more players and teams from the sidebar
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="text-accent mt-0.5 size-4 shrink-0" aria-hidden />
            Set weekly availability for recurring bookings
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="text-accent mt-0.5 size-4 shrink-0" aria-hidden />
            Share your booking link with parents
          </li>
        </ul>
      </div>
    </div>
  );
}
