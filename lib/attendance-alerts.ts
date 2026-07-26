import {
  getAttendanceRate,
  isCountedAttendanceStatus,
  isMissedAttendanceStatus,
  isPositiveAttendanceStatus,
  type PlayerAttendanceStatus,
} from "@/lib/attendance";

export const ATTENDANCE_RISK_RATE_THRESHOLD = 70;
export const CONSECUTIVE_ABSENCE_THRESHOLD = 3;
export const SESSION_ABSENT_RATE_THRESHOLD = 0.25;

export type AttendanceRecordRef = {
  status: PlayerAttendanceStatus;
  recorded_at: string;
};

export type AttendanceAtRiskPlayer = {
  playerId: string;
  playerName: string;
  rate: number;
  lastAttendanceDate: string | null;
  recentForm: PlayerAttendanceStatus[];
};

export function sortAttendanceByRecordedAtDesc<T extends { recorded_at: string }>(
  records: T[],
): T[] {
  return [...records].sort(
    (left, right) =>
      new Date(right.recorded_at).getTime() - new Date(left.recorded_at).getTime(),
  );
}

export function hasConsecutiveAbsences(
  records: AttendanceRecordRef[],
  threshold = CONSECUTIVE_ABSENCE_THRESHOLD,
): boolean {
  const recent = sortAttendanceByRecordedAtDesc(records).slice(0, threshold);
  return (
    recent.length >= threshold &&
    recent.every((record) => isMissedAttendanceStatus(record.status))
  );
}

export function isPlayerAttendanceAtRisk(
  rate: number,
  records: AttendanceRecordRef[],
): boolean {
  const counted = records.filter((record) => isCountedAttendanceStatus(record.status));
  if (counted.length === 0) return false;
  return (
    rate < ATTENDANCE_RISK_RATE_THRESHOLD ||
    hasConsecutiveAbsences(records)
  );
}

export function getPlayerAttendanceConcerns(
  rate: number,
  records: AttendanceRecordRef[],
): string[] {
  const concerns: string[] = [];
  if (hasConsecutiveAbsences(records)) {
    concerns.push(
      `Missed ${CONSECUTIVE_ABSENCE_THRESHOLD} consecutive sessions`,
    );
  }

  const counted = records.filter((record) => isCountedAttendanceStatus(record.status));
  if (counted.length > 0 && rate < ATTENDANCE_RISK_RATE_THRESHOLD) {
    concerns.push(`Attendance currently ${Math.round(rate)}%`);
  }

  return concerns;
}

export function isSessionLowAttendance(
  absentCount: number,
  rosterTotal: number,
): boolean {
  if (rosterTotal === 0 || absentCount === 0) return false;
  return absentCount / rosterTotal > SESSION_ABSENT_RATE_THRESHOLD;
}

export function buildAttendanceAtRiskPlayers(
  players: Array<{ id: string; player_name: string }>,
  attendanceByPlayer: Map<string, AttendanceRecordRef[]>,
  maxPlayers = 5,
): AttendanceAtRiskPlayer[] {
  const atRisk: AttendanceAtRiskPlayer[] = [];

  for (const player of players) {
    const records = attendanceByPlayer.get(player.id) ?? [];
    const counted = records.filter((record) => isCountedAttendanceStatus(record.status));
    if (counted.length === 0) continue;

    const rate = getAttendanceRate(records);
    if (!isPlayerAttendanceAtRisk(rate, records)) continue;

    const sorted = sortAttendanceByRecordedAtDesc(records);
    atRisk.push({
      playerId: player.id,
      playerName: player.player_name,
      rate,
      lastAttendanceDate: sorted[0]?.recorded_at ?? null,
      recentForm: sorted.slice(0, 5).map((record) => record.status),
    });
  }

  return atRisk
    .sort((left, right) => {
      const leftRecords = attendanceByPlayer.get(left.playerId) ?? [];
      const rightRecords = attendanceByPlayer.get(right.playerId) ?? [];
      const leftConsecutive = hasConsecutiveAbsences(leftRecords) ? 1 : 0;
      const rightConsecutive = hasConsecutiveAbsences(rightRecords) ? 1 : 0;
      if (rightConsecutive !== leftConsecutive) {
        return rightConsecutive - leftConsecutive;
      }
      return left.rate - right.rate;
    })
    .slice(0, maxPlayers);
}

export function monthKeyFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function currentMonthKey(date = new Date()): string {
  return monthKeyFromDate(date);
}

export type MonthlyAttendanceSummary = {
  rate: number;
  present: number;
  missed: number;
  total: number;
};

export function computeMonthlyAttendanceSummary(
  attendance: Array<{ session_id: string; status: PlayerAttendanceStatus }>,
  sessionsById: Map<string, { session_date: string }>,
  monthKey = currentMonthKey(),
): MonthlyAttendanceSummary {
  let present = 0;
  let missed = 0;
  let total = 0;

  for (const entry of attendance) {
    if (!isCountedAttendanceStatus(entry.status)) continue;

    const session = sessionsById.get(entry.session_id);
    if (!session) continue;

    if (monthKeyFromDate(new Date(session.session_date)) !== monthKey) continue;

    total += 1;
    if (isPositiveAttendanceStatus(entry.status)) present += 1;
    if (isMissedAttendanceStatus(entry.status)) missed += 1;
  }

  return {
    rate: total > 0 ? (present / total) * 100 : 0,
    present,
    missed,
    total,
  };
}

export function formatLastAttendanceDate(value: string | null): string {
  if (!value) return "No records yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
  }).format(parsed);
}

export function buildParentMailtoLink(
  email: string,
  playerName: string,
): string {
  const subject = encodeURIComponent(`Following up on ${playerName}'s training`);
  const body = encodeURIComponent(
    `Hi,\n\nI wanted to check in about ${playerName}'s recent sessions.\n\n`,
  );
  return `mailto:${email}?subject=${subject}&body=${body}`;
}
