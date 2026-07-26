"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { formatPortalDate } from "@/lib/parent-portal-format";
import { sanitizeUserFacingError } from "@/lib/user-facing-errors";

type ParentTrainingSession = {
  sessionId: string;
  sessionDate: string;
  location: string | null;
  theme: string | null;
  title: string;
  coachMessage: string | null;
  equipmentNote: string | null;
  preparationNote: string | null;
};

export function ParentTrainingPreparation() {
  const [sessions, setSessions] = useState<ParentTrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/family/training", { cache: "no-store" });
      const payload = (await response.json()) as {
        sessions?: ParentTrainingSession[];
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "Unable to load training details.");
      setSessions(payload.sessions ?? []);
    } catch (caughtError: unknown) {
      setError(
        sanitizeUserFacingError(caughtError, {
          context: "general",
          logLabel: "parent-training-prep",
        }),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadSessions();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadSessions]);

  if (loading) {
    return (
      <div className="football-panel flex items-center gap-3 rounded-2xl p-6 text-sm" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading training preparation...
      </div>
    );
  }

  if (error || sessions.length === 0) return null;

  return (
    <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6" aria-labelledby="training-prep-heading">
      <h2 id="training-prep-heading" className="text-lg font-semibold tracking-tight">
        Training preparation
      </h2>
      <ul className="mt-4 space-y-3" role="list" aria-label="Upcoming training preparation">
        {sessions.map((session) => (
          <li
            key={session.sessionId}
            className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]"
            role="listitem"
          >
            <p className="font-medium">{session.title}</p>
            <p className="text-muted mt-1 text-sm">
              {formatPortalDate(session.sessionDate)}
              {session.theme ? ` · ${session.theme}` : ""}
            </p>
            {session.equipmentNote ? (
              <p className="mt-2 text-sm">
                <span className="font-medium">Equipment:</span> {session.equipmentNote}
              </p>
            ) : null}
            {session.preparationNote ? (
              <p className="mt-2 text-sm">
                <span className="font-medium">Preparation:</span> {session.preparationNote}
              </p>
            ) : null}
            {session.coachMessage ? (
              <p className="mt-2 text-sm">
                <span className="font-medium">Coach message:</span> {session.coachMessage}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
