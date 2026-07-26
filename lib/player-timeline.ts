import type { PlayerAttendanceStatus } from "@/lib/attendance";
import {
  getAttendanceSessionName,
  unwrapAttendanceSession,
  type AttendanceHistoryRow,
} from "@/lib/attendance-history";
import { getReportExcerpt } from "@/lib/structured-report";

export type SavedProgressReport = {
  id: string;
  created_at: string;
  raw_notes: string;
  report: string;
};

export type PlayerTimelineReportItem = {
  type: "report";
  id: string;
  created_at: string;
  reportExcerpt: string;
  raw_notes: string;
  report: string;
};

export type PlayerTimelineAttendanceItem = {
  type: "attendance";
  id: string;
  created_at: string;
  date: string;
  status: Extract<PlayerAttendanceStatus, "injured" | "absent" | "late">;
  notes: string | null;
  sessionName: string;
};

export type PlayerTimelineClipItem = {
  type: "clip";
  id: string;
  created_at: string;
  title: string;
  categoryLabel: string;
  excerpt: string;
  clipId: string;
  parentVisible: boolean;
};

export type PlayerTimelineItem =
  | PlayerTimelineReportItem
  | PlayerTimelineAttendanceItem
  | PlayerTimelineClipItem;

const TIMELINE_ATTENDANCE_STATUSES = new Set<PlayerAttendanceStatus>([
  "injured",
  "absent",
  "late",
]);

export function excerptText(text: string, maxLength = 120): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trimEnd()}…`;
}

export function formatTimelineDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
  }).format(parsed);
}

export function getTimelineAttendanceLabel(
  status: PlayerTimelineAttendanceItem["status"],
): string {
  if (status === "late") return "Late";
  if (status === "injured") return "Injured";
  return "Absent";
}

export function getTimelineAttendanceFallback(
  status: PlayerTimelineAttendanceItem["status"],
): string {
  if (status === "late") return "Arrived after the session started.";
  if (status === "injured") return "Recorded as injured for this session.";
  return "No reason recorded.";
}

export function buildPlayerTimeline(args: {
  reports: SavedProgressReport[];
  attendanceRows: AttendanceHistoryRow[];
  clips?: Array<{
    id: string;
    created_at: string;
    title: string;
    categoryLabel: string;
    excerpt: string;
    parentVisible: boolean;
  }>;
}): PlayerTimelineItem[] {
  const reportItems: PlayerTimelineReportItem[] = args.reports.map((report) => ({
    type: "report",
    id: report.id,
    created_at: report.created_at,
    reportExcerpt: getReportExcerpt(report.report),
    raw_notes: report.raw_notes,
    report: report.report,
  }));

  const attendanceItems: PlayerTimelineAttendanceItem[] = [];

  for (const row of args.attendanceRows) {
    if (!TIMELINE_ATTENDANCE_STATUSES.has(row.status)) continue;

    const session = unwrapAttendanceSession(row.session);
    const sessionDate = session?.session_date ?? row.recorded_at;

    attendanceItems.push({
      type: "attendance",
      id: `${row.session_id}:${row.player_id}:${row.recorded_at}`,
      created_at: sessionDate,
      date: sessionDate,
      status: row.status as PlayerTimelineAttendanceItem["status"],
      notes: row.notes?.trim() ? row.notes.trim() : null,
      sessionName: getAttendanceSessionName(session, row.recorded_at),
    });
  }

  const clipItems: PlayerTimelineClipItem[] = (args.clips ?? []).map((clip) => ({
    type: "clip",
    id: clip.id,
    created_at: clip.created_at,
    title: clip.title,
    categoryLabel: clip.categoryLabel,
    excerpt: excerptText(clip.excerpt || clip.title),
    clipId: clip.id,
    parentVisible: clip.parentVisible,
  }));

  return [...reportItems, ...attendanceItems, ...clipItems].sort(
    (left, right) =>
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );
}

export function getDevelopmentSummaryCopy(args: {
  attendanceRate: number;
  reportCount: number;
}): string {
  const attendanceLabel =
    args.attendanceRate >= 75
      ? "Regular attendee"
      : args.attendanceRate >= 50
        ? "Developing attendance record"
        : "Attendance needs follow-up";

  const reportLabel =
    args.reportCount === 1
      ? "1 report created"
      : `${args.reportCount} reports created`;

  return `${attendanceLabel} with ${reportLabel}.`;
}
