"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivationEventName } from "@/lib/activation-types";

/** Client-side activation tracking via authenticated API. */
export async function trackActivationEvent(
  event: ActivationEventName,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await fetch("/api/activation/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, metadata }),
    });
  } catch {
    // Non-blocking.
  }
}

export const CELEBRATION_METADATA_KEY = "activation_celebrations";

export type CelebrationKey =
  | "academy_created"
  | "session_published"
  | "booking_link_copied"
  | "first_booking"
  | "first_parent";

export type CelebrationMap = Partial<Record<CelebrationKey, boolean>>;

export function parseCelebrations(
  metadata: Record<string, unknown> | null | undefined,
): CelebrationMap {
  const raw = metadata?.[CELEBRATION_METADATA_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as CelebrationMap;
}

export async function markCelebrationSeen(
  supabase: SupabaseClient,
  key: CelebrationKey,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const previous = parseCelebrations(
    user.user_metadata as Record<string, unknown> | undefined,
  );
  if (previous[key]) return;

  const { error } = await supabase.auth.updateUser({
    data: {
      [CELEBRATION_METADATA_KEY]: {
        ...previous,
        [key]: true,
      },
    },
  });
  if (error) {
    console.warn("[celebration]", key, error.message);
  }
}

export function hasSeenCelebration(
  metadata: Record<string, unknown> | null | undefined,
  key: CelebrationKey,
): boolean {
  return Boolean(parseCelebrations(metadata)[key]);
}
