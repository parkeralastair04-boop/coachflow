"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Eye,
  EyeOff,
  Loader2,
  MapPin,
  Pencil,
  PoundSterling,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { FeaturePageHeader } from "@/components/feature-page-header";
import { PlayerMultiSelect } from "@/components/player-multi-select";
import {
  getDayLabel,
  formatMinutes,
  formatPoundsFromPence,
  parsePoundsToPence,
  type CoachAvailabilityRow,
  type SessionBookingRow,
} from "@/lib/booking-system";
import { summarizeSessionBookings } from "@/lib/session-booking-state";
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
  academy_id: string | null;
  player_id: string | null;
  group_name: string | null;
  session_date: string;
  session_type: string | null;
  location: string | null;
  notes: string | null;
  attendance_status: AttendanceStatus;
  created_at: string;
  session_players: SessionPlayerLink[] | null;
  duration_minutes: number;
  price: number;
  capacity: number;
  is_public: boolean;
  booking_enabled: boolean;
  source_availability_id: string | null;
};

type SessionBookingSummary = Pick<
  SessionBookingRow,
  "id" | "session_id" | "booking_status" | "payment_status" | "amount" | "expires_at"
>;

type SessionFormState = {
  availabilityTemplateId: string;
  selectedPlayerIds: string[];
  groupName: string;
  sessionDateTime: string;
  sessionType: string;
  location: string;
  notes: string;
  durationMinutes: string;
  price: string;
  capacity: string;
  visibility: "public" | "private";
  bookingEnabled: boolean;
};

const SESSION_SELECT = `
  id,
  coach_id,
  academy_id,
  player_id,
  group_name,
  session_date,
  session_type,
  location,
  notes,
  attendance_status,
  created_at,
  duration_minutes,
  price,
  capacity,
  is_public,
  booking_enabled,
  source_availability_id,
  session_players (
    player_id,
    player:players (
      id,
      player_name
    )
  )
`;

