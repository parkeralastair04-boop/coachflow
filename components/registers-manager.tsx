"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CalendarCheck,
  Check,
  Clock,
  FileText,
  HeartPulse,
  Loader2,
  MapPin,
  RotateCw,
  ShieldCheck,
  Users,
  WifiOff,
  X,
} from "lucide-react";
import { FeaturePageHeader } from "@/components/feature-page-header";
import { CoachSetupGuidance } from "@/components/coach-setup-guidance";
import {
  PRIMARY_ATTENDANCE_STATUS_OPTIONS,
  SECONDARY_ATTENDANCE_STATUS_OPTIONS,
  countMarkedPlayers,
  getAttendanceLabel,
  getAttendanceSummary,
  type PlayerAttendanceRow,
  type PlayerAttendanceStatus,
} from "@/lib/attendance";
import { getTeamDisplayName, unwrapSingleRelation, type TeamSummary } from "@/lib/team-management";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { PanelSkeleton } from "@/components/branded-loading";

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

type TeamPlayerLink = {
  player_id: string;
  squad_order: number;
  player: {
    id: string;
    player_name: string;
  }[] | {
    id: string;
    player_name: string;
  } | null;
};

type TeamOption = TeamSummary & {
  team_players: TeamPlayerLink[] | null;
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
  team_id: string | null;
  group_name: string | null;
  session_date: string;
  session_type: string | null;
  location: string | null;
  session_players: SessionPlayerLink[] | null;
  team: TeamSummary[] | TeamSummary | null;
};

type AttendanceRow = PlayerAttendanceRow & {
  id: string;
  coach_id: string;
};

type OfflineAttendanceChange = {
  id: string;
  coachId: string;
  sessionId: string;
  playerId: string;
  status: PlayerAttendanceStatus;
  notes: string | null;
  recordedAt: string;
};

type SyncState = "online" | "offline" | "syncing" | "synced";

type SessionPeriod = "today" | "upcoming-this-week" | "later" | "previous";

type SessionPeriodFilter = "all" | "today" | "this-week" | "previous";

type SessionGroup = {
  id: "today" | "upcoming-this-week" | "previous";
  label: string;
  sessions: RegisterSession[];
};

type RosterPlayer = {
  player_id: string;
  player_name: string;
  attendance: AttendanceRow | null;
  noteDraft: string;
};

const SESSION_SELECT = `
  id,
  coach_id,
  player_id,
  team_id,
  group_name,
  session_date,
  session_type,
  location,
  team:teams (
    id,
    team_name,
    age_group,
    team_color
  ),
  session_players (
    player_id,
    player:players (
      id,
      player_name
    )
  )
`;

const ATTENDANCE_SELECT =
  "id, coach_id, session_id, player_id, status, notes, recorded_at";

const DB_NAME = "awarix-registers-v2";
const DB_VERSION = 1;
const STORE_NAME = "attendance_changes";
const LOCAL_STORAGE_KEY = "awarix:offline-player-attendance";

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

