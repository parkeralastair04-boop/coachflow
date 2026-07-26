import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError } from "@/lib/supabase-errors";
import { resolvePublicPortal } from "@/lib/public-booking";
import {
  serializePublicAcademy,
  serializePublicCamp,
  serializePublicCoach,
  serializePublicFixture,
  serializePublicNewsArticle,
  serializePublicResult,
  serializePublicTeam,
} from "@/lib/academy-website-serializers";
import {
  buildAcademyWebsiteNavAvailability,
  type AcademyWebsiteNavAvailability,
} from "@/lib/academy-website-nav";
import {
  PUBLIC_FIXTURE_STATUSES,
  PUBLIC_RESULT_STATUSES,
} from "@/lib/academy-website-visibility";
import type {
  PublicAcademy,
  PublicAcademyContext,
  PublicCamp,
  PublicCoach,
  PublicFixture,
  PublicNewsArticle,
  PublicResult,
  PublicTeam,
  PublicTraining,
  PublicVideo,
} from "@/lib/academy-website-types";
import { isDemoAcademySlug } from "@/lib/demo/constants";
import {
  DEMO_CAMPS,
  DEMO_COACHES,
  DEMO_FIXTURES,
  DEMO_NEWS,
  DEMO_RESULTS,
  DEMO_TEAMS,
  getDemoAcademyContext,
} from "@/lib/demo/data";

type SlugOrContext = string | PublicAcademyContext;

function resolveAcademyId(context: PublicAcademyContext): string | null {
  const id = context.academy.id?.trim();
  if (id && /^[0-9a-f-]{36}$/i.test(id)) return id;
  return null;
}

async function loadAcademyPublicContent(academyId: string): Promise<{
  description: string | null;
  address: string | null;
}> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("academies")
      .select("public_description, public_address")
      .eq("id", academyId)
      .maybeSingle();
    if (error || !data) {
      return { description: null, address: null };
    }
    return {
      description: (data.public_description as string | null) ?? null,
      address: (data.public_address as string | null) ?? null,
    };
  } catch {
    return { description: null, address: null };
  }
}

/**
 * Central academy lookup for all public website pages.
 * Cached per-request so layout, metadata, and page share one portal resolve.
 */
export const getPublicAcademyContext = cache(
  async (academySlug: string): Promise<PublicAcademyContext | null> => {
    if (isDemoAcademySlug(academySlug)) {
      return getDemoAcademyContext();
    }

    const portal = await resolvePublicPortal({ kind: "academy", slug: academySlug });
    if (!portal) return null;

    const academyId = portal.academy_id?.trim() || "";
    const extras = academyId
      ? await loadAcademyPublicContent(academyId)
      : { description: null, address: null };

    return {
      slug: academySlug,
      academy: serializePublicAcademy(portal, academySlug, extras),
    };
  },
);

export async function getPublicAcademy(academySlug: string): Promise<PublicAcademy | null> {
  const context = await getPublicAcademyContext(academySlug);
  return context?.academy ?? null;
}

async function ensureContext(input: SlugOrContext): Promise<PublicAcademyContext | null> {
  if (typeof input !== "string") return input;
  return getPublicAcademyContext(input);
}

/**
 * Content-aware nav availability for an academy (cached with context lookups).
 */
export async function getAcademyWebsiteNavAvailability(
  input: SlugOrContext,
): Promise<AcademyWebsiteNavAvailability> {
  const context = await ensureContext(input);
  if (!context) {
    return buildAcademyWebsiteNavAvailability({
      coaches: 0,
      teams: 0,
      fixtures: 0,
      results: 0,
      camps: 0,
      news: 0,
    });
  }

  const [coaches, teams, fixtures, results, camps, news] = await Promise.all([
    getPublicCoaches(context),
    getPublicTeams(context),
    getPublicFixtures(context),
    getPublicResults(context),
    getPublicCamps(context),
    getPublicNews(context),
  ]);

  return buildAcademyWebsiteNavAvailability({
    coaches: coaches.length,
    teams: teams.length,
    fixtures: fixtures.length,
    results: results.length,
    camps: camps.length,
    news: news.length,
  });
}

/**
 * Public teams for an academy. No squad lists or player data.
 * Returns [] when the academy cannot be resolved or tables are unavailable.
 */
export async function getPublicTeams(input: SlugOrContext): Promise<PublicTeam[]> {
  const context = await ensureContext(input);
  if (!context) return [];
  if (isDemoAcademySlug(context.slug)) return DEMO_TEAMS;
  const academyId = resolveAcademyId(context);
  if (!academyId) return [];

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("teams")
      .select("id, team_name, age_group, team_color")
      .eq("academy_id", academyId)
      .eq("website_visible", true)
      .order("team_name", { ascending: true });

    if (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }

    return (data ?? []).map((row) =>
      serializePublicTeam(row as {
        id: string;
        team_name: string;
        age_group: string | null;
        team_color: string | null;
      }),
    );
  } catch {
    return [];
  }
}

