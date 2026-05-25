"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarCheck,
  Loader2,
  MapPin,
  RotateCw,
  ShieldCheck,
  Users,
  WifiOff,
} from "lucide-react";
import { FeatureInfoTooltip } from "@/components/feature-info-tooltip";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type AttendanceStatus = "scheduled" | "attended" | "missed" | "cancelled";

type SessionPlayerLink = {
  player_id: string;
  player: {
    id: string;
    player_name: string;
  }[] | {
    id: string;
    player_name: string;
  } | null;
};

type PlayerRow = {
  id: string;
  player_name: string;
};

type SessionBookingLink = {
  session_id: string;
  player_id: string;
  booking_status: "pending" | "confirmed" | "waitlist" | "cancelled";
  player: {
    id: string;
    player_name: string;
  }[] | {
    id: string;
    player_name: string;
  } | null;
};

type RegisterSession = {
  id: string;
  coach_id: string;
  player_id: string | null;
  group_name: string | null;
  session_date: string;
  session_type: string | null;
  location: string | null;
  attendance_status: AttendanceStatus;
  session_players: SessionPlayerLink[] | null;
};

type OfflineAttendanceChange = {
  id: string;
  coachId: string;
  sessionId: string;
  attendanceStatus: AttendanceStatus;
  updatedAt: string;
};

type SyncState = "online" | "offline" | "syncing" | "synced";

const attendanceOptions: AttendanceStatus[] = [
  "scheduled",
  "attended",
  "missed",
  "cancelled",
];

const SESSION_SELECT = `
  id,
  coach_id,
  player_id,
  group_name,
  session_date,
  session_type,
  location,
  attendance_status,
  session_players (
    player_id,
    player:players (
      id,
      player_name
    )
  )
`;

const DB_NAME = "coachflow-registers";
const DB_VERSION = 1;
const STORE_NAME = "attendance_changes";
const LOCAL_STORAGE_KEY = "coachflow:offline-attendance-changes";

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
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function getAssignedPlayerNames(
  session: RegisterSession,
  playerNameById: Map<string, string>,
  sessionBookings: SessionBookingLink[],
): string[] {
  const namesByPlayerId = new Map<string, string>();

  for (const booking of sessionBookings) {
    if (booking.session_id !== session.id || booking.booking_status !== "confirmed") continue;
    const player = Array.isArray(booking.player) ? booking.player[0] : booking.player;
    namesByPlayerId.set(
      booking.player_id,
      player?.player_name ?? playerNameById.get(booking.player_id) ?? "Unknown player",
    );
  }

  const linkedNames = (session.session_players ?? [])
    .map((link) => {
      const player = Array.isArray(link.player) ? link.player[0] : link.player;
      const name =
        player?.player_name ?? playerNameById.get(link.player_id) ?? null;
      if (name) {
        namesByPlayerId.set(link.player_id, name);
      }
      return name;
    })
    .filter((name): name is string => Boolean(name));

  if (linkedNames.length > 0 || namesByPlayerId.size > 0) {
    return [...namesByPlayerId.values()];
  }

  if (session.player_id) {
    return [playerNameById.get(session.player_id) ?? "Unknown player"];
  }

  return [];
}

function getRegisterTitle(
  session: RegisterSession,
  playerNameById: Map<string, string>,
  sessionBookings: SessionBookingLink[],
): string {
  if (session.group_name?.trim()) return session.group_name;
  if (session.session_type?.trim()) return session.session_type;

  const names = getAssignedPlayerNames(session, playerNameById, sessionBookings);
  if (names.length === 0) return "Untitled session";
  if (names.length <= 2) return names.join(" & ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
}

function queueKey(coachId: string, sessionId: string): string {
  return `${coachId}:${sessionId}`;
}

function openOfflineDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

async function readLocalStorageQueue(): Promise<OfflineAttendanceChange[]> {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as OfflineAttendanceChange[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeLocalStorageQueue(
  changes: OfflineAttendanceChange[],
): Promise<void> {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(changes));
}

async function getQueuedChanges(): Promise<OfflineAttendanceChange[]> {
  const db = await openOfflineDb();
  if (!db) return readLocalStorageQueue();

  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () =>
      resolve((request.result ?? []) as OfflineAttendanceChange[]);
    request.onerror = () => resolve([]);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();
  });
}

async function saveQueuedChange(change: OfflineAttendanceChange): Promise<void> {
  const db = await openOfflineDb();
  if (!db) {
    const existing = await readLocalStorageQueue();
    const withoutCurrent = existing.filter((item) => item.id !== change.id);
    await writeLocalStorageQueue([...withoutCurrent, change]);
    return;
  }

  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(change);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      resolve();
    };
  });
}

async function deleteQueuedChange(id: string): Promise<void> {
  const db = await openOfflineDb();
  if (!db) {
    const existing = await readLocalStorageQueue();
    await writeLocalStorageQueue(existing.filter((item) => item.id !== id));
    return;
  }

  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      resolve();
    };
  });
}

