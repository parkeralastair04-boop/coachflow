export const COMMUNICATION_LOG_STORAGE_KEY = "awarix:communication-log:v1";
export const MAX_COMMUNICATION_LOG_ENTRIES = 100;

export type CommunicationLogKind =
  | "announcement"
  | "attendance_follow_up"
  | "report_shared"
  | "session_reminder";

export type CommunicationLogEntry = {
  id: string;
  kind: CommunicationLogKind;
  subject: string;
  recipientEmail: string;
  recipientName: string | null;
  playerId: string | null;
  playerName: string | null;
  messageType: string | null;
  preview: string;
  sentAt: string;
  reportId?: string | null;
};

function isCommunicationLogEntry(value: unknown): value is CommunicationLogEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as CommunicationLogEntry;
  return (
    typeof entry.id === "string" &&
    typeof entry.kind === "string" &&
    typeof entry.subject === "string" &&
    typeof entry.recipientEmail === "string" &&
    typeof entry.sentAt === "string"
  );
}

export function readCommunicationLog(): CommunicationLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COMMUNICATION_LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCommunicationLogEntry);
  } catch {
    return [];
  }
}

export function writeCommunicationLog(entries: CommunicationLogEntry[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    COMMUNICATION_LOG_STORAGE_KEY,
    JSON.stringify(entries.slice(0, MAX_COMMUNICATION_LOG_ENTRIES)),
  );
}

export function appendCommunicationLog(entry: CommunicationLogEntry): CommunicationLogEntry[] {
  const next = [entry, ...readCommunicationLog()].slice(0, MAX_COMMUNICATION_LOG_ENTRIES);
  writeCommunicationLog(next);
  return next;
}

export function buildCommunicationLogEntry(args: {
  kind: CommunicationLogKind;
  subject: string;
  recipientEmail: string;
  recipientName?: string | null;
  playerId?: string | null;
  playerName?: string | null;
  messageType?: string | null;
  preview: string;
  reportId?: string | null;
}): CommunicationLogEntry {
  return {
    id: crypto.randomUUID(),
    kind: args.kind,
    subject: args.subject,
    recipientEmail: args.recipientEmail,
    recipientName: args.recipientName ?? null,
    playerId: args.playerId ?? null,
    playerName: args.playerName ?? null,
    messageType: args.messageType ?? null,
    preview: args.preview,
    sentAt: new Date().toISOString(),
    reportId: args.reportId ?? null,
  };
}

export function getPlayerContactHistory(
  log: CommunicationLogEntry[],
  playerId: string,
): CommunicationLogEntry[] {
  return log
    .filter((entry) => entry.playerId === playerId)
    .sort((left, right) => new Date(right.sentAt).getTime() - new Date(left.sentAt).getTime());
}
