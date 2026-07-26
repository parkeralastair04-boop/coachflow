"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormErrorAlert } from "@/components/form-error-alert";
import { FormSuccessAlert } from "@/components/form-success-alert";
import { BotProtectionFields } from "@/components/bot-protection-fields";
import { Button } from "@/components/ui/button";
import { Checkbox, FieldHint, Input, Label } from "@/components/ui/field";
import { createClient } from "@/lib/supabase";
import { runAuthPreflight } from "@/lib/auth-preflight-client";
import { isValidEmail } from "@/lib/validation/email";
import { sanitizeUserFacingError } from "@/lib/user-facing-errors";
import { trackActivationEvent } from "@/lib/activation-client";
import { SPACE } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

export function SignupForm({ className }: { className?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCode = searchParams.get("ref")?.trim() ?? "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [resending, setResending] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState(false);

  function getErrorMessage(caughtError: unknown): string {
    return sanitizeUserFacingError(caughtError, {
      context: "sign-up",
      logLabel: "signup",
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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

    if (!agreedToTerms) {
      setTermsError("You must agree to the Terms of Service and Privacy Policy.");
      return;
    }
    setTermsError(null);

    setLoading(true);
    try {
      const preflight = await runAuthPreflight({
        form: e.currentTarget as HTMLFormElement,
        action: "signup",
        turnstileToken,
      });
      if (!preflight.ok) {
        setError(preflight.error);
        return;
      }

      const supabase = createClient();
      const origin = window.location.origin;
      const { data, error: signErr } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
          data: referralCode ? { referral_code: referralCode } : undefined,
        },
      });
      if (signErr) {
        setError(
          sanitizeUserFacingError(signErr, { context: "sign-up", logLabel: "signup" }),
        );
        return;
      }
      // Supabase returns a user with empty identities when the email already exists
      // and confirm-email is enabled — avoid a fake "check your inbox" success state.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setError("An account with this email already exists. Sign in instead.");
        return;
      }
      if (data.user && referralCode) {
        await fetch("/api/referrals/attribute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            referralCode,
            referredUserId: data.user.id,
          }),
        });
      }
      if (data.session) {
        void trackActivationEvent("signup_complete");
        router.replace("/dashboard");
        router.refresh();
        return;
      }
      void trackActivationEvent("signup_complete");
      setAwaitingVerification(true);
      setMessage(
        "Check your email to confirm your account. After confirming, you’ll land in Awarix to finish match-ready setup.",
      );
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className={cn("flex flex-col", SPACE.formGap, className)}
    >
      <div>
        <Label htmlFor="signup-email" required>
          Email
        </Label>
        <Input
          id="signup-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          invalid={Boolean(emailError)}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError(null);
          }}
          aria-describedby={emailError ? "signup-email-error" : undefined}
          placeholder="you@club.com"
        />
        {emailError ? <FormErrorAlert id="signup-email-error" message={emailError} /> : null}
      </div>
      <div>
        <Label htmlFor="signup-password" required>
          Password
        </Label>
        <Input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby="signup-password-hint"
        />
        <FieldHint id="signup-password-hint">At least 8 characters.</FieldHint>
      </div>
      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <Checkbox
            id="signup-terms"
            checked={agreedToTerms}
            onChange={(event) => {
              setAgreedToTerms(event.target.checked);
              if (termsError) setTermsError(null);
            }}
            aria-invalid={termsError ? true : undefined}
            aria-describedby={termsError ? "signup-terms-error" : "signup-terms-label"}
            className="mt-0.5"
          />
          <label id="signup-terms-label" htmlFor="signup-terms" className="text-sm leading-relaxed">
            I agree to the{" "}
            <Link
              href="/terms"
              className="text-foreground font-medium underline-offset-4 hover:underline"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="text-foreground font-medium underline-offset-4 hover:underline"
            >
              Privacy Policy
            </Link>
          </label>
        </div>
        {termsError ? (
          <FormErrorAlert id="signup-terms-error" message={termsError} />
        ) : null}
      </div>
      {error ? <FormErrorAlert message={error} /> : null}
      {message ? <FormSuccessAlert message={message} /> : null}
      {message && awaitingVerification ? (
        <div className="border-accent/20 bg-accent/5 rounded-xl border p-4 text-sm" role="status">
          <ol className="text-muted list-decimal space-y-1.5 pl-5 leading-relaxed">
            <li>Open the confirmation email and verify your address</li>
            <li>
              You&apos;ll return to Awarix signed in — finish match-ready setup
            </li>
            <li>Name your academy, publish training, and share your booking link with parents</li>
          </ol>
          <Button
            type="button"
            variant="ghost"
            disabled={resending || !email.trim()}
            className="text-accent mt-4 h-auto min-h-0 px-0 underline-offset-4 hover:underline"
            onClick={() => {
              void (async () => {
                setResending(true);
                setError(null);
                try {
                  const supabase = createClient();
                  const { error: resendError } = await supabase.auth.resend({
                    type: "signup",
                    email: email.trim(),
                    options: {
                      emailRedirectTo: `${window.location.origin}/auth/callback`,
                    },
                  });
                  if (resendError) {
                    setError(
                      sanitizeUserFacingError(resendError, {
                        context: "sign-up",
                        logLabel: "signup-resend",
                      }),
                    );
                    return;
                  }
                  setMessage(
                    "Verification email sent again. If you still do not see it, check spam or try a different address.",
                  );
                } catch (caughtError: unknown) {
                  setError(getErrorMessage(caughtError));
                } finally {
                  setResending(false);
                }
              })();
            }}
          >
            {resending ? "Sending…" : "Resend verification email"}
          </Button>
        </div>
      ) : null}
      <div className="relative">
        <BotProtectionFields onTurnstileToken={setTurnstileToken} />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Opening your academy…" : "Start coaching"}
      </Button>
      <p className="text-muted text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-foreground font-medium underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