function StatusIndicator({
  state,
  pendingCount,
}: {
  state: SyncState;
  pendingCount: number;
}) {
  const labels: Record<SyncState, string> = {
    online: "Online ✅",
    offline: "Offline ⚠️",
    syncing: "Syncing 🔄",
    synced: "Synced ✅",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1",
        state === "offline"
          ? "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300"
          : "bg-accent/10 text-accent ring-accent/25",
      )}
    >
      {labels[state]}
      {pendingCount > 0 ? (
        <span className="ml-2 text-[11px] opacity-80">
          {pendingCount} pending
        </span>
      ) : null}
    </div>
  );
}

export function RegistersManager() {
  const [coachId, setCoachId] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [sessionBookings, setSessionBookings] = useState<SessionBookingLink[]>([]);
  const [sessions, setSessions] = useState<RegisterSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [online, setOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );
  const [syncState, setSyncState] = useState<SyncState>(() =>
    typeof navigator === "undefined" || navigator.onLine ? "online" : "offline",
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [queuedSessionIds, setQueuedSessionIds] = useState<string[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const syncingRef = useRef(false);

  const playerNameById = useMemo(
    () => new Map(players.map((player) => [player.id, player.player_name])),
    [players],
  );

  const refreshPendingCount = useCallback(async () => {
    const queued = await getQueuedChanges();
    setPendingCount(queued.length);
    setQueuedSessionIds(queued.map((change) => change.sessionId));
    return queued;
  }, []);

  const loadRegisters = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const [
        { data: sessionsData, error: sessionsError },
        { data: playersData, error: playersError },
        { data: bookingsData, error: bookingsError },
      ] = await Promise.all([
        supabase
          .from("sessions")
          .select(SESSION_SELECT)
          .eq("coach_id", userId)
          .order("session_date", { ascending: false }),
        supabase
          .from("players")
          .select("id, player_name")
          .eq("coach_id", userId),
        supabase
          .from("session_bookings")
          .select(
            `
              session_id,
              player_id,
              booking_status,
              player:players (
                id,
                player_name
              )
            `,
          )
          .eq("coach_id", userId)
          .eq("booking_status", "confirmed"),
      ]);

      if (sessionsError || playersError || bookingsError) {
        setError(
          sessionsError?.message ??
            playersError?.message ??
            bookingsError?.message ??
            "Could not load registers.",
        );
        return;
      }

      const safeSessions = (sessionsData ?? []) as RegisterSession[];
      setPlayers((playersData ?? []) as PlayerRow[]);
      setSessionBookings((bookingsData ?? []) as SessionBookingLink[]);
      const queued = await refreshPendingCount();
      const queuedBySession = new Map(
        queued
          .filter((change) => change.coachId === userId)
          .map((change) => [change.sessionId, change.attendanceStatus]),
      );

      setSessions(
        safeSessions.map((session) => ({
          ...session,
          attendance_status:
            queuedBySession.get(session.id) ?? session.attendance_status,
        })),
      );
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [refreshPendingCount]);

  const syncQueuedChanges = useCallback(async () => {
    if (
      syncingRef.current ||
      (typeof navigator !== "undefined" && !navigator.onLine)
    ) {
      return;
    }

    const queued = await getQueuedChanges();
    if (queued.length === 0) {
      setPendingCount(0);
      setSyncState("synced");
      return;
    }

    syncingRef.current = true;
    setSyncState("syncing");
    setActionError(null);

    try {
      const supabase = createClient();
      for (const change of queued) {
        const { error: updateError } = await supabase
          .from("sessions")
          .update({ attendance_status: change.attendanceStatus })
          .eq("id", change.sessionId)
          .eq("coach_id", change.coachId);

        if (updateError) {
          throw updateError;
        }

        await deleteQueuedChange(change.id);
      }

      await refreshPendingCount();
      setSyncState("synced");
    } catch (caughtError: unknown) {
      setActionError(getErrorMessage(caughtError));
      setSyncState("online");
      await refreshPendingCount();
    } finally {
      syncingRef.current = false;
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
      setSyncState("online");
      void syncQueuedChanges();
    }

    function handleOffline() {
      setOnline(false);
      setSyncState("offline");
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncQueuedChanges]);

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
          setError("You must be signed in to manage registers.");
          setLoading(false);
          return;
        }

        setCoachId(user.id);
        await loadRegisters(user.id);
        await syncQueuedChanges();
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
  }, [loadRegisters, syncQueuedChanges]);

  async function queueAttendanceChange(
    userId: string,
    sessionId: string,
    nextStatus: AttendanceStatus,
  ) {
    await saveQueuedChange({
      id: queueKey(userId, sessionId),
      coachId: userId,
      sessionId,
      attendanceStatus: nextStatus,
      updatedAt: new Date().toISOString(),
    });
    await refreshPendingCount();
  }

  async function updateAttendanceStatus(
    sessionId: string,
    nextStatus: AttendanceStatus,
  ) {
    if (!coachId) {
      setActionError("You must be signed in to update registers.");
      return;
    }

    setActionError(null);
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? { ...session, attendance_status: nextStatus }
          : session,
      ),
    );

    if (!online) {
      await queueAttendanceChange(coachId, sessionId, nextStatus);
      setSyncState("offline");
      return;
    }

    setUpdatingId(sessionId);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("sessions")
        .update({ attendance_status: nextStatus })
        .eq("id", sessionId)
        .eq("coach_id", coachId);

      if (updateError) {
        throw updateError;
      }

      await deleteQueuedChange(queueKey(coachId, sessionId));
      await refreshPendingCount();
      setSyncState("synced");
    } catch (caughtError: unknown) {
      await queueAttendanceChange(coachId, sessionId, nextStatus);
      setActionError(
        `${getErrorMessage(caughtError)} Saved locally and will sync when online.`,
      );
      setSyncState(typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline");
    } finally {
      setUpdatingId(null);
    }
  }

  const activeSyncState: SyncState = !online ? "offline" : syncState;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Group Registers
            </h1>
            <FeatureInfoTooltip featureKey="registers" />
          </div>
          <p className="text-muted mt-1 text-sm">
            Mark attendance on the pitch, keep working offline, and sync when
            signal returns.
          </p>
        </div>
        <StatusIndicator state={activeSyncState} pendingCount={pendingCount} />
      </div>

      {!online ? (
        <div className="glass-panel border-amber-500/25 bg-amber-500/8 flex items-start gap-3 rounded-2xl p-5 text-sm ring-1 ring-amber-500/20">
          <WifiOff className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-300" />
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-200">
              Offline mode active
            </p>
            <p className="text-muted mt-1">
              Attendance changes are being saved locally. CoachFlow will sync
              them automatically when your connection returns.
            </p>
          </div>
        </div>
      ) : null}

      <section className="glass-panel rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="bg-accent/10 ring-accent/20 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
              <ShieldCheck className="text-accent size-5" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Offline-ready attendance
              </h2>
              <p className="text-muted mt-1 text-sm">
                Latest changes per session are de-duplicated locally before
                syncing to Supabase.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={!online || syncState === "syncing" || pendingCount === 0}
            onClick={() => void syncQueuedChanges()}
            className="border-border hover:bg-black/[0.03] inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors disabled:opacity-50 dark:hover:bg-white/[0.06]"
          >
            {syncState === "syncing" ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Syncing
              </>
            ) : (
              <>
                <RotateCw className="mr-2 size-4" aria-hidden />
                Sync now
              </>
            )}
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Session registers</h2>
          {!loading ? (
            <span className="text-muted text-sm">{sessions.length} sessions</span>
          ) : null}
        </div>

        {error ? (
          <div className="glass-panel rounded-2xl p-6 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        ) : null}

        {actionError ? (
          <div className="glass-panel rounded-2xl p-6 text-sm text-amber-700 dark:text-amber-300">
            {actionError}
          </div>
        ) : null}

        {loading ? (
          <div className="glass-panel flex items-center gap-3 rounded-2xl p-6 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading registers...
          </div>
        ) : null}

        {!loading && !error && sessions.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center">
            <CalendarCheck className="text-muted mx-auto size-8" aria-hidden />
            <p className="mt-3 font-medium">No sessions to register</p>
            <p className="text-muted mt-1 text-sm">
              Schedule sessions first, then use this page for group attendance.
            </p>
          </div>
        ) : null}

        {!loading && !error && sessions.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {sessions.map((session) => {
              const assignedNames = getAssignedPlayerNames(
                session,
                playerNameById,
                sessionBookings,
              );

              return (
              <article
                key={session.id}
                className="glass-panel rounded-2xl p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold tracking-tight">
                      {getRegisterTitle(session, playerNameById, sessionBookings)}
                    </h3>
                    <p className="text-muted mt-1 text-sm">
                      {formatSessionDate(session.session_date)}
                    </p>
                  </div>
                  {queuedSessionIds.includes(session.id) ? (
                    <span className="bg-amber-500/10 text-amber-700 ring-amber-500/25 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 dark:text-amber-300">
                      local queue
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <p className="inline-flex items-center gap-1.5">
                    <Users className="text-muted size-3.5" aria-hidden />
                    {assignedNames.length} rostered player
                    {assignedNames.length === 1 ? "" : "s"}
                  </p>
                  <p>
                    <span className="text-muted">Type:</span>{" "}
                    {session.session_type ?? "N/A"}
                  </p>
                  <p className="inline-flex items-center gap-1.5">
                    <MapPin className="text-muted size-3.5" aria-hidden />
                    {session.location ?? "No location"}
                  </p>
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

                <div className="mt-5">
                  <p className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted">
                    Mark all assigned players
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {attendanceOptions.map((status) => (
                      <button
                        key={status}
                        type="button"
                        disabled={updatingId === session.id}
                        onClick={() => void updateAttendanceStatus(session.id, status)}
                        className={cn(
                          "border-border hover:bg-black/[0.03] rounded-xl border px-3 py-2 text-sm font-medium capitalize transition-colors disabled:opacity-60 dark:hover:bg-white/[0.06]",
                          session.attendance_status === status &&
                            "bg-accent/10 text-accent ring-accent/20 border-accent/30 ring-1",
                        )}
                      >
                        {updatingId === session.id && session.attendance_status === status ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                            Saving
                          </span>
                        ) : (
                          status
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}
