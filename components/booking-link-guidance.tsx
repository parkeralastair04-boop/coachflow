"use client";

import { useMemo } from "react";
import { Link2 } from "lucide-react";
import { BOOKING_LINK_GUIDANCE, getRecommendedBookingUrl } from "@/lib/booking-link-copy";
import { getPortalOrigin } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

type BookingLinkGuidanceProps = {
  coachSlug?: string | null;
  academySlug?: string | null;
  primaryUrl?: string | null;
  variant?: "full" | "compact";
  className?: string;
};

export function BookingLinkGuidance({
  coachSlug = null,
  academySlug = null,
  primaryUrl = null,
  variant = "full",
  className,
}: BookingLinkGuidanceProps) {
  const origin = getPortalOrigin();
  const coachUrl = useMemo(
    () => (coachSlug ? `${origin}/book/${coachSlug}` : null),
    [coachSlug, origin],
  );
  const academyUrl = useMemo(
    () => (academySlug ? `${origin}/academy/${academySlug}/book` : null),
    [academySlug, origin],
  );
  const recommended = useMemo(
    () => getRecommendedBookingUrl({ academySlug, coachSlug, origin }),
    [academySlug, coachSlug, origin],
  );
  const shareUrl = primaryUrl ?? recommended.url;

  if (variant === "compact") {
    return (
      <p className={cn("text-muted text-sm leading-relaxed", className)}>
        {recommended.kind === "academy"
          ? "Share your academy booking page with parents — it's your branded club link."
          : "Share your coach booking page with parents so they can reserve training online."}{" "}
        {shareUrl ? (
          <span className="text-foreground font-medium">
            {recommended.kind === "academy" ? "Academy link" : "Coach link"} is the one to copy.
          </span>
        ) : null}
      </p>
    );
  }

  return (
    <div className={cn("border-border rounded-2xl border p-4 sm:p-5", className)}>
      <div className="flex items-start gap-3">
        <div className="bg-accent/12 ring-accent/25 flex size-9 shrink-0 items-center justify-center rounded-lg ring-1">
          <Link2 className="text-accent size-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{BOOKING_LINK_GUIDANCE.headline}</p>
          <p className="text-muted mt-1 text-sm leading-relaxed">
            {BOOKING_LINK_GUIDANCE.primaryIntro}
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-3 text-sm">
        <li className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
          <p className="font-medium">{BOOKING_LINK_GUIDANCE.coachPage.title}</p>
          <p className="text-muted mt-1 leading-relaxed">
            {BOOKING_LINK_GUIDANCE.coachPage.description}
          </p>
          {coachUrl ? (
            <p className="text-muted mt-2 break-all text-xs">{coachUrl}</p>
          ) : null}
        </li>
        {academyUrl ? (
          <li className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
            <p className="font-medium">{BOOKING_LINK_GUIDANCE.academyPage.title}</p>
            <p className="text-muted mt-1 leading-relaxed">
              {BOOKING_LINK_GUIDANCE.academyPage.description}
            </p>
            <p className="text-muted mt-2 break-all text-xs">{academyUrl}</p>
          </li>
        ) : null}
      </ul>

      <p className="text-muted mt-4 text-sm leading-relaxed">
        <span className="text-foreground font-medium">Which link to share: </span>
        {BOOKING_LINK_GUIDANCE.whichToShare}
      </p>

      {shareUrl ? (
        <div className="border-border mt-4 space-y-3 border-t pt-4">
          <p className="text-xs font-medium tracking-wide uppercase text-muted">Share examples</p>
          <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 text-sm dark:bg-white/[0.03]">
            <p className="text-muted text-xs font-medium">WhatsApp</p>
            <p className="mt-1 leading-relaxed">
              {BOOKING_LINK_GUIDANCE.whatsAppExample(shareUrl)}
            </p>
          </div>
          <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 text-sm dark:bg-white/[0.03]">
            <p className="text-muted text-xs font-medium">Email</p>
            <p className="mt-1 leading-relaxed">
              <span className="text-muted">Subject: </span>
              {BOOKING_LINK_GUIDANCE.emailExample.subject}
            </p>
            <p className="text-muted mt-2 whitespace-pre-wrap text-xs leading-relaxed">
              {BOOKING_LINK_GUIDANCE.emailExample.body(shareUrl)}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
