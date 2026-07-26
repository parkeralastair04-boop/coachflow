"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ClipboardList,
  Clock,
  FileText,
  Film,
  HeartPulse,
  Loader2,
  Mail,
} from "lucide-react";
import { PlayerAttendancePanel } from "@/components/attendance-display";
import { ReportViewModal, type ReportViewData } from "@/components/report-view-modal";
import {
  PLAYER_ATTENDANCE_HISTORY_SELECT,
  parsePlayerAttendanceHistory,
  type AttendanceHistoryRow,
  type PlayerAttendanceHistory,
} from "@/lib/attendance-history";
import { buildParentMailtoLink } from "@/lib/attendance-alerts";
import {
  buildPlayerTimeline,
  formatTimelineDate,
  getDevelopmentSummaryCopy,
  getTimelineAttendanceFallback,
  getTimelineAttendanceLabel,
  type PlayerTimelineItem,
  type SavedProgressReport,
} from "@/lib/player-timeline";
import { getReportExcerpt, getReportTrendCopy } from "@/lib/structured-report";
import type { PlayerPositionOption, PreferredFootOption } from "@/lib/player-profile";
import { getPlayerTeams, getTeamDisplayName, type TeamSummary } from "@/lib/team-management";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { isMissingTableError } from "@/lib/supabase-errors";
import {
  CLIP_CATEGORY_LABELS,
  type ClipCategory,
  type VideoClipRow,
} from "@/lib/video-types";

type PlayerDevelopmentSource = {
  id: string;
  player_name: string;
  preferred_foot: PreferredFootOption;
  primary_position: PlayerPositionOption | null;
  secondary_positions: PlayerPositionOption[];
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  team_players?: { team?: TeamSummary[] | TeamSummary | null }[] | null;
};

type PlayerDevelopmentPanelProps = {
  coachId: string;
  player: PlayerDevelopmentSource;
};

function TimelineIcon({ item }: { item: PlayerTimelineItem }) {
  if (item.type === "report") {
    return <FileText className="size-4 shrink-0" aria-hidden />;
  }
  if (item.type === "clip") {
    return <Film className="size-4 shrink-0" aria-hidden />;
  }
  if (item.status === "late") {
    return <Clock className="size-4 shrink-0" aria-hidden />;
  }
  if (item.status === "injured") {
    return <HeartPulse className="size-4 shrink-0" aria-hidden />;
  }
  return <AlertTriangle className="size-4 shrink-0" aria-hidden />;
}

function timelineTitle(item: PlayerTimelineItem): string {
  if (item.type === "report") return "Progress report created";
  if (item.type === "clip") return `Clip: ${item.title}`;
  return getTimelineAttendanceLabel(item.status);
}

function timelineBody(item: PlayerTimelineItem): string {
  if (item.type === "report") {
    return item.reportExcerpt || "Report saved.";
  }
  if (item.type === "clip") {
    return item.excerpt || item.categoryLabel;
  }
  return item.notes ?? getTimelineAttendanceFallback(item.status);
}

