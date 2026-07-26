"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, Loader2, Trophy } from "lucide-react";
import { buildGoogleCalendarUrl } from "@/lib/parent-portal-format";
import { PARENT_MATCH_AVAILABILITY_LABELS, type ParentMatchAvailability } from "@/lib/match-types";
import { sanitizeUserFacingError } from "@/lib/user-facing-errors";

type ParentMatchItem = {
  id: string;
  title: string;
  kickoffLabel: string;
  statusLabel: string;
  scoreLabel: string;
  squadPublished: boolean;
  venue: string | null;
  kickoffDate: string;
  kickoffTime: string | null;
  children: Array<{
    playerId: string;
    playerName: string;
    parentAvailability: ParentMatchAvailability;
  }>;
  publishedSquad: Array<{ playerName: string; role: string | null; isGoalkeeper: boolean }>;
};

export function ParentMatchFixtures() {
  const [matches, setMatches] = useState<ParentMatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/family/matches", { cache: "no-store" });
      const payload = (await response.json()) as { matches?: ParentMatchItem[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to load fixtures.");
      setMatches(payload.matches ?? []);
    } catch (caughtError: unknown) {
      setError(
        sanitizeUserFacingError(caughtError, {
          context: "general",
          logLabel: "parent-match-fixtures",
        }),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadMatches();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadMatches]);

  async function updateAvailability(
    matchId: string,
    playerId: string,
    availability: ParentMatchAvailability,
  ) {
    setSavingId(`${matchId}-${playerId}`);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/family/matches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, playerId, availability }),
      });
      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to update availability.");
      setStatusMessage(payload.message ?? "Availability updated.");
      await loadMatches();
    } catch (caughtError: unknown) {
      setError(
        sanitizeUserFacingError(caughtError, {
          context: "general",
          logLabel: "parent-match-availability",
        }),
      );
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <div className="football-panel flex items-center gap-3 rounded-2xl p-6 text-sm" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading fixtures...
      </div>
    );
  }

  if (error) {
    return (
      <div className="football-panel football-panel-interactive rounded-2xl p-6 text-sm text-red-600 dark:text-red-400" role="alert">
        {error}
      </div>
    );
  }

  if (matches.length === 0) return null;

  return (
    <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6" aria-labelledby="fixtures-heading">
      <h2 id="fixtures-heading" className="text-lg font-semibold tracking-tight">
        Fixtures
      </h2>
      {statusMessage ? (
        <p className="mt-2 text-sm" role="status">
          {statusMessage}
        </p>
      ) : null}
      <ul className="mt-4 space-y-4" role="list" aria-label="Upcoming fixtures">
        {matches.map((match) => (
          <li
            key={match.id}
            className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]"
            role="listitem"
          >
            <div className="flex items-start gap-3">
              <Trophy className="text-accent mt-0.5 size-5 shrink-0" aria-hidden />
              <div className="flex-1">
                <p className="font-medium">{match.title}</p>
                <p className="text-muted mt-1 text-sm">
                  {match.kickoffLabel} · {match.statusLabel}
                  {match.scoreLabel !== "Result pending" ? ` · ${match.scoreLabel}` : ""}
                </p>
                {match.squadPublished && match.publishedSquad.length > 0 ? (
                  <p className="text-muted mt-2 text-sm">
                    Squad:{" "}
                    {match.publishedSquad
                      .map((player) =>
                        player.isGoalkeeper ? `${player.playerName} (GK)` : player.playerName,
                      )
                      .join(", ")}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={buildGoogleCalendarUrl({
                      title: match.title,
                      startIso: `${match.kickoffDate}T${match.kickoffTime ?? "10:00:00"}`,
                      durationMinutes: 90,
                      location: match.venue,
                    })}
                    target="_blank"
                    rel="noreferrer"
                    className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <CalendarPlus className="size-4" aria-hidden />
                    Add to calendar
                  </a>
                </div>
                {match.children.map((child) => (
                  <div key={child.playerId} className="mt-4">
                    <p className="text-sm font-medium">{child.playerName}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(
                        ["available", "unavailable", "running_late"] as ParentMatchAvailability[]
                      ).map((availability) => (
                        <button
                          key={availability}
                          type="button"
                          disabled={savingId === `${match.id}-${child.playerId}`}
                          onClick={() =>
                            void updateAvailability(match.id, child.playerId, availability)
                          }
                          className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          {PARENT_MATCH_AVAILABILITY_LABELS[availability]}
                        </button>
                      ))}
                    </div>
                    <p className="text-muted mt-1 text-xs" role="status">
                      Current: {PARENT_MATCH_AVAILABILITY_LABELS[child.parentAvailability]}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
