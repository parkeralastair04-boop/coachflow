"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Loader2,
  MapPin,
  Pencil,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { FeaturePageHeader } from "@/components/feature-page-header";
import { PlayerMultiSelect } from "@/components/player-multi-select";
import { createClient } from "@/lib/supabase";

type AttendanceStatus = "scheduled" | "attended" | "missed" | "cancelled";

type PlayerOption = {
  id: string;
  player_name: string;
};

type SessionPlayerLink = {
  player_id: string;
  player: PlayerOption[] | PlayerOption | null;
};

type SessionRow = {
  id: string;
  coach_id: string;
  player_id: string | null;
  group_name: string | null;
  session_date: string;
  session_type: string | null;
  location: string | null;
  notes: string | null;
  attendance_status: AttendanceStatus;
  created_at: string;
  session_players: SessionPlayerLink[] | null;
};

type SessionFormState = {
  selectedPlayerIds: string[];
  groupName: string;
  sessionDateTime: string;
  sessionType: string;
  location: string;
  notes: string;
};

const SESSION_SELECT = `
  id,
  coach_id,
  player_id,
  group_name,
  session_date,
  session_type,
  location,
  notes,
  attendance_status,
  created_at,
  session_players (
    player_id,
    player:players (
      id,
      player_name
    )
  )
`;

