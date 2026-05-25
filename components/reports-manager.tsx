"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, FileDown, Loader2, Mail, Sparkles, Trash2 } from "lucide-react";
import { FeaturePageHeader } from "@/components/feature-page-header";
import {
  getAttendanceLabel,
  getAttendanceRate,
  getAttendanceSummary,
  type PlayerAttendanceStatus,
} from "@/lib/attendance";
import { generateReportPdf, getReportPdfFilename } from "@/lib/report-pdf";
import {
  getPlayerProfileSummary,
  normalizeSecondaryPositions,
  type PlayerPositionOption,
  type PreferredFootOption,
} from "@/lib/player-profile";
import { getPlayerTeams, getTeamDisplayName, type TeamSummary } from "@/lib/team-management";
import { createClient } from "@/lib/supabase";

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
};

type AttendanceHistoryRow = {
  session_id: string;
  player_id: string;
  status: PlayerAttendanceStatus;
  recorded_at: string;
  session:
    | {
        session_date: string;
        session_type: string | null;
        group_name: string | null;
        team: { team_name: string; age_group: string | null }[] | {
          team_name: string;
          age_group: string | null;
        } | null;
      }[]
    | {
        session_date: string;
        session_type: string | null;
        group_name: string | null;
        team: { team_name: string; age_group: string | null }[] | {
          team_name: string;
          age_group: string | null;
        } | null;
      }
    | null;
};

type AttendanceSummaryState = {
  rate: number;
  counts: Record<PlayerAttendanceStatus, number>;
  recent: Array<{ label: string; status: PlayerAttendanceStatus }>;
};

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "An unexpected error occurred.";
}

