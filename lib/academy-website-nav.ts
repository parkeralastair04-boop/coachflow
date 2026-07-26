import type { AcademyWebsitePageKey } from "@/lib/academy-website";

/**
 * Which primary nav sections should appear for an academy.
 * Incomplete product areas (gallery / training brochure / public videos)
 * stay unavailable until they have real public content.
 */
export type AcademyWebsiteNavAvailability = {
  home: true;
  about: true;
  coaches: boolean;
  teams: boolean;
  fixtures: boolean;
  results: boolean;
  training: false;
  camps: boolean;
  gallery: false;
  videos: false;
  news: boolean;
  contact: true;
  book: true;
  parent: true;
};

export const ACADEMY_WEBSITE_UNAVAILABLE_PAGES = [
  "training",
  "gallery",
  "videos",
] as const satisfies readonly AcademyWebsitePageKey[];

export function isAcademyWebsitePageBuilt(
  page: AcademyWebsitePageKey | string,
): boolean {
  return !(ACADEMY_WEBSITE_UNAVAILABLE_PAGES as readonly string[]).includes(page);
}

export function buildAcademyWebsiteNavAvailability(counts: {
  coaches: number;
  teams: number;
  fixtures: number;
  results: number;
  camps: number;
  news: number;
}): AcademyWebsiteNavAvailability {
  return {
    home: true,
    about: true,
    coaches: counts.coaches > 0,
    teams: counts.teams > 0,
    fixtures: counts.fixtures > 0,
    results: counts.results > 0,
    training: false,
    camps: counts.camps > 0,
    gallery: false,
    videos: false,
    news: counts.news > 0,
    contact: true,
    book: true,
    parent: true,
  };
}