const defaultFormState: SessionFormState = {
  selectedPlayerIds: [],
  groupName: "",
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

function toDateTimeLocalValue(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getAssignedPlayerIds(session: SessionRow): string[] {
  const linkedIds = (session.session_players ?? []).map((link) => link.player_id);
  if (linkedIds.length > 0) return linkedIds;
  return session.player_id ? [session.player_id] : [];
}

function getAssignedPlayerNames(
  session: SessionRow,
  playerNameById: Map<string, string>,
): string[] {
  const namesFromLinks = (session.session_players ?? [])
    .map((link) => {
      const player = Array.isArray(link.player) ? link.player[0] : link.player;
      return player?.player_name ?? playerNameById.get(link.player_id) ?? null;
    })
    .filter((name): name is string => Boolean(name));
  if (namesFromLinks.length > 0) return namesFromLinks;
  return session.player_id
    ? [playerNameById.get(session.player_id) ?? "Unknown player"]
    : [];
}

function getSessionTitle(
  session: SessionRow,
  playerNameById: Map<string, string>,
): string {
  if (session.group_name?.trim()) return session.group_name;
  if (session.session_type?.trim()) return session.session_type;

  const names = getAssignedPlayerNames(session, playerNameById);
  if (names.length === 0) return "Untitled session";
  if (names.length <= 2) return names.join(" & ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
}

export function SessionsManager() {
  const [coachId, setCoachId] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [form, setForm] = useState<SessionFormState>(defaultFormState);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
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

      const [
        { data: playersData, error: playersError },
        { data: sessionsData, error: sessionsError },
      ] = await Promise.all([
        supabase
          .from("players")
          .select("id, player_name")
          .eq("coach_id", userId)
          .order("player_name", { ascending: true }),
        supabase
          .from("sessions")
          .select(SESSION_SELECT)
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

      setPlayers((playersData ?? []) as PlayerOption[]);
      setSessions((sessionsData ?? []) as SessionRow[]);
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSessionById = useCallback(
    async (userId: string, sessionId: string): Promise<SessionRow | null> => {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("sessions")
        .select(SESSION_SELECT)
        .eq("coach_id", userId)
        .eq("id", sessionId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      return (data ?? null) as SessionRow | null;
    },
    [],
  );

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

  function resetForm() {
    setEditingSessionId(null);
    setForm(defaultFormState);
    setSubmitError(null);
  }

  function startEditing(session: SessionRow) {
    setEditingSessionId(session.id);
    setSubmitError(null);
    setForm({
      selectedPlayerIds: getAssignedPlayerIds(session),
      groupName: session.group_name ?? "",
      sessionDateTime: toDateTimeLocalValue(session.session_date),
      sessionType: session.session_type ?? "",
      location: session.location ?? "",
      notes: session.notes ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveSessionPlayers(sessionId: string, playerIds: string[]) {
    const supabase = createClient();

    const { error: deleteError } = await supabase
      .from("session_players")
      .delete()
      .eq("session_id", sessionId);

    if (deleteError) {
      throw deleteError;
    }

    const { error: insertError } = await supabase.from("session_players").insert(
      playerIds.map((playerId) => ({
        session_id: sessionId,
        player_id: playerId,
      })),
    );

    if (insertError) {
      throw insertError;
    }
  }

  async function handleSubmitSession(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!coachId) {
      setSubmitError("You must be signed in to schedule sessions.");
      return;
    }
    if (form.selectedPlayerIds.length === 0) {
      setSubmitError("Please select at least one player.");
      return;
    }
    if (!form.sessionDateTime) {
      setSubmitError("Please provide session date and time.");
      return;
    }

    setSubmitError(null);
    setSaving(true);

    const payload = {
      coach_id: coachId,
      player_id: form.selectedPlayerIds[0],
      group_name: form.groupName.trim() || null,
      session_date: new Date(form.sessionDateTime).toISOString(),
      session_type: form.sessionType.trim() || null,
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
      attendance_status: "scheduled" as AttendanceStatus,
    };

    try {
      const supabase = createClient();

      if (editingSessionId) {
        const { error: updateError } = await supabase
          .from("sessions")
          .update({
            player_id: payload.player_id,
            group_name: payload.group_name,
            session_date: payload.session_date,
            session_type: payload.session_type,
            location: payload.location,
            notes: payload.notes,
          })
          .eq("id", editingSessionId)
          .eq("coach_id", coachId);

        if (updateError) {
          setSubmitError(updateError.message);
          return;
        }

        await saveSessionPlayers(editingSessionId, form.selectedPlayerIds);
        const refreshed = await loadSessionById(coachId, editingSessionId);
        if (refreshed) {
          setSessions((current) =>
            current.map((session) =>
              session.id === editingSessionId ? refreshed : session,
            ),
          );
        }
        resetForm();
        return;
      }

      const { data: created, error: insertError } = await supabase
        .from("sessions")
        .insert(payload)
        .select("id")
        .single();

      if (insertError || !created) {
        setSubmitError(insertError?.message ?? "Could not create the session.");
        return;
      }

      try {
        await saveSessionPlayers(created.id as string, form.selectedPlayerIds);
      } catch (sessionPlayersError) {
        await supabase.from("sessions").delete().eq("id", created.id).eq("coach_id", coachId);
        throw sessionPlayersError;
      }

      const refreshed = await loadSessionById(coachId, created.id as string);
      if (refreshed) {
        setSessions((current) => [refreshed, ...current]);
      }
      setForm((current) => ({
        ...current,
        sessionDateTime: "",
        notes: "",
      }));
    } catch (caughtError: unknown) {
      setSubmitError(getErrorMessage(caughtError));
      if (editingSessionId) {
        await loadCoachData(coachId);
      }
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
      if (editingSessionId === sessionId) {
        resetForm();
      }
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
        subtitle="Plan sessions for individuals or groups, assign multiple players, and keep attendance tied to the right session."
      />

      <section className="glass-panel rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              {editingSessionId ? "Edit session" : "Schedule session"}
            </h2>
            <p className="text-muted mt-1 text-sm">
              Add optional group naming like “U12 Development — Skills” and assign
              every player who should appear in the register.
            </p>
          </div>
          {editingSessionId ? (
            <button
              type="button"
              onClick={resetForm}
              className="border-border hover:bg-black/[0.03] inline-flex h-10 items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors dark:hover:bg-white/[0.06]"
            >
              <X className="size-4" aria-hidden />
              Cancel edit
            </button>
          ) : null}
        </div>

        <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmitSession}>
          <div className="sm:col-span-2">
            <PlayerMultiSelect
              players={players}
              selectedIds={form.selectedPlayerIds}
              onChange={(nextSelectedIds) =>
                setForm((current) => ({ ...current, selectedPlayerIds: nextSelectedIds }))
              }
              disabled={saving || players.length === 0}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="groupName">
              Group Name
            </label>
            <input
              id="groupName"
              value={form.groupName}
              onChange={(e) =>
                setForm((current) => ({ ...current, groupName: e.target.value }))
              }
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
              placeholder="e.g. Elite Finishing Group"
            />
            <p className="text-muted mt-2 text-xs">
              Optional. Leave blank if you want CoachFlow to use the session type or
              player list as the title.
            </p>
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
              Session Focus
            </label>
            <input
              id="sessionType"
              value={form.sessionType}
              onChange={(e) =>
                setForm((current) => ({ ...current, sessionType: e.target.value }))
              }
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
              placeholder="e.g. Finishing, Technical, Goalkeeping"
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

          <div className="sm:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={saving || players.length === 0}
              className="bg-foreground text-background hover:opacity-90 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  {editingSessionId ? "Saving..." : "Scheduling..."}
                </>
              ) : editingSessionId ? (
                "Save session"
              ) : (
                "Schedule session"
              )}
            </button>
            <p className="text-muted text-sm">
              {form.selectedPlayerIds.length} player
              {form.selectedPlayerIds.length === 1 ? "" : "s"} will be attached to
              this session.
            </p>
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
              Schedule your first 1:1 or group session to start tracking attendance.
            </p>
          </div>
        ) : null}

        {!loading && !error && sessions.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {sessions.map((session) => {
              const assignedNames = getAssignedPlayerNames(session, playerNameById);
              const assignedCount = assignedNames.length;

              return (
                <article key={session.id} className="glass-panel rounded-2xl p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-semibold tracking-tight">
                        {getSessionTitle(session, playerNameById)}
                      </h3>
                      <p className="text-muted mt-1 text-sm">
                        {formatSessionDate(session.session_date)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEditing(session)}
                        className="text-muted hover:text-foreground inline-flex items-center justify-center rounded-lg p-2 transition-colors"
                        aria-label="Edit session"
                      >
                        <Pencil className="size-4" aria-hidden />
                      </button>
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
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className="bg-accent/10 text-accent ring-accent/20 inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ring-1">
                      <Users className="size-3.5" aria-hidden />
                      {assignedCount} player{assignedCount === 1 ? "" : "s"}
                    </span>
                    {session.session_type ? (
                      <span className="border-border text-muted inline-flex rounded-full border px-2.5 py-1 font-medium">
                        {session.session_type}
                      </span>
                    ) : null}
                  </div>

                  {assignedNames.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {assignedNames.map((name) => (
                        <span
                          key={`${session.id}-${name}`}
                          className="bg-black/[0.02] text-sm rounded-full px-3 py-1 dark:bg-white/[0.03]"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 space-y-2 text-sm">
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
                      Attendance status for all assigned players
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
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}
