"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { FormErrorAlert } from "@/components/form-error-alert";
import { BotProtectionFields } from "@/components/bot-protection-fields";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { getSafeAuthNextPath } from "@/lib/auth/safe-next-path";
import { runAuthPreflight } from "@/lib/auth-preflight-client";
import { createClient } from "@/lib/supabase";
import { isValidEmail } from "@/lib/validation/email";
import { sanitizeUserFacingError } from "@/lib/user-facing-errors";
import { SPACE } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

export function LoginForm({ className }: { className?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = getSafeAuthNextPath(searchParams.get("next"), "/dashboard");
  const isFamilyLogin = nextPath.startsWith("/family");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  function getErrorMessage(caughtError: unknown): string {
    return sanitizeUserFacingError(caughtError, {
      context: "sign-in",
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

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

    const authStartedAt =
      process.env.NODE_ENV === "development" ? performance.now() : 0;

    setLoading(true);
    try {
      const preflight = await runAuthPreflight({
        form: e.currentTarget as HTMLFormElement,
        action: "login",
        turnstileToken,
      });
      if (!preflight.ok) {
        setError(preflight.error);
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (signErr) {
        setError(
          sanitizeUserFacingError(signErr, { context: "sign-in" }),
        );
        setLoading(false);
        return;
      }

      if (process.env.NODE_ENV === "development") {
        console.info(
          `[auth-timing] client-signInWithPassword: ${Math.round(performance.now() - authStartedAt)}ms`,
        );
      }

      router.replace(nextPath);
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
      aria-busy={loading}
    >
      {searchParams.get("error") === "auth" ? (
        <FormErrorAlert message="Authentication failed. Please sign in again." />
      ) : (
        <p className="text-muted text-sm leading-relaxed">
          {isFamilyLogin
            ? "Sign in with the parent email linked to your child to view sessions, attendance, and reports."
            : "Sign in to continue setup, manage training, and share your booking link with parents."}
        </p>
      )}
      <div>
        <Label htmlFor="email" required>
          Email
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          disabled={loading}
          invalid={Boolean(emailError)}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError(null);
          }}
          aria-describedby={emailError ? "login-email-error" : undefined}
          placeholder="you@club.com"
        />
        <FieldError id="login-email-error">{emailError}</FieldError>
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <Label htmlFor="password" required className="mb-0">
            Password
          </Label>
          <Link
            href="/forgot-password"
            className="text-muted text-sm underline-offset-4 hover:text-foreground hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          disabled={loading}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error ? <FormErrorAlert message={error} /> : null}
      <div className="relative">
        <BotProtectionFields onTurnstileToken={setTurnstileToken} />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
      <p className="text-muted text-center text-sm">
        New to Awarix?{" "}
        <Link href="/signup" className="text-foreground font-medium underline-offset-4 hover:underline">
          Create account
        </Link>
      </p>
    </form>
  );
}
