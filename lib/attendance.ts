export const PLAYER_ATTENDANCE_STATUS_OPTIONS = [
  "present",
  "absent",
  "late",
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
