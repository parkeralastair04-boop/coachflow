"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Mail,
  Pencil,
  Phone,
  Save,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { FeaturePageHeader } from "@/components/feature-page-header";
import {
  PLAYER_POSITION_OPTIONS,
  PREFERRED_FOOT_OPTIONS,
  getPositionSummary,
  normalizeSecondaryPositions,
  type PlayerPositionOption,
  type PreferredFootOption,
} from "@/lib/player-profile";
import { getPlayerTeams, getTeamDisplayName, type TeamSummary } from "@/lib/team-management";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type PlayerRow = {
  id: string;
  coach_id: string;
  academy_id: string | null;
  player_name: string;
  date_of_birth: string | null;
  preferred_foot: PreferredFootOption;
  primary_position: PlayerPositionOption | null;
  secondary_positions: PlayerPositionOption[];
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  notes: string | null;
  created_at: string;
  team_players?: { team?: TeamSummary[] | TeamSummary | null }[] | null;
};

type PlayerFormState = {
  playerName: string;
  dateOfBirth: string;
  preferredFoot: PreferredFootOption;
  primaryPosition: string;
  secondaryPositions: PlayerPositionOption[];
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  notes: string;
};

const defaultFormState: PlayerFormState = {
  playerName: "",
  dateOfBirth: "",
  preferredFoot: "Unknown",
  primaryPosition: "",
  secondaryPositions: [],
  parentName: "",
  parentEmail: "",
  parentPhone: "",
  notes: "",
};

const PLAYER_SELECT =
  "id, coach_id, academy_id, player_name, date_of_birth, preferred_foot, primary_position, secondary_positions, parent_name, parent_email, parent_phone, notes, created_at, team_players(team:teams(id, team_name, age_group, team_color))";

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

