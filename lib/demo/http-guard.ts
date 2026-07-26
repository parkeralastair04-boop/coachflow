import {
  DEMO_COOKIE,
  DemoSideEffectError,
  demoSafeJson,
  isDemoAcademySlug,
  isDemoCoachSlug,
} from "@/lib/demo/constants";
import { logger } from "@/lib/logger";

/** Sync demo detection from an incoming Request (API routes). */
export function isDemoHttpRequest(
  request: Request,
  slugs?: { academySlug?: string | null; coachSlug?: string | null },
): boolean {
  if (request.headers.get("x-awarix-demo") === "1") return true;

  const cookie = request.headers.get("cookie") ?? "";
  if (cookie.split(";").some((part) => part.trim() === `${DEMO_COOKIE}=1`)) {
    return true;
  }

  if (slugs?.academySlug && isDemoAcademySlug(slugs.academySlug)) return true;
  if (slugs?.coachSlug && isDemoCoachSlug(slugs.coachSlug)) return true;
  return false;
}

export function rejectDemoMutation(
  request: Request,
  action: string,
  slugs?: { academySlug?: string | null; coachSlug?: string | null },
): Response | null {
  if (!isDemoHttpRequest(request, slugs)) return null;

  logger.warn("app", `Demo request blocked: ${action}`, { demo: true, action });
  return Response.json(
    {
      ...demoSafeJson(
        `Demo mode: ${action} was simulated. No email sent and no payment processed.`,
      ),
      code: "demo_mode",
    },
    { status: 200 },
  );
}

export function throwIfDemoHttp(
  request: Request,
  action: string,
  slugs?: { academySlug?: string | null; coachSlug?: string | null },
): void {
  if (isDemoHttpRequest(request, slugs)) {
    throw new DemoSideEffectError(action);
  }
}

export { DemoSideEffectError, demoSafeJson };
