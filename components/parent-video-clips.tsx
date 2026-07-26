"use client";

import { useCallback, useEffect, useState } from "react";
import type { ParentVideoClipItem } from "@/app/api/family/video/route";
import { sanitizeUserFacingError } from "@/lib/user-facing-errors";

export function ParentVideoClips() {
  const [clips, setClips] = useState<ParentVideoClipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadClips = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/family/video");
      const payload = (await response.json()) as { clips?: ParentVideoClipItem[]; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load shared clips.");
      }
      setClips(payload.clips ?? []);
    } catch (caughtError) {
      setError(
        sanitizeUserFacingError(caughtError, {
          logLabel: "parent-video-clips",
          fallback: "Unable to load shared clips right now.",
        }),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadClips();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadClips]);

  if (loading) return null;
  if (error) {
    return (
      <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6" aria-labelledby="parent-video-heading">
        <h2 id="parent-video-heading" className="text-lg font-semibold tracking-tight">
          Shared clips
        </h2>
        <p className="text-muted mt-2 text-sm" role="alert">
          {error}
        </p>
      </section>
    );
  }
  if (clips.length === 0) return null;

  return (
    <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6" aria-labelledby="parent-video-heading">
      <h2 id="parent-video-heading" className="text-lg font-semibold tracking-tight">
        Shared clips
      </h2>
      <p className="text-muted mt-1 text-sm">
        Clips your coach has chosen to share. Streaming only — downloads are not enabled.
      </p>

      <ul className="mt-5 space-y-4" role="list" aria-label="Shared video clips">
        {clips.map((clip) => (
          <li key={clip.id} className="rounded-xl bg-black/[0.02] px-4 py-4 dark:bg-white/[0.03]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{clip.title}</p>
                <p className="text-muted mt-1 text-sm">
                  {clip.categoryLabel}
                  {clip.playerNames.length > 0 ? ` · ${clip.playerNames.join(", ")}` : ""}
                  {` · ${clip.startLabel}`}
                  {clip.endLabel ? `–${clip.endLabel}` : ""}
                </p>
              </div>
              {clip.sourceUrl ? (
                <a
                  href={clip.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-foreground text-background focus-visible:ring-accent/40 inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Watch clip
                </a>
              ) : null}
            </div>
            {clip.parentComment ? (
              <p className="mt-3 text-sm leading-relaxed">{clip.parentComment}</p>
            ) : null}
            {clip.aiSummary ? (
              <details className="mt-3 text-sm">
                <summary className="focus-visible:ring-accent/40 cursor-pointer font-medium outline-none focus-visible:ring-2">
                  Coach notes
                </summary>
                <p className="text-muted mt-2 whitespace-pre-wrap leading-relaxed">{clip.aiSummary}</p>
              </details>
            ) : null}
            {clip.reportId ? (
              <p className="text-muted mt-3 text-xs">Linked to a progress report in your family dashboard.</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