function formatDate(value: string | null): string {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

function normalizePlayerRow(player: Partial<PlayerRow> & { id: string }): PlayerRow {
  return {
    id: player.id,
    coach_id: player.coach_id ?? "",
    academy_id: player.academy_id ?? null,
    player_name: player.player_name ?? "",
    date_of_birth: player.date_of_birth ?? null,
    preferred_foot: player.preferred_foot ?? "Unknown",
    primary_position: player.primary_position ?? null,
    secondary_positions: normalizeSecondaryPositions(player.secondary_positions),
    parent_name: player.parent_name ?? null,
    parent_email: player.parent_email ?? null,
    parent_phone: player.parent_phone ?? null,
    notes: player.notes ?? null,
    created_at: player.created_at ?? new Date().toISOString(),
    team_players: player.team_players ?? [],
  };
}

export function PlayersManager() {
  const [form, setForm] = useState<PlayerFormState>(defaultFormState);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [academyId, setAcademyId] = useState<string | null>(null);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const hasPlayers = useMemo(() => players.length > 0, [players.length]);

  const sortedPlayers = useMemo(
    () =>
      [...players].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [players],
  );

  const selectableSecondaryPositions = useMemo(
    () =>
      PLAYER_POSITION_OPTIONS.filter((position) => position !== form.primaryPosition),
    [form.primaryPosition],
  );

  const loadPlayers = useCallback(async (userId: string) => {
    setLoadingPlayers(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: playersError } = await supabase
        .from("players")
        .select(PLAYER_SELECT)
        .eq("coach_id", userId)
        .order("created_at", { ascending: false });

      if (playersError) {
        setError(playersError.message);
        return;
      }

      setPlayers(((data ?? []) as PlayerRow[]).map(normalizePlayerRow));
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoadingPlayers(false);
    }
  }, []);

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
          setLoadingPlayers(false);
          return;
        }
        if (!user) {
          setError("You must be signed in to manage players.");
          setLoadingPlayers(false);
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

        await loadPlayers(user.id);
      } catch (caughtError: unknown) {
        if (!cancelled) {
          setError(getErrorMessage(caughtError));
          setLoadingPlayers(false);
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [loadPlayers]);

  function resetForm() {
    setForm(defaultFormState);
    setEditingPlayerId(null);
    setSubmitError(null);
  }

  function startEditing(player: PlayerRow) {
    setEditingPlayerId(player.id);
    setSubmitError(null);
    setForm({
      playerName: player.player_name,
      dateOfBirth: player.date_of_birth ?? "",
      preferredFoot: player.preferred_foot,
      primaryPosition: player.primary_position ?? "",
      secondaryPositions: player.secondary_positions.filter(
        (position) => position !== player.primary_position,
      ),
      parentName: player.parent_name ?? "",
      parentEmail: player.parent_email ?? "",
      parentPhone: player.parent_phone ?? "",
      notes: player.notes ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleSecondaryPosition(position: PlayerPositionOption) {
    setForm((current) => ({
      ...current,
      secondaryPositions: current.secondaryPositions.includes(position)
        ? current.secondaryPositions.filter((item) => item !== position)
        : [...current.secondaryPositions, position],
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!coachId) {
      setSubmitError("You must be signed in to save players.");
      return;
    }
    if (!form.playerName.trim()) {
      setSubmitError("Player name is required.");
      return;
    }

    setSubmitError(null);
    setSaving(true);

    try {
      const supabase = createClient();
      const payload = {
        coach_id: coachId,
        academy_id: academyId,
        player_name: form.playerName.trim(),
        date_of_birth: form.dateOfBirth || null,
        preferred_foot: form.preferredFoot,
        primary_position: (form.primaryPosition || null) as PlayerPositionOption | null,
        secondary_positions: form.secondaryPositions.filter(
          (position) => position !== form.primaryPosition,
        ),
        parent_name: form.parentName.trim() || null,
        parent_email: form.parentEmail.trim() || null,
        parent_phone: form.parentPhone.trim() || null,
        notes: form.notes.trim() || null,
      };

      if (editingPlayerId) {
        const { data, error: updateError } = await supabase
          .from("players")
          .update(payload)
          .eq("id", editingPlayerId)
          .eq("coach_id", coachId)
          .select(PLAYER_SELECT)
          .single();

        if (updateError) {
          setSubmitError(updateError.message);
          return;
        }

        if (data) {
          const normalized = normalizePlayerRow(data as PlayerRow);
          setPlayers((current) =>
            current.map((player) =>
              player.id === editingPlayerId ? normalized : player,
            ),
          );
          resetForm();
        }

        return;
      }

      const { data, error: insertError } = await supabase
        .from("players")
        .insert(payload)
        .select(PLAYER_SELECT)
        .single();

      if (insertError) {
        setSubmitError(insertError.message);
        return;
      }

      if (data) {
        setPlayers((current) => [
          normalizePlayerRow(data as PlayerRow),
          ...current,
        ]);
        resetForm();
      }
    } catch (caughtError: unknown) {
      setSubmitError(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(playerId: string) {
    if (!coachId) {
      setSubmitError("You must be signed in to delete players.");
      return;
    }

    setSubmitError(null);
    setDeletingId(playerId);

    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from("players")
        .delete()
        .eq("id", playerId)
        .eq("coach_id", coachId);

      if (deleteError) {
        setSubmitError(deleteError.message);
        return;
      }

      setPlayers((current) => current.filter((player) => player.id !== playerId));
      if (editingPlayerId === playerId) {
        resetForm();
      }
    } catch (caughtError: unknown) {
      setSubmitError(getErrorMessage(caughtError));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <FeaturePageHeader
        featureKey="players"
        title="Player CRM"
        subtitle="Manage player profiles, parent contacts, and football attributes in one place."
      />

      <section className="glass-panel rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              {editingPlayerId ? "Edit player" : "Add player"}
            </h2>
            <p className="text-muted mt-1 text-sm">
              Capture key football profile details once so they stay available across
              reports, insights, and future squad planning.
            </p>
          </div>
          {editingPlayerId ? (
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

        <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium" htmlFor="playerName">
              Player name <span className="text-red-500">*</span>
            </label>
            <input
              id="playerName"
              required
              value={form.playerName}
              onChange={(event) =>
                setForm((current) => ({ ...current, playerName: event.target.value }))
              }
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
              placeholder="e.g. Oliver Smith"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="dateOfBirth">
              Date of birth
            </label>
            <input
              id="dateOfBirth"
              type="date"
              value={form.dateOfBirth}
              onChange={(event) =>
                setForm((current) => ({ ...current, dateOfBirth: event.target.value }))
              }
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="preferredFoot">
              Preferred foot
            </label>
            <select
              id="preferredFoot"
              value={form.preferredFoot}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  preferredFoot: event.target.value as PreferredFootOption,
                }))
              }
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
            >
              {PREFERRED_FOOT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="primaryPosition">
              Primary position
            </label>
            <select
              id="primaryPosition"
              value={form.primaryPosition}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  primaryPosition: event.target.value,
                  secondaryPositions: current.secondaryPositions.filter(
                    (position) => position !== event.target.value,
                  ),
                }))
              }
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
            >
              <option value="">Not set</option>
              {PLAYER_POSITION_OPTIONS.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium">
              Secondary positions
            </label>
            <div className="grid gap-2 rounded-2xl bg-black/[0.02] p-3 dark:bg-white/[0.03] sm:grid-cols-3">
              {selectableSecondaryPositions.map((position) => {
                const selected = form.secondaryPositions.includes(position);
                return (
                  <button
                    key={position}
                    type="button"
                    onClick={() => toggleSecondaryPosition(position)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                      selected
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border bg-background text-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
                    )}
                  >
                    {position}
                  </button>
                );
              })}
            </div>
            <p className="text-muted mt-2 text-xs">
              Choose any additional roles this player is comfortable performing.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="parentName">
              Parent name
            </label>
            <input
              id="parentName"
              value={form.parentName}
              onChange={(event) =>
                setForm((current) => ({ ...current, parentName: event.target.value }))
              }
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
              placeholder="e.g. Sarah Smith"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="parentEmail">
              Parent email
            </label>
            <input
              id="parentEmail"
              type="email"
              value={form.parentEmail}
              onChange={(event) =>
                setForm((current) => ({ ...current, parentEmail: event.target.value }))
              }
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
              placeholder="parent@example.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="parentPhone">
              Parent phone
            </label>
            <input
              id="parentPhone"
              type="tel"
              value={form.parentPhone}
              onChange={(event) =>
                setForm((current) => ({ ...current, parentPhone: event.target.value }))
              }
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
              placeholder="+44 7123 456789"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium" htmlFor="notes">
              Notes
            </label>
            <textarea
              id="notes"
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
              className="border-border bg-background text-foreground focus:ring-accent/40 min-h-24 w-full rounded-xl border px-3 py-2 text-sm outline-none ring-offset-2 focus:ring-2"
              placeholder="Medical notes, development focus, personality notes, or match context..."
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
              disabled={saving}
              className="bg-foreground text-background hover:opacity-90 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Saving...
                </>
              ) : editingPlayerId ? (
                <>
                  <Save className="mr-2 size-4" aria-hidden />
                  Save player
                </>
              ) : (
                "Add player"
              )}
            </button>
            {editingPlayerId ? (
              <button
                type="button"
                onClick={resetForm}
                className="border-border hover:bg-black/[0.03] inline-flex h-11 items-center justify-center rounded-full border px-6 text-sm font-medium transition-colors dark:hover:bg-white/[0.06]"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Your players</h2>
          {!loadingPlayers && hasPlayers ? (
            <span className="text-muted text-sm">{players.length} total</span>
          ) : null}
        </div>

        {error ? (
          <div className="glass-panel rounded-2xl p-6 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        ) : null}

        {loadingPlayers ? (
          <div className="glass-panel flex items-center gap-3 rounded-2xl p-6 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading players...
          </div>
        ) : null}

        {!loadingPlayers && !error && !hasPlayers ? (
          <div className="glass-panel rounded-2xl p-8 text-center">
            <UserRound className="text-muted mx-auto size-8" aria-hidden />
            <p className="mt-3 font-medium">No players yet</p>
            <p className="text-muted mt-1 text-sm">
              Add your first player to start building your CRM.
            </p>
          </div>
        ) : null}

        {!loadingPlayers && !error && hasPlayers ? (
          <div className="grid gap-4 md:grid-cols-2">
            {sortedPlayers.map((player) => (
              <article key={player.id} className="glass-panel rounded-2xl p-5 sm:p-6">
                {(() => {
                  const playerTeams = getPlayerTeams(player.team_players);
                  return (
                    <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight">
                      {player.player_name}
                    </h3>
                    <p className="text-muted mt-1 text-sm">
                      DOB: {formatDate(player.date_of_birth)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEditing(player)}
                      className="text-muted hover:text-foreground inline-flex items-center justify-center rounded-lg p-2 transition-colors"
                      aria-label={`Edit ${player.player_name}`}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === player.id}
                      onClick={() => void handleDelete(player.id)}
                      className="text-muted hover:text-red-500 inline-flex items-center justify-center rounded-lg p-2 transition-colors disabled:opacity-60"
                      aria-label={`Delete ${player.player_name}`}
                    >
                      {deletingId === player.id ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <Trash2 className="size-4" aria-hidden />
                      )}
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="bg-accent/10 text-accent ring-accent/20 inline-flex rounded-full px-2.5 py-1 font-medium ring-1">
                    {player.preferred_foot} foot
                  </span>
                  {playerTeams.map((team) => (
                    <span
                      key={`${player.id}-${team.id}`}
                      className="border-border text-muted inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-medium"
                    >
                      <span
                        className="inline-flex size-2.5 rounded-full"
                        style={{
                          backgroundColor:
                            team.team_color ?? "var(--color-accent)",
                        }}
                      />
                      {getTeamDisplayName(team)}
                    </span>
                  ))}
                  <span className="border-border text-muted inline-flex rounded-full border px-2.5 py-1 font-medium">
                    {player.primary_position ?? "Primary position not set"}
                  </span>
                  {player.secondary_positions.map((position) => (
                    <span
                      key={`${player.id}-${position}`}
                      className="border-border text-muted inline-flex rounded-full border px-2.5 py-1 font-medium"
                    >
                      {position}
                    </span>
                  ))}
                </div>

                <div className="mt-4 rounded-xl bg-black/[0.02] p-4 text-sm dark:bg-white/[0.03]">
                  <p className="text-muted text-xs">Football profile</p>
                  <p className="mt-1 font-medium">
                    {getPositionSummary({
                      primary_position: player.primary_position,
                      secondary_positions: player.secondary_positions,
                    })}
                  </p>
                </div>

                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <dt className="text-muted shrink-0">Parent:</dt>
                    <dd>{player.parent_name ?? "N/A"}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="text-muted size-3.5" aria-hidden />
                    <dd>{player.parent_email ?? "N/A"}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="text-muted size-3.5" aria-hidden />
                    <dd>{player.parent_phone ?? "N/A"}</dd>
                  </div>
                </dl>

                {player.notes ? (
                  <p className="text-muted mt-4 rounded-xl bg-black/[0.02] p-3 text-sm dark:bg-white/[0.03]">
                    {player.notes}
                  </p>
                ) : null}
                    </>
                  );
                })()}
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
