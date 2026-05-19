"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Mail, Phone, Trash2, UserRound } from "lucide-react";
import { FeaturePageHeader } from "@/components/feature-page-header";
import { createClient } from "@/lib/supabase";

type PlayerRow = {
  id: string;
  coach_id: string;
  player_name: string;
  date_of_birth: string | null;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  notes: string | null;
  created_at: string;
};

type PlayerFormState = {
  playerName: string;
  dateOfBirth: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  notes: string;
};

const defaultFormState: PlayerFormState = {
  playerName: "",
  dateOfBirth: "",
  parentName: "",
  parentEmail: "",
  parentPhone: "",
  notes: "",
};

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

export function PlayersManager() {
  const [form, setForm] = useState<PlayerFormState>(defaultFormState);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const hasPlayers = useMemo(() => players.length > 0, [players.length]);

  const loadPlayers = useCallback(async (userId: string) => {
    setLoadingPlayers(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: playersError } = await supabase
        .from("players")
        .select(
          "id, coach_id, player_name, date_of_birth, parent_name, parent_email, parent_phone, notes, created_at",
        )
        .eq("coach_id", userId)
        .order("created_at", { ascending: false });

      if (playersError) {
        setError(playersError.message);
        return;
      }

      setPlayers((data ?? []) as PlayerRow[]);
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!coachId) {
      setSubmitError("You must be signed in to add players.");
      return;
    }

    setSubmitError(null);
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        coach_id: coachId,
        player_name: form.playerName.trim(),
        date_of_birth: form.dateOfBirth || null,
        parent_name: form.parentName.trim() || null,
        parent_email: form.parentEmail.trim() || null,
        parent_phone: form.parentPhone.trim() || null,
        notes: form.notes.trim() || null,
      };

      const { data, error: insertError } = await supabase
        .from("players")
        .insert(payload)
        .select(
          "id, coach_id, player_name, date_of_birth, parent_name, parent_email, parent_phone, notes, created_at",
        )
        .single();

      if (insertError) {
        setSubmitError(insertError.message);
        return;
      }

      if (data) {
        setPlayers((current) => [data as PlayerRow, ...current]);
        setForm(defaultFormState);
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
        subtitle="Manage your players and parent contacts in one place."
      />

      <section className="glass-panel rounded-2xl p-6 sm:p-8">
        <h2 className="text-lg font-semibold tracking-tight">Add player</h2>
        <p className="text-muted mt-1 text-sm">
          New players are automatically assigned to your coach account.
        </p>
        <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium" htmlFor="playerName">
              Player Name <span className="text-red-500">*</span>
            </label>
            <input
              id="playerName"
              required
              value={form.playerName}
              onChange={(e) =>
                setForm((current) => ({ ...current, playerName: e.target.value }))
              }
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
              placeholder="e.g. Oliver Smith"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="dateOfBirth">
              Date of Birth
            </label>
            <input
              id="dateOfBirth"
              type="date"
              value={form.dateOfBirth}
              onChange={(e) =>
                setForm((current) => ({ ...current, dateOfBirth: e.target.value }))
              }
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="parentName">
              Parent Name
            </label>
            <input
              id="parentName"
              value={form.parentName}
              onChange={(e) =>
                setForm((current) => ({ ...current, parentName: e.target.value }))
              }
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
              placeholder="e.g. Sarah Smith"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="parentEmail">
              Parent Email
            </label>
            <input
              id="parentEmail"
              type="email"
              value={form.parentEmail}
              onChange={(e) =>
                setForm((current) => ({ ...current, parentEmail: e.target.value }))
              }
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
              placeholder="parent@example.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="parentPhone">
              Parent Phone
            </label>
            <input
              id="parentPhone"
              type="tel"
              value={form.parentPhone}
              onChange={(e) =>
                setForm((current) => ({ ...current, parentPhone: e.target.value }))
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
              onChange={(e) =>
                setForm((current) => ({ ...current, notes: e.target.value }))
              }
              className="border-border bg-background text-foreground focus:ring-accent/40 min-h-24 w-full rounded-xl border px-3 py-2 text-sm outline-none ring-offset-2 focus:ring-2"
              placeholder="Medical notes, trial details, preferred position..."
            />
          </div>

          {submitError ? (
            <p className="sm:col-span-2 text-sm text-red-600 dark:text-red-400">
              {submitError}
            </p>
          ) : null}

          <div className="sm:col-span-2">
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
              ) : (
                "Add player"
              )}
            </button>
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
            {players.map((player) => (
              <article key={player.id} className="glass-panel rounded-2xl p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight">
                      {player.player_name}
                    </h3>
                    <p className="text-muted mt-1 text-sm">
                      DOB: {formatDate(player.date_of_birth)}
                    </p>
                  </div>
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
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
