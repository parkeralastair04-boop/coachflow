"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Copy, FileDown, Loader2, Mail, Sparkles, Trash2, UserRound } from "lucide-react";
import { FeaturePageHeader } from "@/components/feature-page-header";
import { FormErrorAlert } from "@/components/form-error-alert";
import { EmptyState } from "@/components/empty-state";
import { footballEmptyPreset } from "@/lib/football-identity";
import { CoachSetupGuidance } from "@/components/coach-setup-guidance";
import { ReportsAttendanceBlock } from "@/components/attendance-display";
import {
  EMPTY_GUIDED_REPORT_NOTES,
  GuidedReportNotesFields,
} from "@/components/guided-report-notes-fields";
import { ReportViewModal } from "@/components/report-view-modal";
import { StructuredReportDisplay } from "@/components/structured-report-display";
import { getAttendanceLabel } from "@/lib/attendance";
import {
  PLAYER_ATTENDANCE_HISTORY_SELECT,
  parsePlayerAttendanceHistory,
  type AttendanceHistoryRow,
  type PlayerAttendanceHistory,
} from "@/lib/attendance-history";
import {
  guidedNotesToPlainText,
  hasGuidedNoteContent,
  parseGuidedNotes,
  type GuidedReportNotes,
} from "@/lib/guided-report-notes";
import { generateReportPdf, getReportPdfFilename } from "@/lib/report-pdf";
import {
  DEFAULT_REPORT_TEMPLATE,
  REPORT_TEMPLATE_OPTIONS,
  type ReportTemplateId,
} from "@/lib/report-templates";
import {
  formatReportPlainText,
  getReportExcerpt,
  parseReportContent,
  serializeStructuredReport,
  type StructuredProgressReport,
} from "@/lib/structured-report";
import {
  getPlayerProfileSummary,
  normalizeSecondaryPositions,
  type PlayerPositionOption,
  type PreferredFootOption,
} from "@/lib/player-profile";
import { getPlayerTeams, getTeamDisplayName, type TeamSummary } from "@/lib/team-management";
import { createClient } from "@/lib/supabase";
import { sanitizeDashboardSaveError } from "@/lib/user-facing-errors";
import { PanelSkeleton } from "@/components/branded-loading";

type PlayerOption = {
  id: string;
  player_name: string;
  preferred_foot: PreferredFootOption;
  primary_position: PlayerPositionOption | null;
  secondary_positions: PlayerPositionOption[];
  team_players?: { team?: TeamSummary[] | TeamSummary | null }[] | null;
};

type SavedReport = {
  id: string;
  coach_id: string;
  player_id: string;
  raw_notes: string;
  report: string;
  created_at: string;
  parent_visible?: boolean;
};

