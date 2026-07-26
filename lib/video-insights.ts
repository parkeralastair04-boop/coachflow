import {
  CLIP_CATEGORY_LABELS,
  type ClipCategory,
  type VideoAssetRow,
  type VideoClipRow,
  type VideoClipWithPlayers,
} from "@/lib/video-types";
import { DEVELOPMENT_TAG_LABELS, type DevelopmentTag } from "@/lib/training-types";

export type VideoDashboardSnapshot = {
  recentUploads: VideoAssetRow[];
  unreviewedClips: number;
  sharedClips: number;
  playerClipsNeedingReview: number;
};

export type VideoAnalyticsSummary = {
  mostClippedPlayers: Array<{ playerId: string; playerName: string; count: number }>;
  developmentThemes: Array<{ tag: string; label: string; count: number }>;
  trainingClips: number;
  matchClips: number;
  sharedClips: number;
  reviewCompletionRate: number;
  totalClips: number;
  totalAssets: number;
};

export function buildVideoDashboardSnapshot(args: {
  assets: VideoAssetRow[];
  clips: VideoClipRow[];
}): VideoDashboardSnapshot {
  const activeAssets = args.assets.filter((asset) => !asset.archived_at);
  const activeClips = args.clips.filter((clip) => !clip.archived_at);

  return {
    recentUploads: [...activeAssets]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 3),
    unreviewedClips: activeClips.filter((clip) => !clip.reviewed_at).length,
    sharedClips: activeClips.filter((clip) => clip.parent_visible).length,
    playerClipsNeedingReview: activeClips.filter(
      (clip) => !clip.reviewed_at && (clip.description || clip.coaching_point),
    ).length,
  };
}

export function buildVideoAnalyticsSummary(args: {
  assets: VideoAssetRow[];
  clips: VideoClipWithPlayers[];
  players: Array<{ id: string; player_name: string }>;
}): VideoAnalyticsSummary {
  const activeAssets = args.assets.filter((asset) => !asset.archived_at);
  const activeClips = args.clips.filter((clip) => !clip.archived_at);

  const playerCounts = new Map<string, number>();
  for (const clip of activeClips) {
    for (const playerId of clip.playerIds) {
      playerCounts.set(playerId, (playerCounts.get(playerId) ?? 0) + 1);
    }
  }

  const mostClippedPlayers = [...playerCounts.entries()]
    .map(([playerId, count]) => ({
      playerId,
      playerName: args.players.find((player) => player.id === playerId)?.player_name ?? "Player",
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const themeCounts = new Map<string, number>();
  for (const clip of activeClips) {
    for (const tag of clip.development_tags) {
      themeCounts.set(tag, (themeCounts.get(tag) ?? 0) + 1);
    }
  }

  const developmentThemes = [...themeCounts.entries()]
    .map(([tag, count]) => ({
      tag,
      label: DEVELOPMENT_TAG_LABELS[tag as DevelopmentTag] ?? tag,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const reviewed = activeClips.filter((clip) => clip.reviewed_at).length;

  return {
    mostClippedPlayers,
    developmentThemes,
    trainingClips: activeClips.filter(
      (clip) => clip.category === "training" || Boolean(clip.training_plan_id) || Boolean(clip.drill_id),
    ).length,
    matchClips: activeClips.filter((clip) => Boolean(clip.match_id) || isMatchCategory(clip.category)).length,
    sharedClips: activeClips.filter((clip) => clip.parent_visible).length,
    reviewCompletionRate: activeClips.length > 0 ? Math.round((reviewed / activeClips.length) * 100) : 0,
    totalClips: activeClips.length,
    totalAssets: activeAssets.length,
  };
}

function isMatchCategory(category: ClipCategory): boolean {
  return category !== "training" && category !== "other";
}

export function filterVideoAssets(
  assets: VideoAssetRow[],
  query: string,
  opts?: { favouritesOnly?: boolean; includeArchived?: boolean },
): VideoAssetRow[] {
  const normalised = query.trim().toLowerCase();
  return assets.filter((asset) => {
    if (!opts?.includeArchived && asset.archived_at) return false;
    if (opts?.favouritesOnly && !asset.is_favourite) return false;
    if (!normalised) return true;
    return (
      asset.title.toLowerCase().includes(normalised) ||
      asset.tags.some((tag) => tag.toLowerCase().includes(normalised)) ||
      (asset.notes ?? "").toLowerCase().includes(normalised)
    );
  });
}

export function filterVideoClips(
  clips: VideoClipWithPlayers[],
  query: string,
  opts?: { favouritesOnly?: boolean; unreviewedOnly?: boolean; includeArchived?: boolean },
): VideoClipWithPlayers[] {
  const normalised = query.trim().toLowerCase();
  return clips.filter((clip) => {
    if (!opts?.includeArchived && clip.archived_at) return false;
    if (opts?.favouritesOnly && !clip.is_favourite) return false;
    if (opts?.unreviewedOnly && clip.reviewed_at) return false;
    if (!normalised) return true;
    return (
      clip.title.toLowerCase().includes(normalised) ||
      CLIP_CATEGORY_LABELS[clip.category].toLowerCase().includes(normalised) ||
      (clip.description ?? "").toLowerCase().includes(normalised) ||
      clip.development_tags.some((tag) => tag.toLowerCase().includes(normalised))
    );
  });
}

export function attachPlayersToClips(
  clips: VideoClipRow[],
  links: Array<{ clip_id: string; player_id: string }>,
): VideoClipWithPlayers[] {
  const byClip = new Map<string, string[]>();
  for (const link of links) {
    const current = byClip.get(link.clip_id) ?? [];
    current.push(link.player_id);
    byClip.set(link.clip_id, current);
  }
  return clips.map((clip) => ({
    ...clip,
    playerIds: byClip.get(clip.id) ?? [],
  }));
}
