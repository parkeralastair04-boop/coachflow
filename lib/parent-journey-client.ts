"use client";

import type { ParentJourneyEventName } from "@/lib/parent-journey-types";

/** Client-side parent funnel tracking via authenticated API. */
export async function trackParentJourneyEvent(
  event: ParentJourneyEventName,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await fetch("/api/family/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, metadata }),
    });
  } catch {
    // Non-blocking.
  }
}
