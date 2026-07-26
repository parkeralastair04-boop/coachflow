import {
  SETUP_UNAVAILABLE_TITLE,
} from "@/lib/user-facing-errors";

export const NOT_FOUND_TITLE = "Page not found";
export const NOT_FOUND_DESCRIPTION =
  "The page you are looking for may have moved or no longer exists.";

export const GLOBAL_ERROR_TITLE = "Something went wrong";
export const GLOBAL_ERROR_DESCRIPTION = "Please try again.";
export const GLOBAL_ERROR_DETAIL =
  "If the problem continues, contact support.";

export const BOOKING_ERROR_TITLE = "We couldn't load this booking page right now.";
export const BOOKING_ERROR_DESCRIPTION =
  "Please try again in a few moments or contact your coach.";

export const DASHBOARD_ERROR_TITLE = SETUP_UNAVAILABLE_TITLE;
export const DASHBOARD_ERROR_DESCRIPTION =
  "Try again in a few moments. Contact support if the issue continues.";

export function isBookingPathname(pathname: string): boolean {
  return pathname.startsWith("/book") || /^\/academy\/[^/]+\/book/.test(pathname);
}

export function getBookingPortalPath(pathname: string): string | null {
  const coachMatch = pathname.match(/^\/book\/([^/]+)/);
  if (coachMatch) {
    return `/book/${coachMatch[1]}`;
  }

  const academyMatch = pathname.match(/^\/academy\/([^/]+)\/book/);
  if (academyMatch) {
    return `/academy/${academyMatch[1]}/book`;
  }

  if (pathname.startsWith("/book")) {
    return "/book";
  }

  return null;
}

export type BookingPortalTenantFromPath =
  | { kind: "coach"; slug: string }
  | { kind: "academy"; slug: string };

export function getBookingPortalTenantFromPath(
  pathname: string,
): BookingPortalTenantFromPath | null {
  const coachMatch = pathname.match(/^\/book\/([^/]+)/);
  if (coachMatch) {
    return { kind: "coach", slug: coachMatch[1] };
  }

  const academyMatch = pathname.match(/^\/academy\/([^/]+)\/book/);
  if (academyMatch) {
    return { kind: "academy", slug: academyMatch[1] };
  }

  return null;
}
