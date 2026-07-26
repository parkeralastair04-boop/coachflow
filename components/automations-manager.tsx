"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Loader2,
  Mail,
  Save,
  Sparkles,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import {
  DEFAULT_AUTOMATION_TEMPLATES,
  type AutomationRow,
  type AutomationType,
} from "@/lib/automations";
import { FeaturePageHeader } from "@/components/feature-page-header";
import { Button } from "@/components/ui/button";
import { CoachSetupGuidance } from "@/components/coach-setup-guidance";
import { SetupRequiredPanel } from "@/components/setup-required-panel";
import { fetchOnboardingCounts } from "@/lib/onboarding-setup";
import { createClient } from "@/lib/supabase";
import {
  getSetupRequiredMessage,
  isMissingTableError,
  resolveQueryError,
} from "@/lib/supabase-errors";
import { cn } from "@/lib/utils";
import { PanelSkeleton } from "@/components/branded-loading";

const MAX_AUTOMATION_SUBJECT_LENGTH = 200;
const MAX_AUTOMATION_TEMPLATE_LENGTH = 5000;

type AutomationFieldErrors = Partial<
  Record<AutomationType, { subject?: string; template?: string }>
>;

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

function buildDefaultRow(coachId: string, type: AutomationType) {
  const template = DEFAULT_AUTOMATION_TEMPLATES.find((item) => item.type === type);
  if (!template) {
    throw new Error(`Unknown automation type: ${type}`);
  }

  return {
    coach_id: coachId,
    type,
    is_enabled: false,
    subject: template.defaultSubject,
    template: template.defaultTemplate,
    timing_offset: template.defaultTimingOffset,
  };
}

