"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export function LoginForm({ className }: { className?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
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
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signErr) {
        setError(signErr.message);
        return;
      }
      router.replace(nextPath);
      router.refresh();
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
      {searchParams.get("error") === "auth" ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          Authentication failed. Please sign in again.
        </p>
      ) : null}
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
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
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 dark:ring-offset-background"
        />
      </div>
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="bg-foreground text-background hover:opacity-90 h-11 rounded-full text-sm font-medium transition-opacity disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-muted text-center text-sm">
        New to CoachFlow?{" "}
        <Link href="/signup" className="text-foreground font-medium underline-offset-4 hover:underline">
          Create account
        </Link>
      </p>
    </form>
  );
}
