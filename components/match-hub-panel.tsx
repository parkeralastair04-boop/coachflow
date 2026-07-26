"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ClipboardList,
  Loader2,
  Mail,
  Plus,
  Star,
  Trophy,
} from "lucide-react";
import { AttendanceStatusBadge } from "@/components/attendance-display";
import {
  getAttendanceLabel,
  PRIMARY_ATTENDANCE_STATUS_OPTIONS,
  SECONDARY_ATTENDANCE_STATUS_OPTIONS,
  type PlayerAttendanceStatus,
} from "@/lib/attendance";
import {
  buildMatchHubSummaryCopy,
  buildSquadPlayerCard,
  buildTeamSeasonRecord,
  formatMatchScoreLabel,
  getEventSummary,
  getParentAvailabilitySummary,
  sortSquadPlayers,
  type MatchWithTeam,
} from "@/lib/match-insights";
import {
  MATCH_COMPETITION_LABELS,
  MATCH_EVENT_LABELS,
  MATCH_EVENT_TYPES,
  MATCH_STATUS_LABELS,
  PARENT_MATCH_AVAILABILITY_LABELS,
  parseMatchData,
  type MatchEventType,
  type MatchSquadPlayerRow,
  type MatchStatus,
} from "@/lib/match-types";
import { getRoleLabel } from "@/lib/team-management";

type MatchHubPanelProps = {
  match: MatchWithTeam;
  squad: MatchSquadPlayerRow[];
  attendanceByPlayer: Record<string, PlayerAttendanceStatus | null>;
  teamMatches: MatchWithTeam[];
  attendanceRatesByPlayer: Record<string, number>;
  recentFormByPlayer: Record<string, string[]>;
  saving: boolean;
  reportLoading: boolean;
  statusMessage: string | null;
  onPublishSquad: (published: boolean) => void;
  onStatusChange: (status: MatchStatus) => void;
  onSquadReorder: (playerId: string, direction: "up" | "down") => void;
  onSetCaptain: (playerId: string) => void;
  onSetViceCaptain: (playerId: string) => void;
  onToggleGoalkeeper: (playerId: string) => void;
  onToggleStarter: (playerId: string) => void;
  onLoadTeamSquad: () => void;
  onMarkAttendance: (playerId: string, status: PlayerAttendanceStatus) => void;
  onBulkAttendance: (status: PlayerAttendanceStatus) => void;
  onAddEvent: (event: {
    type: MatchEventType;
    playerId: string;
    relatedPlayerId?: string | null;
    minute?: number | null;
  }) => void;
  onSaveResult: (result: {
    homeScore: number;
    awayScore: number;
    halfTimeHomeScore?: number | null;
    halfTimeAwayScore?: number | null;
    weather?: string | null;
    coachNotes?: string | null;
    playerOfTheMatchId?: string | null;
  }) => void;
  onGenerateReport: (notes: string) => void;
};

