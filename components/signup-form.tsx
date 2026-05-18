"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export function SignupForm({ className }: { className?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCode = searchParams.get("ref")?.trim() ?? "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function getErrorMessage(caughtError: unknown): string {
    if (
      typeof caughtError === "object" &&
      caughtError !== null &&
      "message" in caughtError &&
      typeof caughtError.message === "string"
    ) {
      return caughtError.message;
    }
    return "An unexpected error occurred.";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { data, error: signErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
          data: referralCode ? { referral_code: referralCode } : undefined,
        },
      });
      if (signErr) {
        setError(signErr.message);
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
        router.replace("/dashboard");
        router.refresh();
        return;
      }
      setMessage("Check your email to confirm your account, then sign in.");
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className={cn("flex flex-col gap-5", className)}
    >
      <div className="space-y-2">
        <label htmlFor="signup-email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="signup-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 dark:ring-offset-background"
          placeholder="you@club.com"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="signup-password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 dark:ring-offset-background"
        />
        <p className="text-muted text-xs">At least 8 characters.</p>
      </div>
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-accent text-sm" role="status">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="bg-foreground text-background hover:opacity-90 h-11 rounded-full text-sm font-medium transition-opacity disabled:opacity-60"
      >
        {loading ? "Creating account…" : "Create account"}
      </button>
      <p className="text-muted text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-foreground font-medium underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
