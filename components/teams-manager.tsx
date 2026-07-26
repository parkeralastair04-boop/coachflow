"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Edit3,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { footballEmptyPreset } from "@/lib/football-identity";
import { FeaturePageHeader } from "@/components/feature-page-header";
import { TeamOverviewCard } from "@/components/team-overview-card";
import { TeamRoleBadge } from "@/components/team-role-badge";
import { TeamSquadPanel } from "@/components/team-squad-panel";
import { type PlayerPositionOption } from "@/lib/player-profile";
import {
  buildAttendanceByPlayer,
  buildReportsByPlayer,
  buildSquadPlayerCards,
  buildTeamAttendanceInsights,
  buildTeamOverviewMetrics,
  buildTeamReportsInsights,
  type TeamAttendanceRow,
  type TeamReportRow,
  type TeamSessionRow,
} from "@/lib/team-insights";
import {
  buildAttendanceLeaders,
  buildCategorizedSupportPlayers,
  buildMissingReportPlayers,
  buildTeamActivityTimeline,
  buildTeamAttendanceTrend,
  buildTeamFormIndicators,
  buildTeamSeasonOverview,
} from "@/lib/team-season-insights";
import {
  TEAM_COLOR_SWATCHES,
  getRoleLabel,
  getTeamMembershipPlayer,
  groupMembershipsByPosition,
  isTeamRole,
  normalizeTeamColor,
  sortSquadDisplayOrder,
  sortTeamMemberships,
  type TeamPlayerMembership,
  type TeamRow,
  type TeamSortOption,
  type TeamViewMode,
} from "@/lib/team-management";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { PanelSkeleton } from "@/components/branded-loading";

type PlayerOption = {
  id: string;
  player_name: string;
  primary_position: PlayerPositionOption | null;
  parent_email: string | null;
};

type TeamFormState = {
  teamName: string;
  ageGroup: string;
  notes: string;
  teamColor: string | null;
};

const defaultFormState: TeamFormState = {
  teamName: "",
  ageGroup: "",
  notes: "",
  teamColor: null,
};

const TEAM_SELECT = `
  id,
  coach_id,
  academy_id,
  team_name,
  age_group,
  notes,
  team_color,
  created_at,
  updated_at,
  team_players (
    id,
    team_id,
    player_id,
    role,
    squad_order,
    created_at,
    player:players (
      id,
      player_name,
      primary_position,
      preferred_foot,
      parent_email
    )
  )
`;

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

function normalizeTeamRow(team: TeamRow): TeamRow {
  return {
    ...team,
    team_color: normalizeTeamColor(team.team_color),
    team_players: (team.team_players ?? []).map((membership) => ({
      ...membership,
      role: isTeamRole(membership.role) ? membership.role : null,
      squad_order: Number.isFinite(membership.squad_order)
        ? Math.max(1, membership.squad_order)
        : 1,
    })),
  };
}

