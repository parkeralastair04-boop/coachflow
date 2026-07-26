"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { PlanId } from "@/lib/billing";
import { fetchAccountEntitlementsComplimentary } from "@/lib/complimentary-access-client";
import {
  TRIAL_PERIOD_DAYS,
  addTrialDays,
  formatUkShortDate,
} from "@/lib/trial-copy";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type SubscribeButtonProps = {
  planId: PlanId;
  monthlyPounds: number;
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
  monthlyPounds,
  highlighted,
  className,
}: SubscribeButtonProps) {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complimentaryMessage, setComplimentaryMessage] = useState<string | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);

  const previewFirstPaymentDate = formatUkShortDate(
    addTrialDays(new Date(), TRIAL_PERIOD_DAYS),
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const access = await fetchAccountEntitlementsComplimentary();
        if (!cancelled && access.hasComplimentaryAccess) {
          setComplimentaryMessage("Complimentary Academy access");
        }
      } catch {
        if (!cancelled) setComplimentaryMessage(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubscribe() {
    if (loading) return;
    setLoading(true);
    setError(null);
    setCheckoutNotice(null);
    try {
      if (!publishableKey) {
        setError("Checkout is temporarily unavailable. Please try again later.");
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        const next = encodeURIComponent(
          typeof window !== "undefined" ? window.location.pathname : "/pricing",
        );
        window.location.href = `/login?next=${next}`;
        return;
      }

      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      const payload = (await response.json()) as {
        url?: string;
        error?: string;
        trialEligible?: boolean;
        message?: string | null;
        firstPaymentDate?: string | null;
        firstPaymentAmount?: number;
      };

      if (response.status === 401) {
        const next = encodeURIComponent(
          typeof window !== "undefined" ? window.location.pathname : "/pricing",
        );
        window.location.href = `/login?next=${next}`;
        return;
      }

      if (!response.ok || !payload.url) {
        setError(payload.error ?? "Could not start checkout.");
        setLoading(false);
        return;
      }

      if (payload.trialEligible && payload.message) {
        setCheckoutNotice(payload.message);
      } else if (payload.trialEligible === false) {
        setCheckoutNotice(
          `Your free trial has already been used. You'll be charged £${payload.firstPaymentAmount ?? monthlyPounds}/month starting today.`,
        );
      }

      window.location.href = payload.url;
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
      setLoading(false);
    }
  }

  if (complimentaryMessage) {
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
        {complimentaryMessage}
      </p>
    );
  }

  return (
    <div className={className}>
      <p className="text-muted mb-3 text-xs leading-relaxed">
        You won&apos;t be charged today. Your first payment of £{monthlyPounds}/month
        will be collected on {previewFirstPaymentDate} unless you cancel before then.
      </p>
      <Button
        type="button"
        onClick={() => void handleSubscribe()}
        disabled={loading}
        aria-busy={loading}
        variant={highlighted ? "accent" : "primary"}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Starting checkout…
          </>
        ) : (
          "Start coaching free"
        )}
      </Button>
      {checkoutNotice ? (
        <p className="text-muted mt-2 text-xs leading-relaxed">{checkoutNotice}</p>
      ) : null}
      <FieldError className="mt-2 text-xs">{error}</FieldError>
    </div>
  );
}
