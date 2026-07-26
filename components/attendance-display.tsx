import Link from "next/link";
import {
  AlertTriangle,
  Check,
  Circle,
  Clock,
  HeartPulse,
  Mail,
  Phone,
  UserRound,
  X,
} from "lucide-react";
import {
  formatAttendanceSessionDate,
  type AttendanceHistoryEntry,
  type PlayerAttendanceHistory,
} from "@/lib/attendance-history";
import {
  buildParentMailtoLink,
  isSessionLowAttendance,
} from "@/lib/attendance-alerts";
import {
  getAttendanceLabel,
  getRegisterCompletenessState,
  type PlayerAttendanceStatus,
  type RegisterCompletenessState,
} from "@/lib/attendance";
import { cn } from "@/lib/utils";

const statusBadgeStyles: Record<PlayerAttendanceStatus, string> = {
  present:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  absent: "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200",
  late: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  injured: "border-orange-500/30 bg-orange-500/10 text-orange-800 dark:text-orange-200",
  excused: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-200",
};

export function AttendanceStatusBadge({
  status,
  compact = false,
  showLabel = true,
}: {
  status: PlayerAttendanceStatus;
  compact?: boolean;
  showLabel?: boolean;
}) {
  const iconClassName = cn(compact ? "size-3" : "size-3.5");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.06]",
        compact ? "text-[11px]" : "text-xs",
        statusBadgeStyles[status],
      )}
    >
      {status === "present" ? (
        <Check className={iconClassName} aria-hidden />
      ) : status === "absent" ? (
        <X className={iconClassName} aria-hidden />
      ) : status === "late" ? (
        <Clock className={iconClassName} aria-hidden />
      ) : status === "injured" ? (
        <HeartPulse className={iconClassName} aria-hidden />
      ) : (
        <Circle className={iconClassName} aria-hidden />
      )}
      {showLabel ? (
        <span>{getAttendanceLabel(status)}</span>
      ) : (
        <span className="sr-only">{getAttendanceLabel(status)}</span>
      )}
    </span>
  );
}

export function AttendanceRecentForm({
  entries,
  id,
  showLegend = true,
}: {
  entries: Array<{ status: PlayerAttendanceStatus }>;
  id?: string;
  showLegend?: boolean;
}) {
  if (entries.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium" id={id}>
        Recent form
      </p>
      <div
        className="flex flex-wrap gap-2"
        aria-labelledby={id}
        role="list"
        aria-label="Recent attendance form"
      >
        {entries.map((entry, index) => (
          <span key={`${entry.status}-${index}`} role="listitem">
            <AttendanceStatusBadge status={entry.status} compact showLabel={false} />
          </span>
        ))}
      </div>
      {showLegend ? (
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <Check className="size-3" aria-hidden /> Present
        </span>
        <span className="inline-flex items-center gap-1">
          <X className="size-3" aria-hidden /> Absent
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3" aria-hidden /> Late
        </span>
        <span className="inline-flex items-center gap-1">
          <HeartPulse className="size-3" aria-hidden /> Injured
        </span>
        <span className="inline-flex items-center gap-1">
          <Circle className="size-3" aria-hidden /> Excused
        </span>
      </div>
      ) : null}
    </div>
  );
}

