"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { readClientComplimentaryAccess } from "@/lib/complimentary-access-client";

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Could not open billing portal.";
}

export function ManageBillingButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complimentaryMessage, setComplimentaryMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = createClient();
        const access = await readClientComplimentaryAccess(supabase);
        if (!cancelled && access.hasComplimentaryAccess) {
          if (access.isBetaTester) {
            setComplimentaryMessage("Complimentary Academy Access");
          } else if (access.isFounder) {
            setComplimentaryMessage("You have complimentary founder access.");
          } else {
            setComplimentaryMessage("Complimentary Academy Access");
          }
        }
      } catch {
        if (!cancelled) setComplimentaryMessage(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleOpenPortal() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.email) {
        setError("Please sign in with an email account to manage billing.");
        return;
      }

      const response = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerEmail: user.email }),
      });

      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        setError(payload.error ?? "Could not open billing portal.");
        return;
      }

      window.location.href = payload.url;
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }

  if (complimentaryMessage) {
    return (
      <p className="text-muted text-sm leading-relaxed">{complimentaryMessage}</p>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void handleOpenPortal()}
        disabled={loading}
        className="bg-foreground text-background hover:opacity-90 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            Opening portal...
          </>
        ) : (
          "Manage Billing"
        )}
      </button>
      {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
