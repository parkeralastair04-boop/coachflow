"use client";

import { useMemo, useState } from "react";
import {
  Clock3,
  Eye,
  EyeOff,
  Loader2,
  PoundSterling,
  Repeat,
  Trash2,
  Users,
} from "lucide-react";
import {
  DAY_OPTIONS,
  formatMinutes,
  formatPoundsFromPence,
  getDayLabel,
  parsePoundsToPence,
  SESSION_TYPE_OPTIONS,
  type CoachAvailabilityRow,
  type RecurringSessionSeriesRow,
  type SessionTypeOption,
} from "@/lib/booking-system";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type RecurringSeriesManagerProps = {
  coachId: string;
  academyId: string | null;
  availabilityTemplates: CoachAvailabilityRow[];
  series: RecurringSessionSeriesRow[];
  onSeriesChange: (series: RecurringSessionSeriesRow[]) => void;
};

type RecurringSeriesFormState = {
  templateId: string;
  title: string;
  dayOfWeek: string;
  startTime: string;
  sessionType: SessionTypeOption;
  durationMinutes: string;
  monthlyPrice: string;
  capacity: string;
  location: string;
  notes: string;
  visibility: "public" | "private";
  rollingWeeks: string;
};

const defaultFormState: RecurringSeriesFormState = {
  templateId: "",
  title: "Weekly coaching subscription",
  dayOfWeek: "1",
  startTime: "17:00",
  sessionType: "Group Session",
  durationMinutes: "60",
  monthlyPrice: "89.00",
  capacity: "8",
  location: "",
  notes: "",
  visibility: "public",
  rollingWeeks: "8",
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

function sortSeries(
  currentSeries: RecurringSessionSeriesRow[],
): RecurringSessionSeriesRow[] {
  return [...currentSeries].sort((a, b) => {
    if (a.day_of_week === b.day_of_week) {
      return a.start_time.localeCompare(b.start_time);
    }
    return a.day_of_week - b.day_of_week;
  });
}

export function RecurringSeriesManager({
  coachId,
  academyId,
  availabilityTemplates,
  series,
  onSeriesChange,
}: RecurringSeriesManagerProps) {
  const [form, setForm] = useState<RecurringSeriesFormState>(defaultFormState);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const templateById = useMemo(
    () => new Map(availabilityTemplates.map((template) => [template.id, template])),
    [availabilityTemplates],
  );

  function applyTemplate(templateId: string) {
    const template = templateById.get(templateId);
    setForm((current) => {
      if (!template) {
        return { ...current, templateId: "" };
      }

      return {
        ...current,
        templateId,
        title:
          current.title === defaultFormState.title
            ? `${template.session_type} weekly subscription`
            : current.title,
        dayOfWeek: String(template.day_of_week),
        startTime: template.start_time.slice(0, 5),
        sessionType: template.session_type,
        durationMinutes: String(template.duration_minutes),
        capacity: String(template.default_capacity),
      };
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const monthlyPrice = parsePoundsToPence(form.monthlyPrice);
    const durationMinutes = Number.parseInt(form.durationMinutes, 10);
    const capacity = Number.parseInt(form.capacity, 10);
    const rollingWeeks = Number.parseInt(form.rollingWeeks, 10);

    if (!form.title.trim()) {
      setSubmitError("Title is required.");
      return;
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes < 15) {
      setSubmitError("Duration must be at least 15 minutes.");
      return;
    }
    if (!Number.isFinite(capacity) || capacity < 1) {
      setSubmitError("Capacity must be at least 1.");
      return;
    }
    if (!Number.isFinite(rollingWeeks) || rollingWeeks < 1 || rollingWeeks > 24) {
      setSubmitError("Rolling weeks must be between 1 and 24.");
      return;
    }
    if (monthlyPrice < 100) {
      setSubmitError("Monthly price must be at least £1.00.");
      return;
    }

    setSaving(true);
    setSubmitError(null);

    try {
      const supabase = createClient();
      const payload = {
        coach_id: coachId,
        academy_id: academyId,
        source_availability_id: form.templateId || null,
        title: form.title.trim(),
        day_of_week: Number.parseInt(form.dayOfWeek, 10),
        start_time: form.startTime,
        session_type: form.sessionType,
        duration_minutes: durationMinutes,
        monthly_price: monthlyPrice,
        currency: "gbp",
        capacity,
        location: form.location.trim() || null,
        notes: form.notes.trim() || null,
        is_public: form.visibility === "public",
        booking_enabled: true,
        is_active: true,
        rolling_weeks: rollingWeeks,
      };

      const { data, error } = await supabase
        .from("recurring_session_series")
        .insert(payload)
        .select(
          "id, coach_id, academy_id, source_availability_id, title, session_type, day_of_week, start_time, duration_minutes, location, notes, capacity, monthly_price, currency, is_public, booking_enabled, is_active, rolling_weeks, created_at",
        )
        .single();

      if (error) {
        setSubmitError(error.message);
        return;
      }

      if (data) {
        await supabase.rpc("generate_recurring_series_sessions", {
          p_series_id: data.id,
        });
        onSeriesChange(sortSeries([...series, data as RecurringSessionSeriesRow]));
      }

      setForm(defaultFormState);
    } catch (caughtError: unknown) {
      setSubmitError(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(seriesId: string) {
    setDeletingId(seriesId);
    setSubmitError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("recurring_session_series")
        .delete()
        .eq("id", seriesId)
        .eq("coach_id", coachId);

      if (error) {
        setSubmitError(error.message);
        return;
      }

      onSeriesChange(series.filter((item) => item.id !== seriesId));
    } catch (caughtError: unknown) {
      setSubmitError(getErrorMessage(caughtError));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="glass-panel rounded-2xl p-6 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-8">
      <div className="flex items-start gap-3">
        <div className="bg-accent/10 ring-accent/20 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
          <Repeat className="text-accent size-5" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Recurring coaching subscriptions
          </h2>
          <p className="text-muted mt-1 text-sm">
            Create weekly coaching subscriptions with simple monthly billing and a
            seamless parent booking experience.
          </p>
        </div>
      </div>

      <form className="mt-8 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
        <div className="sm:col-span-2">
          <label className="mb-2 block text-sm font-medium" htmlFor="seriesTemplate">
            Start from availability template
          </label>
          <select
            id="seriesTemplate"
            value={form.templateId}
            onChange={(event) => applyTemplate(event.target.value)}
            className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
          >
            <option value="">Manual recurring setup</option>
            {availabilityTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {getDayLabel(template.day_of_week)} {template.start_time.slice(0, 5)} ·{" "}
                {template.session_type}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-2 block text-sm font-medium" htmlFor="seriesTitle">
            Product title
          </label>
          <input
            id="seriesTitle"
            value={form.title}
            onChange={(event) =>
              setForm((current) => ({ ...current, title: event.target.value }))
            }
            className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium" htmlFor="seriesDay">
            Weekly day
          </label>
          <select
            id="seriesDay"
            value={form.dayOfWeek}
            onChange={(event) =>
              setForm((current) => ({ ...current, dayOfWeek: event.target.value }))
            }
            className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
          >
            {DAY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium" htmlFor="seriesStartTime">
            Start time
          </label>
          <input
            id="seriesStartTime"
            type="time"
            value={form.startTime}
            onChange={(event) =>
              setForm((current) => ({ ...current, startTime: event.target.value }))
            }
            className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium" htmlFor="seriesType">
            Session type
          </label>
          <select
            id="seriesType"
            value={form.sessionType}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                sessionType: event.target.value as SessionTypeOption,
              }))
            }
            className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
          >
            {SESSION_TYPE_OPTIONS.filter((option) => option !== "Camp").map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium" htmlFor="seriesDuration">
            Session duration
          </label>
          <input
            id="seriesDuration"
            type="number"
            min={15}
            step={15}
            value={form.durationMinutes}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                durationMinutes: event.target.value,
              }))
            }
            className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium" htmlFor="seriesMonthlyPrice">
            Monthly price
          </label>
          <div className="relative">
            <PoundSterling className="text-muted pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <input
              id="seriesMonthlyPrice"
              inputMode="decimal"
              value={form.monthlyPrice}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  monthlyPrice: event.target.value,
                }))
              }
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border pr-3 pl-9 text-sm outline-none ring-offset-2 focus:ring-2"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium" htmlFor="seriesCapacity">
            Capacity
          </label>
          <input
            id="seriesCapacity"
            type="number"
            min={1}
            step={1}
            value={form.capacity}
            onChange={(event) =>
              setForm((current) => ({ ...current, capacity: event.target.value }))
            }
            className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium" htmlFor="seriesRollingWeeks">
            Weeks planned ahead
          </label>
          <input
            id="seriesRollingWeeks"
            type="number"
            min={1}
            max={24}
            step={1}
            value={form.rollingWeeks}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                rollingWeeks: event.target.value,
              }))
            }
            className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-2 block text-sm font-medium" htmlFor="seriesLocation">
            Location
          </label>
          <input
            id="seriesLocation"
            value={form.location}
            onChange={(event) =>
              setForm((current) => ({ ...current, location: event.target.value }))
            }
            className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-2 block text-sm font-medium" htmlFor="seriesNotes">
            Notes
          </label>
          <textarea
            id="seriesNotes"
            value={form.notes}
            onChange={(event) =>
              setForm((current) => ({ ...current, notes: event.target.value }))
            }
            className="border-border bg-background text-foreground focus:ring-accent/40 min-h-24 w-full rounded-xl border px-3 py-2 text-sm outline-none ring-offset-2 focus:ring-2"
            placeholder="What does the weekly subscription include?"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium" htmlFor="seriesVisibility">
            Public visibility
          </label>
          <select
            id="seriesVisibility"
            value={form.visibility}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                visibility: event.target.value as "public" | "private",
              }))
            }
            className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
          >
            <option value="public">Public booking portal</option>
            <option value="private">Private / internal only</option>
          </select>
        </div>

        <div className="rounded-2xl bg-black/[0.02] p-4 text-sm dark:bg-white/[0.03]">
          <p className="font-medium">
            Parents subscribe one child at a time, while CoachFlow keeps upcoming
            sessions, spaces, and attendance in sync automatically.
          </p>
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
            className="bg-accent text-white hover:opacity-90 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Creating recurring series...
              </>
            ) : (
              "Create recurring subscription"
            )}
          </button>
        </div>
      </form>

      <div className="mt-10 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Published recurring products
          </h3>
          <span className="text-muted text-sm">{series.length} total</span>
        </div>

        {series.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 px-4 py-5 text-sm text-muted dark:border-white/10">
            No recurring subscription products have been created yet.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {series.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-black/5 bg-black/[0.02] p-5 dark:border-white/10 dark:bg-white/[0.03]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-medium">{item.title}</h4>
                    <p className="text-muted mt-1 text-sm">
                      {getDayLabel(item.day_of_week)} at {item.start_time.slice(0, 5)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1",
                      item.is_public
                        ? "bg-accent/10 text-accent ring-accent/20"
                        : "bg-black/5 text-muted-foreground ring-black/10 dark:bg-white/5 dark:ring-white/10",
                    )}
                  >
                    {item.is_public ? (
                      <Eye className="size-3.5" aria-hidden />
                    ) : (
                      <EyeOff className="size-3.5" aria-hidden />
                    )}
                    {item.is_public ? "Public" : "Private"}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                  <div className="rounded-xl bg-white/60 px-3 py-2.5 dark:bg-black/20">
                    <p className="text-muted text-xs">Monthly price</p>
                    <p className="mt-1 inline-flex items-center gap-1 font-medium">
                      <PoundSterling className="size-3.5" aria-hidden />
                      {formatPoundsFromPence(item.monthly_price, item.currency.toUpperCase())}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/60 px-3 py-2.5 dark:bg-black/20">
                    <p className="text-muted text-xs">Weekly session</p>
                    <p className="mt-1 inline-flex items-center gap-1 font-medium">
                      <Clock3 className="size-3.5" aria-hidden />
                      {formatMinutes(item.duration_minutes)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/60 px-3 py-2.5 dark:bg-black/20">
                    <p className="text-muted text-xs">Capacity</p>
                    <p className="mt-1 inline-flex items-center gap-1 font-medium">
                      <Users className="size-3.5" aria-hidden />
                      {item.capacity} players
                    </p>
                  </div>
                </div>

                {item.location ? (
                  <p className="text-muted mt-3 text-sm">{item.location}</p>
                ) : null}
                {item.notes ? (
                  <p className="text-muted mt-2 text-sm leading-relaxed">{item.notes}</p>
                ) : null}

                <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{item.rolling_weeks} weeks generated ahead</span>
                  <button
                    type="button"
                    onClick={() => void handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-red-600 transition hover:bg-red-500/10 disabled:opacity-60 dark:text-red-400"
                  >
                    {deletingId === item.id ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="size-3.5" aria-hidden />
                    )}
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