export function ReportsManager() {
  const [coachId, setCoachId] = useState("");
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [notes, setNotes] = useState("");
  const [report, setReport] = useState("");
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
    useState<AttendanceSummaryState | null>(null);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [reportsError, setReportsError] = useState<string | null>(null);

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
        .select("id, coach_id, player_id, raw_notes, report, created_at")
        .eq("coach_id", userCoachId)
        .eq("player_id", playerId)
        .order("created_at", { ascending: false });

      if (error) {
        setReportsError(error.message);
        return;
      }

      setSavedReports((data ?? []) as SavedReport[]);
    } catch (caughtError: unknown) {
      setReportsError(getErrorMessage(caughtError));
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
        .select(
          `
            session_id,
            player_id,
            status,
            recorded_at,
            session:sessions (
              session_date,
              session_type,
              group_name,
              team:teams (
                team_name,
                age_group
              )
            )
          `,
        )
        .eq("coach_id", userCoachId)
        .eq("player_id", playerId)
        .order("recorded_at", { ascending: false });

      if (error) {
        setAttendanceSummary(null);
        return;
      }

      const rows = (data ?? []) as AttendanceHistoryRow[];
      const counts = getAttendanceSummary(rows);
      const recent = rows.slice(0, 5).map((row) => {
        const session = Array.isArray(row.session) ? row.session[0] : row.session;
        const team = Array.isArray(session?.team) ? session?.team[0] : session?.team;
        const label =
          session?.group_name?.trim() ||
          team?.team_name?.trim() ||
          session?.session_type?.trim() ||
          new Intl.DateTimeFormat("en-GB", {
            month: "short",
            day: "numeric",
          }).format(new Date(row.recorded_at));

        return {
          label,
          status: row.status,
        };
      });

      setAttendanceSummary({
        rate: getAttendanceRate(rows),
        counts,
        recent,
      });
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
          setFormError(userError.message);
          return;
        }
        if (!user) {
          setFormError("You must be signed in to generate reports.");
          return;
        }
        setCoachId(user.id);

        const { data, error: playersError } = await supabase
          .from("players")
          .select(
            "id, player_name, preferred_foot, primary_position, secondary_positions, team_players(team:teams(id, team_name, age_group, team_color))",
          )
          .eq("coach_id", user.id)
          .order("player_name", { ascending: true });

        if (cancelled) return;
        if (playersError) {
          setFormError(playersError.message);
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
          const initialPlayerId = safePlayers[0].id;
          setSelectedPlayerId(initialPlayerId);
          await Promise.all([
            loadSavedReports(user.id, initialPlayerId),
            loadAttendanceSummary(user.id, initialPlayerId),
          ]);
        }
      } catch (caughtError: unknown) {
        if (!cancelled) setFormError(getErrorMessage(caughtError));
      } finally {
        if (!cancelled) setLoadingPlayers(false);
      }
    }

    void loadPlayers();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handlePlayerChange(playerId: string) {
    setSelectedPlayerId(playerId);
    setSendSuccess(null);
    setSendError(null);
    if (!coachId) return;
    await Promise.all([
      loadSavedReports(coachId, playerId),
      loadAttendanceSummary(coachId, playerId),
    ]);
  }

  async function handleGenerateReport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setCopied(false);
    setSendSuccess(null);
    setSendError(null);
    setPdfError(null);

    if (!selectedPlayer) {
      setFormError("Please select a player.");
      return;
    }
    if (!notes.trim()) {
      setFormError("Please add coaching notes before generating a report.");
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch("/api/generate-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerName: selectedPlayer.player_name,
          playerProfile: {
            preferredFoot: selectedPlayer.preferred_foot,
            primaryPosition: selectedPlayer.primary_position,
            secondaryPositions: selectedPlayer.secondary_positions,
            teamNames: getPlayerTeams(selectedPlayer.team_players).map((team) =>
              getTeamDisplayName(team),
            ),
            attendanceSummary: attendanceSummary
              ? {
                  attendanceRate: Math.round(attendanceSummary.rate),
                  counts: attendanceSummary.counts,
                  recent: attendanceSummary.recent.map((entry) => ({
                    label: entry.label,
                    status: getAttendanceLabel(entry.status),
                  })),
                }
              : null,
          },
          notes: notes.trim(),
        }),
      });

      const payload = (await response.json()) as { report?: string; error?: string };

      if (!response.ok) {
        setFormError(payload.error ?? "Failed to generate report.");
        return;
      }
      if (!payload.report) {
        setFormError("No report was generated.");
        return;
      }

      setReport(payload.report);
      setSendSuccess(null);
      setSendError(null);
      setPdfError(null);
    } catch (caughtError: unknown) {
      setFormError(getErrorMessage(caughtError));
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
        raw_notes: notes.trim(),
        report: report.trim(),
      };

      const { data, error } = await supabase
        .from("progress_reports")
        .insert(payload)
        .select("id, coach_id, player_id, raw_notes, report, created_at")
        .single();

      if (error) {
        setFormError(error.message);
        return;
      }

      if (data) {
        setSavedReports((current) => [data as SavedReport, ...current]);
      }
    } catch (caughtError: unknown) {
      setFormError(getErrorMessage(caughtError));
    } finally {
      setSavingReport(false);
    }
  }

  async function handleCopy() {
    if (!report) return;
    setCopying(true);
    setFormError(null);
    try {
      await navigator.clipboard.writeText(report);
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
        }),
      });

      const payload = (await response.json()) as { id?: string | null; error?: string };
      if (!response.ok) {
        setSendError(payload.error ?? "Could not send report.");
        return;
      }

      setSendSuccess("Report sent to parent.");
    } catch (caughtError: unknown) {
      setSendError(getErrorMessage(caughtError));
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
      setPdfError(getErrorMessage(caughtError));
    } finally {
      setDownloadingPdf(false);
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
        setReportsError(error.message);
        return;
      }

      setSavedReports((current) => current.filter((item) => item.id !== reportId));
    } catch (caughtError: unknown) {
      setReportsError(getErrorMessage(caughtError));
    } finally {
      setDeletingReportId(null);
    }
  }

  function formatDate(dateValue: string): string {
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return dateValue;
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(parsed);
  }

  return (
    <div className="space-y-8">
      <FeaturePageHeader
        featureKey="reports"
        title="AI Progress Reports"
        subtitle="Turn session notes into polished parent-ready updates in seconds."
      />

      <section className="glass-panel rounded-2xl p-6 sm:p-8">
        <h2 className="text-lg font-semibold tracking-tight">Generate report</h2>
        <p className="text-muted mt-1 text-sm">
          Select a player, paste coaching notes, then generate a concise report.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleGenerateReport}>
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="player">
              Player
            </label>
            <select
              id="player"
              disabled={loadingPlayers || players.length === 0}
              value={selectedPlayerId}
              onChange={(e) => {
                void handlePlayerChange(e.target.value);
              }}
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 disabled:opacity-70"
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
              {attendanceSummary ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="border-border text-muted inline-flex rounded-full border px-2.5 py-1 text-xs font-medium">
                    Attendance {Math.round(attendanceSummary.rate)}%
                  </span>
                  <span className="border-border text-muted inline-flex rounded-full border px-2.5 py-1 text-xs font-medium">
                    {attendanceSummary.counts.present + attendanceSummary.counts.late} positive
                  </span>
                  <span className="border-border text-muted inline-flex rounded-full border px-2.5 py-1 text-xs font-medium">
                    {attendanceSummary.counts.absent} absent
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="notes">
              Raw Coaching Notes
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Paste your session notes: technical highlights, decisions, physical output, attitude, and next focus."
              className="border-border bg-background text-foreground focus:ring-accent/40 min-h-40 w-full rounded-xl border px-3 py-2 text-sm outline-none ring-offset-2 focus:ring-2"
            />
          </div>

          {formError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
          ) : null}

          <button
            type="submit"
            disabled={loadingPlayers || generating || players.length === 0}
            className="bg-foreground text-background hover:opacity-90 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity disabled:opacity-60"
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
      </section>

      {loadingPlayers ? (
        <div className="glass-panel flex items-center gap-3 rounded-2xl p-6 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading players...
        </div>
      ) : null}

      {report ? (
        <section className="glass-panel rounded-2xl p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Generated report</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleDownloadPdf()}
                disabled={downloadingPdf}
                className="border-border hover:bg-black/[0.03] inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors disabled:opacity-60 dark:hover:bg-white/[0.06]"
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
                className="border-border hover:bg-black/[0.03] inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors disabled:opacity-60 dark:hover:bg-white/[0.06]"
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
          <p className="text-muted mt-4 whitespace-pre-wrap rounded-xl bg-black/[0.02] p-4 text-sm leading-relaxed dark:bg-white/[0.03]">
            {report}
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => void handleSaveReport()}
              disabled={savingReport}
              className="bg-foreground text-background hover:opacity-90 inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium transition-opacity disabled:opacity-60"
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
              className="bg-accent text-white hover:opacity-90 inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium transition-opacity disabled:opacity-60"
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
          {sendError ? (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{sendError}</p>
          ) : null}
          {pdfError ? (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{pdfError}</p>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Saved reports</h2>
          {selectedPlayerId ? (
            <span className="text-muted text-sm">{savedReports.length} total</span>
          ) : null}
        </div>

        {reportsError ? (
          <div className="glass-panel rounded-2xl p-6 text-sm text-red-600 dark:text-red-400">
            {reportsError}
          </div>
        ) : null}

        {loadingReports ? (
          <div className="glass-panel flex items-center gap-3 rounded-2xl p-6 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading saved reports...
          </div>
        ) : null}

        {!loadingReports &&
        !reportsError &&
        selectedPlayerId &&
        savedReports.length === 0 ? (
          <div className="glass-panel rounded-2xl p-6 text-sm text-muted">
            No saved reports for this player yet.
          </div>
        ) : null}

        {!loadingReports &&
        !reportsError &&
        selectedPlayerId &&
        savedReports.length > 0 ? (
          <div className="grid gap-4">
            {savedReports.map((saved) => (
              <article key={saved.id} className="glass-panel rounded-2xl p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs uppercase tracking-wide text-muted">
                    {formatDate(saved.created_at)}
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleDeleteSavedReport(saved.id)}
                    disabled={deletingReportId === saved.id}
                    className="text-muted hover:text-red-500 inline-flex items-center justify-center rounded-lg p-2 transition-colors disabled:opacity-60"
                    aria-label="Delete saved report"
                  >
                    {deletingReportId === saved.id ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="size-4" aria-hidden />
                    )}
                  </button>
                </div>
                <p className="mt-3 whitespace-pre-wrap rounded-xl bg-black/[0.02] p-4 text-sm leading-relaxed text-muted dark:bg-white/[0.03]">
                  {saved.report}
                </p>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