export function PlayerDevelopmentPanel({ coachId, player }: PlayerDevelopmentPanelProps) {
  const [attendanceHistory, setAttendanceHistory] = useState<PlayerAttendanceHistory | null>(null);
  const [savedReports, setSavedReports] = useState<SavedProgressReport[]>([]);
  const [timeline, setTimeline] = useState<PlayerTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState<ReportViewData | null>(null);
  const [academyName, setAcademyName] = useState("Awarix");

  const teams = useMemo(() => getPlayerTeams(player.team_players), [player.team_players]);
  const teamLabel =
    teams.length > 0 ? teams.map((team) => getTeamDisplayName(team)).join(", ") : "No team assigned";
  const positionLabel = player.primary_position ?? "Not set";
  const lastReportDate = savedReports[0]?.created_at ?? null;
  const previousReportDate = savedReports[1]?.created_at ?? null;
  const reportTrendCopy = getReportTrendCopy(savedReports.length);

  useEffect(() => {
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      void (async () => {
        setLoading(true);
        try {
          const supabase = createClient();
          const [{ data: attendanceData }, { data: reportsData }, { data: membership }, clipLinksRes] =
            await Promise.all([
            supabase
              .from("session_attendance")
              .select(PLAYER_ATTENDANCE_HISTORY_SELECT)
              .eq("coach_id", coachId)
              .eq("player_id", player.id)
              .order("recorded_at", { ascending: false }),
            supabase
              .from("progress_reports")
              .select("id, created_at, raw_notes, report")
              .eq("coach_id", coachId)
              .eq("player_id", player.id)
              .order("created_at", { ascending: false }),
            supabase
              .from("academy_members")
              .select("academy:academies(name)")
              .eq("user_id", coachId)
              .order("created_at", { ascending: true })
              .limit(1)
              .maybeSingle(),
            supabase
              .from("video_clip_players")
              .select("clip_id")
              .eq("player_id", player.id),
          ]);

          if (cancelled) return;

          const academy = membership?.academy as { name?: string } | { name?: string }[] | null;
          const resolvedAcademy = Array.isArray(academy) ? academy[0] : academy;
          setAcademyName(resolvedAcademy?.name?.trim() || "Awarix");

          const attendanceRows = (attendanceData ?? []) as AttendanceHistoryRow[];
          const reports = (reportsData ?? []) as SavedProgressReport[];

          let clipTimelineItems: Array<{
            id: string;
            created_at: string;
            title: string;
            categoryLabel: string;
            excerpt: string;
            parentVisible: boolean;
          }> = [];

          if (!clipLinksRes.error || !isMissingTableError(clipLinksRes.error)) {
            const clipIds = [...new Set((clipLinksRes.data ?? []).map((row) => row.clip_id as string))];
            if (clipIds.length > 0) {
              const { data: clipRows } = await supabase
                .from("video_clips")
                .select("id, created_at, title, category, description, coaching_point, parent_visible, archived_at")
                .in("id", clipIds)
                .is("archived_at", null)
                .order("created_at", { ascending: false });
              clipTimelineItems = ((clipRows ?? []) as VideoClipRow[]).map((clip) => ({
                id: clip.id,
                created_at: clip.created_at,
                title: clip.title,
                categoryLabel: CLIP_CATEGORY_LABELS[clip.category as ClipCategory] ?? clip.category,
                excerpt: clip.coaching_point || clip.description || clip.title,
                parentVisible: clip.parent_visible,
              }));
            }
          }

          setAttendanceHistory(parsePlayerAttendanceHistory(attendanceRows));
          setSavedReports(reports);
          setTimeline(
            buildPlayerTimeline({
              reports,
              attendanceRows,
              clips: clipTimelineItems,
            }),
          );
        } catch {
          if (cancelled) return;
          setAttendanceHistory(null);
          setSavedReports([]);
          setTimeline([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [coachId, player.id]);

  const summaryCopy = getDevelopmentSummaryCopy({
    attendanceRate: attendanceHistory?.rate ?? 0,
    reportCount: savedReports.length,
  });

  return (
    <div className="space-y-6">
      <section
        className="glass-panel interactive-surface rounded-2xl p-5 sm:p-6"
        aria-labelledby="player-development-summary"
      >
        <h2 id="player-development-summary" className="text-lg font-semibold tracking-tight">
          Development summary
        </h2>
        <p className="text-muted mt-1 text-sm" role="status" aria-live="polite">
          {summaryCopy}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
            <p className="text-muted text-xs">Attendance</p>
            <p className="mt-1 font-semibold">
              {attendanceHistory ? `${Math.round(attendanceHistory.rate)}%` : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
            <p className="text-muted text-xs">Reports created</p>
            <p className="mt-1 font-semibold">{savedReports.length}</p>
          </div>
          <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
            <p className="text-muted text-xs">Current team</p>
            <p className="mt-1 font-semibold">{teamLabel}</p>
          </div>
          <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
            <p className="text-muted text-xs">Primary position</p>
            <p className="mt-1 font-semibold">{positionLabel}</p>
          </div>
        </div>
        {lastReportDate ? (
          <p className="text-muted mt-3 text-sm">
            Last report: {formatTimelineDate(lastReportDate)}
            {previousReportDate
              ? ` · Previous report: ${formatTimelineDate(previousReportDate)}`
              : ""}
          </p>
        ) : null}
        <p className="text-muted mt-1 text-sm">{reportTrendCopy}</p>
      </section>

      <section aria-labelledby="player-quick-actions">
        <h2 id="player-quick-actions" className="sr-only">
          Player quick actions
        </h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/reports?player=${player.id}`}
            className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <FileText className="size-4" aria-hidden />
            Create report
          </Link>
          {player.parent_email ? (
            <a
              href={buildParentMailtoLink(player.parent_email, player.player_name)}
              className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
            >
              <Mail className="size-4" aria-hidden />
              Contact parent
            </a>
          ) : null}
          <Link
            href="/dashboard/registers"
            className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
          >
            <ClipboardList className="size-4" aria-hidden />
            Take register
          </Link>
          <Link
            href={`/dashboard/reports?player=${player.id}`}
            className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
          >
            <FileText className="size-4" aria-hidden />
            View reports
          </Link>
          <Link
            href="/dashboard/video"
            className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
          >
            <Film className="size-4" aria-hidden />
            Video clips
          </Link>
        </div>
      </section>

      <PlayerAttendancePanel
        playerName={player.player_name}
        history={attendanceHistory}
        loading={loading}
        parentName={player.parent_name}
        parentEmail={player.parent_email}
        parentPhone={player.parent_phone}
      />

      <section className="glass-panel interactive-surface rounded-2xl p-5 sm:p-6" aria-labelledby="player-reports-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="player-reports-heading" className="text-lg font-semibold tracking-tight">
              Progress reports
            </h2>
            <span className="bg-accent/10 text-accent ring-accent/20 mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1">
              {savedReports.length} report{savedReports.length === 1 ? "" : "s"}
            </span>
          </div>
          <Link
            href={`/dashboard/reports?player=${player.id}`}
            className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Create report
          </Link>
        </div>

        {loading ? (
          <p className="text-muted mt-4 flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading reports...
          </p>
        ) : null}

        {!loading && savedReports.length === 0 ? (
          <p className="text-muted mt-4 text-sm">No saved reports for this player yet.</p>
        ) : null}

        {!loading && savedReports.length > 0 ? (
          <ul className="mt-4 space-y-3" aria-label="Recent progress reports">
            {savedReports.slice(0, 3).map((saved) => (
              <li
                key={saved.id}
                className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]"
              >
                <p className="text-muted text-xs uppercase tracking-wide">
                  {formatTimelineDate(saved.created_at)}
                </p>
                <p className="mt-2 text-sm leading-relaxed">
                  {getReportExcerpt(saved.report, 120) || "Report saved."}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveReport(saved)}
                  className="text-accent focus-visible:ring-accent/40 mt-3 inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  View full report
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="glass-panel interactive-surface rounded-2xl p-5 sm:p-6" aria-labelledby="player-timeline-heading">
        <h2 id="player-timeline-heading" className="text-lg font-semibold tracking-tight">
          Development timeline
        </h2>
        <p className="text-muted mt-1 text-sm">Newest first</p>

        {loading ? (
          <p className="text-muted mt-4 flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading development history...
          </p>
        ) : null}

        {!loading && timeline.length === 0 ? (
          <p className="text-muted mt-4 text-sm">No development history yet.</p>
        ) : null}

        {!loading && timeline.length > 0 ? (
          <ol className="mt-4 space-y-3" role="list" aria-label="Development timeline">
            {timeline.map((item) => (
              <li
                key={`${item.type}-${item.id}`}
                role="listitem"
                className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "inline-flex size-9 shrink-0 items-center justify-center rounded-xl ring-1",
                      item.type === "report"
                        ? "bg-accent/10 text-accent ring-accent/20"
                        : item.type === "clip"
                          ? "bg-sky-500/10 text-sky-800 ring-sky-500/20 dark:text-sky-200"
                          : "bg-amber-500/10 text-amber-800 ring-amber-500/20 dark:text-amber-200",
                    )}
                  >
                    <TimelineIcon item={item} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{timelineTitle(item)}</p>
                    <p className="text-muted mt-1 text-sm">
                      {formatTimelineDate(item.created_at)}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed">{timelineBody(item)}</p>
                    {item.type === "report" ? (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveReport({
                            id: item.id,
                            created_at: item.created_at,
                            report: item.report,
                            raw_notes: item.raw_notes,
                          })
                        }
                        className="text-accent focus-visible:ring-accent/40 mt-3 inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        View full report
                      </button>
                    ) : null}
                    {item.type === "clip" ? (
                      <Link
                        href="/dashboard/video"
                        className="text-accent focus-visible:ring-accent/40 mt-3 inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        Open Video Analysis
                      </Link>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </section>

      <ReportViewModal
        open={activeReport !== null}
        onClose={() => setActiveReport(null)}
        report={activeReport}
        playerId={player.id}
        playerName={player.player_name}
        preferredFoot={player.preferred_foot}
        primaryPosition={player.primary_position}
        secondaryPositions={player.secondary_positions}
        teams={teams}
        academyName={academyName}
      />
    </div>
  );
}
