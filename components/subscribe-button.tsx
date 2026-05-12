"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { PlanId } from "@/lib/billing";
import { isFounder } from "@/lib/founders";
import { cn } from "@/lib/utils";

type SubscribeButtonProps = {
  planId: PlanId;
  highlighted?: boolean;
  className?: string;
};

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Could not start checkout.";
}

export function SubscribeButton({
  planId,
  highlighted,
  className,
}: SubscribeButtonProps) {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [founderAccess, setFounderAccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!cancelled && user?.email && isFounder(user.email)) {
          setFounderAccess(true);
        }
      } catch {
        if (!cancelled) setFounderAccess(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    try {
      if (!publishableKey) {
        setError("Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.");
        return;
      }
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          customerEmail: user?.email ?? undefined,
        }),
      });

      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        setError(payload.error ?? "Could not start checkout.");
        return;
      }

      window.location.href = payload.url;
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }

  if (founderAccess) {
    return (
      <p
        className={cn(
          "inline-flex min-h-11 w-full items-center justify-center rounded-full px-4 text-center text-sm font-medium",
          highlighted
            ? "text-accent bg-accent/10 ring-accent/25 ring-1"
            : "text-muted border-border border",
          className,
        )}
      >
        You have complimentary founder access.
      </p>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void handleSubscribe()}
        disabled={loading}
        className={
          highlighted
            ? "bg-accent text-white hover:opacity-90 inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-medium transition-opacity disabled:opacity-60"
            : "bg-foreground text-background hover:opacity-90 dark:bg-white dark:text-black inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-medium transition-opacity disabled:opacity-60"
        }
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            Redirecting...
          </>
        ) : (
          "Subscribe"
        )}
      </button>
      {error ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