/**
 * Upcoming fixtures. Excludes squads, attendance, notes, and player events.
 */
export async function getPublicFixtures(input: SlugOrContext): Promise<PublicFixture[]> {
  const context = await ensureContext(input);
  if (!context) return [];
  if (isDemoAcademySlug(context.slug)) return DEMO_FIXTURES;
  const academyId = resolveAcademyId(context);
  if (!academyId) return [];

  try {
    const admin = createAdminClient();
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await admin
      .from("matches")
      .select(
        "id, team_id, opposition, competition_type, competition_name, venue, is_home, kickoff_date, kickoff_time, pitch, status, team:teams(id, team_name, age_group, team_color)",
      )
      .eq("academy_id", academyId)
      .eq("website_visible", true)
      .in("status", [...PUBLIC_FIXTURE_STATUSES])
      .gte("kickoff_date", today)
      .order("kickoff_date", { ascending: true })
      .order("kickoff_time", { ascending: true });

    if (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }

    return (data ?? [])
      .map((row) => serializePublicFixture(row as never))
      .filter((row): row is PublicFixture => row !== null);
  } catch {
    return [];
  }
}

/**
 * Completed results. Scores only — no scorers, PoTM, or coach notes.
 */
export async function getPublicResults(input: SlugOrContext): Promise<PublicResult[]> {
  const context = await ensureContext(input);
  if (!context) return [];
  if (isDemoAcademySlug(context.slug)) return DEMO_RESULTS;
  const academyId = resolveAcademyId(context);
  if (!academyId) return [];

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("matches")
      .select(
        "id, team_id, opposition, competition_type, competition_name, venue, is_home, kickoff_date, kickoff_time, status, match_data, team:teams(id, team_name, age_group, team_color)",
      )
      .eq("academy_id", academyId)
      .eq("website_visible", true)
      .in("status", [...PUBLIC_RESULT_STATUSES])
      .order("kickoff_date", { ascending: false })
      .limit(40);

    if (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }

    return (data ?? [])
      .map((row) => serializePublicResult(row as never))
      .filter((row): row is PublicResult => row !== null);
  } catch {
    return [];
  }
}

/**
 * Upcoming / current camps catalogue. No enrolments or parent contacts.
 * Remaining spaces are derived from capacity − enrolled count only.
 */
export async function getPublicCamps(input: SlugOrContext): Promise<PublicCamp[]> {
  const context = await ensureContext(input);
  if (!context) return [];
  if (isDemoAcademySlug(context.slug)) return DEMO_CAMPS;
  const academyId = resolveAcademyId(context);
  if (!academyId) return [];

  try {
    const admin = createAdminClient();
    const today = new Date().toISOString().slice(0, 10);
    const [{ data, error }, { data: enrolmentRows, error: enrolmentError }] = await Promise.all([
      admin
        .from("camps")
        .select(
          "id, name, description, start_date, end_date, start_time, end_time, age_group, price, location, capacity",
        )
        .eq("academy_id", academyId)
        .eq("website_visible", true)
        .gte("end_date", today)
        .order("start_date", { ascending: true }),
      admin
        .from("camp_enrolments")
        .select("camp_id, status")
        .eq("academy_id", academyId),
    ]);

    if (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }

    const enrolledByCamp = new Map<string, number>();
    if (!enrolmentError) {
      for (const row of enrolmentRows ?? []) {
        if ((row as { status?: string }).status !== "enrolled") continue;
        const campId = (row as { camp_id: string }).camp_id;
        enrolledByCamp.set(campId, (enrolledByCamp.get(campId) ?? 0) + 1);
      }
    }

    return (data ?? []).map((row) => {
      const camp = row as {
        id: string;
        name: string;
        description: string | null;
        start_date: string;
        end_date: string;
        start_time: string;
        end_time: string;
        age_group: string | null;
        price: number | string;
        location: string | null;
        capacity: number | null;
      };
      const capacity =
        typeof camp.capacity === "number" && Number.isFinite(camp.capacity)
          ? camp.capacity
          : null;
      const enrolled = enrolledByCamp.get(camp.id) ?? 0;
      return serializePublicCamp({
        ...camp,
        remaining: capacity == null ? null : Math.max(0, capacity - enrolled),
      });
    });
  } catch {
    return [];
  }
}

