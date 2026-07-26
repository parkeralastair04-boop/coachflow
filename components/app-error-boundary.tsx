"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import {
  BOOKING_ERROR_DESCRIPTION,
  BOOKING_ERROR_TITLE,
  DASHBOARD_ERROR_DESCRIPTION,
  DASHBOARD_ERROR_TITLE,
  getBookingPortalTenantFromPath,
  GLOBAL_ERROR_DESCRIPTION,
  GLOBAL_ERROR_DETAIL,
  GLOBAL_ERROR_TITLE,
} from "@/lib/error-experience";
import { SUPPORT_EMAIL } from "@/lib/help-support";
import { loadBookingSupportEmail } from "@/lib/load-booking-support-email";

type AppErrorBoundaryProps = {
  variant: "global" | "dashboard" | "booking";
  onRetry: () => void;
};

const primaryButtonClassName =
  "bg-foreground text-background hover:opacity-90 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity focus-visible:ring-accent/50 focus-visible:ring-2 focus-visible:outline-none";

const secondaryButtonClassName =
  "border-border hover:bg-surface-hover inline-flex h-11 items-center justify-center rounded-full border px-6 text-sm font-medium transition-colors focus-visible:ring-accent/50 focus-visible:ring-2 focus-visible:outline-none dark:hover:bg-white/[0.06]";

function getCopy(variant: AppErrorBoundaryProps["variant"]) {
  if (variant === "dashboard") {
    return {
      title: DASHBOARD_ERROR_TITLE,
      description: DASHBOARD_ERROR_DESCRIPTION,
    };
  }

  if (variant === "booking") {
    return {
      title: BOOKING_ERROR_TITLE,
      description: BOOKING_ERROR_DESCRIPTION,
    };
  }

  return {
    title: GLOBAL_ERROR_TITLE,
    description: `${GLOBAL_ERROR_DESCRIPTION} ${GLOBAL_ERROR_DETAIL}`,
  };
}

export function AppErrorBoundary({ variant, onRetry }: AppErrorBoundaryProps) {
  const pathname = usePathname();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [coachSupportEmail, setCoachSupportEmail] = useState<string | null>(null);
  const copy = getCopy(variant);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (variant !== "booking") {
      return;
    }

    const tenant = getBookingPortalTenantFromPath(pathname);
    if (!tenant) {
      return;
    }

    let cancelled = false;

    void loadBookingSupportEmail(tenant).then((email) => {
      if (!cancelled) {
        setCoachSupportEmail(email);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pathname, variant]);

  const supportEmail =
    variant === "booking" && coachSupportEmail ? coachSupportEmail : SUPPORT_EMAIL;
  const supportLabel =
    variant === "booking" && coachSupportEmail ? "Contact your coach" : "Contact support";

  return (
    <div className="mesh-gradient flex min-h-full flex-col">
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
        <Link href="/" className="mb-10 inline-flex" aria-label="Awarix home">
          <BrandLogo size="auth" priority />
        </Link>

        <div
          className="glass-panel w-full max-w-md rounded-2xl p-8 text-center sm:p-10"
          role="alert"
          aria-live="assertive"
        >
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-semibold tracking-tight outline-none focus:outline-none"
          >
            {copy.title}
          </h1>
          <p className="text-muted mx-auto mt-3 max-w-sm text-sm leading-relaxed">
            {copy.description}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
            <button type="button" onClick={onRetry} className={primaryButtonClassName}>
              Try again
            </button>
            <Link href="/" className={secondaryButtonClassName}>
              Go home
            </Link>
          </div>

          <p className="text-muted mt-8 text-sm">
            {supportLabel}?{" "}
            <a
              href={`mailto:${supportEmail}`}
              className="text-foreground focus-visible:ring-accent/50 font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              {supportEmail}
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
