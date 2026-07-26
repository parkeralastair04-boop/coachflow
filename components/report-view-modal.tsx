"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Copy, FileDown, Loader2, X } from "lucide-react";
import { StructuredReportDisplay } from "@/components/structured-report-display";
import { generateReportPdf, getReportPdfFilename } from "@/lib/report-pdf";
import type { PreferredFootOption, PlayerPositionOption } from "@/lib/player-profile";
import { formatReportPlainText, parseReportContent } from "@/lib/structured-report";
import { getTeamDisplayName, type TeamSummary } from "@/lib/team-management";
import { sanitizeDashboardSaveError } from "@/lib/user-facing-errors";

export type ReportViewData = {
  id: string;
  created_at: string;
  report: string;
  raw_notes: string;
};

type ReportViewModalProps = {
  open: boolean;
  onClose: () => void;
  report: ReportViewData | null;
  playerId: string;
  playerName: string;
  preferredFoot: PreferredFootOption;
  primaryPosition: PlayerPositionOption | null;
  secondaryPositions: PlayerPositionOption[];
  teams: TeamSummary[];
  academyName?: string;
};

function formatReportDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export function ReportViewModal({
  open,
  onClose,
  report,
  playerId,
  playerName,
  preferredFoot,
  primaryPosition,
  secondaryPositions,
  teams,
  academyName = "Awarix",
}: ReportViewModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement;
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    };
  }, [onClose, open]);

  async function handleCopy() {
    if (!report) return;
    setCopying(true);
    setPdfError(null);
    try {
      await navigator.clipboard.writeText(
        formatReportPlainText(parseReportContent(report.report)),
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setPdfError("Could not copy report. Please copy manually.");
    } finally {
      setCopying(false);
    }
  }

  async function handleDownloadPdf() {
    if (!report) return;
    setDownloadingPdf(true);
    setPdfError(null);
    try {
      const date = new Date(report.created_at);
      const pdfBytes = await generateReportPdf({
        playerName,
        preferredFoot,
        primaryPosition,
        secondaryPositions,
        teamNames: teams.map((team) => getTeamDisplayName(team)),
        report: report.report,
        academyName,
        date,
      });
      const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength);
      new Uint8Array(pdfBuffer).set(pdfBytes);
      const blob = new Blob([pdfBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = getReportPdfFilename(playerName, date);
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

  if (!open || !report) return null;

  const titleId = `report-view-title-${report.id}`;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="glass-panel border-border flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border shadow-2xl sm:max-h-[90vh] sm:rounded-3xl"
      >
        <div className="border-border flex items-center justify-between border-b px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-muted text-xs uppercase tracking-wide">Progress report</p>
            <h2 id={titleId} className="truncate text-lg font-semibold tracking-tight">
              {formatReportDate(report.created_at)}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="text-muted hover:text-foreground focus-visible:ring-accent/40 inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Close report"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6 sm:px-6">
          <section aria-labelledby={`${titleId}-generated`}>
            <h3 id={`${titleId}-generated`} className="sr-only">
              Generated report
            </h3>
            <StructuredReportDisplay report={report.report} />
          </section>

          {report.raw_notes.trim() ? (
            <section aria-labelledby={`${titleId}-notes`}>
              <h3 id={`${titleId}-notes`} className="text-sm font-semibold">
                Original coaching notes
              </h3>
              <p className="text-muted mt-3 whitespace-pre-wrap rounded-xl bg-black/[0.02] p-4 text-sm leading-relaxed dark:bg-white/[0.03]">
                {report.raw_notes}
              </p>
            </section>
          ) : null}

          {pdfError ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {pdfError}
            </p>
          ) : null}
        </div>

        <div className="border-border flex flex-wrap gap-2 border-t px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => void handleCopy()}
            disabled={copying}
            className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 dark:hover:bg-white/[0.06]"
          >
            {copied ? (
              <>
                <Check className="size-4" aria-hidden />
                Copied
              </>
            ) : (
              <>
                <Copy className="size-4" aria-hidden />
                {copying ? "Copying..." : "Copy report"}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => void handleDownloadPdf()}
            disabled={downloadingPdf}
            className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 dark:hover:bg-white/[0.06]"
          >
            {downloadingPdf ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Preparing...
              </>
            ) : (
              <>
                <FileDown className="size-4" aria-hidden />
                Create PDF
              </>
            )}
          </button>
          <Link
            href={`/dashboard/reports?player=${playerId}`}
            className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Create new report
          </Link>
        </div>
      </div>
    </div>
  );
}
