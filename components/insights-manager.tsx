"use client";

import { useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  Brain,
  Download,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
} from "lucide-react";
import { FeatureInfoTooltip } from "@/components/feature-info-tooltip";
import type { BusinessInsight, InsightsResponse } from "@/lib/insights";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

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

function priorityClass(priority: BusinessInsight["priority"]) {
  if (priority === "High") return "bg-red-500/10 text-red-700 ring-red-500/25 dark:text-red-300";
  if (priority === "Medium") return "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300";
  return "bg-accent/10 text-accent ring-accent/25";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function wrapText(text: string, maxChars = 86) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function downloadInsightsPdf(payload: InsightsResponse) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 54;
  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function ensureSpace(required: number) {
    if (y < margin + required) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  }

  page.drawText("CoachFlow AI Business Insights", {
    x: margin,
    y,
    size: 24,
    font: bold,
    color: rgb(0.04, 0.1, 0.23),
  });
  y -= 22;
  page.drawText(`Generated ${formatDate(payload.generatedAt)}`, {
    x: margin,
    y,
    size: 10,
    font: regular,
    color: rgb(0.38, 0.43, 0.5),
  });
  y -= 32;

  for (const insight of payload.insights) {
    ensureSpace(120);
    page.drawText(`${insight.priority} · ${insight.category}`, {
      x: margin,
      y,
      size: 10,
      font: bold,
      color: rgb(0.06, 0.73, 0.51),
    });
    y -= 16;
    page.drawText(insight.title, {
      x: margin,
      y,
      size: 14,
      font: bold,
      color: rgb(0.04, 0.1, 0.23),
    });
    y -= 18;
    for (const line of wrapText(insight.summary)) {
      ensureSpace(18);
      page.drawText(line, {
        x: margin,
        y,
        size: 10.5,
        font: regular,
        color: rgb(0.12, 0.16, 0.22),
      });
      y -= 14;
    }
    y -= 4;
    page.drawText("Recommended action:", {
      x: margin,
      y,
      size: 10.5,
      font: bold,
      color: rgb(0.04, 0.1, 0.23),
    });
    y -= 14;
    for (const line of wrapText(insight.recommendedAction)) {
      ensureSpace(18);
      page.drawText(line, {
        x: margin,
        y,
        size: 10.5,
        font: regular,
        color: rgb(0.12, 0.16, 0.22),
      });
      y -= 14;
    }
    y -= 22;
  }

  const bytes = await pdf.save();
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/pdf" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `coachflow-business-insights-${payload.generatedAt.slice(0, 10)}.pdf`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function InsightsManager() {
  const [payload, setPayload] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function refreshInsights() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/insights/generate", { method: "POST" });
      const data = (await response.json()) as InsightsResponse & { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Unable to generate insights.");
        return;
      }
      setPayload(data);
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }

  async function saveInsights() {
    if (!payload) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) {
        setError(userError.message);
        return;
      }
      if (!user) {
        setError("You must be signed in to save insights.");
        return;
      }

      const { error: insertError } = await supabase.from("ai_insights").insert({
        coach_id: user.id,
        insights: payload.insights,
      });
      if (insertError) {
        setError(insertError.message);
        return;
      }
      setSuccess("Insights saved.");
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function exportPdf() {
    if (!payload) return;
    setExporting(true);
    setError(null);
    try {
      await downloadInsightsPdf(payload);
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              AI Business Insights
            </h1>
            <FeatureInfoTooltip featureKey="insights" />
          </div>
          <p className="text-muted mt-1 max-w-2xl text-sm">
            Turn academy data into commercial priorities, retention warnings, and
            follow-up actions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshInsights()}
          disabled={loading}
          className="bg-foreground text-background hover:opacity-90 inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium transition-opacity disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Generating
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 size-4" aria-hidden />
              Refresh Insights
            </>
          )}
        </button>
      </div>

      {error ? (
        <div className="glass-panel rounded-2xl p-5 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="glass-panel rounded-2xl p-5 text-sm text-accent">
          {success}
        </div>
      ) : null}

      {!payload && !loading ? (
        <section className="glass-panel rounded-2xl p-8 text-center">
          <Brain className="text-accent mx-auto size-10" aria-hidden />
          <h2 className="mt-4 text-xl font-semibold tracking-tight">
            Generate your first insight pack
          </h2>
          <p className="text-muted mx-auto mt-2 max-w-xl text-sm">
            CoachFlow will analyse players, sessions, reports, payments, camps,
            bookings, and referrals to highlight the next best actions.
          </p>
          <button
            type="button"
            onClick={() => void refreshInsights()}
            className="bg-accent text-white hover:opacity-90 mt-6 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity"
          >
            <Sparkles className="mr-2 size-4" aria-hidden />
            Generate insights
          </button>
        </section>
      ) : null}

      {loading ? (
        <div className="glass-panel flex items-center gap-3 rounded-2xl p-6 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Analysing business signals...
        </div>
      ) : null}

      {payload ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted text-sm">
              Generated {new Date(payload.generatedAt).toLocaleString("en-GB")}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => void saveInsights()}
                disabled={saving}
                className="border-border hover:bg-black/[0.03] inline-flex h-10 items-center justify-center rounded-full border px-5 text-sm font-medium transition-colors disabled:opacity-60 dark:hover:bg-white/[0.06]"
              >
                {saving ? (
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                ) : (
                  <Save className="mr-2 size-4" aria-hidden />
                )}
                Save Insights
              </button>
              <button
                type="button"
                onClick={() => void exportPdf()}
                disabled={exporting}
                className="border-border hover:bg-black/[0.03] inline-flex h-10 items-center justify-center rounded-full border px-5 text-sm font-medium transition-colors disabled:opacity-60 dark:hover:bg-white/[0.06]"
              >
                {exporting ? (
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                ) : (
                  <Download className="mr-2 size-4" aria-hidden />
                )}
                Export PDF
              </button>
            </div>
          </div>

          <section className="grid gap-5 xl:grid-cols-2">
            {payload.insights.map((insight) => (
              <article key={insight.id} className="glass-panel rounded-2xl p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-3 py-1 text-xs font-medium ring-1",
                      priorityClass(insight.priority),
                    )}
                  >
                    {insight.priority} priority
                  </span>
                  <span className="bg-black/[0.03] text-muted inline-flex rounded-full px-3 py-1 text-xs font-medium dark:bg-white/[0.05]">
                    {insight.category}
                  </span>
                </div>
                <h2 className="mt-4 text-lg font-semibold tracking-tight">
                  {insight.title}
                </h2>
                <p className="text-muted mt-2 text-sm leading-relaxed">
                  {insight.summary}
                </p>
                <div className="mt-5 rounded-2xl bg-accent/8 p-4 ring-1 ring-accent/20">
                  <p className="text-xs font-medium uppercase tracking-wide text-accent">
                    Recommended action
                  </p>
                  <p className="mt-2 text-sm leading-relaxed">
                    {insight.recommendedAction}
                  </p>
                </div>
              </article>
            ))}
          </section>
        </>
      ) : null}
    </div>
  );
}
