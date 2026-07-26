import "server-only";

import { isDemoModeActive, blockDemoSideEffect } from "@/lib/demo/mode";
import { isDemoAcademySlug, isDemoCoachSlug } from "@/lib/demo/constants";
import { logger } from "@/lib/logger";

export async function assertNotDemoEmail(): Promise<void> {
  if (await isDemoModeActive()) {
    blockDemoSideEffect("send email");
  }
}

export async function assertNotDemoStripe(): Promise<void> {
  if (await isDemoModeActive()) {
    blockDemoSideEffect("charge Stripe or open live checkout");
  }
}

/** Soft check used when only slug is known (public APIs). */
export function assertNotDemoSlug(
  kind: "academy" | "coach",
  slug: string | null | undefined,
): void {
  const value = slug?.trim() ?? "";
  if (
    (kind === "academy" && isDemoAcademySlug(value)) ||
    (kind === "coach" && isDemoCoachSlug(value))
  ) {
    logger.warn("app", "Demo slug blocked mutating side effect", { kind, slug: value });
    blockDemoSideEffect("mutate the demo academy");
  }
}