export function TeamsManager() {
  const searchParams = useSearchParams();
  const focusTeamId = searchParams.get("team")?.trim() ?? null;
  const focusHandledRef = useRef<string | null>(null);

  const [coachId, setCoachId] = useState<string | null>(null);
  const [academyId, setAcademyId] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [sessions, setSessions] = useState<TeamSessionRow[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<TeamAttendanceRow[]>([]);
  const [reportRows, setReportRows] = useState<TeamReportRow[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [form, setForm] = useState<TeamFormState>(defaultFormState);
  const [sortBy, setSortBy] = useState<TeamSortOption>("squad_order");
  const [viewMode, setViewMode] = useState<TeamViewMode>("roster");
  const [membershipQuery, setMembershipQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingTeam, setSavingTeam] = useState(false);
  const [membershipBusyId, setMembershipBusyId] = useState<string | null>(null);
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const currentTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? null,
    [teams, selectedTeamId],
  );

  const membershipByPlayerId = useMemo(
    () =>
      new Map(
        (currentTeam?.team_players ?? []).map((membership) => [
          membership.player_id,
          membership,
        ]),
      ),
    [currentTeam],
  );

  const filteredPlayers = useMemo(() => {
    const query = membershipQuery.trim().toLowerCase();
    if (!query) return players;
    return players.filter((player) => {
      const label = `${player.player_name} ${player.primary_position ?? ""}`.toLowerCase();
      return label.includes(query);
    });
  }, [membershipQuery, players]);

  const sortedRoster = useMemo(
    () => sortSquadDisplayOrder(currentTeam?.team_players ?? []),
    [currentTeam],
  );

  const parentEmailByPlayerId = useMemo(
    () => new Map(players.map((player) => [player.id, player.parent_email])),
    [players],
  );

  const attendanceByPlayer = useMemo(
    () => buildAttendanceByPlayer(attendanceRows),
    [attendanceRows],
  );

  const reportsByPlayer = useMemo(
    () => buildReportsByPlayer(reportRows),
    [reportRows],
  );

  const teamMetricsById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildTeamOverviewMetrics>>();
    for (const team of teams) {
      map.set(
        team.id,
        buildTeamOverviewMetrics({
          team,
          sessions,
          attendanceByPlayer,
          reportsByPlayer,
        }),
      );
    }
    return map;
  }, [teams, sessions, attendanceByPlayer, reportsByPlayer]);

  const currentTeamInsights = useMemo(() => {
    if (!currentTeam) return null;
    const overview = buildTeamOverviewMetrics({
      team: currentTeam,
      sessions,
      attendanceByPlayer,
      reportsByPlayer,
    });
    const attendance = buildTeamAttendanceInsights({
      team: currentTeam,
      sessions,
      attendanceRows,
      attendanceByPlayer,
    });
    const reports = buildTeamReportsInsights({
      team: currentTeam,
      reportsByPlayer,
    });
    const memberships = sortSquadDisplayOrder(currentTeam.team_players ?? []);
    const squadCards = buildSquadPlayerCards({
      memberships,
      attendanceByPlayer,
      reportsByPlayer,
    }).map((card) => ({
      ...card,
      parentEmail: parentEmailByPlayerId.get(card.playerId) ?? null,
    }));
    const categorizedSupport = buildCategorizedSupportPlayers({
      team: currentTeam,
      attendanceByPlayer,
      reportsByPlayer,
      parentEmailByPlayerId,
    });
    const now = new Date();
    const upcomingSessions = sessions
      .filter((session) => session.team_id === currentTeam.id)
      .filter((session) => new Date(session.session_date) >= now)
      .sort(
        (left, right) =>
          new Date(left.session_date).getTime() - new Date(right.session_date).getTime(),
      );
    const attendanceTrend = buildTeamAttendanceTrend(attendance);
    const formIndicators = buildTeamFormIndicators({
      team: currentTeam,
      sessions,
      attendanceRows,
      attendanceRate: overview.attendanceRate,
      trendDirection: attendanceTrend.direction,
    });
    const season = buildTeamSeasonOverview({
      overview,
      reports,
      upcomingSessionCount: upcomingSessions.length,
      supportCount: categorizedSupport.length,
    });
    const playerNameById = new Map(
      squadCards.map((card) => [card.playerId, card.playerName]),
    );

    return {
      overview,
      attendance,
      reports,
      squadCards,
      upcomingSessions,
      season,
      attendanceTrend,
      formIndicators,
      missingReports: buildMissingReportPlayers({ squadCards }),
      attendanceLeaders: buildAttendanceLeaders(squadCards),
      categorizedSupport,
      timeline: buildTeamActivityTimeline({
        team: currentTeam,
        sessions,
        attendanceRows,
        reportRows,
        playerNameById,
      }),
    };
  }, [
    currentTeam,
    sessions,
    attendanceRows,
    reportRows,
    attendanceByPlayer,
    reportsByPlayer,
    parentEmailByPlayerId,
  ]);

  const groupedRoster = useMemo(
    () => groupMembershipsByPosition(currentTeam?.team_players ?? [], sortBy),
    [currentTeam, sortBy],
  );

  const loadCoachData = useCallback(
    async (userId: string, preferredTeamId?: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const [
          { data: playersData, error: playersError },
          { data: teamsData, error: teamsError },
          { data: sessionsData, error: sessionsError },
          { data: attendanceData, error: attendanceError },
          { data: reportsData, error: reportsError },
        ] = await Promise.all([
          supabase
            .from("players")
            .select("id, player_name, primary_position, parent_email")
            .eq("coach_id", userId)
            .order("player_name", { ascending: true }),
          supabase
            .from("teams")
            .select(TEAM_SELECT)
            .eq("coach_id", userId)
            .order("created_at", { ascending: true }),
          supabase
            .from("sessions")
            .select("id, team_id, session_date, session_type, group_name")
            .eq("coach_id", userId)
            .order("session_date", { ascending: true }),
          supabase
            .from("session_attendance")
            .select("session_id, player_id, status, recorded_at")
            .eq("coach_id", userId),
          supabase
            .from("progress_reports")
            .select("id, player_id, created_at")
            .eq("coach_id", userId)
            .order("created_at", { ascending: false }),
        ]);

        if (playersError || teamsError || sessionsError || attendanceError || reportsError) {
          setError(
            playersError?.message ??
              teamsError?.message ??
              sessionsError?.message ??
              attendanceError?.message ??
              reportsError?.message ??
              "Could not load teams.",
          );
          return;
        }

        const safeTeams = ((teamsData ?? []) as TeamRow[]).map(normalizeTeamRow);
        setPlayers((playersData ?? []) as PlayerOption[]);
        setTeams(safeTeams);
        setSessions((sessionsData ?? []) as TeamSessionRow[]);
        setAttendanceRows((attendanceData ?? []) as TeamAttendanceRow[]);
        setReportRows((reportsData ?? []) as TeamReportRow[]);
        setSelectedTeamId((current) => {
          const nextId = preferredTeamId ?? current;
          if (nextId && safeTeams.some((team) => team.id === nextId)) return nextId;
          return safeTeams[0]?.id ?? null;
        });
      } catch (caughtError: unknown) {
        setError(getErrorMessage(caughtError));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (cancelled) return;
        if (userError) {
          setError(userError.message);
          setLoading(false);
          return;
        }
        if (!user) {
          setError("You must be signed in to manage teams.");
          setLoading(false);
          return;
        }

        setCoachId(user.id);
        const { data: membership } = await supabase
          .from("academy_members")
          .select("academy_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        setAcademyId((membership?.academy_id as string | undefined) ?? null);
        await loadCoachData(user.id);
      } catch (caughtError: unknown) {
        if (!cancelled) {
          setError(getErrorMessage(caughtError));
          setLoading(false);
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [loadCoachData]);

  useEffect(() => {
    if (!focusTeamId || loading || teams.length === 0) return;
    if (focusHandledRef.current === focusTeamId) return;
    if (!teams.some((team) => team.id === focusTeamId)) return;
    focusHandledRef.current = focusTeamId;
    const frame = window.requestAnimationFrame(() => {
      setSelectedTeamId(focusTeamId);
      document.getElementById("team-squad-panel")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusTeamId, loading, teams]);

  function resetForm() {
    setEditingTeamId(null);
    setForm(defaultFormState);
    setSubmitError(null);
  }

  function startEditing(team: TeamRow) {
    setEditingTeamId(team.id);
    setSelectedTeamId(team.id);
    setSubmitError(null);
    setForm({
      teamName: team.team_name,
      ageGroup: team.age_group ?? "",
      notes: team.notes ?? "",
      teamColor: team.team_color,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmitTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!coachId) {
      setSubmitError("You must be signed in to save teams.");
      return;
    }
    if (!form.teamName.trim()) {
      setSubmitError("Team name is required.");
      return;
    }

    setSavingTeam(true);
    setSubmitError(null);

    try {
      const supabase = createClient();
      const payload = {
        coach_id: coachId,
        academy_id: academyId,
        team_name: form.teamName.trim(),
        age_group: form.ageGroup.trim() || null,
        notes: form.notes.trim() || null,
        team_color: normalizeTeamColor(form.teamColor),
        updated_at: new Date().toISOString(),
      };

      if (editingTeamId) {
        const { error: updateError } = await supabase
          .from("teams")
          .update(payload)
          .eq("id", editingTeamId)
          .eq("coach_id", coachId);

        if (updateError) {
          setSubmitError(updateError.message);
          return;
        }

        await loadCoachData(coachId, editingTeamId);
        resetForm();
        return;
      }

      const { data, error: insertError } = await supabase
        .from("teams")
        .insert(payload)
        .select("id")
        .single();

      if (insertError || !data) {
        setSubmitError(insertError?.message ?? "Could not create team.");
        return;
      }

      await loadCoachData(coachId, data.id as string);
      resetForm();
    } catch (caughtError: unknown) {
      setSubmitError(getErrorMessage(caughtError));
    } finally {
      setSavingTeam(false);
    }
  }

  async function handleDeleteTeam(teamId: string) {
    if (!coachId) {
      setSubmitError("You must be signed in to delete teams.");
      return;
    }

    setDeletingTeamId(teamId);
    setSubmitError(null);
    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from("teams")
        .delete()
        .eq("id", teamId)
        .eq("coach_id", coachId);

      if (deleteError) {
        setSubmitError(deleteError.message);
        return;
      }

      if (editingTeamId === teamId) resetForm();
      await loadCoachData(coachId, selectedTeamId === teamId ? null : selectedTeamId);
    } catch (caughtError: unknown) {
      setSubmitError(getErrorMessage(caughtError));
    } finally {
      setDeletingTeamId(null);
    }
  }

  async function persistMemberships(
    teamId: string,
    memberships: TeamPlayerMembership[],
    busyKey: string,
  ) {
    if (!coachId) return;
    setMembershipBusyId(busyKey);
    setSubmitError(null);
    try {
      const supabase = createClient();
      const payload = memberships.map((membership, index) => ({
        id: membership.id,
        team_id: teamId,
        player_id: membership.player_id,
        role: membership.role,
        squad_order: index + 1,
      }));
      const { error: upsertError } = await supabase
        .from("team_players")
        .upsert(payload, { onConflict: "id" });

      if (upsertError) {
        setSubmitError(upsertError.message);
        return;
      }

      await loadCoachData(coachId, teamId);
    } catch (caughtError: unknown) {
      setSubmitError(getErrorMessage(caughtError));
    } finally {
      setMembershipBusyId(null);
    }
  }

  async function toggleMembership(playerId: string) {
    if (!coachId || !currentTeam) return;

    setMembershipBusyId(playerId);
    setSubmitError(null);
    try {
      const existing = membershipByPlayerId.get(playerId);
      const supabase = createClient();

      if (existing) {
        const { error: deleteError } = await supabase
          .from("team_players")
          .delete()
          .eq("id", existing.id);

        if (deleteError) {
          setSubmitError(deleteError.message);
          return;
        }

        const remaining = sortTeamMemberships(
          (currentTeam.team_players ?? []).filter((membership) => membership.id !== existing.id),
          "squad_order",
        );
        if (remaining.length > 0) {
          await persistMemberships(currentTeam.id, remaining, playerId);
          return;
        }
        await loadCoachData(coachId, currentTeam.id);
        return;
      }

      const { error: insertError } = await supabase.from("team_players").insert({
        team_id: currentTeam.id,
        player_id: playerId,
        squad_order: (currentTeam.team_players?.length ?? 0) + 1,
      });

      if (insertError) {
        setSubmitError(insertError.message);
        return;
      }

      await loadCoachData(coachId, currentTeam.id);
    } catch (caughtError: unknown) {
      setSubmitError(getErrorMessage(caughtError));
    } finally {
      setMembershipBusyId(null);
    }
  }

  async function changeRole(membership: TeamPlayerMembership, roleValue: string) {
    if (!currentTeam) return;

    const nextRole = isTeamRole(roleValue) ? roleValue : null;
    const nextMemberships = sortTeamMemberships(
      [...(currentTeam.team_players ?? [])].map((item) => {
        if (item.id === membership.id) {
          return { ...item, role: nextRole };
        }
        if (nextRole && item.role === nextRole) {
          return { ...item, role: null };
        }
        return item;
      }),
      "squad_order",
    );

    await persistMemberships(currentTeam.id, nextMemberships, membership.id);
  }

  async function moveMembership(membershipId: string, direction: -1 | 1) {
    if (!currentTeam) return;

    const ordered = sortTeamMemberships(currentTeam.team_players ?? [], "squad_order");
    const currentIndex = ordered.findIndex((membership) => membership.id === membershipId);
    if (currentIndex < 0) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= ordered.length) return;

    const nextMemberships = [...ordered];
    const [moved] = nextMemberships.splice(currentIndex, 1);
    nextMemberships.splice(nextIndex, 0, moved);
    await persistMemberships(currentTeam.id, nextMemberships, membershipId);
  }

  async function changeSquadOrder(membershipId: string, nextOrderRaw: string) {
    if (!currentTeam) return;
    const currentMemberships = sortTeamMemberships(currentTeam.team_players ?? [], "squad_order");
    const currentIndex = currentMemberships.findIndex(
      (membership) => membership.id === membershipId,
    );
    if (currentIndex < 0) return;

    const requestedOrder = Number.parseInt(nextOrderRaw, 10);
    if (!Number.isFinite(requestedOrder)) return;
    const boundedIndex = Math.min(
      Math.max(requestedOrder - 1, 0),
      currentMemberships.length - 1,
    );
    if (boundedIndex === currentIndex) return;

    const nextMemberships = [...currentMemberships];
    const [moved] = nextMemberships.splice(currentIndex, 1);
    nextMemberships.splice(boundedIndex, 0, moved);
    await persistMemberships(currentTeam.id, nextMemberships, membershipId);
  }

  return (
    <div className="page-content-enter space-y-8">
      <FeaturePageHeader
        featureKey="teams"
        title="Squads"
        subtitle="Group your active squad into age-group teams for registers, training sessions, and match-day planning."
      />

      <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              {editingTeamId ? "Edit team" : "Create team"}
            </h2>
            <p className="text-muted mt-1 text-sm">
              Create football squads such as development groups, elite teams, or
              specialist units like goalkeepers.
            </p>
          </div>
          {editingTeamId ? (
            <button
              type="button"
              onClick={resetForm}
              className="border-border hover:bg-surface-hover inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors dark:hover:bg-white/[0.06]"
            >
              <X className="mr-2 size-4" aria-hidden />
              Cancel edit
            </button>
          ) : null}
        </div>

        <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmitTeam}>
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="teamName">
              Team name <span className="text-red-500">*</span>
            </label>
            <input
              id="teamName"
              required
              value={form.teamName}
              onChange={(event) =>
                setForm((current) => ({ ...current, teamName: event.target.value }))
              }
              className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2"
              placeholder="e.g. U14 Elite"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="ageGroup">
              Age group
            </label>
            <input
              id="ageGroup"
              value={form.ageGroup}
              onChange={(event) =>
                setForm((current) => ({ ...current, ageGroup: event.target.value }))
              }
              className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2"
              placeholder="e.g. U14 or Girls Academy"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium">Team colour</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, teamColor: null }))}
                className={cn(
                  "border-border hover:bg-surface-hover inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors dark:hover:bg-white/[0.06]",
                  !form.teamColor && "border-accent text-accent",
                )}
              >
                Default
              </button>
              {TEAM_COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() =>
                    setForm((current) => ({ ...current, teamColor: swatch }))
                  }
                  className={cn(
                    "inline-flex size-10 items-center justify-center rounded-full ring-2 transition-transform hover:scale-105",
                    form.teamColor === swatch
                      ? "ring-foreground"
                      : "ring-black/10 dark:ring-white/10",
                  )}
                  style={{ backgroundColor: swatch }}
                  aria-label={`Select ${swatch} as team colour`}
                >
                  {form.teamColor === swatch ? (
                    <Check className="size-4 text-white" aria-hidden />
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium" htmlFor="teamNotes">
              Notes
            </label>
            <textarea
              id="teamNotes"
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
              className="border-border bg-background text-foreground focus-visible:ring-accent/40 min-h-24 w-full rounded-xl border px-3 py-2 text-sm outline-none ring-offset-2 focus-visible:ring-2"
              placeholder="Season objectives, coaching themes, training schedule, or selection context..."
            />
          </div>

          {submitError ? (
            <p className="sm:col-span-2 text-sm text-red-600 dark:text-red-400">
              {submitError}
            </p>
          ) : null}

          <div className="sm:col-span-2 flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={savingTeam}
              className="bg-foreground text-background hover:opacity-90 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity disabled:opacity-60"
            >
              {savingTeam ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Saving...
                </>
              ) : editingTeamId ? (
                <>
                  <Save className="mr-2 size-4" aria-hidden />
                  Save team
                </>
              ) : (
                <>
                  <Plus className="mr-2 size-4" aria-hidden />
                  Create team
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-6" aria-labelledby="teams-overview-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="teams-overview-heading" className="text-lg font-semibold tracking-tight">
            Team squads
          </h2>
          {!loading ? (
            <span className="text-muted text-sm">{teams.length} total</span>
          ) : null}
        </div>

        {error ? (
          <div className="football-panel football-panel-interactive rounded-2xl p-6 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        ) : null}

        {loading ? (
          <PanelSkeleton />
        ) : null}

        {!loading && !error && teams.length === 0 ? (
          <EmptyState {...footballEmptyPreset("teams")} />
        ) : null}

        {!loading && !error && teams.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {teams.map((team) => {
              const metrics = teamMetricsById.get(team.id);
              if (!metrics) return null;
              return (
                <div key={team.id} className="relative">
                  <TeamOverviewCard
                    team={team}
                    metrics={metrics}
                    selected={selectedTeamId === team.id}
                    onSelect={() => setSelectedTeamId(team.id)}
                  />
                  <div className="mt-2 flex justify-end gap-2 px-1">
                    <button
                      type="button"
                      onClick={() => startEditing(team)}
                      className="text-muted hover:text-foreground focus-visible:ring-accent/40 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <Edit3 className="size-4" aria-hidden />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteTeam(team.id)}
                      disabled={deletingTeamId === team.id}
                      className="text-muted hover:text-red-500 focus-visible:ring-accent/40 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
                    >
                      {deletingTeamId === team.id ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <>
                          <Trash2 className="size-4" aria-hidden />
                          Delete
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      {currentTeam && currentTeamInsights ? (
        <div id="team-squad-panel" className="space-y-6">
          <TeamSquadPanel
            team={currentTeam}
            overview={currentTeamInsights.overview}
            squadCards={currentTeamInsights.squadCards}
            upcomingSessions={currentTeamInsights.upcomingSessions}
            season={currentTeamInsights.season}
            attendanceTrend={currentTeamInsights.attendanceTrend}
            formIndicators={currentTeamInsights.formIndicators}
            missingReports={currentTeamInsights.missingReports}
            attendanceLeaders={currentTeamInsights.attendanceLeaders}
            supportPlayers={currentTeamInsights.categorizedSupport}
            timeline={currentTeamInsights.timeline}
            loading={loading}
          />

          <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h3 className="text-lg font-semibold tracking-tight">Manage squad roster</h3>
                <p className="text-muted mt-1 text-sm">
                  Sort by squad order, primary position, or name. Captain and vice captain
                  appear first in squad views.
                </p>
              </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <select
                      value={sortBy}
                      onChange={(event) =>
                        setSortBy(event.target.value as TeamSortOption)
                      }
                      className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2"
                    >
                      <option value="squad_order">Sort by squad order</option>
                      <option value="primary_position">Sort by primary position</option>
                      <option value="name">Sort by name</option>
                    </select>
                    <div className="flex rounded-xl border border-[var(--color-border)] p-1">
                      <button
                        type="button"
                        onClick={() => setViewMode("roster")}
                        className={cn(
                          "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          viewMode === "roster"
                            ? "bg-accent text-white"
                            : "text-muted hover:text-foreground",
                        )}
                      >
                        Roster list
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("position")}
                        className={cn(
                          "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          viewMode === "position"
                            ? "bg-accent text-white"
                            : "text-muted hover:text-foreground",
                        )}
                      >
                        By position
                      </button>
                    </div>
                  </div>
                </div>

                {(currentTeam.team_players?.length ?? 0) === 0 ? (
                  <div className="mt-6 rounded-2xl bg-black/[0.02] p-6 text-sm text-muted dark:bg-white/[0.03]">
                    Add players to build your squad.
                  </div>
                ) : viewMode === "roster" ? (
                  <div className="mt-6 space-y-3">
                    {sortedRoster.map((membership, index) => {
                      const player = getTeamMembershipPlayer(membership);
                      if (!player) return null;
                      const busy = membershipBusyId === membership.id;
                      return (
                        <article
                          key={membership.id}
                          className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]"
                        >
                          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate font-semibold">{player.player_name}</p>
                                <span className="border-border text-muted inline-flex rounded-full border px-2.5 py-1 text-xs font-medium">
                                  {player.primary_position ?? "No primary position"}
                                </span>
                                {membership.role ? (
                                  <TeamRoleBadge role={membership.role} />
                                ) : null}
                              </div>
                              <p className="text-muted mt-1 text-sm">
                                Squad order #{index + 1}
                              </p>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-[minmax(0,180px)_120px_auto_auto_auto] sm:items-center">
                              <select
                                value={membership.role ?? ""}
                                disabled={busy}
                                onChange={(event) =>
                                  void changeRole(membership, event.target.value)
                                }
                                className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-10 rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2 disabled:opacity-60"
                              >
                                <option value="">No role</option>
                                <option value="captain">Captain</option>
                                <option value="vice_captain">Vice captain</option>
                              </select>

                              <input
                                type="number"
                                min={1}
                                max={currentTeam.team_players?.length ?? 1}
                                defaultValue={index + 1}
                                onBlur={(event) =>
                                  void changeSquadOrder(membership.id, event.target.value)
                                }
                                disabled={busy}
                                className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-10 rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2 disabled:opacity-60"
                              />

                              <button
                                type="button"
                                onClick={() => void moveMembership(membership.id, -1)}
                                disabled={busy || index === 0}
                                className="border-border hover:bg-surface-hover inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors disabled:opacity-50 dark:hover:bg-white/[0.06]"
                              >
                                <ArrowUp className="size-4" aria-hidden />
                              </button>
                              <button
                                type="button"
                                onClick={() => void moveMembership(membership.id, 1)}
                                disabled={
                                  busy ||
                                  index === (currentTeam.team_players?.length ?? 1) - 1
                                }
                                className="border-border hover:bg-surface-hover inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors disabled:opacity-50 dark:hover:bg-white/[0.06]"
                              >
                                <ArrowDown className="size-4" aria-hidden />
                              </button>
                              <button
                                type="button"
                                onClick={() => void toggleMembership(player.id)}
                                disabled={busy}
                                className="border-border hover:bg-surface-hover inline-flex h-10 items-center justify-center rounded-xl border px-3 text-sm font-medium transition-colors disabled:opacity-50 dark:hover:bg-white/[0.06]"
                              >
                                {busy ? (
                                  <Loader2 className="size-4 animate-spin" aria-hidden />
                                ) : (
                                  "Remove"
                                )}
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-6 space-y-5">
                    {groupedRoster.map((group) => (
                      <section key={group.position}>
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <h4 className="text-sm font-semibold uppercase tracking-wide text-muted">
                            {group.position}
                          </h4>
                          <span className="text-muted text-xs">
                            {group.players.length} player
                            {group.players.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div className="grid gap-3">
                          {group.players.map((membership) => {
                            const player = getTeamMembershipPlayer(membership);
                            if (!player) return null;
                            const busy = membershipBusyId === membership.id;
                            return (
                              <article
                                key={membership.id}
                                className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]"
                              >
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                  <div>
                                    <p className="font-semibold">{player.player_name}</p>
                                    <p className="text-muted mt-1 text-sm">
                                      Squad order #{membership.squad_order}
                                      {membership.role
                                        ? ` · ${getRoleLabel(membership.role)}`
                                        : ""}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <select
                                      value={membership.role ?? ""}
                                      disabled={busy}
                                      onChange={(event) =>
                                        void changeRole(membership, event.target.value)
                                      }
                                      className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-10 rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2 disabled:opacity-60"
                                    >
                                      <option value="">No role</option>
                                      <option value="captain">Captain</option>
                                      <option value="vice_captain">Vice captain</option>
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => void toggleMembership(player.id)}
                                      disabled={busy}
                                      className="border-border hover:bg-surface-hover inline-flex h-10 items-center justify-center rounded-xl border px-3 text-sm font-medium transition-colors disabled:opacity-50 dark:hover:bg-white/[0.06]"
                                    >
                                      {busy ? (
                                        <Loader2 className="size-4 animate-spin" aria-hidden />
                                      ) : (
                                        "Remove"
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </section>

              <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight">
                      Manage membership
                    </h3>
                    <p className="text-muted mt-1 text-sm">
                      Add or remove players from this squad. The architecture supports
                      future multi-team player assignments without restructuring.
                    </p>
                  </div>
                  <div className="border-border bg-background flex h-11 w-full items-center gap-2 rounded-xl border px-3 sm:max-w-xs">
                    <Search className="text-muted size-4" aria-hidden />
                    <input
                      value={membershipQuery}
                      onChange={(event) => setMembershipQuery(event.target.value)}
                      placeholder="Search players..."
                      className="h-full w-full bg-transparent text-sm outline-none"
                    />
                  </div>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  {filteredPlayers.map((player) => {
                    const membership = membershipByPlayerId.get(player.id);
                    const busy = membershipBusyId === player.id || membershipBusyId === membership?.id;
                    const assigned = Boolean(membership);
                    return (
                      <label
                        key={player.id}
                        className={cn(
                          "border-border hover:bg-black/[0.02] flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors dark:hover:bg-white/[0.03]",
                          assigned && "border-accent/25 bg-accent/5",
                          busy && "cursor-wait opacity-70",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={assigned}
                          disabled={busy}
                          onChange={() => void toggleMembership(player.id)}
                          className="mt-1 accent-[var(--color-accent)]"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{player.player_name}</p>
                            <span className="border-border text-muted inline-flex rounded-full border px-2.5 py-1 text-xs font-medium">
                              {player.primary_position ?? "No primary position"}
                            </span>
                            {membership?.role ? (
                              <TeamRoleBadge role={membership.role} />
                            ) : null}
                          </div>
                          <p className="text-muted mt-1 text-sm">
                            {assigned
                              ? `Included in ${currentTeam.team_name}`
                              : "Not currently assigned to this team"}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </section>
        </div>
      ) : !loading && teams.length > 0 ? (
        <div className="football-panel football-panel-interactive rounded-2xl p-8 text-center">
          <Users className="text-muted mx-auto size-8" aria-hidden />
          <p className="mt-3 font-medium">Select a team</p>
          <p className="text-muted mt-1 text-sm">
            Choose a squad card above to view the team hub and manage memberships.
          </p>
        </div>
      ) : null}
    </div>
  );
}
