/**
 * Visibility model for academy content (documentation + helpers).
 *
 * Three levels:
 * - coach_only: dashboard / staff tools only
 * - parent_only: authenticated parent portal (e.g. parent_visible)
 * - website_public: unauthenticated academy website
 *
 * Do NOT treat parent_only flags as website_public.
 */

export type ContentVisibility = "coach_only" | "parent_only" | "website_public";

/**
 * | Domain    | Public rule                                              |
 * |-----------|----------------------------------------------------------|
 * | Branding  | Public portal RPCs                                       |
 * | Booking   | sessions/series is_public + booking_enabled              |
 * | Teams     | teams.website_visible (default true)                     |
 * | Fixtures  | matches.website_visible + scheduled/live + date            |
 * | Results   | matches.website_visible + completed + scores             |
 * | Camps     | camps.website_visible (opt-in; existing grandfathered)   |
 * | Training  | Not public until website_visible brochure exists         |
 * | Videos    | Not public until website_visible clips exist             |
 * | Gallery   | Not shipped — routes return 404                          |
 * | Coaches   | coach_public_profiles for the academy                    |
 * | Reports   | Never public                                             |
 * | News      | academy_news.published + published_at                    |
 */
export const ACADEMY_WEBSITE_VISIBILITY_NOTES = {
  branding: "website_public",
  booking: "website_public",
  teams: "website_visible",
  fixtures: "website_visible",
  results: "website_visible",
  camps: "website_visible",
  training: "not_shipped",
  videos: "not_shipped",
  gallery: "not_shipped",
  coaches: "website_public",
  reports: "never_public",
  news: "website_public",
} as const;

/** Match statuses safe to show as upcoming fixtures on the website. */
export const PUBLIC_FIXTURE_STATUSES = ["scheduled", "live"] as const;

/** Match statuses safe to show as results. */
export const PUBLIC_RESULT_STATUSES = ["completed"] as const;

export function isParentOnlyVisibilityFlag(flagName: string): boolean {
  return flagName === "parent_visible" || flagName === "squad_published";
}