function formatRecordedAt(value: string | null): string {
  if (!value) return "Not marked yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Saved";
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function getRegisterTitle(session: RegisterSession): string {
  if (session.group_name?.trim()) return session.group_name;
  const team = unwrapSingleRelation(session.team);
  if (team?.team_name?.trim()) return team.team_name;
  if (session.session_type?.trim()) return session.session_type;
  return "Untitled session";
}

function startOfLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function startOfLocalWeek(date: Date): Date {
  const day = startOfLocalDay(date);
  const weekday = day.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  day.setDate(day.getDate() + diff);
  return day;
}

function endOfLocalWeek(date: Date): Date {
  const start = startOfLocalWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return endOfLocalDay(end);
}

function getSessionPeriod(sessionDate: string, now = new Date()): SessionPeriod {
  const session = new Date(sessionDate);
  if (Number.isNaN(session.getTime())) return "previous";

  const todayStart = startOfLocalDay(now);
  const todayEnd = endOfLocalDay(now);

  if (session < todayStart) return "previous";
  if (session <= todayEnd) return "today";

  const weekEnd = endOfLocalWeek(now);
  if (session <= weekEnd) return "upcoming-this-week";

  return "later";
}

function isSessionInThisWeek(sessionDate: string, now = new Date()): boolean {
  const session = new Date(sessionDate);
  if (Number.isNaN(session.getTime())) return false;
  return session >= startOfLocalWeek(now) && session <= endOfLocalWeek(now);
}

function sortSessionsAscending(left: RegisterSession, right: RegisterSession): number {
  return new Date(left.session_date).getTime() - new Date(right.session_date).getTime();
}

function groupSessionsByPeriod(sessions: RegisterSession[]): SessionGroup[] {
  const buckets: Record<SessionPeriod, RegisterSession[]> = {
    today: [],
    "upcoming-this-week": [],
    later: [],
    previous: [],
  };

  for (const session of sessions) {
    buckets[getSessionPeriod(session.session_date)].push(session);
  }

  for (const bucket of Object.values(buckets)) {
    bucket.sort(sortSessionsAscending);
  }

  const upcomingSessions = [
    ...buckets["upcoming-this-week"],
    ...buckets.later,
  ].sort(sortSessionsAscending);

  return [
    { id: "today" as const, label: "Today", sessions: buckets.today },
    {
      id: "upcoming-this-week" as const,
      label: "Upcoming this week",
      sessions: upcomingSessions,
    },
    { id: "previous" as const, label: "Previous sessions", sessions: buckets.previous },
  ].filter((group) => group.sessions.length > 0);
}

function filterSessionsByPeriod(
  sessions: RegisterSession[],
  filter: SessionPeriodFilter,
): RegisterSession[] {
  const now = new Date();

  if (filter === "today") {
    return sessions
      .filter((session) => getSessionPeriod(session.session_date, now) === "today")
      .sort(sortSessionsAscending);
  }

  if (filter === "this-week") {
    return sessions
      .filter((session) => isSessionInThisWeek(session.session_date, now))
      .sort(sortSessionsAscending);
  }

  if (filter === "previous") {
    return sessions
      .filter((session) => getSessionPeriod(session.session_date, now) === "previous")
      .sort(sortSessionsAscending);
  }

  return groupSessionsByPeriod(sessions).flatMap((group) => group.sessions);
}

function AttendanceStatusIcon({
  status,
  className,
}: {
  status: PlayerAttendanceStatus;
  className?: string;
}) {
  if (status === "present") return <Check className={className} aria-hidden />;
  if (status === "absent") return <X className={className} aria-hidden />;
  if (status === "late") return <Clock className={className} aria-hidden />;
  if (status === "injured") return <HeartPulse className={className} aria-hidden />;
  return <FileText className={className} aria-hidden />;
}

function queueKey(coachId: string, sessionId: string, playerId: string): string {
  return `${coachId}:${sessionId}:${playerId}`;
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
    online: "Online",
    offline: "Offline",
    syncing: "Syncing",
    synced: "Synced",
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

function mergeAttendanceRows(
  rows: AttendanceRow[],
  queued: OfflineAttendanceChange[],
): AttendanceRow[] {
  const byKey = new Map<string, AttendanceRow>();

  for (const row of rows) {
    byKey.set(queueKey(row.coach_id, row.session_id, row.player_id), row);
  }

  for (const change of queued) {
    byKey.set(change.id, {
      id: change.id,
      coach_id: change.coachId,
      session_id: change.sessionId,
      player_id: change.playerId,
      status: change.status,
      notes: change.notes,
      recorded_at: change.recordedAt,
    });
  }

  return [...byKey.values()];
}

function buildSessionRoster(args: {
  session: RegisterSession;
  playerNameById: Map<string, string>;
  sessionBookings: SessionBookingLink[];
  teamPlayersByTeamId: Map<
    string,
    { player_id: string; player_name: string; squad_order: number }[]
  >;
  teamOrderByPlayerId: Map<string, Map<string, number>>;
  attendanceByKey: Map<string, AttendanceRow>;
  noteDrafts: Record<string, string>;
}): RosterPlayer[] {
  const rosterById = new Map<
    string,
    { player_id: string; player_name: string; squad_order: number | null }
  >();

  for (const link of args.session.session_players ?? []) {
    const player = Array.isArray(link.player) ? link.player[0] : link.player;
    rosterById.set(link.player_id, {
      player_id: link.player_id,
      player_name:
        player?.player_name ??
        args.playerNameById.get(link.player_id) ??
        "Unknown player",
      squad_order:
        args.teamOrderByPlayerId
          .get(args.session.team_id ?? "")?.get(link.player_id) ?? null,
    });
  }

  for (const booking of args.sessionBookings) {
    if (booking.session_id !== args.session.id || booking.booking_status !== "confirmed") {
      continue;
    }
    const player = Array.isArray(booking.player) ? booking.player[0] : booking.player;
    rosterById.set(booking.player_id, {
      player_id: booking.player_id,
      player_name:
        player?.player_name ??
        args.playerNameById.get(booking.player_id) ??
        "Unknown player",
      squad_order:
        args.teamOrderByPlayerId
          .get(args.session.team_id ?? "")?.get(booking.player_id) ?? null,
    });
  }

  if (rosterById.size === 0 && args.session.team_id) {
    for (const player of args.teamPlayersByTeamId.get(args.session.team_id) ?? []) {
      rosterById.set(player.player_id, player);
    }
  }

  if (rosterById.size === 0 && args.session.player_id) {
    rosterById.set(args.session.player_id, {
      player_id: args.session.player_id,
      player_name:
        args.playerNameById.get(args.session.player_id) ?? "Unknown player",
      squad_order: null,
    });
  }

  return [...rosterById.values()]
    .sort((a, b) => {
      if (a.squad_order !== null && b.squad_order !== null) {
        return a.squad_order - b.squad_order || a.player_name.localeCompare(b.player_name);
      }
      if (a.squad_order !== null) return -1;
      if (b.squad_order !== null) return 1;
      return a.player_name.localeCompare(b.player_name);
    })
    .map((player) => {
      const key = queueKey(
        args.session.coach_id,
        args.session.id,
        player.player_id,
      );
      return {
        player_id: player.player_id,
        player_name: player.player_name,
        attendance: args.attendanceByKey.get(key) ?? null,
        noteDraft: args.noteDrafts[key] ?? args.attendanceByKey.get(key)?.notes ?? "",
      };
    });
}

function AttendanceStatusButton({
  status,
  active,
  disabled,
  onClick,
  variant = "primary",
}: {
  status: PlayerAttendanceStatus;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  variant?: "primary" | "secondary";
}) {
  const isPrimary = variant === "primary";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-3 font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60",
        isPrimary ? "text-sm" : "text-xs",
        active
          ? status === "present"
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 ring-1 ring-emerald-500/25 dark:text-emerald-200"
            : status === "absent"
              ? "border-red-500/40 bg-red-500/10 text-red-800 ring-1 ring-red-500/25 dark:text-red-200"
              : status === "late"
                ? "border-amber-500/40 bg-amber-500/10 text-amber-800 ring-1 ring-amber-500/25 dark:text-amber-200"
                : "bg-accent/10 text-accent border-accent/30 ring-accent/20 ring-1"
          : "border-border hover:bg-surface-hover",
      )}
    >
      <AttendanceStatusIcon
        status={status}
        className={cn(isPrimary ? "size-4" : "size-3.5")}
      />
      {getAttendanceLabel(status)}
    </button>
  );
}

