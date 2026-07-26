export const PLAYER_ATTENDANCE_STATUS_OPTIONS = [
  "present",
  "absent",
  "late",
  "injured",
  "excused",
] as const;

export const PRIMARY_ATTENDANCE_STATUS_OPTIONS = [
  "present",
  "absent",
  "late",
] as const;

export const SECONDARY_ATTENDANCE_STATUS_OPTIONS = [
  "injured",
  "excused",
] as const;

export type PlayerAttendanceStatus =
  (typeof PLAYER_ATTENDANCE_STATUS_OPTIONS)[number];

export type PlayerAttendanceRow = {
  id?: string;
  coach_id?: string;
  session_id: string;
  player_id: string;
  status: PlayerAttendanceStatus;
  notes: string | null;
  recorded_at: string;
};

export function isPlayerAttendanceStatus(
  value: unknown,
): value is PlayerAttendanceStatus {
  return (
    typeof value === "string" &&
    PLAYER_ATTENDANCE_STATUS_OPTIONS.includes(
      value as PlayerAttendanceStatus,
    )
  );
}

export function getAttendanceLabel(status: PlayerAttendanceStatus): string {
  if (status === "present") return "Present";
  if (status === "absent") return "Absent";
  if (status === "late") return "Late";
  if (status === "injured") return "Injured";
  return "Excused";
}

export function isPositiveAttendanceStatus(
  status: PlayerAttendanceStatus,
): boolean {
  return status === "present" || status === "late";
}

export function isMissedAttendanceStatus(
  status: PlayerAttendanceStatus,
): boolean {
  return status === "absent";
}

export function isCountedAttendanceStatus(
  status: PlayerAttendanceStatus,
): boolean {
  return (
    status === "present" ||
    status === "late" ||
    status === "absent"
  );
}

export function getAttendanceRate(
  rows: Array<{ status: PlayerAttendanceStatus }>,
): number {
  const counted = rows.filter((row) => isCountedAttendanceStatus(row.status));
  if (counted.length === 0) return 0;
  const attended = counted.filter((row) =>
    isPositiveAttendanceStatus(row.status),
  );
  return (attended.length / counted.length) * 100;
}

export function countMarkedPlayers(
  roster: Array<{ attendance: { status: PlayerAttendanceStatus } | null }>,
): { marked: number; total: number } {
  const total = roster.length;
  const marked = roster.filter((player) => player.attendance !== null).length;
  return { marked, total };
}

export function getAttendanceSummary(
  rows: Array<{ status: PlayerAttendanceStatus }>,
): Record<PlayerAttendanceStatus, number> {
  const summary = {
    present: 0,
    absent: 0,
    late: 0,
    injured: 0,
    excused: 0,
  } satisfies Record<PlayerAttendanceStatus, number>;

  for (const row of rows) {
    summary[row.status] += 1;
  }

  return summary;
}

export type RegisterCompletenessState =
  | "empty"
  | "complete"
  | "nearly-complete"
  | "needs-attention";

export function getRegisterCompletenessState(
  marked: number,
  total: number,
): RegisterCompletenessState {
  if (total === 0) return "empty";
  if (marked === 0) return "needs-attention";
  if (marked >= total) return "complete";

  const unmarked = total - marked;
  if (unmarked <= 2 || marked / total >= 0.8) {
    return "nearly-complete";
  }

  return "needs-attention";
}

export function getSessionPresentRate(
  rosterPlayerIds: string[],
  attendanceRows: Array<{ player_id: string; status: PlayerAttendanceStatus }>,
): number {
  if (rosterPlayerIds.length === 0) return 0;

  const rosterAttendance = attendanceRows.filter((row) =>
    rosterPlayerIds.includes(row.player_id),
  );

  return getAttendanceRate(rosterAttendance);
}