export function MatchHubPanel({
  match,
  squad,
  attendanceByPlayer,
  teamMatches,
  attendanceRatesByPlayer,
  recentFormByPlayer,
  saving,
  reportLoading,
  statusMessage,
  onPublishSquad,
  onStatusChange,
  onSquadReorder,
  onSetCaptain,
  onSetViceCaptain,
  onToggleGoalkeeper,
  onToggleStarter,
  onLoadTeamSquad,
  onMarkAttendance,
  onBulkAttendance,
  onAddEvent,
  onSaveResult,
  onGenerateReport,
}: MatchHubPanelProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "squad" | "register" | "events" | "result" | "report" | "season"
  >("overview");
  const [eventType, setEventType] = useState<MatchEventType>("goal");
  const [eventPlayerId, setEventPlayerId] = useState("");
  const [eventMinute, setEventMinute] = useState("");
  const [reportNotes, setReportNotes] = useState("");
  const matchData = useMemo(() => parseMatchData(match.match_data), [match.match_data]);
  const sortedSquad = useMemo(() => sortSquadPlayers(squad), [squad]);
  const availabilitySummary = useMemo(() => getParentAvailabilitySummary(squad), [squad]);
  const seasonRecord = useMemo(
    () => buildTeamSeasonRecord(match.team_id, teamMatches),
    [match.team_id, teamMatches],
  );
  const scoreLabel = formatMatchScoreLabel(match);

  const tabs = [
    ["overview", "Overview"],
    ["squad", "Squad"],
    ["register", "Register"],
    ["events", "Events"],
    ["result", "Result"],
    ["report", "Report"],
    ["season", "Season"],
  ] as const;

  return (
    <section
      id="match-hub-panel"
      className="glass-panel interactive-surface rounded-2xl p-5 sm:p-8"
      aria-labelledby="match-hub-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="match-hub-heading" className="text-xl font-semibold tracking-tight">
            Match hub
          </h2>
          <p className="text-muted mt-1 text-sm">{buildMatchHubSummaryCopy(match)}</p>
          <p className="text-muted mt-1 text-sm" role="status">
            {MATCH_STATUS_LABELS[match.status]}
            {scoreLabel !== "Result pending" ? ` · ${scoreLabel}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="match-status-select">
            Match status
          </label>
          <select
            id="match-status-select"
            value={match.status}
            disabled={saving}
            onChange={(event) => onStatusChange(event.target.value as MatchStatus)}
            className="border-border bg-background focus-visible:ring-accent/40 h-11 rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
          >
            {Object.entries(MATCH_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={saving}
            onClick={() => onPublishSquad(!match.squad_published)}
            className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {match.squad_published ? "Unpublish squad" : "Publish squad"}
          </button>
        </div>
      </div>

      {statusMessage ? (
        <p className="mt-4 text-sm" role="status">
          {statusMessage}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Match hub sections">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className={`focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              activeTab === id
                ? "bg-accent text-accent-foreground"
                : "border-border border hover:bg-surface-hover"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? (
        <div className="mt-6 space-y-4" role="tabpanel">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-black/[0.02] px-4 py-3 dark:bg-white/[0.03]">
              <dt className="text-muted text-xs">Competition</dt>
              <dd className="mt-1 text-sm font-medium">
                {MATCH_COMPETITION_LABELS[match.competition_type]}
              </dd>
            </div>
            <div className="rounded-xl bg-black/[0.02] px-4 py-3 dark:bg-white/[0.03]">
              <dt className="text-muted text-xs">Venue</dt>
              <dd className="mt-1 text-sm font-medium">{match.venue ?? "TBC"}</dd>
            </div>
            <div className="rounded-xl bg-black/[0.02] px-4 py-3 dark:bg-white/[0.03]">
              <dt className="text-muted text-xs">Home / Away</dt>
              <dd className="mt-1 text-sm font-medium">{match.is_home ? "Home" : "Away"}</dd>
            </div>
            <div className="rounded-xl bg-black/[0.02] px-4 py-3 dark:bg-white/[0.03]">
              <dt className="text-muted text-xs">Pitch</dt>
              <dd className="mt-1 text-sm font-medium">{match.pitch ?? "TBC"}</dd>
            </div>
          </dl>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(availabilitySummary).map(([key, count]) => (
              <div
                key={key}
                className="rounded-xl bg-black/[0.02] px-4 py-3 text-sm dark:bg-white/[0.03]"
              >
                <p className="text-muted text-xs">
                  {PARENT_MATCH_AVAILABILITY_LABELS[key as keyof typeof PARENT_MATCH_AVAILABILITY_LABELS]}
                </p>
                <p className="mt-1 font-medium">{count}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={
                match.session_id
                  ? `/dashboard/registers?session=${match.session_id}`
                  : "/dashboard/registers"
              }
              className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <ClipboardList className="size-4" aria-hidden />
              Open full register
            </Link>
            <Link
              href={`/dashboard/communication?template=match_reminder&match=${match.id}`}
              className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Mail className="size-4" aria-hidden />
              Send reminder
            </Link>
          </div>
        </div>
      ) : null}

      {activeTab === "squad" ? (
        <div className="mt-6 space-y-4" role="tabpanel">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={onLoadTeamSquad}
              className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
            >
              Load team squad
            </button>
          </div>
          <ul className="space-y-3" role="list" aria-label="Match squad">
            {sortedSquad.map((row) => {
              const card = buildSquadPlayerCard({
                squadPlayer: row,
                attendanceRate: attendanceRatesByPlayer[row.player_id] ?? 0,
                recentForm: recentFormByPlayer[row.player_id] ?? [],
                attendanceStatus: attendanceByPlayer[row.player_id] ?? null,
              });
              return (
                <li
                  key={row.id}
                  className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]"
                  role="listitem"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {card.playerName}
                        {card.role ? ` · ${getRoleLabel(card.role)}` : ""}
                        {card.isGoalkeeper ? " · GK" : ""}
                        {!card.isStarter ? " · Sub" : ""}
                      </p>
                      <p className="text-muted mt-1 text-sm">
                        {card.positionLabel} · Attendance {card.attendanceRate}%
                        {card.recentForm.length > 0
                          ? ` · Form ${card.recentForm.join("")}`
                          : ""}
                      </p>
                      <p className="text-muted mt-1 text-sm">
                        Parent: {PARENT_MATCH_AVAILABILITY_LABELS[card.parentAvailability]}
                      </p>
                      <Link
                        href={`/dashboard/players?player=${card.playerId}`}
                        className="text-accent mt-2 inline-flex min-h-11 items-center text-sm underline-offset-4 hover:underline"
                      >
                        View development profile
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        aria-label={`Move ${card.playerName} up`}
                        disabled={saving}
                        onClick={() => onSquadReorder(row.player_id, "up")}
                        className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex size-11 items-center justify-center rounded-xl border outline-none focus-visible:ring-2"
                      >
                        <ArrowUp className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${card.playerName} down`}
                        disabled={saving}
                        onClick={() => onSquadReorder(row.player_id, "down")}
                        className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex size-11 items-center justify-center rounded-xl border outline-none focus-visible:ring-2"
                      >
                        <ArrowDown className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onSetCaptain(row.player_id)}
                        className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                      >
                        Captain
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onSetViceCaptain(row.player_id)}
                        className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                      >
                        Vice
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onToggleGoalkeeper(row.player_id)}
                        className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                      >
                        GK
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onToggleStarter(row.player_id)}
                        className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                      >
                        {card.isStarter ? "Bench" : "Start"}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {activeTab === "register" ? (
        <div className="mt-6 space-y-4" role="tabpanel">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => onBulkAttendance("present")}
              className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Mark all present
            </button>
            {PRIMARY_ATTENDANCE_STATUS_OPTIONS.filter((status) => status !== "present").map(
              (status) => (
                <button
                  key={status}
                  type="button"
                  disabled={saving}
                  onClick={() => onBulkAttendance(status)}
                  className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Mark all {getAttendanceLabel(status).toLowerCase()}
                </button>
              ),
            )}
          </div>
          <ul className="space-y-3" role="list" aria-label="Match register">
            {sortedSquad.map((row) => {
              const status = attendanceByPlayer[row.player_id];
              const name = row.player?.player_name ?? "Player";
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]"
                  role="listitem"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{name}</span>
                    {status ? <AttendanceStatusBadge status={status} /> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[...PRIMARY_ATTENDANCE_STATUS_OPTIONS, ...SECONDARY_ATTENDANCE_STATUS_OPTIONS].map(
                      (option) => (
                        <button
                          key={option}
                          type="button"
                          disabled={saving}
                          onClick={() => onMarkAttendance(row.player_id, option)}
                          className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                        >
                          {getAttendanceLabel(option)}
                        </button>
                      ),
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-muted text-sm">
            For offline pitch-side marking, use the linked{" "}
            <Link href={`/dashboard/registers?session=${match.session_id ?? ""}`} className="text-accent underline-offset-4 hover:underline">
              full register
            </Link>
            .
          </p>
        </div>
      ) : null}

      {activeTab === "events" ? (
        <div className="mt-6 space-y-4" role="tabpanel">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="event-type">
                Event type
              </label>
              <select
                id="event-type"
                value={eventType}
                onChange={(event) => setEventType(event.target.value as MatchEventType)}
                className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
              >
                {MATCH_EVENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {MATCH_EVENT_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="event-player">
                Player
              </label>
              <select
                id="event-player"
                value={eventPlayerId}
                onChange={(event) => setEventPlayerId(event.target.value)}
                className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
              >
                <option value="">Select player</option>
                {sortedSquad.map((row) => (
                  <option key={row.player_id} value={row.player_id}>
                    {row.player?.player_name ?? "Player"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="event-minute">
                Minute
              </label>
              <input
                id="event-minute"
                type="number"
                min={0}
                max={120}
                value={eventMinute}
                onChange={(event) => setEventMinute(event.target.value)}
                className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
              />
            </div>
          </div>
          <button
            type="button"
            disabled={saving || !eventPlayerId}
            onClick={() => {
              onAddEvent({
                type: eventType,
                playerId: eventPlayerId,
                minute: eventMinute ? Number(eventMinute) : null,
              });
              setEventMinute("");
            }}
            className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
          >
            <Plus className="size-4" aria-hidden />
            Add event
          </button>
          <ul className="space-y-2" role="list" aria-label="Match events">
            {matchData.events.map((event) => {
              const player = sortedSquad.find((row) => row.player_id === event.playerId);
              return (
                <li
                  key={event.id}
                  className="rounded-xl bg-black/[0.02] px-3 py-2 text-sm dark:bg-white/[0.03]"
                  role="listitem"
                >
                  {getEventSummary(event, player?.player?.player_name ?? "Player")}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {activeTab === "result" ? (
        <div className="mt-6 space-y-4" role="tabpanel">
          <MatchResultForm
            match={match}
            squad={sortedSquad}
            saving={saving}
            onSave={onSaveResult}
          />
        </div>
      ) : null}

      {activeTab === "report" ? (
        <div className="mt-6 space-y-4" role="tabpanel">
          <label className="mb-2 block text-sm font-medium" htmlFor="match-report-notes">
            Quick coach notes
          </label>
          <textarea
            id="match-report-notes"
            value={reportNotes}
            onChange={(event) => setReportNotes(event.target.value)}
            className="border-border bg-background focus-visible:ring-accent/40 min-h-32 w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2"
          />
          <button
            type="button"
            disabled={reportLoading}
            onClick={() => onGenerateReport(reportNotes)}
            className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
          >
            {reportLoading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Star className="size-4" aria-hidden />
            )}
            Generate AI match report
          </button>
        </div>
      ) : null}

      {activeTab === "season" ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" role="tabpanel">
          <SeasonStat label="Played" value={seasonRecord.played} />
          <SeasonStat label="Won" value={seasonRecord.won} />
          <SeasonStat label="Drawn" value={seasonRecord.drawn} />
          <SeasonStat label="Lost" value={seasonRecord.lost} />
          <SeasonStat label="GF" value={seasonRecord.goalsFor} />
          <SeasonStat label="GA" value={seasonRecord.goalsAgainst} />
          <SeasonStat label="GD" value={seasonRecord.goalDifference} />
          <SeasonStat label="Points" value={seasonRecord.points} />
          <SeasonStat label="Form" value={seasonRecord.currentForm.join(" ") || "—"} />
          <SeasonStat
            label="Streak"
            value={
              seasonRecord.currentStreak.count > 0
                ? `${seasonRecord.currentStreak.count} ${seasonRecord.currentStreak.type}`
                : "—"
            }
          />
          <SeasonStat
            label="Home"
            value={`${seasonRecord.homeRecord.won}-${seasonRecord.homeRecord.drawn}-${seasonRecord.homeRecord.lost}`}
          />
          <SeasonStat
            label="Away"
            value={`${seasonRecord.awayRecord.won}-${seasonRecord.awayRecord.drawn}-${seasonRecord.awayRecord.lost}`}
          />
        </div>
      ) : null}
    </section>
  );
}

function SeasonStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-black/[0.02] px-4 py-3 dark:bg-white/[0.03]">
      <p className="text-muted text-xs">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function MatchResultForm({
  match,
  squad,
  saving,
  onSave,
}: {
  match: MatchWithTeam;
  squad: MatchSquadPlayerRow[];
  saving: boolean;
  onSave: MatchHubPanelProps["onSaveResult"];
}) {
  const data = parseMatchData(match.match_data);
  const [homeScore, setHomeScore] = useState(String(data.result?.homeScore ?? ""));
  const [awayScore, setAwayScore] = useState(String(data.result?.awayScore ?? ""));
  const [weather, setWeather] = useState(data.result?.weather ?? "");
  const [coachNotes, setCoachNotes] = useState(data.result?.coachNotes ?? "");
  const [playerOfTheMatchId, setPlayerOfTheMatchId] = useState(
    data.result?.playerOfTheMatchId ?? "",
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="home-score">
          Home score
        </label>
        <input
          id="home-score"
          type="number"
          min={0}
          value={homeScore}
          onChange={(event) => setHomeScore(event.target.value)}
          className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="away-score">
          Away score
        </label>
        <input
          id="away-score"
          type="number"
          min={0}
          value={awayScore}
          onChange={(event) => setAwayScore(event.target.value)}
          className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="weather">
          Weather
        </label>
        <input
          id="weather"
          value={weather}
          onChange={(event) => setWeather(event.target.value)}
          className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="potm">
          Player of the Match
        </label>
        <select
          id="potm"
          value={playerOfTheMatchId}
          onChange={(event) => setPlayerOfTheMatchId(event.target.value)}
          className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
        >
          <option value="">Select player</option>
          {squad.map((row) => (
            <option key={row.player_id} value={row.player_id}>
              {row.player?.player_name ?? "Player"}
            </option>
          ))}
        </select>
      </div>
      <div className="md:col-span-2">
        <label className="mb-2 block text-sm font-medium" htmlFor="coach-notes">
          Coach notes
        </label>
        <textarea
          id="coach-notes"
          value={coachNotes}
          onChange={(event) => setCoachNotes(event.target.value)}
          className="border-border bg-background focus-visible:ring-accent/40 min-h-24 w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2"
        />
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={() =>
          onSave({
            homeScore: Number(homeScore),
            awayScore: Number(awayScore),
            weather: weather || null,
            coachNotes: coachNotes || null,
            playerOfTheMatchId: playerOfTheMatchId || null,
          })
        }
        className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background md:col-span-2"
      >
        <Trophy className="size-4" aria-hidden />
        Save result
      </button>
    </div>
  );
}