export function PlayerAttendancePanel({
  playerName,
  history,
  loading,
  parentName,
  parentEmail,
  parentPhone,
}: {
  playerName: string;
  history: PlayerAttendanceHistory | null;
  loading?: boolean;
  parentName?: string | null;
  parentEmail?: string | null;
  parentPhone?: string | null;
}) {
  const panelId = "player-attendance-panel";

  if (loading) {
    return (
      <section
        className="glass-panel interactive-surface rounded-2xl p-5 sm:p-6"
        aria-labelledby={panelId}
      >
        <h3 id={panelId} className="text-lg font-semibold tracking-tight">
          Attendance
        </h3>
        <p className="text-muted mt-2 text-sm">Loading attendance records...</p>
      </section>
    );
  }

  if (!history || history.recent.length === 0) {
    return (
      <section
        className="glass-panel interactive-surface rounded-2xl p-5 sm:p-6"
        aria-labelledby={panelId}
      >
        <h3 id={panelId} className="text-lg font-semibold tracking-tight">
          Attendance
        </h3>
        <p className="text-muted mt-2 text-sm">No attendance records yet.</p>
        <PlayerParentContactSection
          playerName={playerName}
          parentName={parentName}
          parentEmail={parentEmail}
          parentPhone={parentPhone}
        />
      </section>
    );
  }

  const missedCount = history.counts.absent;

  return (
    <section
      className="glass-panel interactive-surface rounded-2xl p-5 sm:p-6"
      aria-labelledby={panelId}
    >
      <h3 id={panelId} className="text-lg font-semibold tracking-tight">
        Attendance
      </h3>
      <p className="sr-only">Attendance summary for {playerName}</p>

      {history.isAtRisk ? (
        <div
          className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/8 p-4 text-sm ring-1 ring-amber-500/15"
          role="status"
          aria-live="polite"
        >
          <p className="inline-flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-200">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            Attendance needs attention
          </p>
          <p className="text-muted mt-1">
            {playerName} has missed several sessions recently.
          </p>
        </div>
      ) : null}

      <div
        className="mt-4 grid gap-3 sm:grid-cols-3"
        role="status"
        aria-live="polite"
      >
        <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
          <p className="text-muted text-xs">Attendance percentage</p>
          <p className="mt-1 text-lg font-semibold">{Math.round(history.rate)}%</p>
        </div>
        <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
          <p className="text-muted text-xs">Present count</p>
          <p className="mt-1 text-lg font-semibold">
            {history.counts.present + history.counts.late}
          </p>
        </div>
        <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
          <p className="text-muted text-xs">Missed count</p>
          <p className="mt-1 text-lg font-semibold">{missedCount}</p>
        </div>
      </div>

      <div className="mt-5">
        <h4 className="text-sm font-semibold">Recent attendance</h4>
        <p className="text-muted mt-1 text-xs">Last 5 sessions</p>
        <ul className="mt-3 space-y-2" aria-label="Recent attendance records">
          {history.recent.map((entry) => (
            <RecentAttendanceListItem key={`${entry.sessionId}-${entry.recordedAt}`} entry={entry} />
          ))}
        </ul>
      </div>

      <div className="mt-5">
        <AttendanceRecentForm
          entries={history.recent}
          id={`${panelId}-recent-form`}
        />
      </div>

      <PlayerParentContactSection
        playerName={playerName}
        parentName={parentName}
        parentEmail={parentEmail}
        parentPhone={parentPhone}
      />
    </section>
  );
}

function PlayerParentContactSection({
  playerName,
  parentName,
  parentEmail,
  parentPhone,
}: {
  playerName: string;
  parentName?: string | null;
  parentEmail?: string | null;
  parentPhone?: string | null;
}) {
  const hasParentDetails = parentName || parentEmail || parentPhone;
  if (!hasParentDetails) return null;

  return (
    <div className="mt-5 rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]">
      <h4 className="text-sm font-semibold">Parent contact</h4>
      <dl className="mt-3 space-y-2 text-sm">
        {parentName ? (
          <div className="flex items-center gap-2">
            <UserRound className="text-muted size-3.5 shrink-0" aria-hidden />
            <dd>{parentName}</dd>
          </div>
        ) : null}
        {parentEmail ? (
          <div className="flex items-center gap-2">
            <Mail className="text-muted size-3.5 shrink-0" aria-hidden />
            <dd>{parentEmail}</dd>
          </div>
        ) : null}
        {parentPhone ? (
          <div className="flex items-center gap-2">
            <Phone className="text-muted size-3.5 shrink-0" aria-hidden />
            <dd>{parentPhone}</dd>
          </div>
        ) : null}
      </dl>
      {parentEmail ? (
        <a
          href={buildParentMailtoLink(parentEmail, playerName)}
          className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 mt-4 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Mail className="mr-2 size-4" aria-hidden />
          Contact parent
        </a>
      ) : null}
    </div>
  );
}

function RecentAttendanceListItem({ entry }: { entry: AttendanceHistoryEntry }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/[0.02] px-3 py-2.5 text-sm dark:bg-white/[0.03]">
      <div className="min-w-0">
        <p className="font-medium">{entry.sessionName}</p>
        <p className="text-muted text-xs">
          {formatAttendanceSessionDate(entry.sessionDate)}
        </p>
      </div>
      <AttendanceStatusBadge status={entry.status} />
    </li>
  );
}

