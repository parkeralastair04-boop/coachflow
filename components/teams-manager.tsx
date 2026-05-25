"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Edit3,
  Loader2,
  Plus,
  Save,
  Search,
  Shield,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { FeaturePageHeader } from "@/components/feature-page-header";
import { type PlayerPositionOption } from "@/lib/player-profile";
import {
  TEAM_COLOR_SWATCHES,
  getRoleLabel,
  getTeamDisplayName,
  getTeamMembershipPlayer,
  groupMembershipsByPosition,
  isTeamRole,
  normalizeTeamColor,
  sortTeamMemberships,
  type TeamPlayerMembership,
  type TeamRow,
  type TeamSortOption,
  type TeamViewMode,
} from "@/lib/team-management";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type PlayerOption = {
  id: string;
  player_name: string;
  primary_position: PlayerPositionOption | null;
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
      primary_position
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
  const [coachId, setCoachId] = useState<string | null>(null);
  const [academyId, setAcademyId] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
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
    () => sortTeamMemberships(currentTeam?.team_players ?? [], sortBy),
    [currentTeam, sortBy],
  );

  const groupedRoster = useMemo(
    () => groupMembershipsByPosition(currentTeam?.team_players ?? [], sortBy),
    [currentTeam, sortBy],
  );

  const teamStats = useMemo(() => {
    const memberships = currentTeam?.team_players ?? [];
    const captain = memberships.find((membership) => membership.role === "captain");
    const viceCaptain = memberships.find(
      (membership) => membership.role === "vice_captain",
    );
    return {
      totalPlayers: memberships.length,
      captain: captain ? getTeamMembershipPlayer(captain)?.player_name ?? null : null,
      viceCaptain: viceCaptain
        ? getTeamMembershipPlayer(viceCaptain)?.player_name ?? null
        : null,
    };
  }, [currentTeam]);

  const loadCoachData = useCallback(
    async (userId: string, preferredTeamId?: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const [
          { data: playersData, error: playersError },
          { data: teamsData, error: teamsError },
        ] = await Promise.all([
          supabase
            .from("players")
            .select("id, player_name, primary_position")
            .eq("coach_id", userId)
            .order("player_name", { ascending: true }),
          supabase
            .from("teams")
            .select(TEAM_SELECT)
            .eq("coach_id", userId)
            .order("created_at", { ascending: true }),
        ]);

        if (playersError || teamsError) {
          setError(
            playersError?.message ?? teamsError?.message ?? "Could not load teams.",
          );
          return;
        }

        const safeTeams = ((teamsData ?? []) as TeamRow[]).map(normalizeTeamRow);
        setPlayers((playersData ?? []) as PlayerOption[]);
        setTeams(safeTeams);
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
    <div className="space-y-8">
      <FeaturePageHeader
        featureKey="teams"
        title="Teams"
        subtitle="Build squads, assign players, and organise your rosters for sessions, registers, and season planning."
      />

      <section className="glass-panel rounded-2xl p-6 sm:p-8">
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
              className="border-border hover:bg-black/[0.03] inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors dark:hover:bg-white/[0.06]"
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
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
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
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
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
                  "border-border hover:bg-black/[0.03] inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors dark:hover:bg-white/[0.06]",
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
              className="border-border bg-background text-foreground focus:ring-accent/40 min-h-24 w-full rounded-xl border px-3 py-2 text-sm outline-none ring-offset-2 focus:ring-2"
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

      <section className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Your teams</h2>
            {!loading ? (
              <span className="text-muted text-sm">{teams.length} total</span>
            ) : null}
          </div>

          {error ? (
            <div className="glass-panel rounded-2xl p-6 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="glass-panel flex items-center gap-3 rounded-2xl p-6 text-sm">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading teams...
            </div>
          ) : null}

          {!loading && !error && teams.length === 0 ? (
            <div className="glass-panel rounded-2xl p-8 text-center">
              <Shield className="text-muted mx-auto size-8" aria-hidden />
              <p className="mt-3 font-medium">No teams yet</p>
              <p className="text-muted mt-1 text-sm">
                Create your first squad to start organising rosters and session groups.
              </p>
            </div>
          ) : null}

          {!loading && !error && teams.length > 0 ? (
            <div className="space-y-3">
              {teams.map((team) => {
                const selected = selectedTeamId === team.id;
                return (
                  <article
                    key={team.id}
                    className={cn(
                      "glass-panel cursor-pointer rounded-2xl p-5 transition-colors",
                      selected && "ring-accent/25 ring-1",
                    )}
                    onClick={() => setSelectedTeamId(team.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex size-3 shrink-0 rounded-full"
                            style={{
                              backgroundColor: team.team_color ?? "var(--color-accent)",
                            }}
                          />
                          <h3 className="truncate text-base font-semibold tracking-tight">
                            {team.team_name}
                          </h3>
                        </div>
                        <p className="text-muted mt-1 text-sm">
                          {team.age_group?.trim() || "No age group set"}
                        </p>
                      </div>
                      <span className="bg-accent/10 text-accent ring-accent/20 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1">
                        {team.team_players?.length ?? 0}
                      </span>
                    </div>

                    {team.notes ? (
                      <p className="text-muted mt-3 line-clamp-2 text-sm">{team.notes}</p>
                    ) : null}

                    <div className="mt-4 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          startEditing(team);
                        }}
                        className="border-border hover:bg-black/[0.03] inline-flex h-9 items-center justify-center rounded-full border px-3 text-sm font-medium transition-colors dark:hover:bg-white/[0.06]"
                      >
                        <Edit3 className="mr-2 size-4" aria-hidden />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDeleteTeam(team.id);
                        }}
                        disabled={deletingTeamId === team.id}
                        className="border-border hover:bg-black/[0.03] inline-flex h-9 items-center justify-center rounded-full border px-3 text-sm font-medium transition-colors disabled:opacity-60 dark:hover:bg-white/[0.06]"
                      >
                        {deletingTeamId === team.id ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <>
                            <Trash2 className="mr-2 size-4" aria-hidden />
                            Delete
                          </>
                        )}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          {currentTeam ? (
            <>
              <section className="glass-panel rounded-2xl p-6 sm:p-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex size-3 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            currentTeam.team_color ?? "var(--color-accent)",
                        }}
                      />
                      <h2 className="text-xl font-semibold tracking-tight">
                        {getTeamDisplayName(currentTeam)}
                      </h2>
                    </div>
                    <p className="text-muted mt-2 text-sm">
                      {currentTeam.notes?.trim() ||
                        "Use this squad space to organise your roster, roles, and positional balance."}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-black/[0.02] px-4 py-3 dark:bg-white/[0.03]">
                      <p className="text-muted text-xs">Players</p>
                      <p className="mt-1 text-lg font-semibold">{teamStats.totalPlayers}</p>
                    </div>
                    <div className="rounded-2xl bg-black/[0.02] px-4 py-3 dark:bg-white/[0.03]">
                      <p className="text-muted text-xs">Captain</p>
                      <p className="mt-1 text-sm font-medium">
                        {teamStats.captain ?? "Not assigned"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-black/[0.02] px-4 py-3 dark:bg-white/[0.03]">
                      <p className="text-muted text-xs">Vice captain</p>
                      <p className="mt-1 text-sm font-medium">
                        {teamStats.viceCaptain ?? "Not assigned"}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="glass-panel rounded-2xl p-6 sm:p-8">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight">Roster</h3>
                    <p className="text-muted mt-1 text-sm">
                      Sort by squad order, primary position, or name. Switch between a
                      list view and grouped-by-position view whenever you need.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <select
                      value={sortBy}
                      onChange={(event) =>
                        setSortBy(event.target.value as TeamSortOption)
                      }
                      className="border-border bg-background text-foreground focus:ring-accent/40 h-11 rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
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
                    No players assigned yet. Use the membership panel below to add your
                    first squad members.
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
                                  <span className="bg-accent/10 text-accent ring-accent/20 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1">
                                    {getRoleLabel(membership.role)}
                                  </span>
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
                                className="border-border bg-background text-foreground focus:ring-accent/40 h-10 rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 disabled:opacity-60"
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
                                className="border-border bg-background text-foreground focus:ring-accent/40 h-10 rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 disabled:opacity-60"
                              />

                              <button
                                type="button"
                                onClick={() => void moveMembership(membership.id, -1)}
                                disabled={busy || index === 0}
                                className="border-border hover:bg-black/[0.03] inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors disabled:opacity-50 dark:hover:bg-white/[0.06]"
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
                                className="border-border hover:bg-black/[0.03] inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors disabled:opacity-50 dark:hover:bg-white/[0.06]"
                              >
                                <ArrowDown className="size-4" aria-hidden />
                              </button>
                              <button
                                type="button"
                                onClick={() => void toggleMembership(player.id)}
                                disabled={busy}
                                className="border-border hover:bg-black/[0.03] inline-flex h-10 items-center justify-center rounded-xl border px-3 text-sm font-medium transition-colors disabled:opacity-50 dark:hover:bg-white/[0.06]"
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
                                      className="border-border bg-background text-foreground focus:ring-accent/40 h-10 rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 disabled:opacity-60"
                                    >
                                      <option value="">No role</option>
                                      <option value="captain">Captain</option>
                                      <option value="vice_captain">Vice captain</option>
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => void toggleMembership(player.id)}
                                      disabled={busy}
                                      className="border-border hover:bg-black/[0.03] inline-flex h-10 items-center justify-center rounded-xl border px-3 text-sm font-medium transition-colors disabled:opacity-50 dark:hover:bg-white/[0.06]"
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

              <section className="glass-panel rounded-2xl p-6 sm:p-8">
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
                              <span className="bg-accent/10 text-accent ring-accent/20 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1">
                                {getRoleLabel(membership.role)}
                              </span>
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
            </>
          ) : (
            <div className="glass-panel rounded-2xl p-8 text-center">
              <Users className="text-muted mx-auto size-8" aria-hidden />
              <p className="mt-3 font-medium">Select a team</p>
              <p className="text-muted mt-1 text-sm">
                Choose a team from the left to view the roster and manage memberships.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
