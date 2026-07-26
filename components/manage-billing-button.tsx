"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { fetchAccountEntitlementsComplimentary } from "@/lib/complimentary-access-client";

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

type ManageBillingButtonProps = {
  label?: string;
  className?: string;
} & Pick<ButtonProps, "variant" | "size" | "shape">;

export function ManageBillingButton({
  label = "Manage Subscription",
  variant = "accent",
  size = "md",
  shape = "pill",
  className,
}: ManageBillingButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complimentaryMessage, setComplimentaryMessage] = useState<string | null>(null);

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

  async function handleOpenPortal() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
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
    <div className={className}>
      <Button
        type="button"
        variant={variant}
        size={size}
        shape={shape}
        className="w-full sm:w-auto"
        onClick={() => void handleOpenPortal()}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Opening portal...
          </>
        ) : (
          label
        )}
      </Button>
      <FieldError className="mt-2">{error}</FieldError>
    </div>
  );
}
