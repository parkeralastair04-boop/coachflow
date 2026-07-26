import { getAttendanceRate, type PlayerAttendanceStatus } from "@/lib/attendance";
import { getPositionSummary, isPlayerPositionOption } from "@/lib/player-profile";
import {
  formatMatchKickoff,
  getMatchTitle,
  MATCH_EVENT_LABELS,
  parseMatchData,
  type MatchData,
  type MatchEvent,
  type MatchResult,
  type MatchRow,
  type MatchSquadPlayerRow,
  type MatchStatus,
  type ParentMatchAvailability,
} from "@/lib/match-types";

export type MatchWithTeam = MatchRow & {
  team?: { team_name: string } | null;
};

export type MatchOverviewMetrics = {
  squadSize: number;
  availabilityResponded: number;
  availabilityUnavailable: number;
  registerMarked: number;
  goalsScored: number;
  goalsConceded: number;
};

export type TeamSeasonRecord = {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  currentForm: string[];
  currentStreak: { type: "win" | "draw" | "loss" | "none"; count: number };
  homeRecord: { played: number; won: number; drawn: number; lost: number };
  awayRecord: { played: number; won: number; drawn: number; lost: number };
  biggestWin: { margin: number; label: string } | null;
  biggestLoss: { margin: number; label: string } | null;
};

export type PlayerMatchHistory = {
  playerId: string;
  appearances: number;
  starts: number;
  substituteAppearances: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  minutes: number;
  playerOfTheMatchAwards: number;
  recentForm: string[];
};

export type MatchDashboardSnapshot = {
  upcomingFixture: MatchWithTeam | null;
  awaitingAvailability: number;
  latestResult: {
    match: MatchWithTeam;
    scoreLabel: string;
  } | null;
  unavailablePlayers: Array<{ playerId: string; playerName: string; matchId: string }>;
  seasonRecord: TeamSeasonRecord | null;
};

function getTeamName(match: MatchWithTeam): string {
  const team = match.team;
  if (!team || typeof team !== "object") return "Your team";
  return team.team_name ?? "Your team";
}

function getMatchScores(match: MatchRow): { for: number; against: number } | null {
  const data = parseMatchData(match.match_data);
  if (!data.result) return null;
  const home = data.result.homeScore;
  const away = data.result.awayScore;
  if (home === null || away === null) return null;
  return match.is_home ? { for: home, against: away } : { for: away, against: home };
}

function getMatchOutcome(
  match: MatchRow,
): "win" | "draw" | "loss" | null {
  const scores = getMatchScores(match);
  if (!scores || match.status !== "completed") return null;
  if (scores.for > scores.against) return "win";
  if (scores.for < scores.against) return "loss";
  return "draw";
}

export function buildMatchOverviewMetrics(args: {
  squad: MatchSquadPlayerRow[];
  attendanceByPlayer: Record<string, PlayerAttendanceStatus | null>;
}): MatchOverviewMetrics {
  const { squad, attendanceByPlayer } = args;
  const availabilityResponded = squad.filter(
    (player) => player.parent_availability !== "no_response",
  ).length;
  const availabilityUnavailable = squad.filter(
    (player) => player.parent_availability === "unavailable",
  ).length;
  const registerMarked = squad.filter(
    (player) => attendanceByPlayer[player.player_id] !== null,
  ).length;

  return {
    squadSize: squad.length,
    availabilityResponded,
    availabilityUnavailable,
    registerMarked,
    goalsScored: 0,
    goalsConceded: 0,
  };
}

export function buildTeamSeasonRecord(
  teamId: string,
  matches: MatchWithTeam[],
): TeamSeasonRecord {
  const completed = matches.filter(
    (match) => match.team_id === teamId && match.status === "completed",
  );

  let won = 0;
  let drawn = 0;
  let lost = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  const homeRecord = { played: 0, won: 0, drawn: 0, lost: 0 };
  const awayRecord = { played: 0, won: 0, drawn: 0, lost: 0 };
  let biggestWin: TeamSeasonRecord["biggestWin"] = null;
  let biggestLoss: TeamSeasonRecord["biggestLoss"] = null;
  const form: string[] = [];

  for (const match of completed) {
    const scores = getMatchScores(match);
    if (!scores) continue;
    goalsFor += scores.for;
    goalsAgainst += scores.against;
    const outcome = getMatchOutcome(match);
    if (!outcome) continue;

    const record = match.is_home ? homeRecord : awayRecord;
    record.played += 1;

    if (outcome === "win") {
      won += 1;
      record.won += 1;
      form.push("W");
      const margin = scores.for - scores.against;
      const label = getMatchTitle(match, getTeamName(match));
      if (!biggestWin || margin > biggestWin.margin) {
        biggestWin = { margin, label };
      }
    } else if (outcome === "draw") {
      drawn += 1;
      record.drawn += 1;
      form.push("D");
    } else {
      lost += 1;
      record.lost += 1;
      form.push("L");
      const margin = scores.against - scores.for;
      const label = getMatchTitle(match, getTeamName(match));
      if (!biggestLoss || margin > biggestLoss.margin) {
        biggestLoss = { margin, label };
      }
    }
  }

  const currentForm = form.slice(-5);
  const latest = currentForm[currentForm.length - 1];
  let streakType: TeamSeasonRecord["currentStreak"]["type"] = "none";
  let streakCount = 0;
  if (latest) {
    streakType = latest === "W" ? "win" : latest === "D" ? "draw" : "loss";
    for (let index = currentForm.length - 1; index >= 0; index -= 1) {
      if (currentForm[index] !== latest) break;
      streakCount += 1;
    }
  }

  return {
    played: completed.length,
    won,
    drawn,
    lost,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    points: won * 3 + drawn,
    currentForm,
    currentStreak: { type: streakType, count: streakCount },
    homeRecord,
    awayRecord,
    biggestWin,
    biggestLoss,
  };
}

