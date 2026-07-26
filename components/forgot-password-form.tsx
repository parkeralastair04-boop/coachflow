"use client";

import { useState } from "react";
import Link from "next/link";
import { FormErrorAlert } from "@/components/form-error-alert";
import { BotProtectionFields } from "@/components/bot-protection-fields";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { createClient } from "@/lib/supabase";
import { runAuthPreflight } from "@/lib/auth-preflight-client";
import {
  FORGOT_PASSWORD_SUCCESS,
  sanitizeUserFacingError,
} from "@/lib/user-facing-errors";
import { isValidEmail } from "@/lib/validation/email";
import { SPACE } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

export function ForgotPasswordForm({ className }: { className?: string }) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError("Email is required.");
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    setEmailError(null);
    setLoading(true);

    try {
      const preflight = await runAuthPreflight({
        form: event.currentTarget as HTMLFormElement,
        action: "password_reset",
        turnstileToken,
      });
      if (!preflight.ok) {
        setError(preflight.error);
        return;
      }

      const supabase = createClient();
      const origin = window.location.origin;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        trimmedEmail,
        {
          redirectTo: `${origin}/auth/callback?next=/reset-password`,
        },
      );

      if (resetError) {
        setError(
          sanitizeUserFacingError(resetError, {
            context: "password-reset",
            logLabel: "forgot-password",
          }),
        );
        return;
      }

      setMessage(FORGOT_PASSWORD_SUCCESS);
    } catch (caughtError: unknown) {
      setError(
        sanitizeUserFacingError(caughtError, {
          context: "password-reset",
          logLabel: "forgot-password",
        }),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className={cn("flex flex-col", SPACE.formGap, className)}
    >
      <div>
        <Label htmlFor="forgot-email" required>
          Email
        </Label>
        <Input
          id="forgot-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (emailError) setEmailError(null);
          }}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? "forgot-email-error" : undefined}
          placeholder="you@club.com"
        />
        <FieldError id="forgot-email-error">{emailError}</FieldError>
      </div>

      {error ? <FormErrorAlert message={error} /> : null}
      {message ? (
        <p className="text-accent break-words text-sm" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}

      <div className="relative">
        <BotProtectionFields onTurnstileToken={setTurnstileToken} />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Sending…" : "Send reset link"}
      </Button>

      <p className="text-muted text-center text-sm">
        Remember your password?{" "}
        <Link
          href="/login"
          className="text-foreground font-medium underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
