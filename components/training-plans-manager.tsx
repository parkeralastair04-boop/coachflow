"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Copy, Loader2, Plus, Sparkles } from "lucide-react";
import { FeaturePageHeader } from "@/components/feature-page-header";
import { SetupRequiredPanel } from "@/components/setup-required-panel";
import { TrainingPlanHubPanel } from "@/components/training-plan-hub-panel";
import { TrainingPlanOverviewCard } from "@/components/training-plan-overview-card";
import { filterDrillLibrary, filterTrainingPlans } from "@/lib/training-insights";
import { linkTrainingPlanToSession, syncTrainingPlayersToSession } from "@/lib/training-session";
import {
  createDefaultTimeline,
  DIFFICULTY_LABELS,
  getTimelineDurationTotal,
  parseTrainingPlanData,
  TIMELINE_SECTION_LABELS,
  type TimelineSection,
  type TrainingDifficulty,
  type TrainingDrillRow,
  type TrainingPlanRow,
} from "@/lib/training-types";
import { createClient } from "@/lib/supabase";
import { getTeamDisplayName, type TeamRow } from "@/lib/team-management";
import { isMissingTableError } from "@/lib/supabase-errors";
import { PanelSkeleton } from "@/components/branded-loading";

const PLAN_SELECT =
  "id, coach_id, academy_id, session_id, team_id, title, age_group, theme, objectives, duration_minutes, difficulty, equipment, coach_notes, expected_outcomes, tags, development_focus, match_objective, is_favourite, archived_at, parent_visible, parent_message, parent_equipment_note, parent_preparation_note, plan_data, last_used_at, created_at, updated_at";

const DRILL_SELECT =
  "id, coach_id, academy_id, name, description, objectives, organisation, coaching_points, progressions, regressions, equipment, duration_minutes, player_numbers, difficulty, category, tags, development_tags, is_favourite, archived_at, drill_data, last_used_at, created_at, updated_at";

type PlanFormState = {
  title: string;
  ageGroup: string;
  theme: string;
  objectives: string;
  durationMinutes: string;
  difficulty: TrainingDifficulty;
  equipment: string;
  coachNotes: string;
  expectedOutcomes: string;
  teamId: string;
  matchObjective: string;
};

type DrillFormState = {
  name: string;
  description: string;
  objectives: string;
  organisation: string;
  coachingPoints: string;
  progressions: string;
  regressions: string;
  equipment: string;
  durationMinutes: string;
  playerNumbers: string;
  difficulty: TrainingDifficulty;
  category: string;
  tags: string;
};

type AiFormState = {
  ageGroup: string;
  ability: TrainingDifficulty;
  theme: string;
  players: string;
  durationMinutes: string;
  objectives: string;
  equipment: string;
};

const defaultPlanForm: PlanFormState = {
  title: "",
  ageGroup: "",
  theme: "",
  objectives: "",
  durationMinutes: "60",
  difficulty: "intermediate",
  equipment: "Cones, bibs, balls",
  coachNotes: "",
  expectedOutcomes: "",
  teamId: "",
  matchObjective: "",
};

const defaultDrillForm: DrillFormState = {
  name: "",
  description: "",
  objectives: "",
  organisation: "",
  coachingPoints: "",
  progressions: "",
  regressions: "",
  equipment: "Cones, balls",
  durationMinutes: "10",
  playerNumbers: "8-12",
  difficulty: "intermediate",
  category: "Technical",
  tags: "",
};

