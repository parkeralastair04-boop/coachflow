/** Stable identifiers for the static Riverside United demo academy. */

export const DEMO_ACADEMY_SLUG = "riverside-united";

export const DEMO_ACADEMY_ID = "00000000-0000-4000-a000-000000000001";
export const DEMO_COACH_ID = "00000000-0000-4000-a000-0000000000c1";
export const DEMO_COACH_SLUG = "james-okonkwo";

export const DEMO_COOKIE = "awarix_demo";
export const DEMO_TOUR_STORAGE_KEY = "awarix.demo.tour.dismissed";
export const DEMO_MUTATIONS_STORAGE_KEY = "awarix.demo.mutations";

export const DEMO_SUPPORT_EMAIL = "hello@riversideunited.demo";

export function isDemoAcademySlug(slug: string | null | undefined): boolean {
  return (slug ?? "").trim().toLowerCase() === DEMO_ACADEMY_SLUG;
}

export function isDemoCoachSlug(slug: string | null | undefined): boolean {
  return (slug ?? "").trim().toLowerCase() === DEMO_COACH_SLUG;
}

export function isDemoTenantSlug(
  kind: "academy" | "coach",
  slug: string | null | undefined,
): boolean {
  return kind === "academy" ? isDemoAcademySlug(slug) : isDemoCoachSlug(slug);
}

export class DemoSideEffectError extends Error {
  readonly code = "demo_side_effect_blocked";

  constructor(action: string) {
    super(
      `Demo mode cannot ${action}. This showcase never sends email or charges Stripe.`,
    );
    this.name = "DemoSideEffectError";
  }
}

export function demoSafeJson(message?: string) {
  return {
    ok: true,
    demo: true as const,
    message:
      message ??
      "Demo mode: action simulated. No email sent and no payment processed.",
  };
}
