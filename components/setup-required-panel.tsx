"use client";

import { AlertCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import { FootballPanel } from "@/components/football/football-panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { SUPPORT_EMAIL } from "@/lib/help-support";
import {
  SETUP_UNAVAILABLE_DESCRIPTION,
  SETUP_UNAVAILABLE_TITLE,
} from "@/lib/user-facing-errors";
import { TYPE } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

type SetupRequiredPanelProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  /** Ignored — callers may pass detected table names for internal setup state only. */
  tables?: string[];
  /** When true, presents as an error alert with initial heading focus. */
  alert?: boolean;
};

export function SetupRequiredPanel({
  title = SETUP_UNAVAILABLE_TITLE,
  description = SETUP_UNAVAILABLE_DESCRIPTION,
  onRetry,
  alert = false,
}: SetupRequiredPanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (alert) {
      headingRef.current?.focus();
    }
  }, [alert]);

  function handleRetry() {
    if (onRetry) {
      onRetry();
      return;
    }
    window.location.reload();
  }

  return (
    <FootballPanel
      variant="default"
      className="page-content-enter p-8 text-center sm:p-10"
      role={alert ? "alert" : "status"}
      aria-live={alert ? "assertive" : "polite"}
    >
      <AlertCircle className="text-accent mx-auto size-10" aria-hidden />
      <h2
        ref={headingRef}
        tabIndex={alert ? -1 : undefined}
        className={cn(TYPE.sectionTitle, "mt-4 text-xl outline-none focus:outline-none")}
      >
        {title}
      </h2>
      <p className={cn(TYPE.description, "mx-auto mt-2 max-w-xl")}>{description}</p>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button type="button" variant="primary" onClick={handleRetry}>
          Try again
        </Button>
        <a href={`mailto:${SUPPORT_EMAIL}`} className={buttonVariants({ variant: "secondary" })}>
          Contact support
        </a>
      </div>
    </FootballPanel>
  );
}
