"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { footballEmptyPreset } from "@/lib/football-identity";
import { FeaturePageHeader } from "@/components/feature-page-header";
import { MatchHubPanel } from "@/components/match-hub-panel";
import { MatchOverviewCard } from "@/components/match-overview-card";
import { SetupRequiredPanel } from "@/components/setup-required-panel";
import { getAttendanceRate, type PlayerAttendanceStatus } from "@/lib/attendance";
import { parsePlayerAttendanceHistory } from "@/lib/attendance-history";
import {
  appendMatchEvent,
  buildMatchOverviewMetrics,
  createEmptyMatchResult,
  formatMatchScoreLabel,
  type MatchWithTeam,
} from "@/lib/match-insights";
import { ensureMatchSession, syncMatchSquadToSessionPlayers } from "@/lib/match-session";
import {
  DEFAULT_MAX_SQUAD_SIZE,
  getRegisterAttendanceForSquad,
  parseMatchData,
  type MatchCompetitionType,
  type MatchEventType,
  type MatchSquadPlayerRow,
  type MatchStatus,
} from "@/lib/match-types";
import { createClient } from "@/lib/supabase";
import { getTeamDisplayName, getTeamMembershipPlayer, type TeamRow } from "@/lib/team-management";
import { isMissingTableError } from "@/lib/supabase-errors";
import { PanelSkeleton } from "@/components/branded-loading";

type MatchFormState = {
  teamId: string;
  opposition: string;
  competitionType: MatchCompetitionType;
  competitionName: string;
  venue: string;
  isHome: boolean;
  kickoffDate: string;
  kickoffTime: string;
  meetTime: string;
  pitch: string;
  notes: string;
  maxSquadSize: string;
};

const defaultForm: MatchFormState = {
  teamId: "",
  opposition: "",
  competitionType: "league",
  competitionName: "",
  venue: "",
  isHome: true,
  kickoffDate: "",
  kickoffTime: "10:00",
  meetTime: "09:30",
  pitch: "",
  notes: "",
  maxSquadSize: String(DEFAULT_MAX_SQUAD_SIZE),
};

const MATCH_SELECT =
  "id, coach_id, academy_id, team_id, session_id, opposition, competition_type, competition_name, venue, is_home, kickoff_date, kickoff_time, meet_time, pitch, notes, status, squad_published, max_squad_size, match_data, report_id, created_at, updated_at, team:teams(team_name)";

const SQUAD_SELECT =
  "id, match_id, player_id, squad_order, role, is_goalkeeper, is_starter, parent_availability, minutes_played, player:players(id, player_name, primary_position)";

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

