"use client";

import { useEffect, useId, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Loader2, MessageSquareHeart, Send, Star, X } from "lucide-react";
import {
  FEEDBACK_CATEGORIES,
  getFeedbackCategoryLabel,
  type FeedbackCategory,
} from "@/lib/product-feedback";
import { fetchOnboardingCounts } from "@/lib/onboarding-setup";
import { FormErrorAlert } from "@/components/form-error-alert";
import {
  sanitizeDashboardSaveError,
  SUPPORT_UNAVAILABLE_DETAIL,
  SUPPORT_UNAVAILABLE_MESSAGE,
} from "@/lib/user-facing-errors";
import { createClient } from "@/lib/supabase";
import { useOnboardingState } from "@/components/onboarding-host";
import { cn } from "@/lib/utils";

function getErrorMessage(error: unknown): string {
  return sanitizeDashboardSaveError(error, { logLabel: "product-feedback" });
}

function StarRating({
  value,
  onChange,
  disabled,
  describedBy,
  invalid,
}: {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
  describedBy?: string;
  invalid?: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const display = hovered ?? value;

  return (
    <div
      className="flex items-center gap-1"
      role="radiogroup"
      aria-label="Rating from 1 to 5 stars"
      aria-invalid={invalid ? true : undefined}
      aria-describedby={describedBy}
      onMouseLeave={() => setHovered(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= display;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            disabled={disabled}
            onMouseEnter={() => setHovered(star)}
            onFocus={() => setHovered(star)}
            onBlur={() => setHovered(null)}
            onClick={() => onChange(star)}
            className={cn(
              "inline-flex size-10 items-center justify-center rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none disabled:opacity-60",
              active
                ? "text-accent bg-accent/10"
                : "text-muted hover:text-accent hover:bg-accent/5",
            )}
          >
            <Star
              className="size-5"
              strokeWidth={2}
              fill={active ? "currentColor" : "none"}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}

function ProductFeedbackForm({
  page,
  onSuccess,
  onCancel,
  firstFieldRef,
}: {
  page: string;
  onSuccess: () => void;
  onCancel: () => void;
  firstFieldRef: React.RefObject<HTMLSelectElement | null>;
}) {
  const [category, setCategory] = useState<FeedbackCategory>("general_feedback");
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const ratingErrorId = useId();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (rating < 1) {
      setRatingError("Please select a star rating.");
      return;
    }

    setRatingError(null);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/support/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, rating, title, feedback, page }),
      });
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        setupRequired?: boolean;
      };

      if (!response.ok) {
        setError(
          payload.setupRequired
            ? `${SUPPORT_UNAVAILABLE_MESSAGE} ${SUPPORT_UNAVAILABLE_DETAIL}`
            : sanitizeDashboardSaveError(payload.error ?? payload.message, {
                logLabel: "product-feedback",
              }),
        );
        return;
      }

      onSuccess();
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
      <p className="text-muted text-sm leading-relaxed" role="status" aria-live="polite">
        We&apos;d love to hear how Awarix is working for you.
      </p>

      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="feedback-category">
          What is this about?
        </label>
        <select
          ref={firstFieldRef}
          id="feedback-category"
          value={category}
          onChange={(event) => setCategory(event.target.value as FeedbackCategory)}
          className="border-border bg-background focus-visible:ring-accent/50 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {FEEDBACK_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {getFeedbackCategoryLabel(value)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium" id="feedback-rating-label">
          Rating <span className="text-red-500">*</span>
        </span>
        <StarRating
          value={rating}
          onChange={(nextRating) => {
            setRating(nextRating);
            if (ratingError) setRatingError(null);
          }}
          disabled={loading}
          describedBy={ratingError ? ratingErrorId : "feedback-rating-label"}
          invalid={Boolean(ratingError)}
        />
        {ratingError ? (
          <p
            id={ratingErrorId}
            role="alert"
            aria-live="assertive"
            className="break-words text-sm text-red-600 dark:text-red-400"
          >
            {ratingError}
          </p>
        ) : null}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="feedback-title">
          Summary
        </label>
        <input
          id="feedback-title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="A short summary"
          required
          className="border-border bg-background focus-visible:ring-accent/50 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="feedback-body">
          Your message
        </label>
        <textarea
          id="feedback-body"
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          placeholder="Tell us what worked well, what felt confusing, or what we could do better."
          required
          rows={4}
          className="border-border bg-background focus-visible:ring-accent/50 w-full resize-y rounded-xl border px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
      </div>

      <p className="text-muted text-xs leading-relaxed">
        You&apos;re sharing feedback from{" "}
        <span className="text-foreground font-medium">{page}</span>.
      </p>

      {error ? <FormErrorAlert message={error} /> : null}

      <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="border-border hover:bg-surface-hover focus-visible:ring-accent/50 inline-flex h-11 items-center justify-center rounded-full border px-6 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="bg-foreground text-background hover:opacity-90 focus-visible:ring-accent/50 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Submitting...
            </>
          ) : (
            <>
              <Send className="mr-2 size-4" aria-hidden />
              Send feedback
            </>
          )}
        </button>
      </div>
    </form>
  );
}