export function buildPlayerMatchHistory(args: {
  playerId: string;
  matches: MatchRow[];
  squads: MatchSquadPlayerRow[];
}): PlayerMatchHistory {
  const { playerId, matches, squads } = args;
  const playerSquads = squads.filter((row) => row.player_id === playerId);
  const matchIds = new Set(playerSquads.map((row) => row.match_id));
  const relevantMatches = matches.filter((match) => matchIds.has(match.id));

  let goals = 0;
  let assists = 0;
  let yellowCards = 0;
  let redCards = 0;
  let minutes = 0;
  let playerOfTheMatchAwards = 0;
  const recentForm: string[] = [];

  for (const squad of playerSquads) {
    minutes += squad.minutes_played;
    const match = relevantMatches.find((item) => item.id === squad.match_id);
    if (!match) continue;
    const data = parseMatchData(match.match_data);
    for (const event of data.events) {
      if (event.playerId === playerId) {
        if (event.type === "goal" || event.type === "own_goal") goals += 1;
        if (event.type === "assist") assists += 1;
        if (event.type === "yellow_card") yellowCards += 1;
        if (event.type === "red_card") redCards += 1;
      }
    }
    if (data.result?.playerOfTheMatchId === playerId) {
      playerOfTheMatchAwards += 1;
    }
    if (match.status === "completed") {
      const outcome = getMatchOutcome(match);
      if (outcome) recentForm.push(outcome === "win" ? "W" : outcome === "draw" ? "D" : "L");
    }
  }

  return {
    playerId,
    appearances: playerSquads.length,
    starts: playerSquads.filter((row) => row.is_starter).length,
    substituteAppearances: playerSquads.filter((row) => !row.is_starter).length,
    goals,
    assists,
    yellowCards,
    redCards,
    minutes,
    playerOfTheMatchAwards,
    recentForm: recentForm.slice(-5),
  };
}

export function buildMatchDashboardSnapshot(args: {
  matches: MatchWithTeam[];
  squads: MatchSquadPlayerRow[];
  teamId?: string | null;
}): MatchDashboardSnapshot {
  const today = new Date().toISOString().slice(0, 10);
  const teamMatches = args.teamId
    ? args.matches.filter((match) => match.team_id === args.teamId)
    : args.matches;

  const upcomingFixture =
    teamMatches
      .filter(
        (match) =>
          match.status === "scheduled" || match.status === "live",
      )
      .filter((match) => match.kickoff_date >= today)
      .sort((left, right) => left.kickoff_date.localeCompare(right.kickoff_date))[0] ?? null;

  const upcomingSquads = upcomingFixture
    ? args.squads.filter((row) => row.match_id === upcomingFixture.id)
    : [];

  const awaitingAvailability = upcomingSquads.filter(
    (row) => row.parent_availability === "no_response",
  ).length;

  const latestCompleted =
    teamMatches
      .filter((match) => match.status === "completed")
      .sort((left, right) => right.kickoff_date.localeCompare(left.kickoff_date))[0] ?? null;

  const latestResult = latestCompleted
    ? {
        match: latestCompleted,
        scoreLabel: formatMatchScoreLabel(latestCompleted),
      }
    : null;

  const unavailablePlayers = args.squads
    .filter((row) => row.parent_availability === "unavailable")
    .map((row) => ({
      playerId: row.player_id,
      playerName: row.player?.player_name ?? "Player",
      matchId: row.match_id,
    }));

  const seasonTeamId = args.teamId ?? teamMatches[0]?.team_id ?? null;
  const seasonRecord = seasonTeamId
    ? buildTeamSeasonRecord(seasonTeamId, teamMatches)
    : null;

  return {
    upcomingFixture,
    awaitingAvailability,
    latestResult,
    unavailablePlayers,
    seasonRecord,
  };
}

export function formatMatchScoreLabel(
  match: Pick<MatchRow, "match_data">,
): string {
  const data = parseMatchData(match.match_data);
  if (!data.result) return "Result pending";
  const home = data.result.homeScore;
  const away = data.result.awayScore;
  if (home === null || away === null) return "Result pending";
  return `${home} – ${away}`;
}

