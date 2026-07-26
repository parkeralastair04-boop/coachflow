import { NextResponse } from "next/server";
import { requireParentPortalAccess } from "@/lib/parent-portal-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CLIP_CATEGORY_LABELS,
  formatClipTimestamp,
  type ClipCategory,
  type VideoAssetRow,
  type VideoClipRow,
} from "@/lib/video-types";

export const runtime = "nodejs";

export type ParentVideoClipItem = {
  id: string;
  title: string;
  categoryLabel: string;
  parentComment: string | null;
  aiSummary: string | null;
  startLabel: string;
  endLabel: string | null;
  playerNames: string[];
  videoTitle: string | null;
  sourceUrl: string | null;
  reportId: string | null;
  createdAt: string;
};

export async function GET() {
  try {
    const access = await requireParentPortalAccess();
    if (!access.ok) return access.response;

    const admin = createAdminClient();
    const { data: players, error: playersError } = await admin
      .from("players")
      .select("id, player_name")
      .ilike("parent_email", access.parentEmail);

    if (playersError) {
      return NextResponse.json({ error: playersError.message }, { status: 500 });
    }

    const playerRows = players ?? [];
    const playerIds = playerRows.map((row) => row.id as string);
    if (playerIds.length === 0) {
      return NextResponse.json({ clips: [] as ParentVideoClipItem[] });
    }

    const { data: links, error: linksError } = await admin
      .from("video_clip_players")
      .select("clip_id, player_id")
      .in("player_id", playerIds);

    if (linksError) {
      return NextResponse.json({ error: linksError.message }, { status: 500 });
    }

    const clipIds = [...new Set((links ?? []).map((link) => link.clip_id as string))];
    if (clipIds.length === 0) {
      return NextResponse.json({ clips: [] as ParentVideoClipItem[] });
    }

    const { data: clips, error: clipsError } = await admin
      .from("video_clips")
      .select("*")
      .in("id", clipIds)
      .eq("parent_visible", true)
      .is("archived_at", null)
      .order("created_at", { ascending: false });

    if (clipsError) {
      return NextResponse.json({ error: clipsError.message }, { status: 500 });
    }

    const typedClips = (clips ?? []) as VideoClipRow[];
    const assetIds = typedClips
      .map((clip) => clip.video_asset_id)
      .filter((id): id is string => Boolean(id));

    const { data: assets } = assetIds.length
      ? await admin.from("video_assets").select("id, title, source_url, storage_path").in("id", assetIds)
      : { data: [] };

    const assetById = new Map(
      ((assets ?? []) as Array<Pick<VideoAssetRow, "id" | "title" | "source_url" | "storage_path">>).map(
        (asset) => [asset.id, asset],
      ),
    );

    const playerNameById = new Map(
      playerRows.map((player) => [player.id as string, player.player_name as string]),
    );
    const playersByClip = new Map<string, string[]>();
    for (const link of links ?? []) {
      const names = playersByClip.get(link.clip_id as string) ?? [];
      const name = playerNameById.get(link.player_id as string);
      if (name && !names.includes(name)) names.push(name);
      playersByClip.set(link.clip_id as string, names);
    }

    const payload: ParentVideoClipItem[] = typedClips.map((clip) => {
      const asset = clip.video_asset_id ? assetById.get(clip.video_asset_id) : null;
      return {
        id: clip.id,
        title: clip.title,
        categoryLabel: CLIP_CATEGORY_LABELS[clip.category as ClipCategory] ?? clip.category,
        parentComment: clip.parent_comment,
        aiSummary: clip.ai_summary,
        startLabel: formatClipTimestamp(clip.start_seconds),
        endLabel: clip.end_seconds != null ? formatClipTimestamp(clip.end_seconds) : null,
        playerNames: playersByClip.get(clip.id) ?? [],
        videoTitle: asset?.title ?? null,
        sourceUrl: asset?.source_url ?? asset?.storage_path ?? null,
        reportId: clip.report_id,
        createdAt: clip.created_at,
      };
    });

    return NextResponse.json({ clips: payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load shared clips.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
