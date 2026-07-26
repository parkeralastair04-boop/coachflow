"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Loader2, Plus, Sparkles, Star } from "lucide-react";
import { FeaturePageHeader } from "@/components/feature-page-header";
import { FormErrorAlert } from "@/components/form-error-alert";
import { SetupRequiredPanel } from "@/components/setup-required-panel";
import {
  attachPlayersToClips,
  filterVideoAssets,
  filterVideoClips,
} from "@/lib/video-insights";
import {
  CLIP_CATEGORIES,
  CLIP_CATEGORY_LABELS,
  DEVELOPMENT_TAGS,
  formatClipTimestamp,
  getVideoPlaybackUrl,
  type ClipCategory,
  type DevelopmentTag,
  type VideoAssetRow,
  type VideoClipRow,
  type VideoClipWithPlayers,
} from "@/lib/video-types";
import { DEVELOPMENT_TAG_LABELS } from "@/lib/training-types";
import { createClient } from "@/lib/supabase";
import { getSetupRequiredMessage, isMissingTableError } from "@/lib/supabase-errors";
import { sanitizeDashboardSaveError } from "@/lib/user-facing-errors";
import { cn } from "@/lib/utils";

type View = "library" | "clips" | "builder";

type PlayerOption = { id: string; player_name: string };
type MatchOption = { id: string; opposition: string; kickoff_date: string };
type PlanOption = { id: string; title: string };
type DrillOption = { id: string; name: string };
type TeamOption = { id: string; team_name: string; age_group: string | null };
type SessionOption = { id: string; session_date: string; group_name: string | null };
type ReportOption = { id: string; player_id: string; created_at: string };

const inputClass =
  "border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2";

