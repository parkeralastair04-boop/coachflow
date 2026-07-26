import "server-only";

import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export { getSafeAuthNextPath } from "@/lib/auth/safe-next-path";

function isDevAuthTimingEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}

/** Lightweight auth timing logs — development only. */
export function logAuthTiming(label: string, startedAt: number) {
  if (!isDevAuthTimingEnabled()) return;
  const elapsedMs = Math.round(performance.now() - startedAt);
  console.info(`[auth-timing] ${label}: ${elapsedMs}ms`);
}

/**
 * Request-scoped Supabase server client.
 * Cookies() is already request-bound; caching avoids recreating clients.
 */
export const getServerSupabase = cache(async () => {
  return createServerSupabaseClient();
});

/**
 * Validate the signed-in user once per request.
 * Prefer this over repeated auth.getUser() in layouts and helpers.
 */
export const getAuthenticatedUser = cache(async (): Promise<User | null> => {
  const startedAt = performance.now();
  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user;
  } finally {
    logAuthTiming("getAuthenticatedUser", startedAt);
  }
});
