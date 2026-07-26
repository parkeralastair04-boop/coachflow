import "server-only";

import { cookies, headers } from "next/headers";
import {
  DEMO_ACADEMY_SLUG,
  DEMO_COOKIE,
  DemoSideEffectError,
  demoSafeJson,
  isDemoAcademySlug,
  isDemoCoachSlug,
  isDemoTenantSlug,
} from "@/lib/demo/constants";
import { logger } from "@/lib/logger";

/**
 * Demo mode is active when:
 * - Cookie `awarix_demo=1` is set (product tour), or
 * - Header `x-awarix-demo: 1` (API clients)
 */
export async function isDemoModeActive(): Promise<boolean> {
  try {
    const headerStore = await headers();
    if (headerStore.get("x-awarix-demo") === "1") return true;

    const cookieStore = await cookies();
    if (cookieStore.get(DEMO_COOKIE)?.value === "1") return true;
  } catch {
    // Outside request scope (scripts) — treat as inactive.
  }
  return false;
}

export {
  DEMO_ACADEMY_SLUG,
  DEMO_COOKIE,
  DemoSideEffectError,
  demoSafeJson,
  isDemoAcademySlug,
  isDemoCoachSlug,
  isDemoTenantSlug,
};

/** Hard stop for side effects — never send email or call Stripe for demo. */
export function blockDemoSideEffect(action: string): never {
  logger.warn("app", `Demo mode blocked side effect: ${action}`, {
    demo: true,
    action,
  });
  throw new DemoSideEffectError(action);
}