export function MatchesManager() {
  const searchParams = useSearchParams();
  const focusMatchId = searchParams.get("match")?.trim() ?? null;
  const focusHandledRef = useRef<string | null>(null);

  const [form, setForm] = useState<MatchFormState>(defaultForm);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [academyId, setAcademyId] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [matches, setMatches] = useState<MatchWithTeam[]>([]);
  const [squads, setSquads] = useState<MatchSquadPlayerRow[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<
    Array<{ session_id: string; player_id: string; status: PlayerAttendanceStatus }>
  >([]);
  const [playerAttendanceHistory, setPlayerAttendanceHistory] = useState<
    Record<string, PlayerAttendanceStatus[]>
  >({});
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [setupTables, setSetupTables] = useState<string[]>([]);

  const selectedMatch = useMemo(
    () => matches.find((match) => match.id === selectedMatchId) ?? null,
    [matches, selectedMatchId],
  );

  const selectedSquad = useMemo(
    () =>
      selectedMatch
        ? squads
            .filter((row) => row.match_id === selectedMatch.id)
            .sort((left, right) => left.squad_order - right.squad_order)
        : [],
    [selectedMatch, squads],
  );

  const selectedAttendance = useMemo(() => {
    if (!selectedMatch?.session_id) return {};
    const rows = attendanceRows.filter((row) => row.session_id === selectedMatch.session_id);
    return getRegisterAttendanceForSquad(selectedSquad, rows);
  }, [attendanceRows, selectedMatch, selectedSquad]);

  const attendanceRatesByPlayer = useMemo(() => {
    const rates: Record<string, number> = {};
    for (const [playerId, rows] of Object.entries(playerAttendanceHistory)) {
      rates[playerId] = getAttendanceRate(rows.map((status) => ({ status })));
    }
    return rates;
  }, [playerAttendanceHistory]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("You must be signed in.");
        return;
      }
      setCoachId(user.id);

      const [{ data: profile }, teamsRes, matchesRes, squadsRes, attendanceRes, playersRes] =
        await Promise.all([
          supabase.from("profiles").select("academy_id").eq("id", user.id).maybeSingle(),
          supabase
            .from("teams")
            .select(
              "id, coach_id, academy_id, team_name, age_group, notes, team_color, created_at, updated_at, team_players(id, team_id, player_id, role, squad_order, player:players(id, player_name, primary_position, preferred_foot, secondary_positions))",
            )
            .eq("coach_id", user.id)
            .order("team_name", { ascending: true }),
          supabase
            .from("matches")
            .select(MATCH_SELECT)
            .eq("coach_id", user.id)
            .order("kickoff_date", { ascending: false }),
          supabase.from("match_squad_players").select(SQUAD_SELECT),
          supabase.from("session_attendance").select("session_id, player_id, status").eq("coach_id", user.id),
          supabase
            .from("players")
            .select("id, player_name, session_attendance(status, recorded_at, session:sessions(session_date, group_name, session_type))")
            .eq("coach_id", user.id),
        ]);

      if (teamsRes.error) throw teamsRes.error;
      if (matchesRes.error) {
        if (isMissingTableError(matchesRes.error)) {
          setSetupTables(["matches", "match_squad_players"]);
          return;
        }
        throw matchesRes.error;
      }
      if (squadsRes.error) throw squadsRes.error;

      setAcademyId((profile?.academy_id as string | null) ?? null);
      setTeams((teamsRes.data ?? []) as TeamRow[]);
      setMatches((matchesRes.data ?? []) as unknown as MatchWithTeam[]);
      setSquads((squadsRes.data ?? []) as unknown as MatchSquadPlayerRow[]);
      setAttendanceRows((attendanceRes.data ?? []) as typeof attendanceRows);

      const history: Record<string, PlayerAttendanceStatus[]> = {};
      for (const player of playersRes.data ?? []) {
        const rows = (player.session_attendance ?? []) as Parameters<
          typeof parsePlayerAttendanceHistory
        >[0];
        const parsed = parsePlayerAttendanceHistory(rows);
        history[player.id as string] = parsed.records.map((entry) => entry.status);
      }
      setPlayerAttendanceHistory(history);
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadData();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadData]);

  useEffect(() => {
    if (!focusMatchId || focusHandledRef.current === focusMatchId || matches.length === 0) return;
    focusHandledRef.current = focusMatchId;
    setSelectedMatchId(focusMatchId);
    window.requestAnimationFrame(() => {
      document.getElementById("match-hub-panel")?.scrollIntoView({ behavior: "smooth" });
    });
  }, [focusMatchId, matches.length]);

  async function handleCreateMatch() {
    if (!coachId || !form.teamId || !form.opposition.trim() || !form.kickoffDate) {
      setSubmitError("Team, opposition, and kick-off date are required.");
      return;
    }

    const team = teams.find((item) => item.id === form.teamId);
    const firstPlayerId =
      team?.team_players?.[0]?.player_id ??
      (team?.team_players?.[0] as { player_id?: string } | undefined)?.player_id;
    if (!firstPlayerId) {
      setSubmitError("Add at least one player to the team before creating a fixture.");
      return;
    }

    setSaving(true);
    setSubmitError(null);
    setStatusMessage(null);
    try {
      const supabase = createClient();
      const sessionId = await ensureMatchSession(supabase, {
        coachId,
        academyId,
        teamId: form.teamId,
        teamName: getTeamDisplayName(team!),
        opposition: form.opposition.trim(),
        isHome: form.isHome,
        kickoffDate: form.kickoffDate,
        kickoffTime: form.kickoffTime || null,
        venue: form.venue.trim() || null,
        notes: form.notes.trim() || null,
        playerId: firstPlayerId as string,
      });

      const { data, error: insertError } = await supabase
        .from("matches")
        .insert({
          coach_id: coachId,
          academy_id: academyId,
          team_id: form.teamId,
          session_id: sessionId,
          opposition: form.opposition.trim(),
          competition_type: form.competitionType,
          competition_name: form.competitionName.trim() || null,
          venue: form.venue.trim() || null,
          is_home: form.isHome,
          kickoff_date: form.kickoffDate,
          kickoff_time: form.kickoffTime || null,
          meet_time: form.meetTime || null,
          pitch: form.pitch.trim() || null,
          notes: form.notes.trim() || null,
          max_squad_size: Number(form.maxSquadSize) || DEFAULT_MAX_SQUAD_SIZE,
          match_data: { events: [], result: null, reportNotes: null },
        })
        .select(MATCH_SELECT)
        .single();

      if (insertError || !data) {
        await supabase.from("sessions").delete().eq("id", sessionId).eq("coach_id", coachId);
        throw insertError ?? new Error("Unable to create fixture.");
      }
      setMatches((current) => [data as unknown as MatchWithTeam, ...current]);
      setSelectedMatchId(data.id as string);
      setForm(defaultForm);
      setStatusMessage("Fixture created.");
    } catch (caughtError: unknown) {
      setSubmitError(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function updateMatch(matchId: string, patch: Record<string, unknown>) {
    if (!coachId) return;
    setSaving(true);
    setStatusMessage(null);
    try {
      const supabase = createClient();
      const { data, error: updateError } = await supabase
        .from("matches")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", matchId)
        .eq("coach_id", coachId)
        .select(MATCH_SELECT)
        .single();
      if (updateError || !data) throw updateError ?? new Error("Unable to update match.");
      setMatches((current) =>
        current.map((match) => (match.id === matchId ? (data as unknown as MatchWithTeam) : match)),
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveSquadRows(matchId: string, rows: MatchSquadPlayerRow[]) {
    const supabase = createClient();
    const payload = rows.map((row) => ({
      player_id: row.player_id,
      squad_order: row.squad_order,
      role: row.role,
      is_goalkeeper: row.is_goalkeeper,
      is_starter: row.is_starter,
      parent_availability: row.parent_availability,
      minutes_played: row.minutes_played,
    }));

    const { error: rpcError } = await supabase.rpc("replace_match_squad_players", {
      p_match_id: matchId,
      p_rows: payload,
    });

    if (rpcError) {
      const missingRpc =
        rpcError.code === "PGRST202" ||
        (rpcError.message ?? "").toLowerCase().includes("replace_match_squad_players");
      if (!missingRpc) throw rpcError;

      const { data: previous } = await supabase
        .from("match_squad_players")
        .select(
          "match_id, player_id, squad_order, role, is_goalkeeper, is_starter, parent_availability, minutes_played",
        )
        .eq("match_id", matchId);

      await supabase.from("match_squad_players").delete().eq("match_id", matchId);
      if (rows.length > 0) {
        const { error } = await supabase.from("match_squad_players").insert(
          rows.map((row) => ({
            match_id: matchId,
            player_id: row.player_id,
            squad_order: row.squad_order,
            role: row.role,
            is_goalkeeper: row.is_goalkeeper,
            is_starter: row.is_starter,
            parent_availability: row.parent_availability,
            minutes_played: row.minutes_played,
          })),
        );
        if (error) {
          if (previous && previous.length > 0) {
            await supabase.from("match_squad_players").insert(previous);
          }
          throw error;
        }
      }
    }

    setSquads((current) => [
      ...current.filter((row) => row.match_id !== matchId),
      ...rows,
    ]);
    const match = matches.find((item) => item.id === matchId);
    if (match?.session_id) {
      await syncMatchSquadToSessionPlayers(
        supabase,
        match.session_id,
        rows.map((row) => row.player_id),
      );
    }
  }

  async function handleLoadTeamSquad() {
    if (!selectedMatch) return;
    const team = teams.find((item) => item.id === selectedMatch.team_id);
    if (!team?.team_players?.length) {
      setStatusMessage("No players found on this team.");
      return;
    }
    setSaving(true);
    try {
      const rows: MatchSquadPlayerRow[] = team.team_players.map((membership, index) => {
        const player = getTeamMembershipPlayer(membership);
        return {
          id: crypto.randomUUID(),
          match_id: selectedMatch.id,
          player_id: membership.player_id,
          squad_order: membership.squad_order ?? index,
          role: membership.role,
          is_goalkeeper: player?.primary_position === "GK",
          is_starter: true,
          parent_availability: "no_response",
          minutes_played: 0,
          player,
        };
      });
      await saveSquadRows(selectedMatch.id, rows);
      setStatusMessage("Team squad loaded.");
    } catch (caughtError: unknown) {
      setSubmitError(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkAttendance(playerId: string, status: PlayerAttendanceStatus) {
    if (!selectedMatch?.session_id || !coachId) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("session_attendance").upsert(
        {
          coach_id: coachId,
          session_id: selectedMatch.session_id,
          player_id: playerId,
          status,
          notes: null,
          recorded_at: new Date().toISOString(),
        },
        { onConflict: "session_id,player_id" },
      );
      if (error) throw error;
      setAttendanceRows((current) => {
        const without = current.filter(
          (row) =>
            !(row.session_id === selectedMatch.session_id && row.player_id === playerId),
        );
        return [
          ...without,
          { session_id: selectedMatch.session_id!, player_id: playerId, status },
        ];
      });
      setStatusMessage("Attendance updated.");
    } catch (caughtError: unknown) {
      setSubmitError(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function handleBulkAttendance(status: PlayerAttendanceStatus) {
    if (!selectedMatch) return;
    for (const row of selectedSquad) {
      await handleMarkAttendance(row.player_id, status);
    }
  }

  async function handleAddEvent(event: {
    type: MatchEventType;
    playerId: string;
    relatedPlayerId?: string | null;
    minute?: number | null;
  }) {
    if (!selectedMatch) return;
    const data = parseMatchData(selectedMatch.match_data);
    const next = appendMatchEvent(data, {
      type: event.type,
      playerId: event.playerId,
      relatedPlayerId: event.relatedPlayerId ?? null,
      minute: event.minute ?? null,
      note: null,
    });
    await updateMatch(selectedMatch.id, { match_data: next });
    setStatusMessage("Event added.");
  }

  async function handleSaveResult(result: {
    homeScore: number;
    awayScore: number;
    weather?: string | null;
    coachNotes?: string | null;
    playerOfTheMatchId?: string | null;
  }) {
    if (!selectedMatch) return;
    const data = parseMatchData(selectedMatch.match_data);
    const nextResult = {
      ...(data.result ?? createEmptyMatchResult(selectedMatch)),
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      weather: result.weather ?? null,
      coachNotes: result.coachNotes ?? null,
      playerOfTheMatchId: result.playerOfTheMatchId ?? null,
      finalWhistleAt: new Date().toISOString(),
    };
    await updateMatch(selectedMatch.id, {
      match_data: { ...data, result: nextResult },
      status: "completed" as MatchStatus,
    });
    setStatusMessage("Result saved.");
  }

  async function handleGenerateReport(notes: string) {
    if (!selectedMatch) return;
    setReportLoading(true);
    try {
      const response = await fetch("/api/matches/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: selectedMatch.id, notes }),
      });
      const payload = (await response.json()) as { error?: string; reportId?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to generate report.");
      if (payload.reportId) {
        await updateMatch(selectedMatch.id, { report_id: payload.reportId });
      }
      setStatusMessage("Match report generated.");
    } catch (caughtError: unknown) {
      setSubmitError(
        caughtError instanceof Error ? caughtError.message : "Unable to generate report.",
      );
    } finally {
      setReportLoading(false);
    }
  }

  async function handleDeleteMatch(matchId: string) {
    if (!coachId) return;
    setDeletingId(matchId);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("matches").delete().eq("id", matchId).eq("coach_id", coachId);
      if (error) throw error;
      setMatches((current) => current.filter((match) => match.id !== matchId));
      if (selectedMatchId === matchId) setSelectedMatchId(null);
    } catch (caughtError: unknown) {
      setSubmitError(getErrorMessage(caughtError));
    } finally {
      setDeletingId(null);
    }
  }

  if (setupTables.length > 0) {
    return <SetupRequiredPanel tables={setupTables} title="Match Centre setup required" />;
  }

  return (
    <div className="page-content-enter space-y-10">
      <FeaturePageHeader
        featureKey="matches"
        title="Match Centre"
        subtitle="Plan fixtures, select squads, track matchday attendance, record events, and share results with families."
      />

      {error ? (
        <div className="football-panel football-panel-interactive rounded-2xl p-6 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </div>
      ) : null}
      {submitError ? (
        <div className="football-panel football-panel-interactive rounded-2xl p-6 text-sm text-red-600 dark:text-red-400" role="alert">
          {submitError}
        </div>
      ) : null}

      <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6" aria-labelledby="create-fixture-heading">
        <h2 id="create-fixture-heading" className="text-lg font-semibold tracking-tight">
          Create fixture
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="match-team">
              Team
            </label>
            <select
              id="match-team"
              value={form.teamId}
              onChange={(event) => setForm((current) => ({ ...current, teamId: event.target.value }))}
              className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
            >
              <option value="">Select team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {getTeamDisplayName(team)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="match-opposition">
              Opposition
            </label>
            <input
              id="match-opposition"
              value={form.opposition}
              onChange={(event) => setForm((current) => ({ ...current, opposition: event.target.value }))}
              className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="match-competition-type">
              Competition type
            </label>
            <select
              id="match-competition-type"
              value={form.competitionType}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  competitionType: event.target.value as MatchCompetitionType,
                }))
              }
              className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
            >
              <option value="league">League</option>
              <option value="cup">Cup</option>
              <option value="friendly">Friendly</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="match-competition-name">
              Competition name
            </label>
            <input
              id="match-competition-name"
              value={form.competitionName}
              onChange={(event) =>
                setForm((current) => ({ ...current, competitionName: event.target.value }))
              }
              className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="match-kickoff-date">
              Kick-off date
            </label>
            <input
              id="match-kickoff-date"
              type="date"
              value={form.kickoffDate}
              onChange={(event) => setForm((current) => ({ ...current, kickoffDate: event.target.value }))}
              className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="match-kickoff-time">
              Kick-off time
            </label>
            <input
              id="match-kickoff-time"
              type="time"
              value={form.kickoffTime}
              onChange={(event) => setForm((current) => ({ ...current, kickoffTime: event.target.value }))}
              className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="match-meet-time">
              Meet time
            </label>
            <input
              id="match-meet-time"
              type="time"
              value={form.meetTime}
              onChange={(event) => setForm((current) => ({ ...current, meetTime: event.target.value }))}
              className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="match-venue">
              Venue
            </label>
            <input
              id="match-venue"
              value={form.venue}
              onChange={(event) => setForm((current) => ({ ...current, venue: event.target.value }))}
              className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="match-home-away">
              Home / Away
            </label>
            <select
              id="match-home-away"
              value={form.isHome ? "home" : "away"}
              onChange={(event) =>
                setForm((current) => ({ ...current, isHome: event.target.value === "home" }))
              }
              className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
            >
              <option value="home">Home</option>
              <option value="away">Away</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="match-pitch">
              Pitch
            </label>
            <input
              id="match-pitch"
              value={form.pitch}
              onChange={(event) => setForm((current) => ({ ...current, pitch: event.target.value }))}
              className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
            />
          </div>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleCreateMatch()}
          className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
          Create fixture
        </button>
      </section>

      {loading ? (
        <PanelSkeleton />
      ) : null}

      {!loading && matches.length > 0 ? (
        <section className="space-y-6" aria-labelledby="fixtures-heading">
          <h2 id="fixtures-heading" className="text-lg font-semibold tracking-tight">
            Fixtures
          </h2>
          <div className="grid gap-4 xl:grid-cols-2">
            {matches.map((match) => {
              const squad = squads.filter((row) => row.match_id === match.id);
              const attendance =
                match.session_id
                  ? getRegisterAttendanceForSquad(
                      squad,
                      attendanceRows.filter((row) => row.session_id === match.session_id),
                    )
                  : {};
              const metrics = buildMatchOverviewMetrics({ squad, attendanceByPlayer: attendance });
              return (
                <div key={match.id} className="space-y-3">
                  <MatchOverviewCard
                    match={match}
                    metrics={metrics}
                    scoreLabel={formatMatchScoreLabel(match)}
                    selected={selectedMatchId === match.id}
                    onSelect={() => setSelectedMatchId(match.id)}
                  />
                  <button
                    type="button"
                    disabled={deletingId === match.id}
                    onClick={() => void handleDeleteMatch(match.id)}
                    className="text-muted hover:text-foreground focus-visible:ring-accent/40 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm outline-none focus-visible:ring-2"
                  >
                    {deletingId === match.id ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="size-4" aria-hidden />
                    )}
                    Delete fixture
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {selectedMatch ? (
        <MatchHubPanel
          match={selectedMatch}
          squad={selectedSquad}
          attendanceByPlayer={selectedAttendance}
          teamMatches={matches.filter((match) => match.team_id === selectedMatch.team_id)}
          attendanceRatesByPlayer={attendanceRatesByPlayer}
          recentFormByPlayer={{}}
          saving={saving}
          reportLoading={reportLoading}
          statusMessage={statusMessage}
          onPublishSquad={(published) => void updateMatch(selectedMatch.id, { squad_published: published })}
          onStatusChange={(status) => void updateMatch(selectedMatch.id, { status })}
          onSquadReorder={async (playerId, direction) => {
            const rows = [...selectedSquad];
            const index = rows.findIndex((row) => row.player_id === playerId);
            const swapIndex = direction === "up" ? index - 1 : index + 1;
            if (index < 0 || swapIndex < 0 || swapIndex >= rows.length) return;
            const currentOrder = rows[index].squad_order;
            rows[index].squad_order = rows[swapIndex].squad_order;
            rows[swapIndex].squad_order = currentOrder;
            [rows[index], rows[swapIndex]] = [rows[swapIndex], rows[index]];
            await saveSquadRows(selectedMatch.id, rows);
          }}
          onSetCaptain={async (playerId) => {
            const rows = selectedSquad.map((row) => ({
              ...row,
              role:
                row.player_id === playerId
                  ? ("captain" as const)
                  : row.role === "captain"
                    ? null
                    : row.role,
            }));
            await saveSquadRows(selectedMatch.id, rows);
          }}
          onSetViceCaptain={async (playerId) => {
            const rows = selectedSquad.map((row) => ({
              ...row,
              role:
                row.player_id === playerId
                  ? ("vice_captain" as const)
                  : row.role === "vice_captain"
                    ? null
                    : row.role,
            }));
            await saveSquadRows(selectedMatch.id, rows);
          }}
          onToggleGoalkeeper={async (playerId) => {
            const rows = selectedSquad.map((row) =>
              row.player_id === playerId
                ? { ...row, is_goalkeeper: !row.is_goalkeeper }
                : row,
            );
            await saveSquadRows(selectedMatch.id, rows);
          }}
          onToggleStarter={async (playerId) => {
            const rows = selectedSquad.map((row) =>
              row.player_id === playerId ? { ...row, is_starter: !row.is_starter } : row,
            );
            await saveSquadRows(selectedMatch.id, rows);
          }}
          onLoadTeamSquad={() => void handleLoadTeamSquad()}
          onMarkAttendance={(playerId, status) => void handleMarkAttendance(playerId, status)}
          onBulkAttendance={(status) => void handleBulkAttendance(status)}
          onAddEvent={(event) => void handleAddEvent(event)}
          onSaveResult={(result) => void handleSaveResult(result)}
          onGenerateReport={(notes) => void handleGenerateReport(notes)}
        />
      ) : null}

      {!loading && matches.length === 0 ? (
        <EmptyState {...footballEmptyPreset("matches")} />
      ) : null}
    </div>
  );
}