export function buildSquadPlayerCard(args: {
  squadPlayer: MatchSquadPlayerRow;
  attendanceRate: number;
  recentForm: string[];
  attendanceStatus: PlayerAttendanceStatus | null;
}) {
  const player = args.squadPlayer.player;
  return {
    playerId: args.squadPlayer.player_id,
    playerName: player?.player_name ?? "Player",
    positionLabel: getPositionSummary({
      primary_position:
        player?.primary_position && isPlayerPositionOption(player.primary_position)
          ? player.primary_position
          : null,
      secondary_positions: [],
    }),
    attendanceRate: Math.round(args.attendanceRate),
    recentForm: args.recentForm,
    role: args.squadPlayer.role,
    isGoalkeeper: args.squadPlayer.is_goalkeeper,
    parentAvailability: args.squadPlayer.parent_availability,
    attendanceStatus: args.attendanceStatus,
    squadOrder: args.squadPlayer.squad_order,
    isStarter: args.squadPlayer.is_starter,
    minutesPlayed: args.squadPlayer.minutes_played,
  };
}

export function summariseMatchAnalytics(args: {
  matches: MatchRow[];
  squads: MatchSquadPlayerRow[];
  attendanceRows: Array<{ player_id: string; status: PlayerAttendanceStatus }>;
}) {
  const completed = args.matches.filter((match) => match.status === "completed");
  const goalsScored = completed.reduce((total, match) => {
    const scores = getMatchScores(match);
    return total + (scores?.for ?? 0);
  }, 0);
  const goalsConceded = completed.reduce((total, match) => {
    const scores = getMatchScores(match);
    return total + (scores?.against ?? 0);
  }, 0);
  const wins = completed.filter((match) => getMatchOutcome(match) === "win").length;
  const winPercent = completed.length > 0 ? (wins / completed.length) * 100 : 0;
  const goalsPerMatch = completed.length > 0 ? goalsScored / completed.length : 0;
  const availabilityRate = getAvailabilityRate(args.squads);
  const attendanceRate = getAttendanceRate(args.attendanceRows);
  const playerAppearances = new Map<string, number>();
  for (const row of args.squads) {
    playerAppearances.set(row.player_id, (playerAppearances.get(row.player_id) ?? 0) + 1);
  }

  return {
    goalsPerMatch,
    attendanceAtMatches: attendanceRate,
    winPercent,
    goalsScored,
    goalsConceded,
    availabilityRate,
    playerAppearances: [...playerAppearances.entries()]
      .map(([playerId, count]) => ({ playerId, count }))
      .sort((left, right) => right.count - left.count),
  };
}

function getAvailabilityRate(squads: MatchSquadPlayerRow[]): number {
  if (squads.length === 0) return 0;
  const responded = squads.filter((row) => row.parent_availability !== "no_response").length;
  return (responded / squads.length) * 100;
}

export function buildMatchHubSummaryCopy(match: MatchWithTeam): string {
  const teamName = getTeamName(match);
  const title = getMatchTitle(match, teamName);
  const kickoff = formatMatchKickoff(match.kickoff_date, match.kickoff_time);
  return `${title} · ${kickoff}`;
}

export function createEmptyMatchResult(match: MatchRow): MatchResult {
  return {
    homeScore: null,
    awayScore: null,
    halfTimeHomeScore: null,
    halfTimeAwayScore: null,
    competitionName: match.competition_name,
    venue: match.venue,
    weather: null,
    coachNotes: null,
    finalWhistleAt: null,
    playerOfTheMatchId: null,
    scorers: [],
  };
}

export function appendMatchEvent(data: MatchData, event: Omit<MatchEvent, "id" | "createdAt">): MatchData {
  return {
    ...data,
    events: [
      {
        ...event,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      },
      ...data.events,
    ],
  };
}

export function getEventSummary(event: MatchEvent, playerName: string, relatedName?: string | null) {
  const label = MATCH_EVENT_LABELS[event.type];
  const minute = event.minute !== null ? `${event.minute}'` : "";
  if (event.type === "substitution" && relatedName) {
    return `${minute} ${label}: ${playerName} ↔ ${relatedName}`.trim();
  }
  return `${minute} ${label}: ${playerName}`.trim();
}

export function isUpcomingMatch(match: MatchRow, today = new Date().toISOString().slice(0, 10)) {
  return (
    (match.status === "scheduled" || match.status === "live") && match.kickoff_date >= today
  );
}

export function filterMatchesByStatus(matches: MatchRow[], status: MatchStatus) {
  return matches.filter((match) => match.status === status);
}

export function sortSquadPlayers(squads: MatchSquadPlayerRow[]) {
  return [...squads].sort((left, right) => left.squad_order - right.squad_order);
}

export function getParentAvailabilitySummary(
  squads: MatchSquadPlayerRow[],
): Record<ParentMatchAvailability, number> {
  return {
    available: squads.filter((row) => row.parent_availability === "available").length,
    unavailable: squads.filter((row) => row.parent_availability === "unavailable").length,
    running_late: squads.filter((row) => row.parent_availability === "running_late").length,
    no_response: squads.filter((row) => row.parent_availability === "no_response").length,
  };
}
