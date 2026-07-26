"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { FormErrorAlert } from "@/components/form-error-alert";
import { createClient } from "@/lib/supabase";
import { sanitizeUserFacingError } from "@/lib/user-facing-errors";

type ClaimLookup = {
  status?: string;
  email?: string | null;
  childName?: string | null;
  academyName?: string | null;
  error?: string;
};

export function ParentClaimAccountForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [lookup, setLookup] = useState<ClaimLookup | null>(null);
  const [loadingLookup, setLoadingLookup] = useState(() => Boolean(token));
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    async function load() {
      setLoadingLookup(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/family/claim?token=${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as ClaimLookup;
        if (!cancelled) {
          setLookup(payload);
          if (payload.email) setRecoveryEmail(payload.email);
        }
      } catch (caughtError: unknown) {
        if (!cancelled) {
          setError(
            sanitizeUserFacingError(caughtError, {
              context: "general",
              logLabel: "parent-claim-lookup",
            }),
          );
        }
      } finally {
        if (!cancelled) setLoadingLookup(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleClaim(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/family/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "claim",
          token,
          password,
          fullName: fullName.trim() || undefined,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        email?: string;
        redirectTo?: string;
        loginUrl?: string;
        message?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? "Unable to create your account.");
        return;
      }

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: payload.email ?? lookup?.email ?? "",
        password,
      });
      if (signInError) {
        setSuccess("Account created. Sign in with your new password.");
        router.push(`/login?next=${encodeURIComponent("/family?welcome=1")}`);
        return;
      }

      router.push(payload.redirectTo ?? "/family?welcome=1");
    } catch (caughtError: unknown) {
      setError(
        sanitizeUserFacingError(caughtError, {
          context: "general",
          logLabel: "parent-claim-submit",
        }),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReissue(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setRecovering(true);
    try {
      const response = await fetch("/api/family/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reissue",
          email: recoveryEmail.trim(),
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        kind?: string;
        loginUrl?: string;
      };
      if (!response.ok) {
        setError(payload.error ?? "Unable to send a new invite.");
        return;
      }
      if (payload.kind === "sign_in" && payload.loginUrl) {
        setSuccess(payload.message ?? "Sign in to continue.");
        return;
      }
      setSuccess(payload.message ?? "Check your email for a new invite link.");
    } catch (caughtError: unknown) {
      setError(
        sanitizeUserFacingError(caughtError, {
          context: "general",
          logLabel: "parent-claim-reissue",
        }),
      );
    } finally {
      setRecovering(false);
    }
  }

  if (loadingLookup) {
    return (
      <div className="football-panel flex items-center gap-3 rounded-2xl p-6 text-sm" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Checking your invite…
      </div>
    );
  }

  const needsRecovery =
    !token ||
    lookup?.status === "expired" ||
    lookup?.status === "used" ||
    lookup?.status === "revoked" ||
    lookup?.status === "invalid";

  if (lookup?.status === "valid_existing") {
    return (
      <div className="football-panel space-y-4 rounded-2xl p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">You already have an account</h1>
        <p className="text-muted text-sm leading-relaxed">
          Sign in with {lookup.email} to open your family training hub.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent("/family")}`}
          className="bg-accent text-accent-foreground hover:bg-accent/90 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (needsRecovery) {
    return (
      <div className="football-panel space-y-4 rounded-2xl p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Get a new invite link</h1>
        <p className="text-muted text-sm leading-relaxed">
          {token
            ? "This invite is no longer valid. Enter the parent email from your booking and we will send a fresh secure link."
            : "Enter the parent email from your booking to receive a secure account invite."}
        </p>
        <form onSubmit={(event) => void handleReissue(event)} className="space-y-4">
          <label className="block text-sm font-medium">
            Parent email
            <input
              type="email"
              required
              value={recoveryEmail}
              onChange={(event) => setRecoveryEmail(event.target.value)}
              className="border-border bg-background mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm"
              autoComplete="email"
            />
          </label>
          {error ? <FormErrorAlert message={error} /> : null}
          {success ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{success}</p> : null}
          <button
            type="submit"
            disabled={recovering}
            className="bg-accent text-accent-foreground hover:bg-accent/90 inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-medium disabled:opacity-60"
          >
            {recovering ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Send invite"}
          </button>
        </form>
        <p className="text-muted text-sm">
          Already have an account?{" "}
          <Link href="/login?next=/family" className="text-accent underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="football-panel space-y-4 rounded-2xl p-6 sm:p-8">
      <div>
        <p className="text-muted text-sm font-medium">
          {lookup?.academyName?.trim() || "Awarix"} family access
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Join as a parent</h1>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          {lookup?.childName
            ? `Set a password for ${lookup.email} to manage ${lookup.childName}'s bookings, reports, and payments.`
            : `Set a password for ${lookup?.email} to open your family training hub.`}
        </p>
      </div>

      <form onSubmit={(event) => void handleClaim(event)} className="space-y-4">
        <label className="block text-sm font-medium">
          Your name <span className="text-muted font-normal">(optional)</span>
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="border-border bg-background mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm"
            autoComplete="name"
          />
        </label>
        <label className="block text-sm font-medium">
          Password
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="border-border bg-background mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm"
            autoComplete="new-password"
          />
        </label>
        <label className="block text-sm font-medium">
          Confirm password
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="border-border bg-background mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm"
            autoComplete="new-password"
          />
        </label>
        {error ? <FormErrorAlert message={error} /> : null}
        {success ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{success}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          className="bg-accent text-accent-foreground hover:bg-accent/90 inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-medium disabled:opacity-60"
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            "Open your child's training"
          )}
        </button>
      </form>
    </div>
  );
}