const defaultFormState: SessionFormState = {
  availabilityTemplateId: "",
  selectedPlayerIds: [],
  groupName: "",
  sessionDateTime: "",
  sessionType: "1-to-1",
  location: "",
  notes: "",
  durationMinutes: "60",
  price: "0.00",
  capacity: "1",
  visibility: "private",
  bookingEnabled: false,
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

function sortSessions(a: SessionRow, b: SessionRow) {
  return new Date(b.session_date).getTime() - new Date(a.session_date).getTime();
}

export function SessionsManager() {
  const [coachId, setCoachId] = useState<string | null>(null);
  const [academyId, setAcademyId] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [availabilityTemplates, setAvailabilityTemplates] = useState<CoachAvailabilityRow[]>([]);
  const [sessionBookings, setSessionBookings] = useState<SessionBookingSummary[]>([]);
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

  const templateById = useMemo(
    () => new Map(availabilityTemplates.map((template) => [template.id, template])),
    [availabilityTemplates],
  );

  const loadCoachData = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      const [
        { data: playersData, error: playersError },
        { data: sessionsData, error: sessionsError },
        { data: availabilityData, error: availabilityError },
        { data: bookingsData, error: bookingsError },
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
        supabase
          .from("coach_availability")
          .select(
            "id, coach_id, academy_id, day_of_week, start_time, end_time, session_type, duration_minutes, default_price, default_capacity, is_public, created_at",
          )
          .eq("coach_id", userId)
          .order("day_of_week", { ascending: true })
          .order("start_time", { ascending: true }),
        supabase
          .from("session_bookings")
          .select("id, session_id, booking_status, payment_status, amount, expires_at")
          .eq("coach_id", userId),
      ]);

      if (playersError || sessionsError || availabilityError || bookingsError) {
        setError(
          playersError?.message ??
            sessionsError?.message ??
            availabilityError?.message ??
            bookingsError?.message ??
            "Could not load sessions.",
        );
        return;
      }

      setPlayers((playersData ?? []) as PlayerOption[]);
      setSessions(((sessionsData ?? []) as SessionRow[]).sort(sortSessions));
      setAvailabilityTemplates((availabilityData ?? []) as CoachAvailabilityRow[]);
      setSessionBookings((bookingsData ?? []) as SessionBookingSummary[]);
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
        const { data: membership } = await supabase
          .from("academy_members")
          .select("academy_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        setAcademyId((membership?.academy_id as string | undefined) ?? null);
        await supabase.rpc("sync_active_recurring_series_for_coach", {
          p_coach_id: user.id,
        });
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

  function applyTemplate(templateId: string) {
    const template = templateById.get(templateId);
    setForm((current) => {
      if (!template) {
        return { ...current, availabilityTemplateId: "" };
      }

      return {
        ...current,
        availabilityTemplateId: template.id,
        sessionType: template.session_type,
        durationMinutes: String(template.duration_minutes),
        price: (template.default_price / 100).toFixed(2),
        capacity: String(template.default_capacity),
        visibility: template.is_public ? "public" : "private",
        bookingEnabled: template.is_public,
      };
    });
  }

  function resetForm() {
    setEditingSessionId(null);
    setForm(defaultFormState);
    setSubmitError(null);
  }

  function startEditing(session: SessionRow) {
    setEditingSessionId(session.id);
    setSubmitError(null);
    setForm({
      availabilityTemplateId: session.source_availability_id ?? "",
      selectedPlayerIds: getAssignedPlayerIds(session),
      groupName: session.group_name ?? "",
      sessionDateTime: toDateTimeLocalValue(session.session_date),
      sessionType: session.session_type ?? "1-to-1",
      location: session.location ?? "",
      notes: session.notes ?? "",
      durationMinutes: String(session.duration_minutes),
      price: (session.price / 100).toFixed(2),
      capacity: String(session.capacity),
      visibility: session.is_public ? "public" : "private",
      bookingEnabled: session.booking_enabled,
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

    if (playerIds.length === 0) return;

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

  async function handleSubmitSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!coachId) {
      setSubmitError("You must be signed in to schedule sessions.");
      return;
    }
    if (!form.sessionDateTime) {
      setSubmitError("Please provide session date and time.");
      return;
    }
    if (!form.sessionType.trim()) {
      setSubmitError("Please choose a session type.");
      return;
    }

    const durationMinutes = Number.parseInt(form.durationMinutes, 10);
    const capacity = Number.parseInt(form.capacity, 10);
    if (!Number.isFinite(durationMinutes) || durationMinutes < 15) {
      setSubmitError("Duration must be at least 15 minutes.");
      return;
    }
    if (!Number.isFinite(capacity) || capacity < 1) {
      setSubmitError("Capacity must be at least 1.");
      return;
    }

    setSubmitError(null);
    setSaving(true);

    const payload = {
      coach_id: coachId,
      academy_id: academyId,
      player_id: form.selectedPlayerIds[0] ?? null,
      group_name: form.groupName.trim() || null,
      session_date: new Date(form.sessionDateTime).toISOString(),
      session_type: form.sessionType.trim(),
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
      attendance_status: "scheduled" as AttendanceStatus,
      duration_minutes: durationMinutes,
      price: parsePoundsToPence(form.price),
      capacity,
      is_public: form.visibility === "public",
      booking_enabled: form.visibility === "public" ? form.bookingEnabled : false,
      source_availability_id: form.availabilityTemplateId || null,
    };

    try {
      const supabase = createClient();

      if (editingSessionId) {
        const { error: updateError } = await supabase
          .from("sessions")
          .update(payload)
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
            current
              .map((session) => (session.id === editingSessionId ? refreshed : session))
              .sort(sortSessions),
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
        setSessions((current) => [refreshed, ...current].sort(sortSessions));
      }
      setForm((current) => ({
        ...defaultFormState,
        sessionDateTime: "",
        location: current.location,
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

  async function updateAttendanceStatus(sessionId: string, nextStatus: AttendanceStatus) {
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
          session.id === sessionId ? { ...session, attendance_status: nextStatus } : session,
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
      setSessionBookings((current) => current.filter((booking) => booking.session_id !== sessionId));
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
        subtitle="Create sessions from availability templates, override price or capacity, and publish bookable slots without losing manual internal control."
      />

      <section className="glass-panel rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              {editingSessionId ? "Edit session" : "Create session"}
            </h2>
            <p className="text-muted mt-1 text-sm">
              Start from an availability template to auto-fill duration, pricing,
              capacity, and visibility, then override anything before saving.
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
            <label className="mb-2 block text-sm font-medium" htmlFor="availabilityTemplate">
              Availability template
            </label>
            <select
              id="availabilityTemplate"
              value={form.availabilityTemplateId}
              onChange={(event) => applyTemplate(event.target.value)}
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
            >
              <option value="">Create without a template</option>
              {availabilityTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.session_type} · {getDayLabel(template.day_of_week)} ·{" "}
                  {template.start_time.slice(0, 5)} - {template.end_time.slice(0, 5)}
                </option>
              ))}
            </select>
            <p className="text-muted mt-2 text-xs">
              Templates are optional, but they speed up public session creation and keep
              pricing consistent.
            </p>
          </div>

          <div className="sm:col-span-2">
            <PlayerMultiSelect
              players={players}
              selectedIds={form.selectedPlayerIds}
              onChange={(nextSelectedIds) =>
                setForm((current) => ({ ...current, selectedPlayerIds: nextSelectedIds }))
              }
              disabled={saving}
            />
            <p className="text-muted mt-3 text-xs">
              Manual player assignments remain optional so public sessions can start empty
              and fill from bookings later.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="groupName">
              Group name
            </label>
            <input
              id="groupName"
              value={form.groupName}
              onChange={(event) =>
                setForm((current) => ({ ...current, groupName: event.target.value }))
              }
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
              placeholder="e.g. Elite Finishing Group"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="sessionDateTime">
              Session date and time
            </label>
            <input
              id="sessionDateTime"
              type="datetime-local"
              required
              value={form.sessionDateTime}
              onChange={(event) =>
                setForm((current) => ({ ...current, sessionDateTime: event.target.value }))
              }
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="sessionType">
              Session type
            </label>
            <input
              id="sessionType"
              required
              value={form.sessionType}
              onChange={(event) =>
                setForm((current) => ({ ...current, sessionType: event.target.value }))
              }
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
              placeholder="1-to-1, Group Session, Camp"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="location">
              Location
            </label>
            <input
              id="location"
              value={form.location}
              onChange={(event) =>
                setForm((current) => ({ ...current, location: event.target.value }))
              }
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
              placeholder="e.g. Pitch A"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="durationMinutes">
              Duration (mins)
            </label>
            <input
              id="durationMinutes"
              type="number"
              min={15}
              step={15}
              value={form.durationMinutes}
              onChange={(event) =>
                setForm((current) => ({ ...current, durationMinutes: event.target.value }))
              }
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="sessionPrice">
              Price
            </label>
            <div className="border-border bg-background flex h-11 items-center rounded-xl border px-3">
              <PoundSterling className="text-muted size-4 shrink-0" aria-hidden />
              <input
                id="sessionPrice"
                value={form.price}
                onChange={(event) =>
                  setForm((current) => ({ ...current, price: event.target.value }))
                }
                className="h-full w-full bg-transparent text-sm outline-none"
                placeholder="45.00"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="sessionCapacity">
              Capacity
            </label>
            <input
              id="sessionCapacity"
              type="number"
              min={1}
              value={form.capacity}
              onChange={(event) =>
                setForm((current) => ({ ...current, capacity: event.target.value }))
              }
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="sessionVisibility">
              Visibility
            </label>
            <select
              id="sessionVisibility"
              value={form.visibility}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  visibility: event.target.value as "public" | "private",
                  bookingEnabled:
                    event.target.value === "public" ? current.bookingEnabled : false,
                }))
              }
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
            >
              <option value="private">Private / internal only</option>
              <option value="public">Publicly bookable</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="sessionBookingEnabled">
              Public booking
            </label>
            <select
              id="sessionBookingEnabled"
              value={form.bookingEnabled ? "enabled" : "disabled"}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  bookingEnabled: event.target.value === "enabled",
                }))
              }
              disabled={form.visibility !== "public"}
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 disabled:opacity-60"
            >
              <option value="enabled">Booking enabled</option>
              <option value="disabled">Booking paused</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium" htmlFor="notes">
              Notes
            </label>
            <textarea
              id="notes"
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
              className="border-border bg-background text-foreground focus:ring-accent/40 min-h-24 w-full rounded-xl border px-3 py-2 text-sm outline-none ring-offset-2 focus:ring-2"
              placeholder="Training focus, prep notes, or parent-facing details..."
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
              disabled={saving}
              className="bg-foreground text-background hover:opacity-90 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  {editingSessionId ? "Saving..." : "Creating..."}
                </>
              ) : editingSessionId ? (
                "Save session"
              ) : (
                "Create session"
              )}
            </button>
            <p className="text-muted text-sm">
              {form.selectedPlayerIds.length} internal player
              {form.selectedPlayerIds.length === 1 ? "" : "s"} assigned.
            </p>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">All sessions</h2>
          {!loading ? <span className="text-muted text-sm">{sessions.length} total</span> : null}
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
              Create your first bookable slot or internal session to start taking bookings.
            </p>
          </div>
        ) : null}

        {!loading && !error && sessions.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {sessions.map((session) => {
              const assignedNames = getAssignedPlayerNames(session, playerNameById);
              const assignedCount = assignedNames.length;
              const bookingStats = summarizeSessionBookings(
                sessionBookings.filter((booking) => booking.session_id === session.id),
                session.capacity,
              );
              const remainingSpaces = bookingStats.remainingSpaces;

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
                      {assignedCount} internal player{assignedCount === 1 ? "" : "s"}
                    </span>
                    <span className="border-border text-muted inline-flex rounded-full border px-2.5 py-1 font-medium">
                      {session.session_type ?? "Session"}
                    </span>
                    <span className="border-border text-muted inline-flex rounded-full border px-2.5 py-1 font-medium">
                      {formatMinutes(session.duration_minutes)}
                    </span>
                    <span className="border-border text-muted inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium">
                      {session.is_public ? (
                        <>
                          <Eye className="size-3.5" aria-hidden />
                          Public
                        </>
                      ) : (
                        <>
                          <EyeOff className="size-3.5" aria-hidden />
                          Private
                        </>
                      )}
                    </span>
                    {session.is_public ? (
                      <span className="border-border text-muted inline-flex rounded-full border px-2.5 py-1 font-medium">
                        {session.booking_enabled ? "Booking live" : "Booking paused"}
                      </span>
                    ) : null}
                  </div>

                  {assignedNames.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {assignedNames.map((name) => (
                        <span
                          key={`${session.id}-${name}`}
                          className="rounded-full bg-black/[0.02] px-3 py-1 text-sm dark:bg-white/[0.03]"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
                      <p className="text-muted text-xs">Price</p>
                      <p className="mt-1 font-medium">
                        {formatPoundsFromPence(session.price)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
                      <p className="text-muted text-xs">Capacity</p>
                      <p className="mt-1 font-medium">
                        {session.capacity} total · {remainingSpaces} left
                      </p>
                    </div>
                    <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
                      <p className="text-muted text-xs">Bookings</p>
                      <p className="mt-1 font-medium">
                        {bookingStats.confirmed} confirmed · {bookingStats.waitlist} waitlist
                      </p>
                    </div>
                    <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
                      <p className="text-muted text-xs">Availability source</p>
                      <p className="mt-1 font-medium">
                        {session.source_availability_id ? "Template linked" : "Manual"}
                      </p>
                    </div>
                  </div>

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
                      Attendance status
                    </label>
                    <select
                      id={`attendance-${session.id}`}
                      value={session.attendance_status}
                      disabled={statusUpdatingId === session.id}
                      onChange={(event) =>
                        void updateAttendanceStatus(
                          session.id,
                          event.target.value as AttendanceStatus,
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
