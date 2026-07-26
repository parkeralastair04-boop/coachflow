"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { LandPlot } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { PitchSurface } from "@/components/football/pitch-surface";
import { buttonVariants } from "@/components/ui/button";
import {
  getBookingPortalPath,
  isBookingPathname,
  NOT_FOUND_DESCRIPTION,
  NOT_FOUND_TITLE,
} from "@/lib/error-experience";
import { SUPPORT_EMAIL } from "@/lib/help-support";
import { TYPE } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

type NotFoundViewProps = {
  isSignedIn: boolean;
};

export function NotFoundView({ isSignedIn }: NotFoundViewProps) {
  const pathname = usePathname();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const onBookingRoute = isBookingPathname(pathname);
  const bookingPortalPath = getBookingPortalPath(pathname);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="mesh-gradient flex min-h-full flex-col">
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
        <Link href="/" className="mb-10 inline-flex" aria-label="Awarix home">
          <BrandLogo size="auth" priority />
        </Link>

        <PitchSurface
          variant="hero"
          className="football-auth-card page-content-enter w-full max-w-md rounded-2xl p-8 text-center sm:p-10"
        >
          <div className="pointer-events-none absolute inset-0 tactical-grid opacity-[0.12]" aria-hidden />
          <div className="relative">
            <LandPlot className="text-accent mx-auto size-8" aria-hidden />
            <h1
              ref={headingRef}
              tabIndex={-1}
              className={cn(TYPE.pageTitle, "mt-4 outline-none focus:outline-none")}
            >
              {NOT_FOUND_TITLE}
            </h1>
            <p className={cn(TYPE.description, "mx-auto mt-3 max-w-sm")}>
              {NOT_FOUND_DESCRIPTION}
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/" className={buttonVariants({ variant: "primary" })}>
                Go home
              </Link>
              {isSignedIn ? (
                <Link href="/dashboard" className={buttonVariants({ variant: "secondary" })}>
                  Back to dashboard
                </Link>
              ) : null}
              {onBookingRoute && bookingPortalPath ? (
                <Link href={bookingPortalPath} className={buttonVariants({ variant: "secondary" })}>
                  Book training
                </Link>
              ) : null}
            </div>

            <p className={cn(TYPE.description, "mt-8")}>
              Need help?{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-foreground focus-visible:ring-accent/50 font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                {SUPPORT_EMAIL}
              </a>
            </p>
          </div>
        </PitchSurface>
      </main>
    </div>
  );
}
