import { DEVELOPMENT_TAGS, type DevelopmentTag } from "@/lib/training-types";

export { DEVELOPMENT_TAGS, type DevelopmentTag };

export const CLIP_CATEGORIES = [
  "goal",
  "assist",
  "card",
  "build_up",
  "defensive",
  "set_piece",
  "transition",
  "training",
  "other",
] as const;

export type ClipCategory = (typeof CLIP_CATEGORIES)[number];

export const CLIP_CATEGORY_LABELS: Record<ClipCategory, string> = {
  goal: "Goal",
  assist: "Assist",
  card: "Card",
  build_up: "Build-up play",
  defensive: "Defensive moment",
  set_piece: "Set piece",
  transition: "Transition",
  training: "Training",
  other: "Other",
};

export const CLIP_PLAYER_ROLES = ["subject", "mentioned"] as const;
export type ClipPlayerRole = (typeof CLIP_PLAYER_ROLES)[number];

export type VideoAssetRow = {
  id: string;
  coach_id: string;
  academy_id: string | null;
  title: string;
  video_date: string;
  source_url: string | null;
  storage_path: string | null;
  duration_seconds: number | null;
  match_id: string | null;
  session_id: string | null;
  training_plan_id: string | null;
  team_id: string | null;
  tags: string[];
  notes: string | null;
  is_favourite: boolean;
  archived_at: string | null;
  asset_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type VideoClipRow = {
  id: string;
  coach_id: string;
  academy_id: string | null;
  video_asset_id: string | null;
  title: string;
  start_seconds: number;
  end_seconds: number | null;
  category: ClipCategory;
  description: string | null;
  coaching_point: string | null;
  development_tags: string[];
  match_id: string | null;
  session_id: string | null;
  training_plan_id: string | null;
  drill_id: string | null;
  report_id: string | null;
  team_tags: string[];
  notes: string | null;
  is_favourite: boolean;
  reviewed_at: string | null;
  parent_visible: boolean;
  parent_comment: string | null;
  ai_summary: string | null;
  archived_at: string | null;
  clip_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type VideoClipPlayerRow = {
  id: string;
  clip_id: string;
  player_id: string;
  role: ClipPlayerRole;
  created_at: string;
};

export type VideoClipWithPlayers = VideoClipRow & {
  playerIds: string[];
};

export type AiClipSummary = {
  whatHappened: string;
  positiveActions: string;
  areasToImprove: string;
  suggestedCoachingPoint: string;
};

export function isClipCategory(value: string): value is ClipCategory {
  return (CLIP_CATEGORIES as readonly string[]).includes(value);
}

export function isDevelopmentTag(value: string): value is DevelopmentTag {
  return (DEVELOPMENT_TAGS as readonly string[]).includes(value);
}

export function formatClipTimestamp(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function parseClipDurationSeconds(clip: Pick<VideoClipRow, "start_seconds" | "end_seconds">): number | null {
  if (clip.end_seconds == null) return null;
  return Math.max(0, clip.end_seconds - clip.start_seconds);
}

export function getVideoPlaybackUrl(asset: Pick<VideoAssetRow, "source_url" | "storage_path">): string | null {
  const url = asset.source_url?.trim();
  if (url) return url;
  const path = asset.storage_path?.trim();
  return path || null;
}

export function parseAiClipSummary(raw: unknown): AiClipSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  return {
    whatHappened: typeof data.whatHappened === "string" ? data.whatHappened : "",
    positiveActions: typeof data.positiveActions === "string" ? data.positiveActions : "",
    areasToImprove: typeof data.areasToImprove === "string" ? data.areasToImprove : "",
    suggestedCoachingPoint:
      typeof data.suggestedCoachingPoint === "string" ? data.suggestedCoachingPoint : "",
  };
}

export function formatAiClipSummaryText(summary: AiClipSummary): string {
  return [
    `What happened: ${summary.whatHappened}`,
    `Positive actions: ${summary.positiveActions}`,
    `Areas to improve: ${summary.areasToImprove}`,
    `Suggested coaching point: ${summary.suggestedCoachingPoint}`,
  ]
    .filter((line) => !line.endsWith(": "))
    .join("\n\n");
}
