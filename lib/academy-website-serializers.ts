import { getTeamDisplayName } from "@/lib/team-management";
import { parseMatchData, getMatchTitle, formatMatchKickoff } from "@/lib/match-types";
import { parseCampPrice } from "@/lib/camp-insights";
import {
  DEVELOPMENT_TAG_LABELS,
  DIFFICULTY_LABELS,
  isDevelopmentTag,
  isTrainingDifficulty,
} from "@/lib/training-types";
import { CLIP_CATEGORY_LABELS, type ClipCategory } from "@/lib/video-types";
import { ACADEMY_SUPPORT_PHONE_ENABLED } from "@/lib/academy-shared";
import type { PublicPortal } from "@/lib/public-booking";
import type {
  PublicAcademy,
  PublicCamp,
  PublicCoach,
  PublicFixture,
  PublicNewsArticle,
  PublicResult,
  PublicTeam,
  PublicTraining,
  PublicVideo,
} from "@/lib/academy-website-types";

type TeamSource = {
  id: string;
  team_name: string;
  age_group: string | null;
  team_color: string | null;
};

type MatchSource = {
  id: string;
  team_id: string;
  opposition: string;
  competition_type: string;
  competition_name: string | null;
  venue: string | null;
  is_home: boolean;
  kickoff_date: string;
  kickoff_time: string | null;
  pitch: string | null;
  status: string;
  match_data?: unknown;
  team?: TeamSource | TeamSource[] | null;
};

type CampSource = {
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
  capacity?: number | null;
  remaining?: number | null;
};

type CoachSource = {
  slug: string | null;
  display_name: string;
  logo_url: string | null;
  booking_enabled: boolean;
  role?: string | null;
  biography?: string | null;
};

type TrainingSource = {
  id: string;
  title: string;
  age_group: string | null;
  theme: string | null;
  duration_minutes: number | null;
  difficulty: string | null;
  objectives: string | null;
  equipment?: string[] | null;
  development_focus?: string[] | null;
};

type VideoSource = {
  id: string;
  title: string;
  category?: string | null;
  description?: string | null;
  source_url?: string | null;
  thumbnail_url?: string | null;
  duration_seconds?: number | null;
  development_tags?: string[] | null;
  created_at: string;
};

type NewsSource = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content?: string | null;
  cover_image_url?: string | null;
  published_at: string;
};

function unwrapTeam(team: MatchSource["team"]): TeamSource | null {
  if (!team) return null;
  return Array.isArray(team) ? (team[0] ?? null) : team;
}

function formatCampDateLabel(startDate: string, endDate: string): string {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return startDate === endDate ? startDate : `${startDate} – ${endDate}`;
  }
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  if (startDate === endDate) return formatter.format(start);
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

function formatScoreLabel(
  isHome: boolean,
  homeScore: number | null,
  awayScore: number | null,
): string | null {
  if (homeScore == null || awayScore == null) return null;
  return isHome ? `${homeScore}–${awayScore}` : `${awayScore}–${homeScore}`;
}

export function serializePublicAcademy(
  portal: PublicPortal,
  slug: string,
  extras: { description?: string | null; address?: string | null } = {},
): PublicAcademy {
  return {
    id: portal.academy_id ?? "",
    slug,
    name: portal.display_name,
    logoUrl: portal.logo_url,
    primaryColor: portal.primary_color,
    secondaryColor: portal.secondary_color,
    supportEmail: portal.support_email?.trim() || null,
    supportPhone: ACADEMY_SUPPORT_PHONE_ENABLED
      ? portal.support_phone?.trim() || null
      : null,
    bookingEnabled: portal.booking_enabled,
    description: extras.description?.trim() || null,
    address: extras.address?.trim() || null,
  };
}

export function serializePublicTeam(row: TeamSource): PublicTeam {
  const ageGroup = row.age_group?.trim() || null;
  return {
    id: row.id,
    name: row.team_name,
    ageGroup,
    colour: row.team_color,
    displayName: getTeamDisplayName({
      team_name: row.team_name,
      age_group: row.age_group,
    }),
    summary: ageGroup
      ? `${row.team_name} for the ${ageGroup} age group.`
      : `${row.team_name} training squad.`,
  };
}

export function serializePublicFixture(row: MatchSource): PublicFixture | null {
  const team = unwrapTeam(row.team);
  if (!team) return null;
  const title = getMatchTitle(
    { is_home: row.is_home, opposition: row.opposition },
    team.team_name,
  );
  return {
    id: row.id,
    teamId: row.team_id,
    teamName: team.team_name,
    opposition: row.opposition,
    competitionType: row.competition_type,
    competitionName: row.competition_name,
    venue: row.venue,
    isHome: row.is_home,
    kickoffDate: row.kickoff_date,
    kickoffTime: row.kickoff_time,
    pitch: row.pitch,
    status: row.status,
    title,
  };
}