function ProductFeedbackSuccess({
  onClose,
  panelRef,
}: {
  onClose: () => void;
  panelRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      className="space-y-6 py-2 text-center outline-none"
      role="status"
      aria-live="polite"
    >
      <div className="bg-accent/10 ring-accent/20 mx-auto flex size-14 items-center justify-center rounded-2xl ring-1">
        <MessageSquareHeart className="text-accent size-7" aria-hidden />
      </div>
      <div>
        <p className="text-lg font-semibold tracking-tight">Thank you for your feedback.</p>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          We&apos;ll review it and use it to improve Awarix.
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="bg-foreground text-background hover:opacity-90 focus-visible:ring-accent/50 inline-flex h-11 w-full items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
      >
        Done
      </button>
    </div>
  );
}

export function ProductFeedbackWidget() {
  const pathname = usePathname();
  const { loading: onboardingLoading, completed: onboardingCompleted } = useOnboardingState();
  const [setupLoading, setSetupLoading] = useState(true);
  const [hasBooking, setHasBooking] = useState(false);
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const dialogTitleId = useId();
  const openerRef = useRef<HTMLButtonElement>(null);
  const firstFieldRef = useRef<HTMLSelectElement>(null);
  const successPanelRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const counts = await fetchOnboardingCounts(supabase, user.id);
        if (!cancelled) setHasBooking(counts.hasBooking);
      } finally {
        if (!cancelled) setSetupLoading(false);
      }
    })();

    function handleUpdate() {
      void (async () => {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const counts = await fetchOnboardingCounts(supabase, user.id);
        setHasBooking(counts.hasBooking);
      })();
    }
    window.addEventListener("awarix:onboarding-updated", handleUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener("awarix:onboarding-updated", handleUpdate);
    };
  }, []);

  const showWidget =
    !onboardingLoading &&
    !setupLoading &&
    (onboardingCompleted || hasBooking);

  const handleClose = useCallback(() => {
    setOpen(false);
    window.setTimeout(() => {
      setSuccess(false);
      previouslyFocusedRef.current?.focus();
      openerRef.current?.focus();
    }, 200);
  }, []);

  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((element) => element.offsetParent !== null);

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleClose]);

  useEffect(() => {
    if (!open || !success) return;
    window.requestAnimationFrame(() => {
      successPanelRef.current?.focus();
    });
  }, [open, success]);

  useEffect(() => {
    if (!open || success) return;
    window.requestAnimationFrame(() => {
      firstFieldRef.current?.focus();
    });
  }, [open, success]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function handleOpen() {
    setSuccess(false);
    setOpen(true);
  }

  if (!showWidget) return null;

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        onClick={handleOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "bg-accent fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[55] inline-flex size-14 items-center justify-center rounded-full text-white shadow-[0_12px_40px_rgba(0,0,0,0.22)] transition-all hover:scale-[1.03] hover:opacity-95 focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none sm:size-[3.75rem]",
        )}
        aria-label="Share feedback"
      >
        <MessageSquareHeart className="size-6" strokeWidth={2.1} aria-hidden />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) handleClose();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            className="glass-panel border-border flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border shadow-2xl sm:max-h-[90vh] sm:rounded-3xl"
          >
            <div className="border-border flex items-center justify-between border-b px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-accent text-xs font-medium tracking-wide uppercase">
                  Share feedback
                </p>
                <h2 id={dialogTitleId} className="text-lg font-semibold tracking-tight">
                  {success
                    ? "Thank you for your feedback"
                    : "How is coaching with Awarix?"}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="text-muted hover:text-foreground hover:bg-surface-hover focus-visible:ring-accent/50 inline-flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="Close feedback form"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              {success ? (
                <ProductFeedbackSuccess onClose={handleClose} panelRef={successPanelRef} />
              ) : (
                <ProductFeedbackForm
                  page={pathname}
                  onSuccess={() => setSuccess(true)}
                  onCancel={handleClose}
                  firstFieldRef={firstFieldRef}
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
