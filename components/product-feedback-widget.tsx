"use client";

import { useEffect, useId, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2, MessageSquareHeart, Send, Star, X } from "lucide-react";
import {
  FEEDBACK_CATEGORIES,
  getFeedbackCategoryLabel,
  type FeedbackCategory,
} from "@/lib/product-feedback";
import { cn } from "@/lib/utils";

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

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const display = hovered ?? value;

  return (
    <div
      className="flex items-center gap-1"
      role="radiogroup"
      aria-label="Rating from 1 to 5 stars"
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
}: {
  page: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState<FeedbackCategory>("general_feedback");
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (rating < 1) {
      setError("Please select a star rating.");
      return;
    }

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
            ? (payload.message ?? "Feedback storage is not set up yet.")
            : (payload.error ?? "Could not submit feedback."),
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
      <label className="block space-y-2">
        <span className="text-sm font-medium">Category</span>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as FeedbackCategory)}
          className="border-border bg-background h-11 w-full rounded-xl border px-3 text-sm"
        >
          {FEEDBACK_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {getFeedbackCategoryLabel(value)}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-2">
        <span className="text-sm font-medium">Rating</span>
        <StarRating value={rating} onChange={setRating} disabled={loading} />
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium">Title</span>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Short summary of your feedback"
          required
          className="border-border bg-background h-11 w-full rounded-xl border px-3 text-sm"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium">Feedback</span>
        <textarea
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          placeholder="Tell us what worked well, what felt confusing, or what we could improve."
          required
          rows={4}
          className="border-border bg-background w-full resize-y rounded-xl border px-3 py-2.5 text-sm"
        />
      </label>

      <p className="text-muted text-xs leading-relaxed">
        Submitting from <span className="text-foreground font-medium">{page}</span>. Your account
        email and timestamp are captured automatically.
      </p>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="border-border hover:bg-surface-hover inline-flex h-11 items-center justify-center rounded-full border px-6 text-sm font-medium transition-colors disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="bg-foreground text-background hover:opacity-90 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity disabled:opacity-60"
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

function ProductFeedbackSuccess({ onClose }: { onClose: () => void }) {
  return (
    <div className="space-y-6 py-2 text-center">
      <div className="bg-accent/10 ring-accent/20 mx-auto flex size-14 items-center justify-center rounded-2xl ring-1">
        <MessageSquareHeart className="text-accent size-7" aria-hidden />
      </div>
      <div>
        <p className="text-lg font-semibold tracking-tight">
          Thank you for helping improve CoachFlow.
        </p>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          Your feedback helps us refine the experience for every coach and academy.
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="bg-foreground text-background hover:opacity-90 inline-flex h-11 w-full items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity sm:w-auto"
      >
        Done
      </button>
    </div>
  );
}

export function ProductFeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const dialogTitleId = useId();

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function handleClose() {
    setOpen(false);
    window.setTimeout(() => setSuccess(false), 200);
  }

  function handleOpen() {
    setSuccess(false);
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "bg-accent fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[55] inline-flex size-14 items-center justify-center rounded-full text-white shadow-[0_12px_40px_rgba(0,0,0,0.22)] transition-all hover:scale-[1.03] hover:opacity-95 focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none sm:size-[3.75rem]",
        )}
        aria-label="Share product feedback"
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
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            className="glass-panel border-border flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border shadow-2xl sm:max-h-[90vh] sm:rounded-3xl"
          >
            <div className="border-border flex items-center justify-between border-b px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-accent text-xs font-medium tracking-wide uppercase">
                  Product feedback
                </p>
                <h2 id={dialogTitleId} className="text-lg font-semibold tracking-tight">
                  {success ? "Feedback received" : "Share your experience"}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="text-muted hover:text-foreground hover:bg-surface-hover inline-flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors"
                aria-label="Close feedback form"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              {success ? (
                <ProductFeedbackSuccess onClose={handleClose} />
              ) : (
                <ProductFeedbackForm
                  page={pathname}
                  onSuccess={() => setSuccess(true)}
                  onCancel={handleClose}
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