export function AutomationsManager() {
  const [coachId, setCoachId] = useState("");
  const [automations, setAutomations] = useState<AutomationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingType, setSavingType] = useState<AutomationType | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [setupTables, setSetupTables] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<AutomationFieldErrors>({});
  const [setupLoading, setSetupLoading] = useState(true);
  const [hasBooking, setHasBooking] = useState(false);

  const automationsByType = useMemo(
    () => new Map(automations.map((automation) => [automation.type, automation])),
    [automations],
  );

  const loadAutomations = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSetupTables([]);

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        setError(userError.message);
        return;
      }
      if (!user) {
        setError("You must be signed in to manage automations.");
        return;
      }

      setCoachId(user.id);
      const { data, error: automationsError } = await supabase
        .from("automations")
        .select(
          "id, coach_id, type, is_enabled, subject, template, timing_offset, created_at",
        )
        .eq("coach_id", user.id)
        .order("created_at", { ascending: true });

      if (automationsError) {
        if (isMissingTableError(automationsError)) {
          setSetupTables(["automations"]);
          return;
        }
        const resolved = resolveQueryError(automationsError, "automations");
        setError(resolved.setupRequired ? resolved.message : automationsError.message);
        return;
      }

      const existingRows = (data ?? []) as AutomationRow[];
      const existingTypes = new Set(existingRows.map((row) => row.type));
      const missingRows = DEFAULT_AUTOMATION_TEMPLATES.filter(
        (template) => !existingTypes.has(template.type),
      ).map((template) => buildDefaultRow(user.id, template.type));

      if (missingRows.length > 0) {
        const { data: inserted, error: insertError } = await supabase
          .from("automations")
          .insert(missingRows)
          .select(
            "id, coach_id, type, is_enabled, subject, template, timing_offset, created_at",
          );

        if (insertError) {
          if (isMissingTableError(insertError)) {
            setSetupTables(["automations"]);
            return;
          }
          setError(insertError.message);
          return;
        }

        setAutomations([...existingRows, ...((inserted ?? []) as AutomationRow[])]);
      } else {
        setAutomations(existingRows);
      }
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      await loadAutomations();
    }

    void init();
  }, [loadAutomations]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const counts = await fetchOnboardingCounts(supabase, user.id);
        if (!cancelled) setHasBooking(counts.hasBooking);
      } finally {
        if (!cancelled) setSetupLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateLocalAutomation(
    type: AutomationType,
    patch: Partial<Pick<AutomationRow, "is_enabled" | "subject" | "template" | "timing_offset">>,
  ) {
    setAutomations((current) =>
      current.map((automation) =>
        automation.type === type ? { ...automation, ...patch } : automation,
      ),
    );
  }

  async function saveAutomation(type: AutomationType) {
    if (!coachId) return;
    const automation = automationsByType.get(type);
    if (!automation) return;

    const subject = automation.subject.trim();
    const template = automation.template.trim();
    const nextErrors: { subject?: string; template?: string } = {};
    if (subject.length > MAX_AUTOMATION_SUBJECT_LENGTH) {
      nextErrors.subject = `Subject must be ${MAX_AUTOMATION_SUBJECT_LENGTH} characters or fewer.`;
    }
    if (template.length > MAX_AUTOMATION_TEMPLATE_LENGTH) {
      nextErrors.template = `Message template must be ${MAX_AUTOMATION_TEMPLATE_LENGTH} characters or fewer.`;
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors((current) => ({ ...current, [type]: nextErrors }));
      return;
    }

    setFieldErrors((current) => ({ ...current, [type]: {} }));
    setSavingType(type);
    setError(null);
    setSuccess(null);

    try {
      const supabase = createClient();
      const payload = {
        coach_id: coachId,
        type,
        is_enabled: automation.is_enabled,
        subject: subject,
        template: template,
        timing_offset: automation.timing_offset,
      };

      const { data, error: saveError } = await supabase
        .from("automations")
        .upsert(payload, { onConflict: "coach_id,type" })
        .select(
          "id, coach_id, type, is_enabled, subject, template, timing_offset, created_at",
        )
        .single();

      if (saveError) {
        setError(saveError.message);
        return;
      }

      if (data) {
        setAutomations((current) =>
          current.map((row) =>
            row.type === type ? (data as AutomationRow) : row,
          ),
        );
      }
      setSuccess("Automation saved.");
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setSavingType(null);
    }
  }

  async function runAutomations() {
    setRunning(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/automations/run", { method: "POST" });
      const payload = (await response.json()) as {
        sent?: number;
        evaluated?: number;
        error?: string;
      };
      if (!response.ok) {
        setError(payload.error ?? "Could not run automations.");
        return;
      }
      setSuccess(
        `Automation run complete. Evaluated ${payload.evaluated ?? 0}, sent ${payload.sent ?? 0}.`,
      );
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="page-content-enter space-y-10">
      <FeaturePageHeader
        featureKey="automations"
        title="Automatic Messages"
        subtitle="Send branded emails to parents automatically — session reminders and payment follow-ups while you coach."
        subtitleClassName="max-w-2xl"
        actions={
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => void runAutomations()}
            disabled={running || loading || setupLoading || !hasBooking}
          >
            {running ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Running
              </>
            ) : (
              <>
                <Sparkles className="size-4" aria-hidden />
                Test run
              </>
            )}
          </Button>
        }
      />

      {setupTables.length > 0 ? (
        <SetupRequiredPanel
          {...getSetupRequiredMessage(setupTables)}
          tables={setupTables}
        />
      ) : null}

      {error ? (
        <div className="football-panel football-panel-interactive rounded-2xl p-5 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="football-panel football-panel-interactive rounded-2xl p-5 text-sm text-accent">
          {success}
        </div>
      ) : null}

      {setupTables.length === 0 ? (
      <>
      {!setupLoading && !hasBooking ? (
        <CoachSetupGuidance
          icon={BellRing}
          title="Reminders go live after your first parent booking"
          description="Once parents start booking through your portal, you can switch on reminders and follow-up emails without sending them manually."
          actionHref="/dashboard#getting-started"
          actionLabel="Finish booking setup"
        />
      ) : null}

      {!setupLoading && hasBooking ? (
      <>
      <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="bg-accent/12 ring-accent/25 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
            <BellRing className="text-accent size-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Default automation templates
            </h2>
            <p className="text-muted mt-1 text-sm">
              Enable templates, adjust copy, and tune timing offsets to match
              your academy workflow.
            </p>
          </div>
        </div>
      </section>

      {loading ? (
        <PanelSkeleton />
      ) : null}

      {!loading ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {DEFAULT_AUTOMATION_TEMPLATES.map((template) => {
            const automation = automationsByType.get(template.type);
            if (!automation) return null;
            const typeFieldErrors = fieldErrors[template.type];

            return (
              <article key={template.type} className="football-panel football-panel-interactive rounded-2xl p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight">
                      {template.title}
                    </h3>
                    <p className="text-muted mt-1 text-sm">
                      {template.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateLocalAutomation(template.type, {
                        is_enabled: !automation.is_enabled,
                      })
                    }
                    className={cn(
                      "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors",
                      automation.is_enabled
                        ? "bg-accent/10 text-accent ring-accent/25"
                        : "text-muted ring-border hover:text-foreground",
                    )}
                  >
                    {automation.is_enabled ? (
                      <ToggleRight className="mr-1.5 size-4" aria-hidden />
                    ) : (
                      <ToggleLeft className="mr-1.5 size-4" aria-hidden />
                    )}
                    {automation.is_enabled ? "Enabled" : "Disabled"}
                  </button>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <label
                      className="mb-2 block text-sm font-medium"
                      htmlFor={`automation-subject-${template.type}`}
                    >
                      Email subject
                    </label>
                    <input
                      id={`automation-subject-${template.type}`}
                      value={automation.subject}
                      onChange={(e) => {
                        updateLocalAutomation(template.type, {
                          subject: e.target.value,
                        });
                        if (typeFieldErrors?.subject) {
                          setFieldErrors((current) => ({
                            ...current,
                            [template.type]: { ...current[template.type], subject: undefined },
                          }));
                        }
                      }}
                      aria-invalid={typeFieldErrors?.subject ? true : undefined}
                      aria-describedby={
                        typeFieldErrors?.subject
                          ? `automation-subject-${template.type}-error`
                          : undefined
                      }
                      className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2 dark:ring-offset-background"
                    />
                    {typeFieldErrors?.subject ? (
                      <p
                        id={`automation-subject-${template.type}-error`}
                        role="alert"
                        className="mt-2 break-words text-sm text-red-600 dark:text-red-400"
                      >
                        {typeFieldErrors.subject}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label
                      className="mb-2 block text-sm font-medium"
                      htmlFor={`automation-template-${template.type}`}
                    >
                      Message template
                    </label>
                    <textarea
                      id={`automation-template-${template.type}`}
                      value={automation.template}
                      onChange={(e) => {
                        updateLocalAutomation(template.type, {
                          template: e.target.value,
                        });
                        if (typeFieldErrors?.template) {
                          setFieldErrors((current) => ({
                            ...current,
                            [template.type]: { ...current[template.type], template: undefined },
                          }));
                        }
                      }}
                      aria-invalid={typeFieldErrors?.template ? true : undefined}
                      aria-describedby={
                        typeFieldErrors?.template
                          ? `automation-template-${template.type}-error`
                          : undefined
                      }
                      className="border-border bg-background text-foreground focus-visible:ring-accent/40 min-h-36 w-full rounded-xl border px-3 py-2 text-sm outline-none ring-offset-2 focus-visible:ring-2 dark:ring-offset-background"
                    />
                    {typeFieldErrors?.template ? (
                      <p
                        id={`automation-template-${template.type}-error`}
                        role="alert"
                        className="mt-2 break-words text-sm text-red-600 dark:text-red-400"
                      >
                        {typeFieldErrors.template}
                      </p>
                    ) : null}
                    <p className="text-muted mt-2 text-xs">
                      Variables: {"{parent_name}"}, {"{player_name}"}, {"{session_date}"},{" "}
                      {"{due_date}"}
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      {template.offsetLabel}
                    </label>
                    <input
                      type="number"
                      value={automation.timing_offset}
                      onChange={(e) =>
                        updateLocalAutomation(template.type, {
                          timing_offset: Number.parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2 dark:ring-offset-background"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => void saveAutomation(template.type)}
                    disabled={savingType === template.type}
                    className="bg-foreground text-background hover:opacity-90 inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium transition-opacity disabled:opacity-60"
                  >
                    {savingType === template.type ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 size-4" aria-hidden />
                        Save automation
                      </>
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      <section className="football-panel football-panel-interactive rounded-2xl p-6 text-sm text-muted">
        <div className="flex items-start gap-3">
          <Mail className="text-accent mt-0.5 size-5 shrink-0" aria-hidden />
          <p>
            The <code className="text-foreground">/api/automations/run</code>{" "}
            endpoint is ready for cron. It evaluates enabled automations for
            the authenticated coach and sends matching notifications through
            Resend.
          </p>
        </div>
      </section>
      </>
      ) : null}
      </>
      ) : null}
    </div>
  );
}