export function RegistersManager() {
  const searchParams = useSearchParams();
  const focusSessionId = searchParams.get("session")?.trim() ?? null;
  const sessionCardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const focusHandledRef = useRef<string | null>(null);

  const [coachId, setCoachId] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [sessionBookings, setSessionBookings] = useState<SessionBookingLink[]>([]);
  const [sessions, setSessions] = useState<RegisterSession[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [teamFilter, setTeamFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState<SessionPeriodFilter>("all");
  const [focusedSessionId, setFocusedSessionId] = useState<string | null>(null);
  const [loadAnnouncement, setLoadAnnouncement] = useState("");
  const [bulkSuccessBySessionId, setBulkSuccessBySessionId] = useState<
    Record<string, string>
  >({});
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
  const [queuedAttendanceKeys, setQueuedAttendanceKeys] = useState<string[]>([]);
  const [busyKeys, setBusyKeys] = useState<string[]>([]);
  const [bulkUpdatingSessionId, setBulkUpdatingSessionId] = useState<string | null>(null);
  const syncingRef = useRef(false);

  const playerNameById = useMemo(
    () => new Map(players.map((player) => [player.id, player.player_name])),
    [players],
  );

  const teamPlayersByTeamId = useMemo(() => {
    return new Map(
      teams.map((team) => [
        team.id,
        (team.team_players ?? [])
          .map((membership) => {
            const player = Array.isArray(membership.player)
              ? membership.player[0]
              : membership.player;
            return {
              player_id: membership.player_id,
              player_name:
                player?.player_name ??
                playerNameById.get(membership.player_id) ??
                "Unknown player",
              squad_order: membership.squad_order,
            };
          })
          .sort((a, b) => a.squad_order - b.squad_order || a.player_name.localeCompare(b.player_name)),
      ]),
    );
  }, [playerNameById, teams]);

  const teamOrderByPlayerId = useMemo(() => {
    return new Map(
      teams.map((team) => [
        team.id,
        new Map(
          (team.team_players ?? []).map((membership) => [
            membership.player_id,
            membership.squad_order,
          ]),
        ),
      ]),
    );
  }, [teams]);

  const attendanceByKey = useMemo(
    () =>
      new Map(
        attendanceRows.map((row) => [
          queueKey(row.coach_id, row.session_id, row.player_id),
          row,
        ]),
      ),
    [attendanceRows],
  );

  const visibleSessions = useMemo(() => {
    let filtered = sessions;
    if (teamFilter === "none") {
      filtered = sessions.filter((session) => !session.team_id);
    } else if (teamFilter !== "all") {
      filtered = sessions.filter((session) => session.team_id === teamFilter);
    }
    return filterSessionsByPeriod(filtered, periodFilter);
  }, [periodFilter, sessions, teamFilter]);

  const sessionGroups = useMemo(() => {
    if (periodFilter !== "all") return [];
    let filtered = sessions;
    if (teamFilter === "none") {
      filtered = sessions.filter((session) => !session.team_id);
    } else if (teamFilter !== "all") {
      filtered = sessions.filter((session) => session.team_id === teamFilter);
    }
    return groupSessionsByPeriod(filtered);
  }, [periodFilter, sessions, teamFilter]);

  const refreshPendingCount = useCallback(async () => {
    const queued = await getQueuedChanges();
    setPendingCount(queued.length);
    setQueuedAttendanceKeys(queued.map((change) => change.id));
    return queued;
  }, []);

  const loadRegisters = useCallback(
    async (userId: string) => {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const [
          { data: sessionsData, error: sessionsError },
          { data: playersData, error: playersError },
          { data: teamsData, error: teamsError },
          { data: bookingsData, error: bookingsError },
          { data: attendanceData, error: attendanceError },
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
            .from("teams")
            .select(
              `
                id,
                team_name,
                age_group,
                team_color,
                team_players (
                  player_id,
                  squad_order,
                  player:players (
                    id,
                    player_name
                  )
                )
              `,
            )
            .eq("coach_id", userId)
            .order("team_name", { ascending: true }),
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
          supabase
            .from("session_attendance")
            .select(ATTENDANCE_SELECT)
            .eq("coach_id", userId),
        ]);

        if (
          sessionsError ||
          playersError ||
          teamsError ||
          bookingsError ||
          attendanceError
        ) {
          setError(
            sessionsError?.message ??
              playersError?.message ??
              teamsError?.message ??
              bookingsError?.message ??
              attendanceError?.message ??
              "Could not load registers.",
          );
          return;
        }

        const queued = await refreshPendingCount();
        const mergedAttendance = mergeAttendanceRows(
          (attendanceData ?? []) as AttendanceRow[],
          queued,
        );

        setPlayers((playersData ?? []) as PlayerRow[]);
        setTeams((teamsData ?? []) as TeamOption[]);
        setSessionBookings((bookingsData ?? []) as SessionBookingLink[]);
        setSessions((sessionsData ?? []) as RegisterSession[]);
        setAttendanceRows(mergedAttendance);
        setNoteDrafts(
          Object.fromEntries(
            mergedAttendance.map((row) => [
              queueKey(row.coach_id, row.session_id, row.player_id),
              row.notes ?? "",
            ]),
          ),
        );
      } catch (caughtError: unknown) {
        setError(getErrorMessage(caughtError));
      } finally {
        setLoading(false);
      }
    },
    [refreshPendingCount],
  );

  const syncQueuedChanges = useCallback(async () => {
    if (
      syncingRef.current ||
      (typeof navigator !== "undefined" && !navigator.onLine) ||
      !coachId
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
      const { error: upsertError } = await supabase
        .from("session_attendance")
        .upsert(
          queued.map((change) => ({
            coach_id: change.coachId,
            session_id: change.sessionId,
            player_id: change.playerId,
            status: change.status,
            notes: change.notes,
            recorded_at: change.recordedAt,
          })),
          { onConflict: "session_id,player_id" },
        );

      if (upsertError) {
        throw upsertError;
      }

      for (const change of queued) {
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
  }, [coachId, refreshPendingCount]);

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

  useEffect(() => {
    if (!focusSessionId || loading || error) return;
    if (focusHandledRef.current === focusSessionId) return;

    const session = sessions.find((item) => item.id === focusSessionId);
    if (!session) return;

    focusHandledRef.current = focusSessionId;

    const frame = window.requestAnimationFrame(() => {
      setPeriodFilter("all");
      setFocusedSessionId(focusSessionId);
      setLoadAnnouncement(`Register loaded for ${getRegisterTitle(session)}`);

      const card = sessionCardRefs.current.get(focusSessionId);
      card?.scrollIntoView({ behavior: "smooth", block: "start" });
      const heading = card?.querySelector<HTMLElement>("[data-register-heading]");
      heading?.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [error, focusSessionId, loading, sessions]);

  function setBusy(nextKeys: string[], active: boolean) {
    setBusyKeys((current) => {
      if (active) {
        return [...new Set([...current, ...nextKeys])];
      }
      return current.filter((key) => !nextKeys.includes(key));
    });
  }

  async function queueAttendanceChange(change: OfflineAttendanceChange) {
    await saveQueuedChange(change);
    await refreshPendingCount();
  }

  async function persistAttendanceRows(
    rows: Array<{
      session_id: string;
      player_id: string;
      status: PlayerAttendanceStatus;
      notes: string | null;
      recorded_at: string;
    }>,
  ) {
    if (!coachId) return;
    const supabase = createClient();
    const { error: upsertError } = await supabase.from("session_attendance").upsert(
      rows.map((row) => ({
        coach_id: coachId,
        ...row,
      })),
      { onConflict: "session_id,player_id" },
    );

    if (upsertError) {
      throw upsertError;
    }
  }

  function updateAttendanceState(nextRows: AttendanceRow[]) {
    setAttendanceRows((current) => {
      const byKey = new Map(
        current.map((row) => [
          queueKey(row.coach_id, row.session_id, row.player_id),
          row,
        ]),
      );
      for (const row of nextRows) {
        byKey.set(queueKey(row.coach_id, row.session_id, row.player_id), row);
      }
      return [...byKey.values()];
    });
  }

  async function applyAttendanceChange(args: {
    sessionId: string;
    playerId: string;
    status: PlayerAttendanceStatus;
    notes?: string | null;
  }) {
    if (!coachId) {
      setActionError("You must be signed in to update registers.");
      return;
    }

    const key = queueKey(coachId, args.sessionId, args.playerId);
    const recordedAt = new Date().toISOString();
    const notes = args.notes?.trim() ? args.notes.trim() : null;
    const nextRow: AttendanceRow = {
      id: attendanceByKey.get(key)?.id ?? key,
      coach_id: coachId,
      session_id: args.sessionId,
      player_id: args.playerId,
      status: args.status,
      notes,
      recorded_at: recordedAt,
    };

    setActionError(null);
    updateAttendanceState([nextRow]);
    setNoteDrafts((current) => ({ ...current, [key]: notes ?? "" }));

    if (!online) {
      await queueAttendanceChange({
        id: key,
        coachId: coachId,
        sessionId: args.sessionId,
        playerId: args.playerId,
        status: args.status,
        notes,
        recordedAt,
      });
      setSyncState("offline");
      return;
    }

    setBusy([key], true);
    try {
      await persistAttendanceRows([
        {
          session_id: args.sessionId,
          player_id: args.playerId,
          status: args.status,
          notes,
          recorded_at: recordedAt,
        },
      ]);
      await deleteQueuedChange(key);
      await refreshPendingCount();
      setSyncState("synced");
    } catch (caughtError: unknown) {
      await queueAttendanceChange({
        id: key,
        coachId,
        sessionId: args.sessionId,
        playerId: args.playerId,
        status: args.status,
        notes,
        recordedAt,
      });
      setActionError(
        `${getErrorMessage(caughtError)} Saved locally and will sync when online.`,
      );
      setSyncState(
        typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline",
      );
    } finally {
      setBusy([key], false);
    }
  }

  async function applyBulkAttendance(
    session: RegisterSession,
    playerIds: string[],
    status: PlayerAttendanceStatus,
  ) {
    if (!coachId || playerIds.length === 0) return;

    const recordedAt = new Date().toISOString();
    const keys = playerIds.map((playerId) => queueKey(coachId, session.id, playerId));
    const optimisticRows = playerIds.map((playerId) => {
      const key = queueKey(coachId, session.id, playerId);
      return {
        id: attendanceByKey.get(key)?.id ?? key,
        coach_id: coachId,
        session_id: session.id,
        player_id: playerId,
        status,
        notes: noteDrafts[key]?.trim() || null,
        recorded_at: recordedAt,
      } satisfies AttendanceRow;
    });

    setActionError(null);
    updateAttendanceState(optimisticRows);

    if (!online) {
      for (const row of optimisticRows) {
        await queueAttendanceChange({
          id: queueKey(coachId, row.session_id, row.player_id),
          coachId: coachId,
          sessionId: row.session_id,
          playerId: row.player_id,
          status: row.status,
          notes: row.notes,
          recordedAt,
        });
      }
      if (status === "present") {
        setBulkSuccessBySessionId((current) => ({
          ...current,
          [session.id]: `✓ ${playerIds.length} player${playerIds.length === 1 ? "" : "s"} marked present`,
        }));
      }
      setSyncState("offline");
      return;
    }

    setBulkUpdatingSessionId(session.id);
    setBusy(keys, true);
    try {
      await persistAttendanceRows(
        optimisticRows.map((row) => ({
          session_id: row.session_id,
          player_id: row.player_id,
          status: row.status,
          notes: row.notes,
          recorded_at: row.recorded_at,
        })),
      );
      for (const key of keys) {
        await deleteQueuedChange(key);
      }
      await refreshPendingCount();
      setSyncState("synced");
      if (status === "present") {
        setBulkSuccessBySessionId((current) => ({
          ...current,
          [session.id]: `✓ ${playerIds.length} player${playerIds.length === 1 ? "" : "s"} marked present`,
        }));
      }
    } catch (caughtError: unknown) {
      for (const row of optimisticRows) {
        await queueAttendanceChange({
          id: queueKey(coachId, row.session_id, row.player_id),
          coachId: coachId,
          sessionId: row.session_id,
          playerId: row.player_id,
          status: row.status,
          notes: row.notes,
          recordedAt,
        });
      }
      setActionError(
        `${getErrorMessage(caughtError)} Bulk changes were saved locally and will sync when online.`,
      );
      setSyncState(
        typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline",
      );
    } finally {
      setBulkUpdatingSessionId(null);
      setBusy(keys, false);
    }
  }

  async function handleNoteBlur(sessionId: string, playerId: string) {
    if (!coachId) return;
    const key = queueKey(coachId, sessionId, playerId);
    const attendance = attendanceByKey.get(key);
    if (!attendance) return;

    const nextNote = noteDrafts[key]?.trim() || "";
    if ((attendance.notes ?? "") === nextNote) return;

    await applyAttendanceChange({
      sessionId,
      playerId,
      status: attendance.status,
      notes: nextNote,
    });
  }

  const activeSyncState: SyncState = !online ? "offline" : syncState;

  const periodFilterOptions: Array<{ value: SessionPeriodFilter; label: string }> = [
    { value: "all", label: "All" },
    { value: "today", label: "Today" },
    { value: "this-week", label: "This week" },
    { value: "previous", label: "Previous" },
  ];

  function renderSessionCard(session: RegisterSession) {
    const team = unwrapSingleRelation(session.team);
    const roster = buildSessionRoster({
      session,
      playerNameById,
      sessionBookings,
      teamPlayersByTeamId,
      teamOrderByPlayerId,
      attendanceByKey,
      noteDrafts,
    });
    const summary = getAttendanceSummary(
      roster
        .map((player) => player.attendance)
        .filter((row): row is AttendanceRow => Boolean(row)),
    );
    const { marked, total } = countMarkedPlayers(roster);
    const isFocused = focusedSessionId === session.id;

    return (
      <article
        key={session.id}
        ref={(node) => {
          if (node) {
            sessionCardRefs.current.set(session.id, node);
          } else {
            sessionCardRefs.current.delete(session.id);
          }
        }}
        className={cn(
          "football-panel football-panel-interactive rounded-2xl p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-6",
          isFocused && "ring-accent/40 ring-2 ring-offset-2",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3
              data-register-heading
              tabIndex={-1}
              className="text-lg font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {getRegisterTitle(session)}
            </h3>
            <p className="text-muted mt-1 text-sm">
              {formatSessionDate(session.session_date)}
            </p>
          </div>
          {bulkUpdatingSessionId === session.id ? (
            <span className="bg-accent/10 text-accent ring-accent/20 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1">
              bulk updating
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="bg-accent/10 text-accent ring-accent/20 inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ring-1">
            <Users className="size-3.5" aria-hidden />
            {roster.length} rostered player{roster.length === 1 ? "" : "s"}
          </span>
          {team ? (
            <span className="border-border text-muted inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-medium">
              <span
                className="inline-flex size-2.5 rounded-full"
                style={{
                  backgroundColor: team.team_color ?? "var(--color-accent)",
                }}
              />
              {getTeamDisplayName(team)}
            </span>
          ) : null}
          <span className="border-border text-muted inline-flex rounded-full border px-2.5 py-1 font-medium">
            {session.session_type ?? "Session"}
          </span>
        </div>

        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
            <p className="text-muted text-xs">Present / late</p>
            <p className="mt-1 font-medium">
              {summary.present + summary.late} recorded
            </p>
          </div>
          <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
            <p className="text-muted text-xs">Absent / unavailable</p>
            <p className="mt-1 font-medium">
              {summary.absent + summary.injured + summary.excused} recorded
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <p className="inline-flex items-center gap-1.5">
            <MapPin className="text-muted size-3.5" aria-hidden />
            {session.location ?? "No location"}
          </p>
        </div>

        {total > 0 ? (
          <p
            role="status"
            className="bg-background/95 text-foreground sticky top-0 z-10 -mx-5 mt-5 border-b border-black/[0.06] px-5 py-2.5 text-sm font-medium backdrop-blur sm:static sm:mx-0 sm:mt-4 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none dark:border-white/[0.06]"
          >
            {marked} of {total} players marked
          </p>
        ) : null}

        <div className="mt-5">
          <button
            type="button"
            disabled={roster.length === 0 || bulkUpdatingSessionId === session.id}
            onClick={() =>
              void applyBulkAttendance(
                session,
                roster.map((player) => player.player_id),
                "present",
              )
            }
            className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
          >
            <Check className="size-4" aria-hidden />
            Mark everyone present
          </button>
          {bulkSuccessBySessionId[session.id] ? (
            <p
              role="status"
              aria-live="polite"
              className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-300"
            >
              {bulkSuccessBySessionId[session.id]}
            </p>
          ) : null}
        </div>

        <details className="mt-3">
          <summary className="text-muted cursor-pointer text-xs font-medium">
            More bulk actions
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(["absent", "late", "injured", "excused"] as const).map((status) => (
              <AttendanceStatusButton
                key={`${session.id}-bulk-${status}`}
                status={status}
                active={false}
                variant="secondary"
                disabled={
                  roster.length === 0 || bulkUpdatingSessionId === session.id
                }
                onClick={() =>
                  void applyBulkAttendance(
                    session,
                    roster.map((player) => player.player_id),
                    status,
                  )
                }
              />
            ))}
          </div>
        </details>

        {roster.length > 0 ? (
          <div className="mt-5 space-y-3">
            {roster.map((player) => {
              const key = queueKey(session.coach_id, session.id, player.player_id);
              const activeStatus = player.attendance?.status ?? null;
              const busy = busyKeys.includes(key);
              const queued = queuedAttendanceKeys.includes(key);

              return (
                <div
                  key={key}
                  className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{player.player_name}</p>
                        <p className="text-muted mt-1 text-xs">
                          {activeStatus
                            ? `${getAttendanceLabel(activeStatus)} · ${formatRecordedAt(
                                player.attendance?.recorded_at ?? null,
                              )}`
                            : "Not marked yet"}
                        </p>
                      </div>
                      {queued ? (
                        <span className="bg-amber-500/10 text-amber-700 ring-amber-500/25 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 dark:text-amber-300">
                          local queue
                        </span>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {PRIMARY_ATTENDANCE_STATUS_OPTIONS.map((status) => (
                        <AttendanceStatusButton
                          key={`${key}-${status}`}
                          status={status}
                          active={activeStatus === status}
                          disabled={busy}
                          variant="primary"
                          onClick={() =>
                            void applyAttendanceChange({
                              sessionId: session.id,
                              playerId: player.player_id,
                              status,
                              notes: noteDrafts[key] ?? "",
                            })
                          }
                        />
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {SECONDARY_ATTENDANCE_STATUS_OPTIONS.map((status) => (
                        <AttendanceStatusButton
                          key={`${key}-${status}`}
                          status={status}
                          active={activeStatus === status}
                          disabled={busy}
                          variant="secondary"
                          onClick={() =>
                            void applyAttendanceChange({
                              sessionId: session.id,
                              playerId: player.player_id,
                              status,
                              notes: noteDrafts[key] ?? "",
                            })
                          }
                        />
                      ))}
                    </div>

                    <input
                      value={noteDrafts[key] ?? ""}
                      onChange={(event) =>
                        setNoteDrafts((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                      onBlur={() => void handleNoteBlur(session.id, player.player_id)}
                      onFocus={(event) => {
                        event.target.scrollIntoView({ block: "nearest", behavior: "smooth" });
                      }}
                      placeholder="Optional note, e.g. arrived after warm-up"
                      aria-label={`Notes for ${player.player_name}`}
                      disabled={busy}
                      className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2 disabled:opacity-60"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl bg-black/[0.02] p-4 text-sm dark:bg-white/[0.03]">
            <p className="font-medium">No players in this register yet.</p>
            <p className="text-muted mt-1">
              Players are added from bookings, teams and assigned players.
            </p>
          </div>
        )}
      </article>
    );
  }

  return (
    <div className="page-content-enter space-y-8">
      <FeaturePageHeader
        featureKey="registers"
        title="Session Registers"
        subtitle="Mark attendance for every player individually, apply bulk updates fast, and keep everything syncing from the pitch."
        actions={<StatusIndicator state={activeSyncState} pendingCount={pendingCount} />}
      />

      {!online ? (
        <div className="football-panel border-amber-500/25 bg-amber-500/8 flex items-start gap-3 rounded-2xl p-5 text-sm ring-1 ring-amber-500/20">
          <WifiOff className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-300" />
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-200">
              Offline mode active
            </p>
            <p className="text-muted mt-1">
              Player attendance changes are being stored locally and will sync
              automatically when your connection returns.
            </p>
          </div>
        </div>
      ) : null}

      <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="bg-accent/12 ring-accent/25 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
              <ShieldCheck className="text-accent size-5" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Offline-ready player attendance
              </h2>
              <p className="text-muted mt-1 text-sm">
                Every player mark is queued independently, so bulk updates and
                manual overrides stay intact when signal drops.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={!online || syncState === "syncing" || pendingCount === 0}
            onClick={() => void syncQueuedChanges()}
            className="border-border hover:bg-surface-hover inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors disabled:opacity-50 dark:hover:bg-white/[0.06]"
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Session registers</h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {teams.length > 0 ? (
              <div className="min-w-0">
                <label className="sr-only" htmlFor="registerTeamFilter">
                  Filter by team
                </label>
                <select
                  id="registerTeamFilter"
                  value={teamFilter}
                  onChange={(event) => setTeamFilter(event.target.value)}
                  className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-10 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2 sm:w-auto"
                >
                  <option value="all">All teams</option>
                  <option value="none">No linked team</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {getTeamDisplayName(team)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {!loading ? (
              <span className="text-muted text-sm">
                {visibleSessions.length} session
                {visibleSessions.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter sessions by date">
          {periodFilterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={periodFilter === option.value}
              onClick={() => setPeriodFilter(option.value)}
              className={cn(
                "focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                periodFilter === option.value
                  ? "bg-accent/10 text-accent border-accent/30 ring-accent/20 ring-1"
                  : "border-border hover:bg-surface-hover",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="sr-only" role="status" aria-live="polite">
          {loadAnnouncement}
        </div>

        {error ? (
          <div className="football-panel football-panel-interactive rounded-2xl p-6 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        ) : null}

        {actionError ? (
          <div
            className="glass-panel break-words rounded-2xl p-6 text-sm text-amber-700 dark:text-amber-300"
            role="alert"
          >
            {actionError}
          </div>
        ) : null}

        {loading ? (
          <PanelSkeleton />
        ) : null}

        {!loading && !error && sessions.length === 0 ? (
          <CoachSetupGuidance
            icon={CalendarCheck}
            title="No sessions available."
            description="No training sessions have been scheduled yet."
            actionHref="/dashboard/sessions"
            actionLabel="Create session"
          />
        ) : null}

        {!loading && !error && sessions.length > 0 && visibleSessions.length === 0 ? (
          <div className="football-panel football-panel-interactive rounded-2xl p-8 text-center">
            <CalendarCheck className="text-muted mx-auto size-8" aria-hidden />
            <p className="mt-3 font-medium">No sessions in this date range</p>
            <p className="text-muted mx-auto mt-2 max-w-md text-sm leading-relaxed">
              Try another filter, or create a new session for the dates you need.
            </p>
          </div>
        ) : null}

        {!loading && !error && visibleSessions.length > 0 && periodFilter === "all" ? (
          <div className="page-content-enter space-y-8">
            {sessionGroups.map((group) => (
              <section key={group.id} aria-labelledby={`register-group-${group.id}`}>
                <h3
                  id={`register-group-${group.id}`}
                  className="text-muted mb-4 text-sm font-semibold uppercase tracking-wide"
                >
                  {group.label}
                </h3>
                <div className="grid gap-4 xl:grid-cols-2">
                  {group.sessions.map((session) => renderSessionCard(session))}
                </div>
              </section>
            ))}
          </div>
        ) : null}

        {!loading && !error && visibleSessions.length > 0 && periodFilter !== "all" ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {visibleSessions.map((session) => renderSessionCard(session))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