/**
 * Training brochure list.
 * Intentionally returns [] until a dedicated website_visible flag exists.
 * Do not use parent_visible for the public website.
 */
export async function getPublicTraining(_input: SlugOrContext): Promise<PublicTraining[]> {
  void _input;
  return [];
}

/**
 * Public coaching staff roster (display fields only).
 */
export async function getPublicCoaches(input: SlugOrContext): Promise<PublicCoach[]> {
  const context = await ensureContext(input);
  if (!context) return [];
  if (isDemoAcademySlug(context.slug)) return DEMO_COACHES;
  const academyId = resolveAcademyId(context);
  if (!academyId) return [];

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("coach_public_profiles")
      .select("slug, display_name, logo_url, booking_enabled")
      .eq("academy_id", academyId)
      .order("display_name", { ascending: true });

    if (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }

    return (data ?? []).map((row) => serializePublicCoach(row as never));
  } catch {
    return [];
  }
}

/**
 * Public video clips.
 * Intentionally returns [] until website_visible exists.
 * Do not use parent_visible for the open web.
 */
export async function getPublicVideos(_input: SlugOrContext): Promise<PublicVideo[]> {
  void _input;
  return [];
}

const NEWS_LIST_SELECT =
  "id, slug, title, summary, cover_image_url, published_at";
const NEWS_ARTICLE_SELECT =
  "id, slug, title, summary, content, cover_image_url, published_at";

/**
 * Published academy news, newest first.
 * Never returns unpublished drafts.
 */
export async function getPublicNews(input: SlugOrContext): Promise<PublicNewsArticle[]> {
  const context = await ensureContext(input);
  if (!context) return [];
  if (isDemoAcademySlug(context.slug)) return DEMO_NEWS;
  const academyId = resolveAcademyId(context);
  if (!academyId) return [];

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("academy_news")
      .select(NEWS_LIST_SELECT)
      .eq("academy_id", academyId)
      .eq("published", true)
      .not("published_at", "is", null)
      .order("published_at", { ascending: false });

    if (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }

    return (data ?? [])
      .map((row) => serializePublicNewsArticle(row as never, { includeContent: false }))
      .filter((row): row is PublicNewsArticle => row !== null);
  } catch {
    return [];
  }
}

/**
 * Single published article by slug. Returns null when missing or unpublished.
 */
export async function getPublicArticle(
  input: SlugOrContext,
  articleSlug: string,
): Promise<PublicNewsArticle | null> {
  const context = await ensureContext(input);
  if (!context) return null;
  const slug = articleSlug.trim();
  if (!slug) return null;
  if (isDemoAcademySlug(context.slug)) {
    return DEMO_NEWS.find((article) => article.slug === slug) ?? null;
  }
  const academyId = resolveAcademyId(context);
  if (!academyId) return null;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("academy_news")
      .select(NEWS_ARTICLE_SELECT)
      .eq("academy_id", academyId)
      .eq("slug", slug)
      .eq("published", true)
      .not("published_at", "is", null)
      .maybeSingle();

    if (error) {
      if (isMissingTableError(error)) return null;
      throw error;
    }
    if (!data) return null;
    return serializePublicNewsArticle(data as never);
  } catch {
    return null;
  }
}

/**
 * Previous and next published articles relative to the current slug (by publish date).
 */
export async function getPublicArticleNeighbours(
  input: SlugOrContext,
  articleSlug: string,
): Promise<{ previous: PublicNewsArticle | null; next: PublicNewsArticle | null }> {
  const articles = await getPublicNews(input);
  const index = articles.findIndex((article) => article.slug === articleSlug);
  if (index < 0) {
    return { previous: null, next: null };
  }
  // Newest first: "next" = newer (lower index), "previous" = older (higher index)
  return {
    next: index > 0 ? articles[index - 1] ?? null : null,
    previous: index < articles.length - 1 ? articles[index + 1] ?? null : null,
  };
}

/**
 * Batch loader for homepage / future overview sections.
 * Resolves the academy once, then loads public collections in parallel.
 */
export async function getPublicAcademyWebsiteBundle(academySlug: string) {
  const context = await getPublicAcademyContext(academySlug);
  if (!context) {
    return null;
  }

  const [teams, fixtures, results, camps, training, coaches, videos, news] = await Promise.all([
    getPublicTeams(context),
    getPublicFixtures(context),
    getPublicResults(context),
    getPublicCamps(context),
    getPublicTraining(context),
    getPublicCoaches(context),
    getPublicVideos(context),
    getPublicNews(context),
  ]);

  return {
    context,
    academy: context.academy,
    teams,
    fixtures,
    results,
    camps,
    training,
    coaches,
    videos,
    news,
  };
}
