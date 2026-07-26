import type { Metadata } from "next";

/** Shared robots directive for authenticated / private surfaces. */
export const NOINDEX_ROBOTS = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: {
    index: false,
    follow: false,
  },
} as const;

export const privateRouteMetadata: Metadata = {
  robots: NOINDEX_ROBOTS,
};
