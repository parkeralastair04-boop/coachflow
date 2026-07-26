"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormErrorAlert } from "@/components/form-error-alert";
import { createClient } from "@/lib/supabase";
import {
  RESET_LINK_EXPIRED,
  RESET_PASSWORD_REDIRECT,
  RESET_PASSWORD_SUCCESS,
  sanitizeUserFacingError,
} from "@/lib/user-facing-errors";
import { cn } from "@/lib/utils";

export function ResetPasswordForm({ className }: { className?: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!cancelled) {
          setHasSession(Boolean(user));
          setSessionChecked(true);
        }
      } catch {
        if (!cancelled) {
          setHasSession(false);
          setSessionChecked(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    let valid = true;
    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      valid = false;
    } else {
      setPasswordError(null);
    }

    if (password !== confirmPassword) {
      setConfirmError("Passwords don't match.");
      valid = false;
    } else {
      setConfirmError(null);
    }

    if (!valid) return;

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(
          sanitizeUserFacingError(updateError, {
            context: "password-reset",
            logLabel: "reset-password",
          }),
        );
        return;
      }

      setSuccess(true);
      window.setTimeout(() => {
        void supabase.auth.signOut().then(() => {
          router.replace("/login");
          router.refresh();
        });
      }, 2000);
    } catch (caughtError: unknown) {
      setError(
        sanitizeUserFacingError(caughtError, {
          context: "password-reset",
          logLabel: "reset-password",
        }),
      );
    } finally {
      setLoading(false);
    }
  }

  if (!sessionChecked) {
    return (
      <div className={cn("text-muted flex h-32 items-center justify-center text-sm", className)}>
        Loading…
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className={cn("space-y-4", className)}>
        <FormErrorAlert message={RESET_LINK_EXPIRED} />
        <Link
          href="/forgot-password"
          className="text-foreground inline-flex text-sm font-medium underline-offset-4 hover:underline"
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className={cn("space-y-2", className)} role="status" aria-live="polite">
        <p className="text-accent text-sm font-medium">{RESET_PASSWORD_SUCCESS}</p>
        <p className="text-muted text-sm">{RESET_PASSWORD_REDIRECT}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className={cn("flex flex-col gap-5", className)}
    >
      <div className="space-y-2">
        <label htmlFor="reset-password" className="text-sm font-medium">
          New password <span className="text-red-600 dark:text-red-400">*</span>
        </label>
        <input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (passwordError) setPasswordError(null);
          }}
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={
            passwordError ? "reset-password-error" : "reset-password-hint"
          }
          className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2 dark:ring-offset-background"
        />
        <p id="reset-password-hint" className="text-muted text-xs">
          At least 8 characters.
        </p>
        {passwordError ? (
          <FormErrorAlert id="reset-password-error" message={passwordError} />
        ) : null}
      </div>

      <div className="space-y-2">
        <label htmlFor="reset-confirm-password" className="text-sm font-medium">
          Confirm password <span className="text-red-600 dark:text-red-400">*</span>
        </label>
        <input
          id="reset-confirm-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            if (confirmError) setConfirmError(null);
          }}
          aria-invalid={confirmError ? true : undefined}
          aria-describedby={confirmError ? "reset-confirm-password-error" : undefined}
          className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2 dark:ring-offset-background"
        />
        {confirmError ? (
          <FormErrorAlert id="reset-confirm-password-error" message={confirmError} />
        ) : null}
      </div>

      {error ? <FormErrorAlert message={error} /> : null}

      <button
        type="submit"
        disabled={loading}
        className="bg-foreground text-background hover:opacity-90 h-11 rounded-full text-sm font-medium transition-opacity disabled:opacity-60"
      >
        {loading ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
