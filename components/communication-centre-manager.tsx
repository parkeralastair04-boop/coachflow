"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BellRing,
  CalendarClock,
  FileText,
  Loader2,
  Mail,
  Megaphone,
  Send,
  Users,
} from "lucide-react";
import { FeaturePageHeader } from "@/components/feature-page-header";
import {
  ANNOUNCEMENT_MESSAGE_TYPES,
  ANNOUNCEMENT_TYPE_LABELS,
  COMMUNICATION_TEMPLATES,
  type AnnouncementMessageType,
  type CommunicationTemplateId,
  getCommunicationTemplate,
  renderCommunicationTemplate,
} from "@/lib/communication-templates";
import {
  appendCommunicationLog,
  buildCommunicationLogEntry,
  getPlayerContactHistory,
  readCommunicationLog,
  type CommunicationLogEntry,
  type CommunicationLogKind,
} from "@/lib/communication-log";
import {
  buildCoachCommunicationEmailHtml,
} from "@/lib/communication-email";
import {
  formatSessionDate,
  type AttendanceFollowUpSuggestion,
  type CommunicationDashboardData,
  type TomorrowSessionReminder,
} from "@/lib/communication-insights";
import { sanitizeUserFacingError } from "@/lib/user-facing-errors";
import { PanelSkeleton } from "@/components/branded-loading";

type Audience = "all_families" | "team" | "camp" | "selected";

function formatSentDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export function CommunicationCentreManager() {
  const [data, setData] = useState<CommunicationDashboardData | null>(null);
  const [log, setLog] = useState<CommunicationLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const [audience, setAudience] = useState<Audience>("all_families");
  const [teamId, setTeamId] = useState("");
  const [campId, setCampId] = useState("");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [messageType, setMessageType] = useState<AnnouncementMessageType>("general_update");
  const [templateId, setTemplateId] = useState<CommunicationTemplateId>("training_reminder");
  const [subject, setSubject] = useState(getCommunicationTemplate("training_reminder").defaultSubject);
  const [body, setBody] = useState(getCommunicationTemplate("training_reminder").defaultBody);

  const [reviewFollowUp, setReviewFollowUp] = useState<AttendanceFollowUpSuggestion | null>(null);
  const [skippedFollowUpIds, setSkippedFollowUpIds] = useState<string[]>([]);
  const [previewSession, setPreviewSession] = useState<TomorrowSessionReminder | null>(null);
  const [historyPlayerId, setHistoryPlayerId] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/communication/dashboard", { cache: "no-store" });
      const payload = (await response.json()) as CommunicationDashboardData & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load communication centre.");
      }
      setData(payload);
      setLog(readCommunicationLog());
    } catch (caughtError: unknown) {
      setError(
        sanitizeUserFacingError(caughtError, {
          context: "general",
          logLabel: "communication-centre",
        }),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadDashboard();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadDashboard]);

  const announcements = useMemo(
    () => log.filter((entry) => entry.kind === "announcement").slice(0, 10),
    [log],
  );
  const recentEmails = useMemo(() => log.slice(0, 10), [log]);
  const visibleFollowUps = useMemo(
    () =>
      (data?.attendanceFollowUps ?? []).filter(
        (item) => !skippedFollowUpIds.includes(item.id),
      ),
    [data?.attendanceFollowUps, skippedFollowUpIds],
  );

  const previewHtml = useMemo(() => {
    return buildCoachCommunicationEmailHtml({
      branding: {
        academyName: "Your academy",
        primaryColor: "#10B981",
      },
      subject: renderCommunicationTemplate(subject, {
        parent_name: "Sarah",
        player_name: "Alex",
      }),
      body: renderCommunicationTemplate(body, {
        parent_name: "Sarah",
        player_name: "Alex",
        session_date: "Tomorrow at 5:00 pm",
        camp_name: "Easter Camp",
        camp_dates: "7–11 April",
        attendance_note: "Alex has missed the last 3 sessions.",
      }),
    });
  }, [subject, body]);

  const playerHistory = useMemo(() => {
    if (!historyPlayerId) return [];
    return getPlayerContactHistory(log, historyPlayerId);
  }, [historyPlayerId, log]);

  function applyTemplate(nextTemplateId: CommunicationTemplateId) {
    const template = getCommunicationTemplate(nextTemplateId);
    setTemplateId(nextTemplateId);
    setSubject(template.defaultSubject);
    setBody(template.defaultBody);
  }

  async function sendCommunication(args: {
    kind: CommunicationLogKind;
    payload: Record<string, unknown>;
    messageTypeLabel?: string | null;
  }) {
    setSending(true);
    setStatusMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/communication/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: args.kind, ...args.payload }),
      });
      const result = (await response.json()) as {
        error?: string;
        sent?: number;
        truncated?: boolean;
        recipients?: Array<{
          playerId: string | null;
          playerName: string | null;
          parentEmail: string;
          parentName: string | null;
          preview: string;
        }>;
        subject?: string;
        messageType?: string | null;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to send message.");
      }

      let nextLog = log;
      for (const recipient of result.recipients ?? []) {
        nextLog = appendCommunicationLog(
          buildCommunicationLogEntry({
            kind: args.kind,
            subject: String(result.subject ?? args.payload.subject ?? "Message"),
            recipientEmail: recipient.parentEmail,
            recipientName: recipient.parentName,
            playerId: recipient.playerId,
            playerName: recipient.playerName,
            messageType: args.messageTypeLabel ?? result.messageType ?? null,
            preview: recipient.preview,
          }),
        );
      }
      setLog(nextLog);

      const truncatedNote = result.truncated ? " Only the first 25 families were emailed." : "";
      setStatusMessage(`Sent ${result.sent ?? 0} email${result.sent === 1 ? "" : "s"}.${truncatedNote}`);
    } catch (caughtError: unknown) {
      setError(
        sanitizeUserFacingError(caughtError, {
          context: "general",
          logLabel: "communication-send",
        }),
      );
    } finally {
      setSending(false);
    }
  }

  async function handleSendAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    await sendCommunication({
      kind: "announcement",
      messageTypeLabel: ANNOUNCEMENT_TYPE_LABELS[messageType],
      payload: {
        subject,
        body,
        messageType,
        audience,
        teamId: audience === "team" ? teamId : undefined,
        campId: audience === "camp" ? campId : undefined,
        selectedPlayerIds: audience === "selected" ? selectedPlayerIds : undefined,
      },
    });
  }

  async function handleSendFollowUp(item: AttendanceFollowUpSuggestion) {
    await sendCommunication({
      kind: "attendance_follow_up",
      messageTypeLabel: item.categoryLabel,
      payload: {
        subject: item.suggestedSubject,
        body: item.suggestedBody,
        playerId: item.playerId,
        parentEmail: item.parentEmail,
        parentName: item.parentName,
        playerName: item.playerName,
      },
    });
    setReviewFollowUp(null);
  }

  async function handleSendSessionReminder(session: TomorrowSessionReminder) {
    const template = getCommunicationTemplate("training_reminder");
    for (const family of session.families) {
      const values = {
        parent_name: family.parentName,
        player_name: family.playerName,
        session_date: formatSessionDate(session.sessionDate),
      };
      await sendCommunication({
        kind: "session_reminder",
        messageTypeLabel: "Training reminder",
        payload: {
          subject: renderCommunicationTemplate(template.defaultSubject, values),
          body: renderCommunicationTemplate(template.defaultBody, values),
          playerId: family.playerId,
          parentEmail: family.parentEmail,
          parentName: family.parentName,
          playerName: family.playerName,
        },
      });
    }
    setPreviewSession(null);
  }

  async function handleResendReport(reportId: string, playerId: string, reportText: string) {
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, report: reportText }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to resend report.");
      }

      const report = data?.reports.find((item) => item.id === reportId);
      if (report?.parentEmail) {
        const nextLog = appendCommunicationLog(
          buildCommunicationLogEntry({
            kind: "report_shared",
            subject: report.subject,
            recipientEmail: report.parentEmail,
            recipientName: report.parentName,
            playerId: report.playerId,
            playerName: report.playerName,
            messageType: "Report shared",
            preview: "Progress report emailed to parent.",
            reportId: report.id,
          }),
        );
        setLog(nextLog);
      }

      setStatusMessage("Report resent to parent.");
    } catch (caughtError: unknown) {
      setError(
        sanitizeUserFacingError(caughtError, {
          context: "general",
          logLabel: "communication-resend-report",
        }),
      );
    } finally {
      setSending(false);
    }
  }

  function toggleSelectedPlayer(playerId: string) {
    setSelectedPlayerIds((current) =>
      current.includes(playerId)
        ? current.filter((id) => id !== playerId)
        : [...current, playerId],
    );
  }

  return (
    <div className="page-content-enter space-y-10">
      <FeaturePageHeader
        featureKey="automations"
        title="Parent Updates"
        subtitle="Send announcements, follow up on attendance, share reports, and remind families about upcoming training."
      />

      {error ? (
        <div className="football-panel football-panel-interactive rounded-2xl p-6 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </div>
      ) : null}

      {statusMessage ? (
        <p className="text-muted text-sm" role="status">
          {statusMessage}
        </p>
      ) : null}

      {loading ? (
        <PanelSkeleton />
      ) : null}

      {!loading && data ? (
        <>
          <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6" aria-labelledby="quick-actions-heading">
            <h2 id="quick-actions-heading" className="text-lg font-semibold tracking-tight">
              Quick actions
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href="#send-announcement"
                className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Megaphone className="size-4" aria-hidden />
                Send announcement
              </a>
              <a
                href="#session-reminders"
                className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
              >
                <CalendarClock className="size-4" aria-hidden />
                Session reminders
              </a>
              <a
                href="#attendance-follow-ups"
                className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
              >
                <Users className="size-4" aria-hidden />
                Attendance follow-ups
              </a>
              <Link
                href="/dashboard/reports"
                className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
              >
                <FileText className="size-4" aria-hidden />
                Share report
              </Link>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6" aria-labelledby="announcements-heading">
              <h2 id="announcements-heading" className="text-lg font-semibold tracking-tight">
                Announcements
              </h2>
              {announcements.length === 0 ? (
                <p className="text-muted mt-4 text-sm" role="status">
                  No announcements sent from this centre yet.
                </p>
              ) : (
                <ul className="mt-4 space-y-3" role="list" aria-label="Announcements">
                  {announcements.map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-xl bg-black/[0.02] px-3 py-2 text-sm dark:bg-white/[0.03]"
                      role="listitem"
                    >
                      <p className="font-medium">{entry.subject}</p>
                      <p className="text-muted mt-1">
                        {entry.recipientName ?? entry.recipientEmail} · {formatSentDate(entry.sentAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6" aria-labelledby="recent-emails-heading">
              <h2 id="recent-emails-heading" className="text-lg font-semibold tracking-tight">
                Recent emails
              </h2>
              {recentEmails.length === 0 ? (
                <p className="text-muted mt-4 text-sm" role="status">
                  Emails you send from here will appear in this list.
                </p>
              ) : (
                <ul className="mt-4 space-y-3" role="list" aria-label="Recent emails">
                  {recentEmails.map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-xl bg-black/[0.02] px-3 py-2 text-sm dark:bg-white/[0.03]"
                      role="listitem"
                    >
                      <p className="font-medium">{entry.subject}</p>
                      <p className="text-muted mt-1">{entry.preview}</p>
                      <p className="text-muted mt-1">
                        {entry.playerName ?? entry.recipientEmail} · {formatSentDate(entry.sentAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6" aria-labelledby="scheduled-messages-heading">
            <h2 id="scheduled-messages-heading" className="text-lg font-semibold tracking-tight">
              Scheduled messages
            </h2>
            <p className="text-muted mt-1 text-sm">
              Automatic messages from your automations setup.
            </p>
            {data.scheduledMessages.length === 0 ? (
              <p className="text-muted mt-4 text-sm" role="status">
                No automations configured yet.{" "}
                <Link href="/dashboard/automations" className="text-accent underline-offset-4 hover:underline">
                  Set up automatic messages
                </Link>
              </p>
            ) : (
              <ul className="mt-4 space-y-3" role="list" aria-label="Scheduled messages">
                {data.scheduledMessages.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-black/[0.02] px-3 py-3 text-sm dark:bg-white/[0.03]"
                    role="listitem"
                  >
                    <div>
                      <p className="font-medium capitalize">{item.title}</p>
                      <p className="text-muted mt-1">{item.subject}</p>
                      <p className="text-muted mt-1">{item.timingLabel}</p>
                    </div>
                    <span
                      className={`inline-flex min-h-8 items-center rounded-full px-3 text-xs font-medium ${
                        item.isEnabled
                          ? "bg-accent/10 text-accent ring-accent/20 ring-1"
                          : "bg-black/[0.04] text-muted ring-1 ring-black/[0.06] dark:bg-white/[0.05]"
                      }`}
                    >
                      {item.isEnabled ? "Enabled" : "Paused"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            id="send-announcement"
            className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6"
            aria-labelledby="send-announcement-heading"
          >
            <h2 id="send-announcement-heading" className="text-lg font-semibold tracking-tight">
              Send announcement
            </h2>
            <form className="mt-6 space-y-4" onSubmit={(event) => void handleSendAnnouncement(event)}>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium" htmlFor="announcementAudience">
                    Recipients
                  </label>
                  <select
                    id="announcementAudience"
                    value={audience}
                    onChange={(event) => setAudience(event.target.value as Audience)}
                    className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                  >
                    <option value="all_families">All families</option>
                    <option value="team">Team</option>
                    <option value="camp">Camp attendees</option>
                    <option value="selected">Selected players</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium" htmlFor="announcementType">
                    Message type
                  </label>
                  <select
                    id="announcementType"
                    value={messageType}
                    onChange={(event) =>
                      setMessageType(event.target.value as AnnouncementMessageType)
                    }
                    className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                  >
                    {ANNOUNCEMENT_MESSAGE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {ANNOUNCEMENT_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {audience === "team" ? (
                <div>
                  <label className="mb-2 block text-sm font-medium" htmlFor="announcementTeam">
                    Team
                  </label>
                  <select
                    id="announcementTeam"
                    value={teamId}
                    onChange={(event) => setTeamId(event.target.value)}
                    className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                  >
                    <option value="">Select a team</option>
                    {data.teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.team_name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {audience === "camp" ? (
                <div>
                  <label className="mb-2 block text-sm font-medium" htmlFor="announcementCamp">
                    Camp
                  </label>
                  <select
                    id="announcementCamp"
                    value={campId}
                    onChange={(event) => setCampId(event.target.value)}
                    className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                  >
                    <option value="">Select a camp</option>
                    {data.camps.map((camp) => (
                      <option key={camp.id} value={camp.id}>
                        {camp.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {audience === "selected" ? (
                <fieldset>
                  <legend className="mb-2 text-sm font-medium">Selected players</legend>
                  <ul className="max-h-48 space-y-2 overflow-y-auto" role="list">
                    {data.players.map((player) => (
                      <li key={player.id} role="listitem">
                        <label className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedPlayerIds.includes(player.id)}
                            onChange={() => toggleSelectedPlayer(player.id)}
                          />
                          <span>
                            {player.player_name}
                            {player.parent_email ? "" : " (no parent email)"}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              ) : null}

              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="announcementTemplate">
                  Message template
                </label>
                <select
                  id="announcementTemplate"
                  value={templateId}
                  onChange={(event) =>
                    applyTemplate(event.target.value as CommunicationTemplateId)
                  }
                  className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                >
                  {COMMUNICATION_TEMPLATES.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="announcementSubject">
                  Subject
                </label>
                <input
                  id="announcementSubject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="announcementBody">
                  Message
                </label>
                <textarea
                  id="announcementBody"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  className="border-border bg-background text-foreground focus-visible:ring-accent/40 min-h-40 w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2"
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="size-4" aria-hidden />
                )}
                Send announcement
              </button>
            </form>
          </section>

          <section
            id="attendance-follow-ups"
            className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6"
            aria-labelledby="attendance-follow-ups-heading"
          >
            <h2 id="attendance-follow-ups-heading" className="text-lg font-semibold tracking-tight">
              Attendance follow-ups
            </h2>
            <p className="text-muted mt-1 text-sm">
              Suggested families to contact. You choose whether to send.
            </p>

            {visibleFollowUps.length === 0 ? (
              <p className="text-muted mt-4 text-sm" role="status">
                No attendance follow-ups suggested right now.
              </p>
            ) : (
              <ul className="mt-4 space-y-3" role="list" aria-label="Attendance follow-up suggestions">
                {visibleFollowUps.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]"
                    role="listitem"
                  >
                    <p className="font-medium">{item.playerName}</p>
                    <p className="text-muted mt-1 text-sm">
                      {item.categoryLabel} · {Math.round(item.attendanceRate)}% attendance
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setReviewFollowUp(item)}
                        className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
                      >
                        Review
                      </button>
                      <button
                        type="button"
                        disabled={sending}
                        onClick={() => void handleSendFollowUp(item)}
                        className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
                      >
                        <Mail className="size-4" aria-hidden />
                        Send email
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSkippedFollowUpIds((current) => [...current, item.id])
                        }
                        className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
                      >
                        Skip
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {reviewFollowUp ? (
              <div className="mt-6 rounded-2xl border border-[var(--color-border)] p-4">
                <h3 className="font-medium">Review follow-up</h3>
                <p className="text-muted mt-2 text-sm font-medium">{reviewFollowUp.suggestedSubject}</p>
                <p className="text-muted mt-3 whitespace-pre-wrap text-sm leading-relaxed">
                  {reviewFollowUp.suggestedBody}
                </p>
              </div>
            ) : null}
          </section>

          <section
            className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6"
            aria-labelledby="report-communication-heading"
          >
            <h2 id="report-communication-heading" className="text-lg font-semibold tracking-tight">
              Report communication
            </h2>
            {data.reports.length === 0 ? (
              <p className="text-muted mt-4 text-sm" role="status">
                No reports available to share yet.
              </p>
            ) : (
              <ul className="mt-4 space-y-3" role="list" aria-label="Report communication history">
                {data.reports.map((report) => {
                  const sentEntry = log.find(
                    (entry) => entry.reportId === report.id || entry.playerId === report.playerId,
                  );
                  return (
                    <li
                      key={report.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]"
                      role="listitem"
                    >
                      <div>
                        <p className="font-medium">{report.subject}</p>
                        <p className="text-muted mt-1 text-sm">
                          {report.playerName}
                          {report.parentEmail ? ` · ${report.parentEmail}` : " · No parent email"}
                        </p>
                        <p className="text-muted mt-1 text-sm">
                          {sentEntry
                            ? `Sent ${formatSentDate(sentEntry.sentAt)}`
                            : `Created ${formatSentDate(report.created_at)}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/dashboard/reports?player=${report.playerId}`}
                          className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
                        >
                          Open report
                        </Link>
                        <button
                          type="button"
                          disabled={sending || !report.parentEmail}
                          onClick={() =>
                            void handleResendReport(report.id, report.playerId, report.report)
                          }
                          className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
                        >
                          Resend report
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section
            id="session-reminders"
            className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6"
            aria-labelledby="session-reminders-heading"
          >
            <h2 id="session-reminders-heading" className="text-lg font-semibold tracking-tight">
              Upcoming session reminders
            </h2>
            <p className="text-muted mt-1 text-sm">Tomorrow&apos;s sessions and booked families.</p>

            {data.tomorrowSessions.length === 0 ? (
              <p className="text-muted mt-4 text-sm" role="status">
                No sessions booked for tomorrow.
              </p>
            ) : (
              <ul className="mt-4 space-y-3" role="list" aria-label="Tomorrow's sessions">
                {data.tomorrowSessions.map((session) => (
                  <li
                    key={session.sessionId}
                    className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]"
                    role="listitem"
                  >
                    <p className="font-medium">{session.sessionTitle}</p>
                    <p className="text-muted mt-1 text-sm">
                      {formatSessionDate(session.sessionDate)}
                      {session.location ? ` · ${session.location}` : ""}
                    </p>
                    <p className="text-muted mt-1 text-sm">
                      {session.families.length} famil{session.families.length === 1 ? "y" : "ies"}{" "}
                      booked
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={sending}
                        onClick={() => void handleSendSessionReminder(session)}
                        className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
                      >
                        <BellRing className="size-4" aria-hidden />
                        Send reminder
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewSession(session)}
                        className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
                      >
                        Preview email
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {previewSession ? (
              <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--color-border)]">
                <div className="border-b border-[var(--color-border)] px-4 py-3 text-sm font-medium">
                  Email preview
                </div>
                <iframe
                  title="Session reminder email preview"
                  className="h-[420px] w-full bg-white"
                  srcDoc={previewHtml}
                />
              </div>
            ) : null}
          </section>

          <section
            className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6"
            aria-labelledby="contact-history-heading"
          >
            <h2 id="contact-history-heading" className="text-lg font-semibold tracking-tight">
              Contact history
            </h2>
            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium" htmlFor="historyPlayer">
                Player
              </label>
              <select
                id="historyPlayer"
                value={historyPlayerId}
                onChange={(event) => setHistoryPlayerId(event.target.value)}
                className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full max-w-md rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
              >
                <option value="">Select a player</option>
                {data.players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.player_name}
                  </option>
                ))}
              </select>
            </div>

            {historyPlayerId && playerHistory.length === 0 ? (
              <p className="text-muted mt-4 text-sm" role="status">
                No messages logged for this player yet.
              </p>
            ) : null}

            {playerHistory.length > 0 ? (
              <ol className="mt-4 space-y-3" role="list" aria-label="Player contact history">
                {playerHistory.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-xl bg-black/[0.02] px-3 py-3 text-sm dark:bg-white/[0.03]"
                    role="listitem"
                  >
                    <p className="font-medium">{entry.subject}</p>
                    <p className="text-muted mt-1 capitalize">
                      {entry.kind.replaceAll("_", " ")} · {formatSentDate(entry.sentAt)}
                    </p>
                    <p className="text-muted mt-1">{entry.preview}</p>
                  </li>
                ))}
              </ol>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