export function ReportsAttendanceBlock({
  history,
}: {
  history: PlayerAttendanceHistory;
}) {
  const blockId = "reports-attendance-summary";

  return (
    <section
      className="mt-4 rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]"
      aria-labelledby={blockId}
    >
      <h3 id={blockId} className="text-sm font-semibold">
        Attendance
      </h3>
      <div
        className="mt-3 grid gap-2 sm:grid-cols-3"
        role="status"
        aria-live="polite"
      >
        <div className="rounded-xl border border-black/[0.04] px-3 py-2 text-sm dark:border-white/[0.06]">
          <p className="text-muted text-xs">Attendance rate</p>
          <p className="mt-1 font-semibold">{Math.round(history.rate)}%</p>
        </div>
        <div className="rounded-xl border border-black/[0.04] px-3 py-2 text-sm dark:border-white/[0.06]">
          <p className="text-muted text-xs">Present count</p>
          <p className="mt-1 font-semibold">
            {history.counts.present + history.counts.late}
          </p>
        </div>
        <div className="rounded-xl border border-black/[0.04] px-3 py-2 text-sm dark:border-white/[0.06]">
          <p className="text-muted text-xs">Missed count</p>
          <p className="mt-1 font-semibold">{history.counts.absent}</p>
        </div>
      </div>
      <div className="mt-4">
        <AttendanceRecentForm entries={history.recent} id={`${blockId}-form`} />
      </div>
      {history.concerns.length > 0 ? (
        <div
          className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/8 p-3 text-sm ring-1 ring-amber-500/15"
          role="status"
          aria-live="polite"
        >
          <p className="font-semibold text-amber-800 dark:text-amber-200">
            Recent concern
          </p>
          <ul className="text-muted mt-2 space-y-1">
            {history.concerns.map((concern) => (
              <li key={concern} className="inline-flex items-center gap-2">
                <AlertTriangle className="size-3.5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
                {concern}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function completenessMessage(
  state: RegisterCompletenessState,
  marked: number,
  total: number,
  unmarked: number,
): string {
  if (state === "complete") return "Register complete";
  if (state === "nearly-complete") {
    return `${unmarked} player${unmarked === 1 ? "" : "s"} still need marking`;
  }
  if (marked === 0) return "No attendance has been recorded";
  return `${unmarked} player${unmarked === 1 ? "" : "s"} still unmarked`;
}

export function SessionAttendanceSummary({
  sessionId,
  marked,
  total,
  presentRate,
  absentCount = 0,
}: {
  sessionId: string;
  marked: number;
  total: number;
  presentRate: number;
  absentCount?: number;
}) {
  const summaryId = `session-attendance-${sessionId}`;
  const unmarked = Math.max(total - marked, 0);
  const state = getRegisterCompletenessState(marked, total);
  const message = completenessMessage(state, marked, total, unmarked);
  const showLowAttendanceWarning = isSessionLowAttendance(absentCount, total);

  if (total === 0) {
    return (
      <section
        className="mt-4 rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]"
        aria-labelledby={summaryId}
      >
        <h4 id={summaryId} className="text-sm font-semibold">
          Attendance summary
        </h4>
        <p className="text-muted mt-2 text-sm" role="status" aria-live="polite">
          No players on this register yet.
        </p>
        <Link
          href={`/dashboard/registers?session=${sessionId}`}
          className="text-accent focus-visible:ring-accent/40 mt-3 inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Take register
        </Link>
      </section>
    );
  }

  if (marked === 0) {
    return (
      <section
        className="mt-4 rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]"
        aria-labelledby={summaryId}
      >
        <h4 id={summaryId} className="text-sm font-semibold">
          Attendance summary
        </h4>
        <p className="text-muted mt-2 text-sm" role="status" aria-live="polite">
          No attendance has been recorded.
        </p>
        <Link
          href={`/dashboard/registers?session=${sessionId}`}
          className="text-accent focus-visible:ring-accent/40 mt-3 inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Take register
        </Link>
      </section>
    );
  }

  return (
    <section
      className="mt-4 rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]"
      aria-labelledby={summaryId}
    >
      <h4 id={summaryId} className="text-sm font-semibold">
        Attendance summary
      </h4>
      <div className="mt-3 space-y-2 text-sm" role="status" aria-live="polite">
        <p className="font-medium">
          {marked}/{total} players marked
        </p>
        <p className="text-muted">{Math.round(presentRate)}% present</p>
        <p
          className={cn(
            "inline-flex items-center gap-1.5 font-medium",
            state === "complete" && "text-emerald-700 dark:text-emerald-300",
            state === "nearly-complete" && "text-amber-700 dark:text-amber-300",
            state === "needs-attention" && "text-amber-700 dark:text-amber-300",
          )}
        >
          {state === "complete" ? (
            <Check className="size-4 shrink-0" aria-hidden />
          ) : (
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
          )}
          {message}
        </p>
        {showLowAttendanceWarning ? (
          <p className="inline-flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            Lower attendance than usual
          </p>
        ) : null}
        {showLowAttendanceWarning ? (
          <p className="text-muted">
            {absentCount} player{absentCount === 1 ? "" : "s"} missed this session.
          </p>
        ) : null}
      </div>
    </section>
  );
}