export function VideoAnalysisManager() {
  const [view, setView] = useState<View>("library");
  const [coachId, setCoachId] = useState<string | null>(null);
  const [assets, setAssets] = useState<VideoAssetRow[]>([]);
  const [clips, setClips] = useState<VideoClipWithPlayers[]>([]);
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [matches, setMatches] = useState<MatchOption[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [drills, setDrills] = useState<DrillOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [reports, setReports] = useState<ReportOption[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [setupTables, setSetupTables] = useState<string[]>([]);

  const [assetForm, setAssetForm] = useState({
    title: "",
    videoDate: new Date().toISOString().slice(0, 10),
    sourceUrl: "",
    durationSeconds: "",
    matchId: "",
    sessionId: "",
    trainingPlanId: "",
    teamId: "",
    tags: "",
    notes: "",
  });

  const [clipForm, setClipForm] = useState({
    title: "",
    startSeconds: "0",
    endSeconds: "",
    category: "other" as ClipCategory,
    description: "",
    coachingPoint: "",
    developmentTags: [] as DevelopmentTag[],
    playerIds: [] as string[],
    matchId: "",
    sessionId: "",
    trainingPlanId: "",
    drillId: "",
    reportId: "",
    teamTags: "",
    notes: "",
    parentVisible: false,
    parentComment: "",
    captionsText: "",
    transcriptText: "",
  });

  const filteredAssets = useMemo(
    () => filterVideoAssets(assets, query),
    [assets, query],
  );
  const filteredClips = useMemo(
    () => filterVideoClips(clips, query),
    [clips, query],
  );
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) ?? null;
  const selectedClip = clips.find((clip) => clip.id === selectedClipId) ?? null;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setCoachId(user.id);

      const [
        assetsRes,
        clipsRes,
        linksRes,
        playersRes,
        matchesRes,
        plansRes,
        drillsRes,
        teamsRes,
        sessionsRes,
        reportsRes,
      ] = await Promise.all([
        supabase.from("video_assets").select("*").eq("coach_id", user.id).order("created_at", { ascending: false }),
        supabase.from("video_clips").select("*").eq("coach_id", user.id).order("created_at", { ascending: false }),
        supabase.from("video_clip_players").select("clip_id, player_id"),
        supabase.from("players").select("id, player_name").eq("coach_id", user.id).order("player_name"),
        supabase.from("matches").select("id, opposition, kickoff_date").eq("coach_id", user.id).order("kickoff_date", { ascending: false }),
        supabase.from("training_plans").select("id, title").eq("coach_id", user.id).order("created_at", { ascending: false }),
        supabase.from("training_drills").select("id, name").eq("coach_id", user.id).order("name"),
        supabase.from("teams").select("id, team_name, age_group").eq("coach_id", user.id).order("team_name"),
        supabase.from("sessions").select("id, session_date, group_name").eq("coach_id", user.id).order("session_date", { ascending: false }).limit(100),
        supabase.from("progress_reports").select("id, player_id, created_at").eq("coach_id", user.id).order("created_at", { ascending: false }).limit(50),
      ]);

      if (assetsRes.error) {
        if (isMissingTableError(assetsRes.error)) {
          setSetupTables(["video_assets", "video_clips", "video_clip_players"]);
          return;
        }
        throw assetsRes.error;
      }
      if (clipsRes.error && isMissingTableError(clipsRes.error)) {
        setSetupTables(["video_clips", "video_clip_players"]);
        return;
      }

      setAssets((assetsRes.data ?? []) as VideoAssetRow[]);
      setClips(
        attachPlayersToClips(
          (clipsRes.data ?? []) as VideoClipRow[],
          (linksRes.data ?? []) as Array<{ clip_id: string; player_id: string }>,
        ),
      );
      setPlayers((playersRes.data ?? []) as PlayerOption[]);
      setMatches((matchesRes.data ?? []) as MatchOption[]);
      setPlans((plansRes.data ?? []) as PlanOption[]);
      setDrills((drillsRes.data ?? []) as DrillOption[]);
      setTeams((teamsRes.data ?? []) as TeamOption[]);
      setSessions((sessionsRes.data ?? []) as SessionOption[]);
      setReports((reportsRes.data ?? []) as ReportOption[]);
      setSetupTables([]);
    } catch (caughtError) {
      setError(sanitizeDashboardSaveError(caughtError, { logLabel: "video-load" }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadData();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadData]);

  async function handleAddAsset() {
    if (!coachId || !assetForm.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from("video_assets")
        .insert({
          coach_id: coachId,
          title: assetForm.title.trim(),
          video_date: assetForm.videoDate,
          source_url: assetForm.sourceUrl.trim() || null,
          duration_seconds: assetForm.durationSeconds ? Number(assetForm.durationSeconds) : null,
          match_id: assetForm.matchId || null,
          session_id: assetForm.sessionId || null,
          training_plan_id: assetForm.trainingPlanId || null,
          team_id: assetForm.teamId || null,
          tags: assetForm.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          notes: assetForm.notes.trim() || null,
        })
        .select("*")
        .single();
      if (insertError) throw insertError;
      setStatusMessage("Video added to library.");
      setAssetForm({
        title: "",
        videoDate: new Date().toISOString().slice(0, 10),
        sourceUrl: "",
        durationSeconds: "",
        matchId: "",
        sessionId: "",
        trainingPlanId: "",
        teamId: "",
        tags: "",
        notes: "",
      });
      if (data) {
        setSelectedAssetId((data as VideoAssetRow).id);
        setView("builder");
      }
      await loadData();
    } catch (caughtError) {
      setError(sanitizeDashboardSaveError(caughtError, { logLabel: "video-asset-create" }));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateClip() {
    if (!coachId || !clipForm.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const startSeconds = Math.max(0, Number(clipForm.startSeconds) || 0);
      const endSeconds = clipForm.endSeconds ? Math.max(startSeconds, Number(clipForm.endSeconds)) : null;
      const { data, error: insertError } = await supabase
        .from("video_clips")
        .insert({
          coach_id: coachId,
          video_asset_id: selectedAssetId,
          title: clipForm.title.trim(),
          start_seconds: startSeconds,
          end_seconds: endSeconds,
          category: clipForm.category,
          description: clipForm.description.trim() || null,
          coaching_point: clipForm.coachingPoint.trim() || null,
          development_tags: clipForm.developmentTags,
          match_id: clipForm.matchId || selectedAsset?.match_id || null,
          session_id: clipForm.sessionId || selectedAsset?.session_id || null,
          training_plan_id: clipForm.trainingPlanId || selectedAsset?.training_plan_id || null,
          drill_id: clipForm.drillId || null,
          report_id: clipForm.reportId || null,
          team_tags: clipForm.teamTags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          notes: clipForm.notes.trim() || null,
          parent_visible: clipForm.parentVisible,
          parent_comment: clipForm.parentComment.trim() || null,
          clip_data: {
            captionsText: clipForm.captionsText.trim() || null,
            transcriptText: clipForm.transcriptText.trim() || null,
          },
        })
        .select("*")
        .single();
      if (insertError) throw insertError;

      const clip = data as VideoClipWithPlayers;
      if (clipForm.playerIds.length > 0) {
        const { error: linkError } = await supabase.from("video_clip_players").insert(
          clipForm.playerIds.map((playerId) => ({
            clip_id: clip.id,
            player_id: playerId,
            role: "subject",
          })),
        );
        if (linkError) {
          await supabase.from("video_clips").delete().eq("id", clip.id);
          throw linkError;
        }
      }

      setStatusMessage("Clip created and linked.");
      setSelectedClipId(clip.id);
      setView("clips");
      setClipForm({
        title: "",
        startSeconds: "0",
        endSeconds: "",
        category: "other",
        description: "",
        coachingPoint: "",
        developmentTags: [],
        playerIds: [],
        matchId: "",
        sessionId: "",
        trainingPlanId: "",
        drillId: "",
        reportId: "",
        teamTags: "",
        notes: "",
        parentVisible: false,
        parentComment: "",
        captionsText: "",
        transcriptText: "",
      });
      await loadData();
    } catch (caughtError) {
      setError(sanitizeDashboardSaveError(caughtError, { logLabel: "video-clip-create" }));
    } finally {
      setSaving(false);
    }
  }

  async function toggleAssetFavourite(asset: VideoAssetRow) {
    const supabase = createClient();
    await supabase
      .from("video_assets")
      .update({ is_favourite: !asset.is_favourite })
      .eq("id", asset.id);
    await loadData();
  }

  async function archiveAsset(assetId: string) {
    const supabase = createClient();
    await supabase
      .from("video_assets")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", assetId);
    setStatusMessage("Video archived.");
    await loadData();
  }

  async function markClipReviewed(clipId: string) {
    const supabase = createClient();
    await supabase
      .from("video_clips")
      .update({ reviewed_at: new Date().toISOString() })
      .eq("id", clipId);
    setStatusMessage("Clip marked as reviewed.");
    await loadData();
  }

  async function toggleClipShare(clip: VideoClipWithPlayers) {
    const supabase = createClient();
    await supabase
      .from("video_clips")
      .update({ parent_visible: !clip.parent_visible })
      .eq("id", clip.id);
    setStatusMessage(clip.parent_visible ? "Clip hidden from parents." : "Clip shared with parents.");
    await loadData();
  }

  async function archiveClip(clipId: string) {
    const supabase = createClient();
    await supabase
      .from("video_clips")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", clipId);
    setStatusMessage("Clip archived.");
    await loadData();
  }

  async function generateAiSummary(clipId: string) {
    setAiLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/video/generate-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipId }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to generate summary.");
      setStatusMessage("AI clip summary generated.");
      await loadData();
    } catch (caughtError) {
      setError(sanitizeDashboardSaveError(caughtError, { logLabel: "video-ai-summary" }));
    } finally {
      setAiLoading(false);
    }
  }

  if (setupTables.length > 0) {
    return (
      <div className="page-content-enter space-y-8">
        <FeaturePageHeader
          featureKey="video"
          title="Video Analysis"
          subtitle="Upload, clip, and link match and training footage to player development."
        />
        <SetupRequiredPanel
          {...getSetupRequiredMessage(setupTables)}
          onRetry={() => void loadData()}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="text-muted size-8 animate-spin" aria-hidden />
        <span className="sr-only">Loading video analysis</span>
      </div>
    );
  }

  return (
    <div className="page-content-enter space-y-8">
      <FeaturePageHeader
        featureKey="video"
        title="Video Analysis"
        subtitle="Organise training and match clips, tag players, and share selected moments with parents."
      />

      {error ? <FormErrorAlert message={error} /> : null}
      {statusMessage ? (
        <p className="text-accent text-sm" role="status" aria-live="polite">
          {statusMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Video analysis views">
        {(
          [
            { id: "library" as const, label: "Video library" },
            { id: "builder" as const, label: "Clip builder" },
            { id: "clips" as const, label: "Clips" },
          ] as const
        ).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              view === id
                ? "bg-foreground text-background"
                : "border-border hover:bg-surface-hover border dark:hover:bg-white/[0.06]",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search videos and clips"
        aria-label="Search videos and clips"
        className={cn(inputClass, "max-w-xl")}
      />

      {view === "library" ? (
        <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6" aria-labelledby="library-heading">
          <h2 id="library-heading" className="text-lg font-semibold">
            Video library
          </h2>
          <p className="text-muted mt-1 text-sm">
            Add match or training videos by URL (YouTube, Vimeo, or direct file link).
          </p>

          <form
            className="mt-6 grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              void handleAddAsset();
            }}
          >
            <Field label="Title">
              <input
                className={inputClass}
                value={assetForm.title}
                onChange={(event) => setAssetForm((c) => ({ ...c, title: event.target.value }))}
                required
              />
            </Field>
            <Field label="Date">
              <input
                type="date"
                className={inputClass}
                value={assetForm.videoDate}
                onChange={(event) => setAssetForm((c) => ({ ...c, videoDate: event.target.value }))}
              />
            </Field>
            <Field label="Video URL">
              <input
                className={inputClass}
                value={assetForm.sourceUrl}
                onChange={(event) => setAssetForm((c) => ({ ...c, sourceUrl: event.target.value }))}
                placeholder="https://"
              />
            </Field>
            <Field label="Duration (seconds)">
              <input
                type="number"
                min="0"
                className={inputClass}
                value={assetForm.durationSeconds}
                onChange={(event) => setAssetForm((c) => ({ ...c, durationSeconds: event.target.value }))}
              />
            </Field>
            <Field label="Match">
              <select
                className={inputClass}
                value={assetForm.matchId}
                onChange={(event) => setAssetForm((c) => ({ ...c, matchId: event.target.value }))}
              >
                <option value="">No match linked</option>
                {matches.map((match) => (
                  <option key={match.id} value={match.id}>
                    {match.opposition} · {match.kickoff_date}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Training session">
              <select
                className={inputClass}
                value={assetForm.sessionId}
                onChange={(event) => setAssetForm((c) => ({ ...c, sessionId: event.target.value }))}
              >
                <option value="">No session linked</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.session_date}
                    {session.group_name ? ` · ${session.group_name}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Training plan">
              <select
                className={inputClass}
                value={assetForm.trainingPlanId}
                onChange={(event) => setAssetForm((c) => ({ ...c, trainingPlanId: event.target.value }))}
              >
                <option value="">No plan linked</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Team">
              <select
                className={inputClass}
                value={assetForm.teamId}
                onChange={(event) => setAssetForm((c) => ({ ...c, teamId: event.target.value }))}
              >
                <option value="">No team linked</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.team_name}
                    {team.age_group ? ` · ${team.age_group}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tags (comma separated)">
              <input
                className={inputClass}
                value={assetForm.tags}
                onChange={(event) => setAssetForm((c) => ({ ...c, tags: event.target.value }))}
              />
            </Field>
            <Field label="Notes">
              <input
                className={inputClass}
                value={assetForm.notes}
                onChange={(event) => setAssetForm((c) => ({ ...c, notes: event.target.value }))}
              />
            </Field>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-foreground text-background inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-medium"
              >
                {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                Add video
              </button>
            </div>
          </form>

          <ul className="mt-8 space-y-3" role="list" aria-label="Video library">
            {filteredAssets.map((asset) => {
              const playback = getVideoPlaybackUrl(asset);
              return (
                <li key={asset.id} className="rounded-xl bg-black/[0.02] px-4 py-3 dark:bg-white/[0.03]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{asset.title}</p>
                      <p className="text-muted text-sm">
                        {asset.video_date}
                        {asset.duration_seconds != null ? ` · ${formatClipTimestamp(asset.duration_seconds)}` : ""}
                        {asset.tags.length > 0 ? ` · ${asset.tags.join(", ")}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        aria-label={asset.is_favourite ? "Remove favourite" : "Mark favourite"}
                        onClick={() => void toggleAssetFavourite(asset)}
                        className="border-border inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border"
                      >
                        <Star className={cn("size-4", asset.is_favourite && "fill-current text-amber-500")} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAssetId(asset.id);
                          setView("builder");
                        }}
                        className="border-border inline-flex min-h-11 items-center rounded-full border px-4 text-sm"
                      >
                        Create clip
                      </button>
                      {playback ? (
                        <a
                          href={playback}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="border-border inline-flex min-h-11 items-center rounded-full border px-4 text-sm"
                        >
                          Open
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void archiveAsset(asset.id)}
                        className="border-border inline-flex min-h-11 items-center rounded-full border px-4 text-sm"
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {view === "builder" ? (
        <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6" aria-labelledby="builder-heading">
          <h2 id="builder-heading" className="text-lg font-semibold">
            Clip builder
          </h2>
          <p className="text-muted mt-1 text-sm">
            {selectedAsset
              ? `Creating clip from “${selectedAsset.title}”.`
              : "Select a video from the library, or create a standalone clip."}
          </p>

          <form
            className="mt-6 grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreateClip();
            }}
          >
            <Field label="Source video">
              <select
                className={inputClass}
                value={selectedAssetId ?? ""}
                onChange={(event) => setSelectedAssetId(event.target.value || null)}
              >
                <option value="">Standalone clip</option>
                {assets.filter((asset) => !asset.archived_at).map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Clip title">
              <input
                className={inputClass}
                value={clipForm.title}
                onChange={(event) => setClipForm((c) => ({ ...c, title: event.target.value }))}
                required
              />
            </Field>
            <Field label="Start (seconds)">
              <input
                type="number"
                min="0"
                className={inputClass}
                value={clipForm.startSeconds}
                onChange={(event) => setClipForm((c) => ({ ...c, startSeconds: event.target.value }))}
              />
            </Field>
            <Field label="End (seconds)">
              <input
                type="number"
                min="0"
                className={inputClass}
                value={clipForm.endSeconds}
                onChange={(event) => setClipForm((c) => ({ ...c, endSeconds: event.target.value }))}
              />
            </Field>
            <Field label="Category">
              <select
                className={inputClass}
                value={clipForm.category}
                onChange={(event) =>
                  setClipForm((c) => ({ ...c, category: event.target.value as ClipCategory }))
                }
              >
                {CLIP_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {CLIP_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Match moment">
              <select
                className={inputClass}
                value={clipForm.matchId}
                onChange={(event) => setClipForm((c) => ({ ...c, matchId: event.target.value }))}
              >
                <option value="">No match linked</option>
                {matches.map((match) => (
                  <option key={match.id} value={match.id}>
                    {match.opposition} · {match.kickoff_date}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Training plan">
              <select
                className={inputClass}
                value={clipForm.trainingPlanId}
                onChange={(event) => setClipForm((c) => ({ ...c, trainingPlanId: event.target.value }))}
              >
                <option value="">No plan linked</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Drill">
              <select
                className={inputClass}
                value={clipForm.drillId}
                onChange={(event) => setClipForm((c) => ({ ...c, drillId: event.target.value }))}
              >
                <option value="">No drill linked</option>
                {drills.map((drill) => (
                  <option key={drill.id} value={drill.id}>
                    {drill.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Linked report">
              <select
                className={inputClass}
                value={clipForm.reportId}
                onChange={(event) => setClipForm((c) => ({ ...c, reportId: event.target.value }))}
              >
                <option value="">No report linked</option>
                {reports.map((report) => (
                  <option key={report.id} value={report.id}>
                    Report · {new Date(report.created_at).toLocaleDateString("en-GB")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Team tags (comma separated)">
              <input
                className={inputClass}
                value={clipForm.teamTags}
                onChange={(event) => setClipForm((c) => ({ ...c, teamTags: event.target.value }))}
              />
            </Field>
            <div className="md:col-span-2">
              <p className="text-muted mb-2 text-sm">Players</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Player tags">
                {players.map((player) => {
                  const selected = clipForm.playerIds.includes(player.id);
                  return (
                    <button
                      key={player.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setClipForm((c) => ({
                          ...c,
                          playerIds: selected
                            ? c.playerIds.filter((id) => id !== player.id)
                            : [...c.playerIds, player.id],
                        }))
                      }
                      className={cn(
                        "inline-flex min-h-11 items-center rounded-full border px-3 text-sm",
                        selected ? "bg-foreground text-background" : "border-border",
                      )}
                    >
                      {player.player_name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="md:col-span-2">
              <p className="text-muted mb-2 text-sm">Development tags</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Development tags">
                {DEVELOPMENT_TAGS.map((tag) => {
                  const selected = clipForm.developmentTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setClipForm((c) => ({
                          ...c,
                          developmentTags: selected
                            ? c.developmentTags.filter((item) => item !== tag)
                            : [...c.developmentTags, tag],
                        }))
                      }
                      className={cn(
                        "inline-flex min-h-11 items-center rounded-full border px-3 text-sm",
                        selected ? "bg-foreground text-background" : "border-border",
                      )}
                    >
                      {DEVELOPMENT_TAG_LABELS[tag]}
                    </button>
                  );
                })}
              </div>
            </div>
            <Field label="Description">
              <textarea
                className={cn(inputClass, "min-h-24 py-2")}
                value={clipForm.description}
                onChange={(event) => setClipForm((c) => ({ ...c, description: event.target.value }))}
              />
            </Field>
            <Field label="Coaching point">
              <textarea
                className={cn(inputClass, "min-h-24 py-2")}
                value={clipForm.coachingPoint}
                onChange={(event) => setClipForm((c) => ({ ...c, coachingPoint: event.target.value }))}
              />
            </Field>
            <Field label="Captions / subtitles text">
              <textarea
                className={cn(inputClass, "min-h-24 py-2")}
                value={clipForm.captionsText}
                onChange={(event) => setClipForm((c) => ({ ...c, captionsText: event.target.value }))}
                placeholder="Optional captions for accessibility"
              />
            </Field>
            <Field label="Transcript">
              <textarea
                className={cn(inputClass, "min-h-24 py-2")}
                value={clipForm.transcriptText}
                onChange={(event) => setClipForm((c) => ({ ...c, transcriptText: event.target.value }))}
                placeholder="Optional transcript"
              />
            </Field>
            <label className="flex min-h-11 items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={clipForm.parentVisible}
                onChange={(event) => setClipForm((c) => ({ ...c, parentVisible: event.target.checked }))}
              />
              Share with parents (watch only — no download)
            </label>
            <Field label="Parent comment">
              <input
                className={inputClass}
                value={clipForm.parentComment}
                onChange={(event) => setClipForm((c) => ({ ...c, parentComment: event.target.value }))}
              />
            </Field>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-foreground text-background inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-medium"
              >
                {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                Save clip
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {view === "clips" ? (
        <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6" aria-labelledby="clips-heading">
          <h2 id="clips-heading" className="text-lg font-semibold">
            Clips
          </h2>
          <ul className="mt-6 space-y-4" role="list" aria-label="Video clips">
            {filteredClips.map((clip) => {
              const playerNames = clip.playerIds
                .map((id) => players.find((player) => player.id === id)?.player_name)
                .filter(Boolean);
              const selected = selectedClipId === clip.id;
              return (
                <li
                  key={clip.id}
                  className={cn(
                    "rounded-xl px-4 py-4",
                    selected ? "bg-accent/10" : "bg-surface-subtle",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button
                      type="button"
                      className="text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      onClick={() => setSelectedClipId(clip.id)}
                    >
                      <p className="font-medium">{clip.title}</p>
                      <p className="text-muted mt-1 text-sm">
                        {CLIP_CATEGORY_LABELS[clip.category]} · {formatClipTimestamp(clip.start_seconds)}
                        {clip.end_seconds != null ? `–${formatClipTimestamp(clip.end_seconds)}` : ""}
                        {playerNames.length > 0 ? ` · ${playerNames.join(", ")}` : ""}
                        {clip.parent_visible ? " · Shared" : ""}
                        {clip.reviewed_at ? " · Reviewed" : " · Needs review"}
                      </p>
                    </button>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void generateAiSummary(clip.id)}
                        disabled={aiLoading}
                        className="border-border inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm"
                      >
                        {aiLoading && selectedClipId === clip.id ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Sparkles className="size-4" aria-hidden />
                        )}
                        AI summary
                      </button>
                      {!clip.reviewed_at ? (
                        <button
                          type="button"
                          onClick={() => void markClipReviewed(clip.id)}
                          className="border-border inline-flex min-h-11 items-center rounded-full border px-4 text-sm"
                        >
                          Mark reviewed
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void toggleClipShare(clip)}
                        className="border-border inline-flex min-h-11 items-center rounded-full border px-4 text-sm"
                      >
                        {clip.parent_visible ? "Unshare" : "Share"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void archiveClip(clip.id)}
                        className="border-border inline-flex min-h-11 items-center rounded-full border px-4 text-sm"
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                  {selectedClip?.id === clip.id ? (
                    <div className="mt-4 space-y-2 text-sm">
                      {clip.description ? <p>{clip.description}</p> : null}
                      {clip.coaching_point ? (
                        <p>
                          <span className="font-medium">Coaching point:</span> {clip.coaching_point}
                        </p>
                      ) : null}
                      {clip.development_tags.length > 0 ? (
                        <p>
                          Themes:{" "}
                          {clip.development_tags
                            .map((tag) => DEVELOPMENT_TAG_LABELS[tag as DevelopmentTag] ?? tag)
                            .join(", ")}
                        </p>
                      ) : null}
                      {clip.ai_summary ? (
                        <pre className="text-muted whitespace-pre-wrap font-sans">{clip.ai_summary}</pre>
                      ) : null}
                      {clip.training_plan_id ? (
                        <Link href="/dashboard/training" className="text-accent underline-offset-4 hover:underline">
                          Open Training Planner
                        </Link>
                      ) : null}
                      {clip.match_id ? (
                        <Link
                          href={`/dashboard/matches?match=${clip.match_id}`}
                          className="text-accent ml-3 underline-offset-4 hover:underline"
                        >
                          Open Match Centre
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-muted mb-1 block">{label}</span>
      {children}
    </label>
  );
}