export function ReportsManager() {
  const searchParams = useSearchParams();
  const focusPlayerId = searchParams.get("player")?.trim() ?? null;

  const [coachId, setCoachId] = useState("");
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [guidedNotes, setGuidedNotes] = useState<GuidedReportNotes>(
    EMPTY_GUIDED_REPORT_NOTES,
  );
  const [report, setReport] = useState("");
  const [reportTemplate, setReportTemplate] = useState<ReportTemplateId>(
    DEFAULT_REPORT_TEMPLATE,
  );
  const [academyName, setAcademyName] = useState("Awarix");
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [loadingReports, setLoadingReports] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [attendanceSummary, setAttendanceSummary] =
    useState<PlayerAttendanceHistory | null>(null);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    player?: string;
    notes?: string;
  }>({});
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [viewingReport, setViewingReport] = useState<SavedReport | null>(null);

  const selectedPlayer = useMemo(
    () => players.find((player) => player.id === selectedPlayerId) ?? null,
    [players, selectedPlayerId],
  );

  async function loadSavedReports(userCoachId: string, playerId: string) {
    if (!playerId) {
      setSavedReports([]);
      return;
    }

    setLoadingReports(true);
    setReportsError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("progress_reports")
        .select("id, coach_id, player_id, raw_notes, report, created_at, parent_visible")
        .eq("coach_id", userCoachId)
        .eq("player_id", playerId)
        .order("created_at", { ascending: false });

      if (error) {
        setReportsError(sanitizeDashboardSaveError(error, { logLabel: "reports-load" }));
        return;
      }

      setSavedReports((data ?? []) as SavedReport[]);
    } catch (caughtError: unknown) {
      setReportsError(sanitizeDashboardSaveError(caughtError, { logLabel: "reports-load" }));
    } finally {
      setLoadingReports(false);
    }
  }

  async function loadAttendanceSummary(userCoachId: string, playerId: string) {
    if (!playerId) {
      setAttendanceSummary(null);
      return;
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("session_attendance")
        .select(PLAYER_ATTENDANCE_HISTORY_SELECT)
        .eq("coach_id", userCoachId)
        .eq("player_id", playerId)
        .order("recorded_at", { ascending: false });

      if (error) {
        setAttendanceSummary(null);
        return;
      }

      setAttendanceSummary(
        parsePlayerAttendanceHistory((data ?? []) as AttendanceHistoryRow[]),
      );
    } catch {
      setAttendanceSummary(null);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadPlayers() {
      setLoadingPlayers(true);
      setFormError(null);
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (cancelled) return;
        if (userError) {
          setFormError(sanitizeDashboardSaveError(userError, { logLabel: "reports-auth" }));
          return;
        }
        if (!user) {
          setFormError("You must be signed in to generate reports.");
          return;
        }
        setCoachId(user.id);

        const { data: membership } = await supabase
          .from("academy_members")
          .select("academy:academies(name)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!cancelled) {
          const academy = membership?.academy as { name?: string } | { name?: string }[] | null;
          const resolvedAcademy = Array.isArray(academy) ? academy[0] : academy;
          setAcademyName(resolvedAcademy?.name?.trim() || "Awarix");
        }

        const { data, error: playersError } = await supabase
          .from("players")
          .select(
            "id, player_name, preferred_foot, primary_position, secondary_positions, team_players(team:teams(id, team_name, age_group, team_color))",
          )
          .eq("coach_id", user.id)
          .order("player_name", { ascending: true });

        if (cancelled) return;
        if (playersError) {
          setFormError(sanitizeDashboardSaveError(playersError, { logLabel: "reports-load" }));
          return;
        }

        const safePlayers = ((data ?? []) as PlayerOption[]).map((player) => ({
          ...player,
          preferred_foot: player.preferred_foot ?? "Unknown",
          primary_position: player.primary_position ?? null,
          secondary_positions: normalizeSecondaryPositions(player.secondary_positions),
          team_players: player.team_players ?? [],
        }));
        setPlayers(safePlayers);
        if (safePlayers.length > 0) {
          const initialPlayerId =
            focusPlayerId && safePlayers.some((player) => player.id === focusPlayerId)
              ? focusPlayerId
              : safePlayers[0].id;
          setSelectedPlayerId(initialPlayerId);
          await Promise.all([
            loadSavedReports(user.id, initialPlayerId),
            loadAttendanceSummary(user.id, initialPlayerId),
          ]);
        }
      } catch (caughtError: unknown) {
        if (!cancelled) setFormError(sanitizeDashboardSaveError(caughtError, { logLabel: "reports-load" }));
      } finally {
        if (!cancelled) setLoadingPlayers(false);
      }
    }

    void loadPlayers();
    return () => {
      cancelled = true;
    };
  }, [focusPlayerId]);

  async function handlePlayerChange(playerId: string) {
    setSelectedPlayerId(playerId);
    setGuidedNotes(EMPTY_GUIDED_REPORT_NOTES);
    setReport("");
    setSendSuccess(null);
    setSendError(null);
    if (!coachId) return;
    await Promise.all([
      loadSavedReports(coachId, playerId),
      loadAttendanceSummary(coachId, playerId),
    ]);
  }

  function handleReuseNotes(saved: SavedReport) {
    setGuidedNotes(parseGuidedNotes(saved.raw_notes));
    setFieldErrors((current) => ({ ...current, notes: undefined }));
    document.getElementById("generate-report-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function handleGenerateReport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setCopied(false);
    setSendSuccess(null);
    setSendError(null);
    setPdfError(null);

    const nextFieldErrors: { player?: string; notes?: string } = {};
    if (!selectedPlayer) {
      nextFieldErrors.player = "Please select a player.";
    }
    const notesText = guidedNotesToPlainText(guidedNotes);
    if (!hasGuidedNoteContent(guidedNotes)) {
      nextFieldErrors.notes = "Please add coaching notes before generating a report.";
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setFieldErrors({});
    setGenerating(true);
    try {
      const player = selectedPlayer;
      if (!player) return;

      const previousReport = savedReports[0];
      const response = await fetch("/api/generate-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerName: player.player_name,
          template: reportTemplate,
          playerProfile: {
            preferredFoot: player.preferred_foot,
            primaryPosition: player.primary_position,
            secondaryPositions: player.secondary_positions,
            teamNames: getPlayerTeams(player.team_players).map((team) =>
              getTeamDisplayName(team),
            ),
            attendanceSummary: attendanceSummary
              ? {
                  attendanceRate: Math.round(attendanceSummary.rate),
                  counts: attendanceSummary.counts,
                  recent: attendanceSummary.recent.map((entry) => ({
                    label: entry.sessionName,
                    status: getAttendanceLabel(entry.status),
                  })),
                }
              : null,
            reportCount: savedReports.length,
            previousReportExcerpt: previousReport
              ? getReportExcerpt(previousReport.report, 180)
              : null,
            recentForm: formatRecentForm(attendanceSummary),
          },
          notes: notesText,
        }),
      });

      const payload = (await response.json()) as {
        sections?: StructuredProgressReport;
        error?: string;
      };

      if (!response.ok) {
        setFormError(sanitizeDashboardSaveError(payload.error, { logLabel: "reports-generate" }));
        return;
      }
      if (!payload.sections) {
        setFormError("No report was generated.");
        return;
      }

      setReport(serializeStructuredReport(payload.sections));
      setSendSuccess(null);
      setSendError(null);
      setPdfError(null);
    } catch (caughtError: unknown) {
      setFormError(sanitizeDashboardSaveError(caughtError, { logLabel: "reports-generate" }));
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveReport() {
    if (!coachId || !selectedPlayerId || !report.trim()) {
      setFormError("Generate a report first, then save it.");
      return;
    }

    setSavingReport(true);
    setFormError(null);
    try {
      const supabase = createClient();
      const payload = {
        coach_id: coachId,
        player_id: selectedPlayerId,
        raw_notes: guidedNotesToPlainText(guidedNotes),
        report: report.trim(),
        parent_visible: false,
      };

      const { data, error } = await supabase
        .from("progress_reports")
        .insert(payload)
        .select("id, coach_id, player_id, raw_notes, report, created_at, parent_visible")
        .single();

      if (error) {
        setFormError(sanitizeDashboardSaveError(error, { logLabel: "reports-save" }));
        return;
      }

      if (data) {
        setSavedReports((current) => [data as SavedReport, ...current]);
      }
    } catch (caughtError: unknown) {
      setFormError(sanitizeDashboardSaveError(caughtError, { logLabel: "reports-generate" }));
    } finally {
      setSavingReport(false);
    }
  }

  async function handleCopy() {
    if (!report) return;
    setCopying(true);
    setFormError(null);
    try {
      await navigator.clipboard.writeText(formatReportPlainText(parseReportContent(report)));
      setCopied(true);
    } catch {
      setFormError("Could not copy report. Please copy manually.");
    } finally {
      setCopying(false);
    }
  }

  async function handleSendReport() {
    if (!selectedPlayerId || !report.trim()) {
      setSendError("Generate a report first, then send it to the parent.");
      return;
    }

    setSendingReport(true);
    setSendSuccess(null);
    setSendError(null);
    try {
      const response = await fetch("/api/send-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerId: selectedPlayerId,
          report: report.trim(),
          reportId: savedReports.find((item) => item.report.trim() === report.trim())?.id,
        }),
      });

      const payload = (await response.json()) as { id?: string | null; error?: string };
      if (!response.ok) {
        setSendError(sanitizeDashboardSaveError(payload.error, { logLabel: "reports-send" }));
        return;
      }

      setSendSuccess("Report sent and shared with the parent portal.");
      setSavedReports((current) =>
        current.map((item) =>
          item.report.trim() === report.trim()
            ? { ...item, parent_visible: true }
            : item,
        ),
      );
    } catch (caughtError: unknown) {
      setSendError(sanitizeDashboardSaveError(caughtError, { logLabel: "reports-send" }));
    } finally {
      setSendingReport(false);
    }
  }

  async function handleDownloadPdf() {
    if (!selectedPlayer || !report.trim()) {
      setPdfError("Generate a report first, then download it as a PDF.");
      return;
    }

    setDownloadingPdf(true);
    setPdfError(null);
    try {
      const date = new Date();
      const pdfBytes = await generateReportPdf({
        playerName: selectedPlayer.player_name,
        preferredFoot: selectedPlayer.preferred_foot,
        primaryPosition: selectedPlayer.primary_position,
        secondaryPositions: selectedPlayer.secondary_positions,
        teamNames: getPlayerTeams(selectedPlayer.team_players).map((team) =>
          getTeamDisplayName(team),
        ),
        report: report.trim(),
        academyName,
        date,
      });
      const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength);
      new Uint8Array(pdfBuffer).set(pdfBytes);
      const blob = new Blob([pdfBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = getReportPdfFilename(selectedPlayer.player_name, date);
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (caughtError: unknown) {
      setPdfError(sanitizeDashboardSaveError(caughtError, { logLabel: "reports-pdf" }));
    } finally {
      setDownloadingPdf(false);
    }
  }

  async function handleToggleParentVisible(saved: SavedReport) {
    if (!coachId) return;
    const nextVisible = !saved.parent_visible;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("progress_reports")
        .update({ parent_visible: nextVisible })
        .eq("id", saved.id)
        .eq("coach_id", coachId);
      if (error) {
        setReportsError(sanitizeDashboardSaveError(error, { logLabel: "reports-share" }));
        return;
      }
      setSavedReports((current) =>
        current.map((item) =>
          item.id === saved.id ? { ...item, parent_visible: nextVisible } : item,
        ),
      );
    } catch (caughtError: unknown) {
      setReportsError(sanitizeDashboardSaveError(caughtError, { logLabel: "reports-share" }));
    }
  }

  async function handleDeleteSavedReport(reportId: string) {
    if (!coachId) return;

    setDeletingReportId(reportId);
    setReportsError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("progress_reports")
        .delete()
        .eq("id", reportId)
        .eq("coach_id", coachId);

      if (error) {
        setReportsError(sanitizeDashboardSaveError(error, { logLabel: "reports-load" }));
        return;
      }

      setSavedReports((current) => current.filter((item) => item.id !== reportId));
    } catch (caughtError: unknown) {
      setReportsError(sanitizeDashboardSaveError(caughtError, { logLabel: "reports-load" }));
    } finally {
      setDeletingReportId(null);
    }
  }

  function handleStartFromPreviousNotes() {
    const latest = savedReports[0];
    if (!latest?.raw_notes.trim()) return;
    handleReuseNotes(latest);
  }

  function formatRecentForm(history: PlayerAttendanceHistory | null): string {
    if (!history || history.recent.length === 0) return "";
    return history.recent
      .slice(0, 6)
      .map((entry) => getAttendanceLabel(entry.status))
      .join(" · ");
  }

  function formatReportDate(dateValue: string): string {
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return dateValue;
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(parsed);
  }

  return (
    <div className="page-content-enter space-y-8">
      <FeaturePageHeader
        featureKey="reports"
        title="Player Development"
        subtitle="Turn session notes into polished parent-ready development updates in seconds."
      />

      <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight">Generate report</h2>
        <p className="text-muted mt-1 text-sm">
          Select a player, paste coaching notes, then generate a concise report.
        </p>

        {!loadingPlayers && players.length === 0 ? (
          <div className="mt-6">
            <CoachSetupGuidance
              icon={UserRound}
              title="Build your squad first"
              description="Add a player before generating development reports. Reports turn your pitch-side notes into polished updates for parents."
              actionHref="/dashboard/players"
              actionLabel="Add your first player"
            />
          </div>
        ) : (
        <form
          id="generate-report-form"
          className="mt-6 space-y-4"
          onSubmit={handleGenerateReport}
        >
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="player">
              Player <span className="text-red-500">*</span>
            </label>
            <select
              id="player"
              disabled={loadingPlayers || players.length === 0}
              value={selectedPlayerId}
              onChange={(e) => {
                void handlePlayerChange(e.target.value);
                if (fieldErrors.player) setFieldErrors((c) => ({ ...c, player: undefined }));
              }}
              aria-invalid={fieldErrors.player ? true : undefined}
              aria-describedby={fieldErrors.player ? "player-error" : undefined}
              className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2 disabled:opacity-70"
            >
              {players.length === 0 ? (
                <option value="">No players available</option>
              ) : null}
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.player_name}
                </option>
              ))}
            </select>
            {fieldErrors.player ? (
              <p
                id="player-error"
                role="alert"
                className="mt-2 break-words text-sm text-red-600 dark:text-red-400"
              >
                {fieldErrors.player}
              </p>
            ) : null}
          </div>

          {selectedPlayer ? (
            <div className="rounded-2xl bg-black/[0.02] p-4 text-sm dark:bg-white/[0.03]">
              <p className="font-medium">{selectedPlayer.player_name}</p>
              <p className="text-muted mt-1">
                {getPlayerProfileSummary({
                  preferred_foot: selectedPlayer.preferred_foot,
                  primary_position: selectedPlayer.primary_position,
                  secondary_positions: selectedPlayer.secondary_positions,
                })}
              </p>
              {getPlayerTeams(selectedPlayer.team_players).length > 0 ? (
                <p className="text-muted mt-1">
                  Teams:{" "}
                  {getPlayerTeams(selectedPlayer.team_players)
                    .map((team) => getTeamDisplayName(team))
                    .join(", ")}
                </p>
              ) : null}
              {attendanceSummary && attendanceSummary.recent.length > 0 ? (
                <ReportsAttendanceBlock history={attendanceSummary} />
              ) : (
                <p className="text-muted mt-3 text-sm">No attendance records yet.</p>
              )}
            </div>
          ) : null}

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="report-template">
              Report template
            </label>
            <select
              id="report-template"
              value={reportTemplate}
              onChange={(event) =>
                setReportTemplate(event.target.value as ReportTemplateId)
              }
              disabled={generating}
              className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2 disabled:opacity-70"
            >
              {REPORT_TEMPLATE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-muted mt-2 text-sm">
              {
                REPORT_TEMPLATE_OPTIONS.find((option) => option.id === reportTemplate)
                  ?.description
              }
            </p>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                Coaching notes <span className="text-red-500">*</span>
              </p>
              {savedReports[0]?.raw_notes.trim() ? (
                <button
                  type="button"
                  onClick={handleStartFromPreviousNotes}
                  disabled={generating}
                  className="text-accent focus-visible:ring-accent/40 inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
                >
                  Start from previous notes
                </button>
              ) : null}
            </div>
            <GuidedReportNotesFields
              value={guidedNotes}
              onChange={(nextNotes) => {
                setGuidedNotes(nextNotes);
                if (fieldErrors.notes) {
                  setFieldErrors((current) => ({ ...current, notes: undefined }));
                }
              }}
              disabled={generating}
            />
            {fieldErrors.notes ? (
              <p
                id="notes-error"
                role="alert"
                className="mt-2 break-words text-sm text-red-600 dark:text-red-400"
              >
                {fieldErrors.notes}
              </p>
            ) : null}
          </div>

          {formError ? <FormErrorAlert message={formError} /> : null}

          {generating ? (
            <p className="text-muted text-sm" role="status" aria-live="polite">
              Generating structured report for {selectedPlayer?.player_name ?? "player"}...
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loadingPlayers || generating || players.length === 0}
            className="bg-foreground text-background hover:opacity-90 inline-flex min-h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity disabled:opacity-60"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 size-4" aria-hidden />
                Generate Report
              </>
            )}
          </button>
        </form>
        )}
      </section>

      {loadingPlayers ? (
        <PanelSkeleton />
      ) : null}

      {report ? (
        <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Generated report</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleDownloadPdf()}
                disabled={downloadingPdf}
                className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 dark:hover:bg-white/[0.06]"
              >
                {downloadingPdf ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Preparing...
                  </>
                ) : (
                  <>
                    <FileDown className="size-4" aria-hidden />
                    Download PDF
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => void handleCopy()}
                disabled={copying}
                className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 dark:hover:bg-white/[0.06]"
              >
                {copied ? (
                  <>
                    <Check className="size-4" aria-hidden />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="size-4" aria-hidden />
                    {copying ? "Copying..." : "Copy to Clipboard"}
                  </>
                )}
              </button>
            </div>
          </div>
          <div className="text-muted mt-4 rounded-xl bg-black/[0.02] p-4 dark:bg-white/[0.03]">
            <StructuredReportDisplay report={report} />
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => void handleSaveReport()}
              disabled={savingReport}
              className="bg-foreground text-background hover:opacity-90 focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
            >
              {savingReport ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Saving...
                </>
              ) : (
                "Save Report"
              )}
            </button>
            <button
              type="button"
              onClick={() => void handleSendReport()}
              disabled={sendingReport}
              className="bg-accent text-white hover:opacity-90 focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
            >
              {sendingReport ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 size-4" aria-hidden />
                  Send to Parent
                </>
              )}
            </button>
          </div>
          {sendSuccess ? (
            <p className="mt-3 text-sm text-accent">{sendSuccess}</p>
          ) : null}
          {sendError ? <FormErrorAlert message={sendError} className="mt-3" /> : null}
          {pdfError ? <FormErrorAlert message={pdfError} className="mt-3" /> : null}
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Saved reports</h2>
          {selectedPlayerId ? (
            <span className="text-muted text-sm">{savedReports.length} total</span>
          ) : null}
        </div>

        {reportsError ? <FormErrorAlert message={reportsError} /> : null}

        {loadingReports ? (
          <PanelSkeleton />
        ) : null}

        {!loadingReports &&
        !reportsError &&
        selectedPlayerId &&
        savedReports.length === 0 ? (
          <EmptyState
            {...footballEmptyPreset("reports")}
          />
        ) : null}

        {!loadingReports &&
        !reportsError &&
        selectedPlayerId &&
        savedReports.length > 0 ? (
          <div className="grid gap-4">
            {savedReports.map((saved, index) => {
              const previousReport = savedReports[index + 1] ?? null;
              return (
              <article key={saved.id} className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs uppercase tracking-wide text-muted">
                    {formatReportDate(saved.created_at)}
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleDeleteSavedReport(saved.id)}
                    disabled={deletingReportId === saved.id}
                    className="text-muted hover:text-red-500 focus-visible:ring-accent/40 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
                    aria-label="Delete saved report"
                  >
                    {deletingReportId === saved.id ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="size-4" aria-hidden />
                    )}
                  </button>
                </div>
                <p className="mt-3 text-sm leading-relaxed">
                  {getReportExcerpt(saved.report, 120) || "Report saved."}
                </p>
                {previousReport ? (
                  <div className="mt-4 rounded-xl border border-dashed border-black/10 p-4 dark:border-white/10">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                      Compared with previous report
                    </p>
                    <p className="text-muted mt-2 text-sm">
                      Last report: {formatReportDate(previousReport.created_at)}
                    </p>
                    <p className="text-muted mt-2 text-sm leading-relaxed">
                      {getReportExcerpt(previousReport.report, 120)}
                    </p>
                  </div>
                ) : null}
                {saved.raw_notes.trim() ? (
                  <div className="mt-4 rounded-xl bg-black/[0.02] p-4 dark:bg-white/[0.03]">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                      Original coaching notes
                    </p>
                    <p className="text-muted mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                      {saved.raw_notes}
                    </p>
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setViewingReport(saved)}
                    className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
                  >
                    View report
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggleParentVisible(saved)}
                    className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
                  >
                    {saved.parent_visible ? "Unshare with parent" : "Share with parent"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReuseNotes(saved)}
                    className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
                  >
                    Reuse notes
                  </button>
                </div>
              </article>
              );
            })}
          </div>
        ) : null}
      </section>

      {selectedPlayer ? (
        <ReportViewModal
          open={viewingReport !== null}
          onClose={() => setViewingReport(null)}
          report={viewingReport}
          playerId={selectedPlayer.id}
          playerName={selectedPlayer.player_name}
          preferredFoot={selectedPlayer.preferred_foot}
          primaryPosition={selectedPlayer.primary_position}
          secondaryPositions={selectedPlayer.secondary_positions}
          teams={getPlayerTeams(selectedPlayer.team_players)}
          academyName={academyName}
        />
      ) : null}
    </div>
  );
}
