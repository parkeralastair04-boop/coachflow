import type { MetadataRoute } from "next";
import { getAcademyWebsitePaths } from "@/lib/academy-website";
import { absoluteSitePath, getSiteUrl } from "@/lib/site-url";

const MARKETING_PATHS = ["/", "/pricing", "/privacy", "/terms"] as const;

/** Only index pages that are production-ready product surfaces. */
const ACADEMY_CORE_PAGE_KEYS = [
  "home",
  "about",
  "contact",
  "book",
] as const;

const ACADEMY_CONTENT_PAGE_KEYS = [
  "coaches",
  "teams",
  "fixtures",
  "results",
  "camps",
  "news",
] as const;

async function listPublicAcademySlugs(): Promise<string[]> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("academies")
      .select("slug")
      .not("slug", "is", null);

    if (error || !data) return [];
    return data
      .map((row) => (typeof row.slug === "string" ? row.slug.trim() : ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function listPublicCoachSlugs(): Promise<string[]> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("coach_public_profiles")
      .select("slug")
      .eq("booking_enabled", true)
      .not("slug", "is", null);

    if (error || !data) return [];
    return data
      .map((row) => (typeof row.slug === "string" ? row.slug.trim() : ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function listPublishedNewsPaths(academySlug: string): Promise<string[]> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data: academy } = await admin
      .from("academies")
      .select("id")
      .eq("slug", academySlug)
      .maybeSingle();
    if (!academy?.id) return [];

    const { data, error } = await admin
      .from("academy_news")
      .select("slug")
      .eq("academy_id", academy.id)
      .eq("published", true)
      .not("published_at", "is", null);

    if (error || !data) return [];
    return data
      .map((row) => (typeof row.slug === "string" ? row.slug.trim() : ""))
      .filter(Boolean)
      .map(
        (slug) =>
          `/academy/${encodeURIComponent(academySlug)}/news/${encodeURIComponent(slug)}`,
      );
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  void getSiteUrl();
  const entries: MetadataRoute.Sitemap = MARKETING_PATHS.map((path) => ({
    url: absoluteSitePath(path),
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));

  const [academySlugs, coachSlugs] = await Promise.all([
    listPublicAcademySlugs(),
    listPublicCoachSlugs(),
  ]);

  for (const academySlug of academySlugs) {
    const paths = getAcademyWebsitePaths(academySlug);
    for (const key of ACADEMY_CORE_PAGE_KEYS) {
      entries.push({
        url: absoluteSitePath(paths[key]),
        changeFrequency: key === "home" ? "daily" : "weekly",
        priority: key === "home" || key === "book" ? 0.9 : 0.6,
      });
    }

    try {
      const { getAcademyWebsiteNavAvailability, getPublicAcademyContext } =
        await import("@/lib/academy-website-data");
      const context = await getPublicAcademyContext(academySlug);
      if (context) {
        const availability = await getAcademyWebsiteNavAvailability(context);
        for (const key of ACADEMY_CONTENT_PAGE_KEYS) {
          if (!availability[key]) continue;
          entries.push({
            url: absoluteSitePath(paths[key]),
            changeFrequency: key === "news" ? "daily" : "weekly",
            priority: 0.6,
          });
        }
      }
    } catch {
      // Skip content pages if lookup fails; core pages still indexed.
    }

    const newsPaths = await listPublishedNewsPaths(academySlug);
    for (const newsPath of newsPaths) {
      entries.push({
        url: absoluteSitePath(newsPath),
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  }

  for (const coachSlug of coachSlugs) {
    entries.push({
      url: absoluteSitePath(`/book/${encodeURIComponent(coachSlug)}`),
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  return entries;
}
