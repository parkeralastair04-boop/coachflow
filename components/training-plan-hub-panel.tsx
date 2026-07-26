"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ClipboardList,
  Loader2,
  Sparkles,
  Star,
} from "lucide-react";
import { TrainingPitchBuilder } from "@/components/training-pitch-builder";
import {
  DEVELOPMENT_TAG_LABELS,
  DEVELOPMENT_TAGS,
  DIFFICULTY_LABELS,
  getTimelineDurationTotal,
  parseTrainingPlanData,
  TIMELINE_SECTION_LABELS,
  TIMELINE_SECTION_TYPES,
  type SessionReflection,
  type TimelineSection,
  type TimelineSectionType,
  type TrainingDrillRow,
  type TrainingPlanRow,
} from "@/lib/training-types";

type TrainingPlanHubPanelProps = {
  plan: TrainingPlanRow;
  drills: TrainingDrillRow[];
  saving: boolean;
  aiLoading: boolean;
  statusMessage: string | null;
  onSavePlan: (patch: Partial<TrainingPlanRow> & { plan_data?: TrainingPlanRow["plan_data"] }) => void;
  onReorderTimeline: (sectionId: string, direction: "up" | "down") => void;
  onUpdateTimelineSection: (sectionId: string, patch: Partial<TimelineSection>) => void;
  onAddTimelineSection: (sectionType: TimelineSectionType) => void;
  onAssignDrill: (sectionId: string, drillId: string | null) => void;
  onSaveReflection: (reflection: SessionReflection) => void;
  onGenerateReflection: (reflection: SessionReflection) => void;
  onLinkSession: () => void;
};

