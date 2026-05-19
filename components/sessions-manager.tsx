"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2, MapPin, Trash2 } from "lucide-react";
import { FeaturePageHeader } from "@/components/feature-page-header";
import { createClient } from "@/lib/supabase";

type AttendanceStatus = "scheduled" | "attended" | "missed" | "cancelled";

type PlayerOption = {
  id: string;
  player_name: string;
};

type SessionRow = {
  id: string;
  coach_id: string;
  player_id: string;
  session_date: string;
  session_type: string | null;
  location: string | null;
  notes: string | null;
  attendance_status: AttendanceStatus;
  created_at: string;
};

type SessionFormState = {
  playerId: string;
  sessionDateTime: string;
  sessionType: string;
  location: string;
  notes: string;
};

const defaultFormState: SessionFormState = {
  playerId: "",
  sessionDateTime: "",
  sessionType: "",
  location: "",
  notes: "",
};

const attendanceOptions: AttendanceStatus[] = [
  "scheduled",
  "attended",
  "missed",
  "cancelled",
];

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

function formatSessionDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export function SessionsManager() {
  const [coachId, setCoachId] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [form, setForm] = useState<SessionFormState>(defaultFormState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const playerNameById = useMemo(
    () => new Map(players.map((player) => [player.id, player.player_name])),
    [players],
  );

  const loadCoachData = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      const [{ data: playersData, error: playersError }, { data: sessionsData, error: sessionsError }] =
        await Promise.all([
          supabase
            .from("players")
            .select("id, player_name")
            .eq("coach_id", userId)
            .order("player_name", { ascending: true }),
          supabase
            .from("sessions")
            .select(
              "id, coach_id, player_id, session_date, session_type, location, notes, attendance_status, created_at",
            )
            .eq("coach_id", userId)
            .order("session_date", { ascending: false }),
        ]);

      if (playersError) {
        setError(playersError.message);
        return;
      }
      if (sessionsError) {
        setError(sessionsError.message);
        return;
      }

      const safePlayers = (playersData ?? []) as PlayerOption[];
      const safeSessions = (sessionsData ?? []) as SessionRow[];

      setPlayers(safePlayers);
      setSessions(safeSessions);

      if (safePlayers.length > 0) {
        setForm((current) =>
          current.playerId
            ? current
            : { ...current, playerId: safePlayers[0].id },
        );
      }
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (cancelled) return;
        if (userError) {
          setError(userError.message);
          setLoading(false);
          return;
        }
        if (!user) {
          setError("You must be signed in to manage sessions.");
          setLoading(false);
          return;
        }

        setCoachId(user.id);
        await loadCoachData(user.id);
      } catch (caughtError: unknown) {
        if (!cancelled) {
          setError(getErrorMessage(caughtError));
          setLoading(false);
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [loadCoachData]);

  async function handleCreateSession(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!coachId) {
      setSubmitError("You must be signed in to schedule sessions.");
      return;
    }
    if (!form.playerId) {
      setSubmitError("Please select a player.");
      return;
    }
    if (!form.sessionDateTime) {
      setSubmitError("Please provide session date and time.");
      return;
    }

    setSubmitError(null);
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        coach_id: coachId,
        player_id: form.playerId,
        session_date: new Date(form.sessionDateTime).toISOString(),
        session_type: form.sessionType.trim() || null,
        location: form.location.trim() || null,
        notes: form.notes.trim() || null,
        attendance_status: "scheduled" as AttendanceStatus,
      };

      const { data, error: insertError } = await supabase
        .from("sessions")
        .insert(payload)
        .select(
          "id, coach_id, player_id, session_date, session_type, location, notes, attendance_status, created_at",
        )
        .single();

      if (insertError) {
        setSubmitError(insertError.message);
        return;
      }

      if (data) {
        setSessions((current) => [data as SessionRow, ...current]);
        setForm((current) => ({
          ...defaultFormState,
          playerId: current.playerId,
        }));
      }
    } catch (caughtError: unknown) {
      setSubmitError(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function updateAttendanceStatus(
    sessionId: string,
    nextStatus: AttendanceStatus,
  ) {
    if (!coachId) {
      setSubmitError("You must be signed in to update attendance.");
      return;
    }

    setSubmitError(null);
    setStatusUpdatingId(sessionId);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("sessions")
        .update({ attendance_status: nextStatus })
        .eq("id", sessionId)
        .eq("coach_id", coachId);

      if (updateError) {
        setSubmitError(updateError.message);
        return;
      }

      setSessions((current) =>
        current.map((session) =>
          session.id === sessionId
            ? { ...session, attendance_status: nextStatus }
            : session,
        ),
      );
    } catch (caughtError: unknown) {
      setSubmitError(getErrorMessage(caughtError));
    } finally {
      setStatusUpdatingId(null);
    }
  }

  async function handleDeleteSession(sessionId: string) {
    if (!coachId) {
      setSubmitError("You must be signed in to delete sessions.");
      return;
    }

    setSubmitError(null);
    setDeletingId(sessionId);
    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from("sessions")
        .delete()
        .eq("id", sessionId)
        .eq("coach_id", coachId);

      if (deleteError) {
        setSubmitError(deleteError.message);
        return;
      }

      setSessions((current) => current.filter((session) => session.id !== sessionId));
    } catch (caughtError: unknown) {
      setSubmitError(getErrorMessage(caughtError));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <FeaturePageHeader
        featureKey="sessions"
        title="Session Scheduling"
        subtitle="Plan sessions and track attendance across your coaching calendar."
      />

      <section className="glass-panel rounded-2xl p-6 sm:p-8">
        <h2 className="text-lg font-semibold tracking-tight">Schedule session</h2>
        <p className="text-muted mt-1 text-sm">
          Assign sessions to players and mark attendance as the week progresses.
        </p>

        <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={handleCreateSession}>
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="playerId">
              Player
            </label>
            <select
              id="playerId"
              required
              value={form.playerId}
              onChange={(e) =>
                setForm((current) => ({ ...current, playerId: e.target.value }))
              }
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
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

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="sessionDateTime">
              Session Date and Time
            </label>
            <input
              id="sessionDateTime"
              type="datetime-local"
              required
              value={form.sessionDateTime}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  sessionDateTime: e.target.value,
                }))
              }
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="sessionType">
              Session Type
            </label>
            <input
              id="sessionType"
              value={form.sessionType}
              onChange={(e) =>
                setForm((current) => ({ ...current, sessionType: e.target.value }))
              }
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
              placeholder="e.g. 1:1 Technical"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="location">
              Location
            </label>
            <input
              id="location"
              value={form.location}
              onChange={(e) =>
                setForm((current) => ({ ...current, location: e.target.value }))
              }
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
              placeholder="e.g. Pitch A"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium" htmlFor="notes">
              Notes
            </label>
            <textarea
              id="notes"
              value={form.notes}
              onChange={(e) =>
                setForm((current) => ({ ...current, notes: e.target.value }))
              }
              className="border-border bg-background text-foreground focus:ring-accent/40 min-h-24 w-full rounded-xl border px-3 py-2 text-sm outline-none ring-offset-2 focus:ring-2"
              placeholder="Training focus, prep notes, or follow-up actions..."
            />
          </div>

          {submitError ? (
            <p className="sm:col-span-2 text-sm text-red-600 dark:text-red-400">
              {submitError}
            </p>
          ) : null}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving || players.length === 0}
              className="bg-foreground text-background hover:opacity-90 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Scheduling...
                </>
              ) : (
                "Schedule session"
              )}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">All sessions</h2>
          {!loading ? (
            <span className="text-muted text-sm">{sessions.length} total</span>
          ) : null}
        </div>

        {error ? (
          <div className="glass-panel rounded-2xl p-6 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="glass-panel flex items-center gap-3 rounded-2xl p-6 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading sessions...
          </div>
        ) : null}

        {!loading && !error && sessions.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center">
            <CalendarClock className="text-muted mx-auto size-8" aria-hidden />
            <p className="mt-3 font-medium">No sessions yet</p>
            <p className="text-muted mt-1 text-sm">
              Schedule your first session to start tracking attendance.
            </p>
          </div>
        ) : null}

        {!loading && !error && sessions.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {sessions.map((session) => (
              <article key={session.id} className="glass-panel rounded-2xl p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight">
                      {playerNameById.get(session.player_id) ?? "Unknown player"}
                    </h3>
                    <p className="text-muted mt-1 text-sm">
                      {formatSessionDate(session.session_date)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDeleteSession(session.id)}
                    disabled={deletingId === session.id}
                    className="text-muted hover:text-red-500 inline-flex items-center justify-center rounded-lg p-2 transition-colors disabled:opacity-60"
                    aria-label="Delete session"
                  >
                    {deletingId === session.id ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="size-4" aria-hidden />
                    )}
                  </button>
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <p>
                    <span className="text-muted">Type:</span>{" "}
                    {session.session_type ?? "N/A"}
                  </p>
                  <p className="inline-flex items-center gap-1.5">
                    <MapPin className="text-muted size-3.5" aria-hidden />
                    {session.location ?? "No location"}
                  </p>
                </div>

                <div className="mt-4">
                  <label
                    htmlFor={`attendance-${session.id}`}
                    className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted"
                  >
                    Attendance status
                  </label>
                  <select
                    id={`attendance-${session.id}`}
                    value={session.attendance_status}
                    disabled={statusUpdatingId === session.id}
                    onChange={(e) =>
                      void updateAttendanceStatus(
                        session.id,
                        e.target.value as AttendanceStatus,
                      )
                    }
                    className="border-border bg-background text-foreground focus:ring-accent/40 h-10 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 disabled:opacity-70"
                  >
                    {attendanceOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                {session.notes ? (
                  <p className="text-muted mt-4 rounded-xl bg-black/[0.02] p-3 text-sm dark:bg-white/[0.03]">
                    {session.notes}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