export function serializePublicResult(row: MatchSource): PublicResult | null {
  const team = unwrapTeam(row.team);
  if (!team) return null;
  const parsed = parseMatchData(row.match_data);
  const homeScore = parsed.result?.homeScore ?? null;
  const awayScore = parsed.result?.awayScore ?? null;
  // Intentionally omit scorers, playerOfTheMatchId, coachNotes, events.
  return {
    id: row.id,
    teamId: row.team_id,
    teamName: team.team_name,
    opposition: row.opposition,
    competitionType: row.competition_type,
    competitionName: row.competition_name ?? parsed.result?.competitionName ?? null,
    venue: row.venue ?? parsed.result?.venue ?? null,
    isHome: row.is_home,
    kickoffDate: row.kickoff_date,
    kickoffTime: row.kickoff_time,
    status: row.status,
    title: getMatchTitle(
      { is_home: row.is_home, opposition: row.opposition },
      team.team_name,
    ),
    homeScore,
    awayScore,
    scoreLabel: formatScoreLabel(row.is_home, homeScore, awayScore),
  };
}

export function serializePublicCamp(row: CampSource): PublicCamp {
  const ageGroup = row.age_group?.trim() || null;
  const location = row.location?.trim() || null;
  const description = row.description?.trim() || null;
  const summaryParts = [
    ageGroup ? `${ageGroup} age group` : null,
    location ? `at ${location}` : null,
  ].filter(Boolean);

  return {
    id: row.id,
    name: row.name,
    description,
    startDate: row.start_date,
    endDate: row.end_date,
    startTime: row.start_time,
    endTime: row.end_time,
    ageGroup,
    price: parseCampPrice(row.price),
    location,
    dateLabel: formatCampDateLabel(row.start_date, row.end_date),
    remainingSpaces:
      typeof row.remaining === "number" && Number.isFinite(row.remaining)
        ? Math.max(0, row.remaining)
        : null,
    summary:
      description ||
      (summaryParts.length > 0
        ? `${row.name} · ${summaryParts.join(" · ")}.`
        : `${row.name} holiday camp.`),
  };
}

export function serializePublicCoach(row: CoachSource): PublicCoach {
  const slug = row.slug?.trim() || null;
  return {
    id: slug ?? row.display_name,
    displayName: row.display_name,
    logoUrl: row.logo_url,
    bookingEnabled: row.booking_enabled,
    profileSlug: slug,
    role: row.role?.trim() || null,
    biography: row.biography?.trim() || null,
  };
}

export function serializePublicTraining(row: TrainingSource): PublicTraining {
  const equipment = (row.equipment ?? [])
    .map((item) => item.trim())
    .filter(Boolean);
  const developmentFocus = (row.development_focus ?? [])
    .filter(isDevelopmentTag)
    .map((tag) => DEVELOPMENT_TAG_LABELS[tag]);
  const difficulty = row.difficulty?.trim() || null;

  return {
    id: row.id,
    title: row.title,
    ageGroup: row.age_group?.trim() || null,
    theme: row.theme?.trim() || null,
    durationMinutes: row.duration_minutes,
    difficulty: difficulty
      ? isTrainingDifficulty(difficulty)
        ? DIFFICULTY_LABELS[difficulty]
        : difficulty
      : null,
    equipmentSummary: equipment.length > 0 ? equipment.join(", ") : null,
    developmentFocus,
    summary: row.objectives?.trim() || null,
  };
}

export function serializePublicVideo(row: VideoSource): PublicVideo {
  const category = row.category;
  const developmentFocus = (row.development_tags ?? [])
    .filter(isDevelopmentTag)
    .map((tag) => DEVELOPMENT_TAG_LABELS[tag]);

  return {
    id: row.id,
    title: row.title,
    categoryLabel:
      category && category in CLIP_CATEGORY_LABELS
        ? CLIP_CATEGORY_LABELS[category as ClipCategory]
        : category ?? null,
    summary: row.description?.trim() || null,
    thumbnailUrl: row.thumbnail_url?.trim() || null,
    sourceUrl: row.source_url?.trim() || null,
    durationSeconds: row.duration_seconds ?? null,
    developmentFocus,
    publishedAt: row.created_at,
  };
}

export function serializePublicNewsArticle(
  row: NewsSource,
  options?: { includeContent?: boolean },
): PublicNewsArticle | null {
  const publishedAt = row.published_at?.trim();
  const title = row.title?.trim();
  const slug = row.slug?.trim();
  if (!publishedAt || !title || !slug) return null;

  return {
    id: row.id,
    slug,
    title,
    summary: row.summary?.trim() || "",
    content: options?.includeContent === false ? "" : row.content?.trim() || "",
    coverImageUrl: row.cover_image_url?.trim() || null,
    publishedAt,
  };
}

export function formatPublicKickoffLabel(date: string, time: string | null): string {
  return formatMatchKickoff(date, time);
}
