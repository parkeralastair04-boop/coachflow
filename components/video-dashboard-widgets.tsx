"use client";

import { useCallback, useEffect, useState } from "react";
import { Clapperboard, Loader2 } from "lucide-react";
import {
  DashboardWidgetPanel,
  DashboardWidgetStat,
} from "@/components/dashboard/dashboard-widget-panel";
import { buildVideoDashboardSnapshot } from "@/lib/video-insights";
import type { VideoAssetRow, VideoClipRow } from "@/lib/video-types";
import { createClient } from "@/lib/supabase";
import { isMissingTableError } from "@/lib/supabase-errors";

export function VideoDashboardWidgets() {
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<ReturnType<typeof buildVideoDashboardSnapshot> | null>(
    null,
  );

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [assetsRes, clipsRes] = await Promise.all([
        supabase.from("video_assets").select("*").eq("coach_id", user.id),
        supabase.from("video_clips").select("*").eq("coach_id", user.id),
      ]);

      if (assetsRes.error) {
        if (isMissingTableError(assetsRes.error)) return;
        throw assetsRes.error;
      }

      setSnapshot(
        buildVideoDashboardSnapshot({
          assets: (assetsRes.data ?? []) as VideoAssetRow[],
          clips: (clipsRes.data ?? []) as VideoClipRow[],
        }),
      );
    } catch {
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadSnapshot();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadSnapshot]);

  if (loading) {
    return (
      <DashboardWidgetPanel
        id="video-widgets"
        title="Video Analysis"
        description="Recent uploads, unreviewed clips, and parent shares."
        icon={Clapperboard}
        href="/dashboard/video"
        linkLabel="Open Video Analysis"
      >
        <p className="text-muted flex items-center gap-2 text-sm" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading video widgets...
        </p>
      </DashboardWidgetPanel>
    );
  }

  if (!snapshot) return null;
  if (
    snapshot.recentUploads.length === 0 &&
    snapshot.unreviewedClips === 0 &&
    snapshot.sharedClips === 0
  ) {
    return null;
  }

  return (
    <DashboardWidgetPanel
      id="video-widgets"
      title="Video Analysis"
      description="Recent uploads, unreviewed clips, and parent shares."
      icon={Clapperboard}
      href="/dashboard/video"
      linkLabel="Open Video Analysis"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <DashboardWidgetStat
          label="Recent uploads"
          value={
            snapshot.recentUploads.length > 0
              ? snapshot.recentUploads.map((asset) => asset.title).join(", ")
              : "None yet"
          }
        />
        <DashboardWidgetStat label="Unreviewed clips" value={String(snapshot.unreviewedClips)} />
        <DashboardWidgetStat label="Shared clips" value={String(snapshot.sharedClips)} />
        <DashboardWidgetStat
          label="Clips needing review"
          value={String(snapshot.playerClipsNeedingReview)}
        />
      </div>
    </DashboardWidgetPanel>
  );
}