const defaultAiForm: AiFormState = {
  ageGroup: "U10",
  ability: "intermediate",
  theme: "Passing and movement",
  players: "12",
  durationMinutes: "60",
  objectives: "Improve passing accuracy and off-the-ball movement",
  equipment: "Cones, bibs, balls",
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

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function TrainingPlansManager() {
  const searchParams = useSearchParams();
  const focusPlanId = searchParams.get("plan")?.trim() ?? null;
  const focusHandledRef = useRef<string | null>(null);

  const [coachId, setCoachId] = useState<string | null>(null);
  const [academyId, setAcademyId] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [plans, setPlans] = useState<TrainingPlanRow[]>([]);
  const [drills, setDrills] = useState<TrainingDrillRow[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState<PlanFormState>(defaultPlanForm);
  const [drillForm, setDrillForm] = useState<DrillFormState>(defaultDrillForm);
  const [aiForm, setAiForm] = useState<AiFormState>(defaultAiForm);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [setupTables, setSetupTables] = useState<string[]>([]);
  const [view, setView] = useState<"plans" | "drills" | "ai">("plans");

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  const filteredPlans = useMemo(
    () => filterTrainingPlans(plans, { query: libraryQuery }),
    [plans, libraryQuery],
  );

  const filteredDrills = useMemo(
    () => filterDrillLibrary(drills, { query: libraryQuery }),
    [drills, libraryQuery],
  );

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

      const [{ data: profile }, teamsRes, plansRes, drillsRes] = await Promise.all([
        supabase.from("profiles").select("academy_id").eq("id", user.id).maybeSingle(),
        supabase
          .from("teams")
          .select(
            "id, coach_id, academy_id, team_name, age_group, notes, team_color, created_at, updated_at, team_players(id, team_id, player_id, role, squad_order, player:players(id, player_name, primary_position))",
          )
          .eq("coach_id", user.id)
          .order("team_name", { ascending: true }),
        supabase
          .from("training_plans")
          .select(PLAN_SELECT)
          .eq("coach_id", user.id)
          .order("updated_at", { ascending: false }),
        supabase
          .from("training_drills")
          .select(DRILL_SELECT)
          .eq("coach_id", user.id)
          .order("updated_at", { ascending: false }),
      ]);

      if (plansRes.error) {
        if (isMissingTableError(plansRes.error)) {
          setSetupTables(["training_plans", "training_drills"]);
          return;
        }
        throw plansRes.error;
      }
      if (drillsRes.error) throw drillsRes.error;

      setAcademyId((profile?.academy_id as string | null) ?? null);
      setTeams((teamsRes.data ?? []) as TeamRow[]);
      setPlans((plansRes.data ?? []) as unknown as TrainingPlanRow[]);
      setDrills((drillsRes.data ?? []) as unknown as TrainingDrillRow[]);
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
    if (!focusPlanId || focusHandledRef.current === focusPlanId || plans.length === 0) return;
    focusHandledRef.current = focusPlanId;
    setSelectedPlanId(focusPlanId);
    window.requestAnimationFrame(() => {
      document.getElementById("training-plan-hub")?.scrollIntoView({ behavior: "smooth" });
    });
  }, [focusPlanId, plans.length]);

  async function updatePlan(planId: string, patch: Record<string, unknown>) {
    if (!coachId) return;
    setSaving(true);
    setStatusMessage(null);
    try {
      const supabase = createClient();
      const { data, error: updateError } = await supabase
        .from("training_plans")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", planId)
        .eq("coach_id", coachId)
        .select(PLAN_SELECT)
        .single();
      if (updateError || !data) throw updateError ?? new Error("Unable to update plan.");
      setPlans((current) =>
        current.map((plan) => (plan.id === planId ? (data as unknown as TrainingPlanRow) : plan)),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCreatePlan() {
    if (!coachId || !planForm.title.trim()) {
      setSubmitError("Plan title is required.");
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from("training_plans")
        .insert({
          coach_id: coachId,
          academy_id: academyId,
          team_id: planForm.teamId || null,
          title: planForm.title.trim(),
          age_group: planForm.ageGroup.trim() || null,
          theme: planForm.theme.trim() || null,
          objectives: planForm.objectives.trim() || null,
          duration_minutes: Number(planForm.durationMinutes) || 60,
          difficulty: planForm.difficulty,
          equipment: splitCsv(planForm.equipment),
          coach_notes: planForm.coachNotes.trim() || null,
          expected_outcomes: planForm.expectedOutcomes.trim() || null,
          match_objective: planForm.matchObjective.trim() || null,
          plan_data: {
            timeline: createDefaultTimeline(),
            pitchLayout: { elements: [], updatedAt: null },
            reflection: null,
            linkedPlayerIds: [],
          },
        })
        .select(PLAN_SELECT)
        .single();
      if (insertError || !data) throw insertError ?? new Error("Unable to create plan.");
      setPlans((current) => [data as unknown as TrainingPlanRow, ...current]);
      setSelectedPlanId(data.id as string);
      setPlanForm(defaultPlanForm);
      setStatusMessage("Training plan created.");
    } catch (caughtError: unknown) {
      setSubmitError(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateDrill() {
    if (!coachId || !drillForm.name.trim()) {
      setSubmitError("Drill name is required.");
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from("training_drills")
        .insert({
          coach_id: coachId,
          academy_id: academyId,
          name: drillForm.name.trim(),
          description: drillForm.description.trim() || null,
          objectives: drillForm.objectives.trim() || null,
          organisation: drillForm.organisation.trim() || null,
          coaching_points: drillForm.coachingPoints.trim() || null,
          progressions: drillForm.progressions.trim() || null,
          regressions: drillForm.regressions.trim() || null,
          equipment: splitCsv(drillForm.equipment),
          duration_minutes: Number(drillForm.durationMinutes) || null,
          player_numbers: drillForm.playerNumbers.trim() || null,
          difficulty: drillForm.difficulty,
          category: drillForm.category.trim() || null,
          tags: splitCsv(drillForm.tags),
        })
        .select(DRILL_SELECT)
        .single();
      if (insertError || !data) throw insertError ?? new Error("Unable to create drill.");
      setDrills((current) => [data as unknown as TrainingDrillRow, ...current]);
      setDrillForm(defaultDrillForm);
      setStatusMessage("Drill saved to library.");
    } catch (caughtError: unknown) {
      setSubmitError(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicateDrill(drill: TrainingDrillRow) {
    if (!coachId) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from("training_drills")
        .insert({
          coach_id: coachId,
          academy_id: academyId,
          name: `${drill.name} (copy)`,
          description: drill.description,
          objectives: drill.objectives,
          organisation: drill.organisation,
          coaching_points: drill.coaching_points,
          progressions: drill.progressions,
          regressions: drill.regressions,
          equipment: drill.equipment,
          duration_minutes: drill.duration_minutes,
          player_numbers: drill.player_numbers,
          difficulty: drill.difficulty,
          category: drill.category,
          tags: drill.tags,
          development_tags: drill.development_tags,
          drill_data: drill.drill_data,
        })
        .select(DRILL_SELECT)
        .single();
      if (insertError || !data) throw insertError;
      setDrills((current) => [data as unknown as TrainingDrillRow, ...current]);
      setStatusMessage("Drill duplicated.");
    } catch (caughtError: unknown) {
      setSubmitError(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateAiPlan() {
    setAiLoading(true);
    setSubmitError(null);
    try {
      const response = await fetch("/api/training/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiForm),
      });
      const payload = (await response.json()) as { error?: string; planId?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to generate plan.");
      await loadData();
      if (payload.planId) setSelectedPlanId(payload.planId);
      setStatusMessage("AI training plan generated.");
    } catch (caughtError: unknown) {
      setSubmitError(getErrorMessage(caughtError));
    } finally {
      setAiLoading(false);
    }
  }

  async function handleLinkSession() {
    if (!selectedPlan || !coachId) return;
    const team = teams.find((item) => item.id === selectedPlan.team_id);
    const firstPlayerId = team?.team_players?.[0]?.player_id;
    if (!firstPlayerId) {
      setSubmitError("Select a team with players before linking a session.");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const sessionDate = new Date();
      sessionDate.setDate(sessionDate.getDate() + 1);
      sessionDate.setHours(18, 0, 0, 0);
      const sessionId = await linkTrainingPlanToSession(supabase, {
        coachId,
        academyId,
        plan: selectedPlan,
        teamId: selectedPlan.team_id,
        playerId: firstPlayerId as string,
        sessionDate: sessionDate.toISOString(),
        existingSessionId: selectedPlan.session_id,
      });
      const playerIds =
        team?.team_players?.map((membership) => membership.player_id as string) ?? [];
      await syncTrainingPlayersToSession(supabase, sessionId, playerIds);
      await updatePlan(selectedPlan.id, { session_id: sessionId, last_used_at: new Date().toISOString() });
      setStatusMessage("Training plan linked to session.");
    } catch (caughtError: unknown) {
      setSubmitError(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  function updateSelectedPlanData(nextData: ReturnType<typeof parseTrainingPlanData>) {
    if (!selectedPlan) return;
    void updatePlan(selectedPlan.id, { plan_data: nextData });
  }

  async function updateDrill(drillId: string, patch: Record<string, unknown>) {
    if (!coachId) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { data, error: updateError } = await supabase
        .from("training_drills")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", drillId)
        .eq("coach_id", coachId)
        .select(DRILL_SELECT)
        .single();
      if (updateError || !data) throw updateError;
      setDrills((current) =>
        current.map((drill) => (drill.id === drillId ? (data as unknown as TrainingDrillRow) : drill)),
      );
    } finally {
      setSaving(false);
    }
  }

  if (setupTables.length > 0) {
    return <SetupRequiredPanel tables={setupTables} title="Training Planner setup required" />;
  }

  return (
    <div className="page-content-enter space-y-10">
      <FeaturePageHeader
        featureKey="training"
        title="Training Planner"
        subtitle="Build reusable training plans, drill libraries, session timelines, and reflections without duplicating session scheduling."
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
      {statusMessage ? (
        <p className="text-sm" role="status">
          {statusMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Training planner views">
        {(
          [
            ["plans", "Training plans"],
            ["drills", "Drill library"],
            ["ai", "AI builder"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={`focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              view === id
                ? "bg-accent text-accent-foreground"
                : "border-border border hover:bg-surface-hover"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="library-search">
          Search library
        </label>
        <input
          id="library-search"
          value={libraryQuery}
          onChange={(event) => setLibraryQuery(event.target.value)}
          placeholder="Search plans and drills"
          className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full max-w-xl rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
        />
      </div>

      {view === "plans" ? (
        <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6" aria-labelledby="create-plan-heading">
          <h2 id="create-plan-heading" className="text-lg font-semibold tracking-tight">
            Create training plan
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Title" id="plan-title" value={planForm.title} onChange={(value) => setPlanForm((c) => ({ ...c, title: value }))} />
            <Field label="Age group" id="plan-age" value={planForm.ageGroup} onChange={(value) => setPlanForm((c) => ({ ...c, ageGroup: value }))} />
            <Field label="Theme" id="plan-theme" value={planForm.theme} onChange={(value) => setPlanForm((c) => ({ ...c, theme: value }))} />
            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="plan-team">
                Team
              </label>
              <select
                id="plan-team"
                value={planForm.teamId}
                onChange={(event) => setPlanForm((current) => ({ ...current, teamId: event.target.value }))}
                className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
              >
                <option value="">Optional team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {getTeamDisplayName(team)}
                  </option>
                ))}
              </select>
            </div>
            <Field label="Duration (min)" id="plan-duration" value={planForm.durationMinutes} onChange={(value) => setPlanForm((c) => ({ ...c, durationMinutes: value }))} />
            <Field label="Equipment" id="plan-equipment" value={planForm.equipment} onChange={(value) => setPlanForm((c) => ({ ...c, equipment: value }))} />
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium" htmlFor="plan-objectives">
                Objectives
              </label>
              <textarea
                id="plan-objectives"
                value={planForm.objectives}
                onChange={(event) => setPlanForm((current) => ({ ...current, objectives: event.target.value }))}
                className="border-border bg-background focus-visible:ring-accent/40 min-h-24 w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2"
              />
            </div>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleCreatePlan()}
            className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
            Create plan
          </button>
        </section>
      ) : null}

      {view === "drills" ? (
        <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6" aria-labelledby="create-drill-heading">
          <h2 id="create-drill-heading" className="text-lg font-semibold tracking-tight">
            Add drill to library
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Name" id="drill-name" value={drillForm.name} onChange={(value) => setDrillForm((c) => ({ ...c, name: value }))} />
            <Field label="Category" id="drill-category" value={drillForm.category} onChange={(value) => setDrillForm((c) => ({ ...c, category: value }))} />
            <Field label="Duration (min)" id="drill-duration" value={drillForm.durationMinutes} onChange={(value) => setDrillForm((c) => ({ ...c, durationMinutes: value }))} />
            <Field label="Player numbers" id="drill-players" value={drillForm.playerNumbers} onChange={(value) => setDrillForm((c) => ({ ...c, playerNumbers: value }))} />
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium" htmlFor="drill-description">
                Description
              </label>
              <textarea
                id="drill-description"
                value={drillForm.description}
                onChange={(event) => setDrillForm((current) => ({ ...current, description: event.target.value }))}
                className="border-border bg-background focus-visible:ring-accent/40 min-h-24 w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium" htmlFor="drill-coaching-points">
                Coaching points
              </label>
              <textarea
                id="drill-coaching-points"
                value={drillForm.coachingPoints}
                onChange={(event) => setDrillForm((current) => ({ ...current, coachingPoints: event.target.value }))}
                className="border-border bg-background focus-visible:ring-accent/40 min-h-24 w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2"
              />
            </div>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleCreateDrill()}
            className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Save drill
          </button>

          <ul className="mt-6 space-y-3" role="list" aria-label="Drill library">
            {filteredDrills.map((drill) => (
              <li key={drill.id} className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]" role="listitem">
                <p className="font-medium">{drill.name}</p>
                <p className="text-muted mt-1 text-sm">
                  {drill.category ?? "Uncategorised"} · {DIFFICULTY_LABELS[drill.difficulty]}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void updateDrill(drill.id, { is_favourite: !drill.is_favourite })}
                    className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                  >
                    {drill.is_favourite ? "Unfavourite" : "Favourite"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDuplicateDrill(drill)}
                    className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                  >
                    <Copy className="size-4" aria-hidden />
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => void updateDrill(drill.id, { archived_at: drill.archived_at ? null : new Date().toISOString() })}
                    className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                  >
                    {drill.archived_at ? "Restore" : "Archive"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {view === "ai" ? (
        <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6" aria-labelledby="ai-builder-heading">
          <h2 id="ai-builder-heading" className="text-lg font-semibold tracking-tight">
            AI training builder
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Age group" id="ai-age" value={aiForm.ageGroup} onChange={(value) => setAiForm((c) => ({ ...c, ageGroup: value }))} />
            <Field label="Players" id="ai-players" value={aiForm.players} onChange={(value) => setAiForm((c) => ({ ...c, players: value }))} />
            <Field label="Theme" id="ai-theme" value={aiForm.theme} onChange={(value) => setAiForm((c) => ({ ...c, theme: value }))} />
            <Field label="Duration (min)" id="ai-duration" value={aiForm.durationMinutes} onChange={(value) => setAiForm((c) => ({ ...c, durationMinutes: value }))} />
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium" htmlFor="ai-objectives">
                Objectives
              </label>
              <textarea
                id="ai-objectives"
                value={aiForm.objectives}
                onChange={(event) => setAiForm((current) => ({ ...current, objectives: event.target.value }))}
                className="border-border bg-background focus-visible:ring-accent/40 min-h-24 w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2"
              />
            </div>
          </div>
          <button
            type="button"
            disabled={aiLoading}
            onClick={() => void handleGenerateAiPlan()}
            className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {aiLoading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
            Generate session plan
          </button>
        </section>
      ) : null}

      {loading ? (
        <PanelSkeleton />
      ) : null}

      {!loading && view === "plans" && filteredPlans.length > 0 ? (
        <section className="grid gap-4 xl:grid-cols-2">
          {filteredPlans.map((plan) => {
            const duration =
              plan.duration_minutes ??
              getTimelineDurationTotal(parseTrainingPlanData(plan.plan_data).timeline);
            return (
              <TrainingPlanOverviewCard
                key={plan.id}
                plan={plan}
                durationMinutes={duration}
                linkedSessionId={plan.session_id}
                selected={selectedPlanId === plan.id}
                onSelect={() => setSelectedPlanId(plan.id)}
              />
            );
          })}
        </section>
      ) : null}

      {selectedPlan ? (
        <TrainingPlanHubPanel
          plan={selectedPlan}
          drills={drills}
          saving={saving}
          aiLoading={aiLoading}
          statusMessage={statusMessage}
          onSavePlan={(patch) => void updatePlan(selectedPlan.id, patch)}
          onReorderTimeline={(sectionId, direction) => {
            const data = parseTrainingPlanData(selectedPlan.plan_data);
            const rows = [...data.timeline];
            const index = rows.findIndex((row) => row.id === sectionId);
            const swapIndex = direction === "up" ? index - 1 : index + 1;
            if (index < 0 || swapIndex < 0 || swapIndex >= rows.length) return;
            const currentOrder = rows[index].order;
            rows[index].order = rows[swapIndex].order;
            rows[swapIndex].order = currentOrder;
            [rows[index], rows[swapIndex]] = [rows[swapIndex], rows[index]];
            updateSelectedPlanData({ ...data, timeline: rows });
          }}
          onUpdateTimelineSection={(sectionId, patch) => {
            const data = parseTrainingPlanData(selectedPlan.plan_data);
            updateSelectedPlanData({
              ...data,
              timeline: data.timeline.map((section) =>
                section.id === sectionId ? { ...section, ...patch } : section,
              ),
            });
          }}
          onAddTimelineSection={(sectionType) => {
            const data = parseTrainingPlanData(selectedPlan.plan_data);
            const section: TimelineSection = {
              id: crypto.randomUUID(),
              sectionType,
              title: TIMELINE_SECTION_LABELS[sectionType],
              durationMinutes: 10,
              drillId: null,
              notes: null,
              order: data.timeline.length,
            };
            updateSelectedPlanData({ ...data, timeline: [...data.timeline, section] });
          }}
          onAssignDrill={(sectionId, drillId) => {
            const data = parseTrainingPlanData(selectedPlan.plan_data);
            updateSelectedPlanData({
              ...data,
              timeline: data.timeline.map((section) =>
                section.id === sectionId ? { ...section, drillId } : section,
              ),
            });
            if (drillId) void updateDrill(drillId, { last_used_at: new Date().toISOString() });
          }}
          onSaveReflection={(reflection) => {
            const data = parseTrainingPlanData(selectedPlan.plan_data);
            updateSelectedPlanData({ ...data, reflection });
            setStatusMessage("Reflection saved.");
          }}
          onGenerateReflection={async (reflection) => {
            setAiLoading(true);
            try {
              const response = await fetch("/api/training/generate-reflection", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ planId: selectedPlan.id, reflection }),
              });
              const payload = (await response.json()) as { error?: string; summary?: string };
              if (!response.ok) throw new Error(payload.error ?? "Unable to summarise reflection.");
              const data = parseTrainingPlanData(selectedPlan.plan_data);
              updateSelectedPlanData({
                ...data,
                reflection: {
                  ...reflection,
                  aiSummary: payload.summary ?? null,
                  completedAt: new Date().toISOString(),
                },
              });
              setStatusMessage("Reflection summarised.");
            } catch (caughtError: unknown) {
              setSubmitError(getErrorMessage(caughtError));
            } finally {
              setAiLoading(false);
            }
          }}
          onLinkSession={() => void handleLinkSession()}
        />
      ) : null}
    </div>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
      />
    </div>
  );
}