export function TrainingPlanHubPanel({
  plan,
  drills,
  saving,
  aiLoading,
  statusMessage,
  onSavePlan,
  onReorderTimeline,
  onUpdateTimelineSection,
  onAddTimelineSection,
  onAssignDrill,
  onSaveReflection,
  onGenerateReflection,
  onLinkSession,
}: TrainingPlanHubPanelProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "timeline" | "pitch" | "reflection" | "parent" | "development"
  >("overview");
  const planData = useMemo(() => parseTrainingPlanData(plan.plan_data), [plan.plan_data]);
  const durationTotal = getTimelineDurationTotal(planData.timeline);

  const tabs = [
    ["overview", "Overview"],
    ["timeline", "Timeline"],
    ["pitch", "Pitch"],
    ["reflection", "Reflection"],
    ["parent", "Parent view"],
    ["development", "Development"],
  ] as const;

  return (
    <section
      id="training-plan-hub"
      className="glass-panel interactive-surface rounded-2xl p-5 sm:p-8"
      aria-labelledby="training-plan-hub-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="training-plan-hub-heading" className="text-xl font-semibold tracking-tight">
            {plan.title}
          </h2>
          <p className="text-muted mt-1 text-sm" role="status">
            {plan.theme ?? "No theme set"} · {DIFFICULTY_LABELS[plan.difficulty]} · {durationTotal} min
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => onSavePlan({ is_favourite: !plan.is_favourite })}
            className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Star className={`size-4 ${plan.is_favourite ? "fill-current" : ""}`} aria-hidden />
            {plan.is_favourite ? "Favourited" : "Favourite"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onLinkSession}
            className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Link to session
          </button>
        </div>
      </div>

      {statusMessage ? (
        <p className="mt-4 text-sm" role="status">
          {statusMessage}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Training plan sections">
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
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <OverviewItem label="Age group" value={plan.age_group ?? "Not set"} />
            <OverviewItem label="Objectives" value={plan.objectives ?? "Not set"} />
            <OverviewItem label="Expected outcomes" value={plan.expected_outcomes ?? "Not set"} />
            <OverviewItem label="Match objective" value={plan.match_objective ?? "Not linked"} />
            <OverviewItem label="Equipment" value={plan.equipment.join(", ") || "None listed"} />
            <OverviewItem label="Coach notes" value={plan.coach_notes ?? "None"} />
          </dl>
          <div className="flex flex-wrap gap-2">
            {plan.session_id ? (
              <Link
                href={`/dashboard/registers?session=${plan.session_id}`}
                className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <ClipboardList className="size-4" aria-hidden />
                Open register
              </Link>
            ) : null}
            <Link
              href="/dashboard/sessions"
              className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              View sessions
            </Link>
          </div>
        </div>
      ) : null}

      {activeTab === "timeline" ? (
        <div className="mt-6 space-y-4" role="tabpanel">
          <p className="text-sm font-medium" role="status">
            Total duration: {durationTotal} minutes
          </p>
          <div className="flex flex-wrap gap-2">
            {TIMELINE_SECTION_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                disabled={saving}
                onClick={() => onAddTimelineSection(type)}
                className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
              >
                Add {TIMELINE_SECTION_LABELS[type]}
              </button>
            ))}
          </div>
          <ul className="space-y-3" role="list" aria-label="Session timeline">
            {planData.timeline.map((section) => {
              const drill = drills.find((item) => item.id === section.drillId);
              return (
                <li
                  key={section.id}
                  className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]"
                  role="listitem"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="grid flex-1 gap-3 md:grid-cols-3">
                      <div>
                        <label className="mb-2 block text-sm font-medium" htmlFor={`section-title-${section.id}`}>
                          Section
                        </label>
                        <input
                          id={`section-title-${section.id}`}
                          value={section.title}
                          onChange={(event) =>
                            onUpdateTimelineSection(section.id, { title: event.target.value })
                          }
                          className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium" htmlFor={`section-duration-${section.id}`}>
                          Duration (min)
                        </label>
                        <input
                          id={`section-duration-${section.id}`}
                          type="number"
                          min={1}
                          value={section.durationMinutes}
                          onChange={(event) =>
                            onUpdateTimelineSection(section.id, {
                              durationMinutes: Number(event.target.value) || 0,
                            })
                          }
                          className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium" htmlFor={`section-drill-${section.id}`}>
                          Drill
                        </label>
                        <select
                          id={`section-drill-${section.id}`}
                          value={section.drillId ?? ""}
                          onChange={(event) =>
                            onAssignDrill(section.id, event.target.value || null)
                          }
                          className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                        >
                          <option value="">No drill linked</option>
                          {drills
                            .filter((item) => !item.archived_at)
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        aria-label={`Move ${section.title} up`}
                        disabled={saving}
                        onClick={() => onReorderTimeline(section.id, "up")}
                        className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex size-11 items-center justify-center rounded-xl border outline-none focus-visible:ring-2"
                      >
                        <ArrowUp className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${section.title} down`}
                        disabled={saving}
                        onClick={() => onReorderTimeline(section.id, "down")}
                        className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex size-11 items-center justify-center rounded-xl border outline-none focus-visible:ring-2"
                      >
                        <ArrowDown className="size-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                  {drill ? (
                    <p className="text-muted mt-2 text-sm">
                      {drill.description ?? "Linked drill"} · {drill.duration_minutes ?? "?"} min
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {activeTab === "pitch" ? (
        <div className="mt-6" role="tabpanel">
          <TrainingPitchBuilder
            title={plan.title}
            layout={planData.pitchLayout}
            onChange={(layout) =>
              onSavePlan({
                plan_data: { ...planData, pitchLayout: layout },
              })
            }
          />
        </div>
      ) : null}

      {activeTab === "reflection" ? (
        <ReflectionForm
          reflection={planData.reflection}
          saving={saving}
          aiLoading={aiLoading}
          onSave={onSaveReflection}
          onGenerate={onGenerateReflection}
        />
      ) : null}

      {activeTab === "parent" ? (
        <div className="mt-6 space-y-4" role="tabpanel">
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={plan.parent_visible}
              onChange={(event) => onSavePlan({ parent_visible: event.target.checked })}
            />
            Share preparation details with parents (no tactical diagrams)
          </label>
          {(
            [
              ["parent_message", "Coach message", plan.parent_message],
              ["parent_equipment_note", "Equipment to bring", plan.parent_equipment_note],
              ["parent_preparation_note", "Preparation notes", plan.parent_preparation_note],
            ] as const
          ).map(([key, label, value]) => (
            <div key={key}>
              <label className="mb-2 block text-sm font-medium" htmlFor={key}>
                {label}
              </label>
              <textarea
                id={key}
                value={value ?? ""}
                onChange={(event) => onSavePlan({ [key]: event.target.value })}
                className="border-border bg-background focus-visible:ring-accent/40 min-h-24 w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2"
              />
            </div>
          ))}
        </div>
      ) : null}

      {activeTab === "development" ? (
        <div className="mt-6" role="tabpanel">
          <fieldset>
            <legend className="mb-3 text-sm font-medium">Development focus tags</legend>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {DEVELOPMENT_TAGS.map((tag) => (
                <li key={tag}>
                  <label className="flex min-h-11 items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={plan.development_focus.includes(tag)}
                      onChange={(event) => {
                        const next = event.target.checked
                          ? [...plan.development_focus, tag]
                          : plan.development_focus.filter((item) => item !== tag);
                        onSavePlan({ development_focus: next });
                      }}
                    />
                    {DEVELOPMENT_TAG_LABELS[tag]}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        </div>
      ) : null}
    </section>
  );
}

function OverviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/[0.02] px-4 py-3 dark:bg-white/[0.03]">
      <dt className="text-muted text-xs">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}

function ReflectionForm({
  reflection,
  saving,
  aiLoading,
  onSave,
  onGenerate,
}: {
  reflection: SessionReflection | null;
  saving: boolean;
  aiLoading: boolean;
  onSave: (reflection: SessionReflection) => void;
  onGenerate: (reflection: SessionReflection) => void;
}) {
  const [form, setForm] = useState<SessionReflection>({
    wentWell: reflection?.wentWell ?? "",
    needsImproving: reflection?.needsImproving ?? "",
    attendanceImpact: reflection?.attendanceImpact ?? "",
    coachNotes: reflection?.coachNotes ?? "",
    followUpActions: reflection?.followUpActions ?? "",
    aiSummary: reflection?.aiSummary ?? "",
    completedAt: reflection?.completedAt ?? null,
  });

  return (
    <div className="mt-6 space-y-4" role="tabpanel">
      {(
        [
          ["wentWell", "What went well?"],
          ["needsImproving", "What needs improving?"],
          ["attendanceImpact", "Attendance impact"],
          ["coachNotes", "Coach notes"],
          ["followUpActions", "Follow-up actions"],
        ] as const
      ).map(([key, label]) => (
        <div key={key}>
          <label className="mb-2 block text-sm font-medium" htmlFor={`reflection-${key}`}>
            {label}
          </label>
          <textarea
            id={`reflection-${key}`}
            value={form[key] ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
            className="border-border bg-background focus-visible:ring-accent/40 min-h-24 w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2"
          />
        </div>
      ))}
      {form.aiSummary ? (
        <div className="rounded-xl bg-black/[0.02] p-4 text-sm dark:bg-white/[0.03]" role="status">
          <p className="font-medium">AI summary</p>
          <p className="text-muted mt-2">{form.aiSummary}</p>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            onSave({
              ...form,
              completedAt: new Date().toISOString(),
            })
          }
          className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Save reflection
        </button>
        <button
          type="button"
          disabled={aiLoading}
          onClick={() => onGenerate(form)}
          className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {aiLoading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="size-4" aria-hidden />
          )}
          AI summarise
        </button>
      </div>
    </div>
  );
}
