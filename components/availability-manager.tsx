"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  PoundSterling,
  Trash2,
  Users,
} from "lucide-react";
import { SetupRequiredPanel } from "@/components/setup-required-panel";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { footballEmptyPreset } from "@/lib/football-identity";
import {
  DAY_OPTIONS,
  formatMinutes,
  formatPoundsFromPence,
  getDayLabel,
  parsePoundsToPence,
  SESSION_TYPE_OPTIONS,
  type CoachAvailabilityRow,
  type SessionTypeOption,
} from "@/lib/booking-system";
import { createClient } from "@/lib/supabase";
import { MIN_CAPACITY, MIN_DURATION_MINUTES } from "@/lib/validation/constants";
import {
  getSetupRequiredMessage,
  isMissingTableError,
  resolveQueryError,
} from "@/lib/supabase-errors";
import { RecurringSeriesManager } from "@/components/recurring-series-manager";
import { BookingLinkGuidance } from "@/components/booking-link-guidance";
import type { RecurringSessionSeriesRow } from "@/lib/booking-system";
import { PanelSkeleton } from "@/components/branded-loading";

type AvailabilityFormState = {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  sessionType: SessionTypeOption;
  durationMinutes: string;
  defaultPrice: string;
  defaultCapacity: string;
  visibility: "public" | "private";
};

const defaultForm: AvailabilityFormState = {
  dayOfWeek: "1",
  startTime: "16:00",
  endTime: "18:00",
  sessionType: "1-to-1",
  durationMinutes: "60",
  defaultPrice: "45.00",
  defaultCapacity: "1",
  visibility: "public",
};

type AvailabilityFieldErrors = {
  durationMinutes?: string;
  defaultCapacity?: string;
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

function formatTime(value: string): string {
  return value.slice(0, 5);
}

export function AvailabilityManager() {
  const initialPortalOrigin =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const [coachId, setCoachId] = useState<string | null>(null);
  const [academyId, setAcademyId] = useState<string | null>(null);
  const [coachSlug, setCoachSlug] = useState<string | null>(null);
  const [academySlug, setAcademySlug] = useState<string | null>(null);
  const [portalOrigin] = useState(initialPortalOrigin.replace(/\/$/, ""));
  const [copiedUrl, setCopiedUrl] = useState<"coach" | "academy" | null>(null);
  const [templates, setTemplates] = useState<CoachAvailabilityRow[]>([]);
  const [recurringSeries, setRecurringSeries] = useState<RecurringSessionSeriesRow[]>([]);
  const [form, setForm] = useState<AvailabilityFormState>(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AvailabilityFieldErrors>({});
  const [setupTables, setSetupTables] = useState<string[]>([]);

  const publicTemplates = useMemo(
    () => templates.filter((template) => template.is_public).length,
    [templates],
  );

  const coachBookingUrl = useMemo(() => {
    if (!coachSlug) return null;
    return `${portalOrigin || ""}/book/${coachSlug}`.replace(/([^:]\/)\/+/g, "$1");
  }, [coachSlug, portalOrigin]);

  const academyBookingUrl = useMemo(() => {
    if (!academySlug) return null;
    return `${portalOrigin || ""}/academy/${academySlug}/book`.replace(
      /([^:]\/)\/+/g,
      "$1",
    );
  }, [academySlug, portalOrigin]);

  const loadTemplates = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    setSetupTables([]);

    try {
      const supabase = createClient();
      const [
        { data, error: loadError },
        { data: recurringData, error: recurringError },
      ] = await Promise.all([
        supabase
          .from("coach_availability")
          .select(
            "id, coach_id, academy_id, day_of_week, start_time, end_time, session_type, duration_minutes, default_price, default_capacity, is_public, created_at",
          )
          .eq("coach_id", userId)
          .order("day_of_week", { ascending: true })
          .order("start_time", { ascending: true }),
        supabase
          .from("recurring_session_series")
          .select(
            "id, coach_id, academy_id, source_availability_id, title, session_type, day_of_week, start_time, duration_minutes, location, notes, capacity, monthly_price, currency, is_public, booking_enabled, is_active, rolling_weeks, created_at",
          )
          .eq("coach_id", userId)
          .order("day_of_week", { ascending: true })
          .order("start_time", { ascending: true }),
      ]);

      if (loadError || recurringError) {
        if (isMissingTableError(loadError)) {
          setSetupTables(["coach_availability"]);
          return;
        }
        if (isMissingTableError(recurringError)) {
          setSetupTables(["coach_availability", "recurring_session_series"]);
          return;
        }
        const resolved = resolveQueryError(
          loadError ?? recurringError,
          loadError ? "coach_availability" : "recurring_session_series",
        );
        setError(resolved.message);
        return;
      }

      setTemplates((data ?? []) as CoachAvailabilityRow[]);
      setRecurringSeries((recurringData ?? []) as RecurringSessionSeriesRow[]);
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
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
          setLoading(false);
          return;
        }
        if (!user) {
          setError("You must be signed in to manage availability.");
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
        const resolvedAcademyId = (membership?.academy_id as string | undefined) ?? null;
        setAcademyId(resolvedAcademyId);

        const [{ data: profileData }, { data: academyData }] = await Promise.all([
          supabase
            .from("coach_public_profiles")
            .select("slug")
            .eq("coach_id", user.id)
            .maybeSingle(),
          resolvedAcademyId
            ? supabase
                .from("academies")
                .select("slug")
                .eq("id", resolvedAcademyId)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        if (!cancelled) {
          setCoachSlug((profileData?.slug as string | undefined) ?? null);
          setAcademySlug((academyData?.slug as string | undefined) ?? null);
        }
        await loadTemplates(user.id);
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
  }, [loadTemplates]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!coachId) {
      setSubmitError("You must be signed in to manage availability.");
      return;
    }

    const durationMinutes = Number.parseInt(form.durationMinutes, 10);
    const defaultCapacity = Number.parseInt(form.defaultCapacity, 10);
    const priceInPence = parsePoundsToPence(form.defaultPrice);

    const nextFieldErrors: AvailabilityFieldErrors = {};
    if (!Number.isFinite(durationMinutes) || durationMinutes < MIN_DURATION_MINUTES) {
      nextFieldErrors.durationMinutes = `Duration must be at least ${MIN_DURATION_MINUTES} minutes.`;
    }
    if (!Number.isFinite(defaultCapacity) || defaultCapacity < MIN_CAPACITY) {
      nextFieldErrors.defaultCapacity = `Capacity must be at least ${MIN_CAPACITY}.`;
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setFieldErrors({});
    setSaving(true);
    setSubmitError(null);

    try {
      const supabase = createClient();
      const payload = {
        coach_id: coachId,
        academy_id: academyId,
        day_of_week: Number.parseInt(form.dayOfWeek, 10),
        start_time: form.startTime,
        end_time: form.endTime,
        session_type: form.sessionType,
        duration_minutes: durationMinutes,
        default_price: priceInPence,
        default_capacity: defaultCapacity,
        is_public: form.visibility === "public",
      };

      const { data, error: insertError } = await supabase
        .from("coach_availability")
        .insert(payload)
        .select(
          "id, coach_id, academy_id, day_of_week, start_time, end_time, session_type, duration_minutes, default_price, default_capacity, is_public, created_at",
        )
        .single();

      if (insertError) {
        setSubmitError(insertError.message);
        return;
      }

      if (data) {
        setTemplates((current) =>
          [...current, data as CoachAvailabilityRow].sort((a, b) =>
            a.day_of_week === b.day_of_week
              ? a.start_time.localeCompare(b.start_time)
              : a.day_of_week - b.day_of_week,
          ),
        );
      }
      setForm(defaultForm);
      setFieldErrors({});
    } catch (caughtError: unknown) {
      setSubmitError(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(templateId: string) {
    if (!coachId) return;

    setDeletingId(templateId);
    setSubmitError(null);
    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from("coach_availability")
        .delete()
        .eq("id", templateId)
        .eq("coach_id", coachId);

      if (deleteError) {
        setSubmitError(deleteError.message);
        return;
      }

      setTemplates((current) => current.filter((template) => template.id !== templateId));
    } catch (caughtError: unknown) {
      setSubmitError(getErrorMessage(caughtError));
    } finally {
      setDeletingId(null);
    }
  }

  async function copyPortalUrl(kind: "coach" | "academy", url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(kind);
      window.setTimeout(() => setCopiedUrl((current) => (current === kind ? null : current)), 2000);
    } catch {
      setSubmitError("Could not copy the booking URL.");
    }
  }

  return (
    <div className="page-content-enter space-y-10">
      <PageHeader
        title="When you coach"
        subtitle="Share your booking page, set weekly training windows, and publish bookable sessions for parents."
        subtitleClassName="max-w-2xl"
      />

      <section className="glass-panel sticky top-0 z-30 rounded-2xl p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-accent text-xs font-medium tracking-wide uppercase">
              Booking portal
            </p>
            <h2 className="mt-1 text-base font-semibold tracking-tight">Your booking links</h2>
            <p className="text-muted mt-1 text-sm">
              Copy the link parents should use — see the guide below if you have both coach and academy pages.
            </p>
          </div>
          {coachBookingUrl ? (
            <div className="flex w-full shrink-0 flex-col gap-3 sm:max-w-xl sm:min-w-[18rem]">
              <div className="border-border bg-background rounded-xl border px-3 py-3 text-sm">
                <p className="break-all font-medium">{coachBookingUrl}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void copyPortalUrl("coach", coachBookingUrl)}
                  className="border-border hover:bg-surface-hover inline-flex h-10 flex-1 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors sm:flex-none dark:hover:bg-white/[0.06]"
                >
                  <Copy className="mr-2 size-4" aria-hidden />
                  {copiedUrl === "coach" ? "Copied" : "Copy link"}
                </button>
                <a
                  href={coachBookingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-foreground text-background hover:opacity-90 inline-flex h-10 flex-1 items-center justify-center rounded-full px-4 text-sm font-medium transition-opacity sm:flex-none"
                >
                  <ExternalLink className="mr-2 size-4" aria-hidden />
                  Open portal
                </a>
              </div>
            </div>
          ) : (
            <p className="text-muted text-sm sm:max-w-xs sm:text-right">
              Your coach booking link will appear here once your public portal is ready.
            </p>
          )}
        </div>

        {academyBookingUrl ? (
          <div className="border-border mt-5 border-t pt-5">
            <p className="text-sm font-medium">Academy portal</p>
            <p className="text-muted mt-1 break-all text-sm">{academyBookingUrl}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void copyPortalUrl("academy", academyBookingUrl)}
                className="border-border hover:bg-surface-hover inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors dark:hover:bg-white/[0.06]"
              >
                <Copy className="mr-2 size-4" aria-hidden />
                {copiedUrl === "academy" ? "Copied" : "Copy link"}
              </button>
              <a
                href={academyBookingUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-foreground text-background hover:opacity-90 inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium transition-opacity"
              >
                <ExternalLink className="mr-2 size-4" aria-hidden />
                Open portal
              </a>
            </div>
          </div>
        ) : null}
      </section>

      {coachBookingUrl || academyBookingUrl ? (
        <BookingLinkGuidance
          coachSlug={coachSlug}
          academySlug={academySlug}
          primaryUrl={academyBookingUrl ?? coachBookingUrl}
          variant="full"
        />
      ) : null}

      {setupTables.length > 0 ? (
        <SetupRequiredPanel
          {...getSetupRequiredMessage(setupTables)}
          tables={setupTables}
        />
      ) : null}

      {setupTables.length === 0 ? (
        <>
          <section className="football-panel football-panel-interactive rounded-2xl p-6 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-8">
            <div className="flex items-start gap-3">
              <div className="bg-accent/12 ring-accent/25 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
                <CalendarRange className="text-accent size-5" aria-hidden />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  How public booking works
                </h2>
                <p className="text-muted mt-1 max-w-2xl text-sm">
                  Create public or private sessions, share your booking portal, and let
                  Awarix handles reservations, payments, and availability so you stay on the pitch.
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]">
                <p className="text-sm font-medium">Public or private sessions</p>
                <p className="text-muted mt-1 text-sm leading-relaxed">
                  Choose exactly which sessions appear online and keep internal
                  scheduling private.
                </p>
              </div>
              <div className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]">
                <p className="text-sm font-medium">Parents book online</p>
                <p className="text-muted mt-1 text-sm leading-relaxed">
                  Families reserve sessions through your unique booking portal URL above.
                </p>
              </div>
              <div className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]">
                <p className="text-sm font-medium">Weekly subscription sessions</p>
                <p className="text-muted mt-1 text-sm leading-relaxed">
                  Offer weekly coaching subscriptions alongside one-off bookings.
                </p>
              </div>
              <div className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]">
                <p className="text-sm font-medium">Automatic spaces and payments</p>
                <p className="text-muted mt-1 text-sm leading-relaxed">
                  Capacity updates automatically and Stripe handles secure checkout.
                </p>
              </div>
            </div>
          </section>

          <section className="football-panel football-panel-interactive rounded-2xl p-6 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-8">
            <div className="flex items-start gap-3">
              <div className="bg-accent/12 ring-accent/25 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
                <CalendarRange className="text-accent size-5" aria-hidden />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Create availability</h2>
                <p className="text-muted mt-1 text-sm">
                  Save a weekly template here to speed up session creation. For your first booking, go straight to Sessions and publish a public slot.
                </p>
              </div>
            </div>

            <form className="mt-8 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="availabilityDay">
                  Available day
                </label>
                <select
                  id="availabilityDay"
                  value={form.dayOfWeek}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, dayOfWeek: event.target.value }))
                  }
                  className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2"
                >
                  {DAY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="availabilityType">
                  Session type
                </label>
                <select
                  id="availabilityType"
                  value={form.sessionType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      sessionType: event.target.value as SessionTypeOption,
                      defaultCapacity:
                        event.target.value === "1-to-1" ? "1" : current.defaultCapacity,
                    }))
                  }
                  className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2"
                >
                  {SESSION_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="availabilityStart">
                  Start time
                </label>
                <input
                  id="availabilityStart"
                  type="time"
                  value={form.startTime}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, startTime: event.target.value }))
                  }
                  className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="availabilityEnd">
                  End time
                </label>
                <input
                  id="availabilityEnd"
                  type="time"
                  value={form.endTime}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, endTime: event.target.value }))
                  }
                  className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="durationMinutes">
                  Session duration <span className="text-red-500">*</span>
                </label>
                <input
                  id="durationMinutes"
                  type="number"
                  min={MIN_DURATION_MINUTES}
                  step={MIN_DURATION_MINUTES}
                  value={form.durationMinutes}
                  onChange={(event) => {
                    setForm((current) => ({
                      ...current,
                      durationMinutes: event.target.value,
                    }));
                    if (fieldErrors.durationMinutes) {
                      setFieldErrors((current) => ({
                        ...current,
                        durationMinutes: undefined,
                      }));
                    }
                  }}
                  aria-invalid={fieldErrors.durationMinutes ? true : undefined}
                  aria-describedby={
                    fieldErrors.durationMinutes ? "durationMinutes-error" : undefined
                  }
                  className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2"
                />
                {fieldErrors.durationMinutes ? (
                  <p
                    id="durationMinutes-error"
                    role="alert"
                    className="mt-2 break-words text-sm text-red-600 dark:text-red-400"
                  >
                    {fieldErrors.durationMinutes}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="defaultPrice">
                  Session pricing
                </label>
                <div className="border-border bg-background flex h-11 items-center rounded-xl border px-3">
                  <PoundSterling className="text-muted size-4 shrink-0" aria-hidden />
                  <input
                    id="defaultPrice"
                    value={form.defaultPrice}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        defaultPrice: event.target.value,
                      }))
                    }
                    className="h-full w-full bg-transparent text-sm outline-none"
                    placeholder="45.00"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="defaultCapacity">
                  Max capacity <span className="text-red-500">*</span>
                </label>
                <input
                  id="defaultCapacity"
                  type="number"
                  min={MIN_CAPACITY}
                  value={form.defaultCapacity}
                  onChange={(event) => {
                    setForm((current) => ({
                      ...current,
                      defaultCapacity: event.target.value,
                    }));
                    if (fieldErrors.defaultCapacity) {
                      setFieldErrors((current) => ({
                        ...current,
                        defaultCapacity: undefined,
                      }));
                    }
                  }}
                  aria-invalid={fieldErrors.defaultCapacity ? true : undefined}
                  aria-describedby={
                    fieldErrors.defaultCapacity ? "defaultCapacity-error" : undefined
                  }
                  className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2"
                />
                {fieldErrors.defaultCapacity ? (
                  <p
                    id="defaultCapacity-error"
                    role="alert"
                    className="mt-2 break-words text-sm text-red-600 dark:text-red-400"
                  >
                    {fieldErrors.defaultCapacity}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="visibility">
                  Booking visibility
                </label>
                <select
                  id="visibility"
                  value={form.visibility}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      visibility: event.target.value as "public" | "private",
                    }))
                  }
                  className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2"
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </div>

              <div className="sm:col-span-2 rounded-2xl bg-black/[0.02] p-4 text-sm dark:bg-white/[0.03]">
                <p className="font-medium">
                  Save your preferred format, pricing, and visibility once, then reuse
                  it whenever you schedule new sessions.
                </p>
                <p className="text-muted mt-1">
                  A polished availability setup keeps your calendar consistent across
                  private coaching, public bookings, and recurring offers.
                </p>
              </div>

              {submitError ? (
                <p
                  className="sm:col-span-2 break-words text-sm text-red-600 dark:text-red-400"
                  role="alert"
                >
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
                      Creating...
                    </>
                  ) : (
                    "Create Availability"
                  )}
                </button>
              </div>
            </form>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight">Saved templates</h2>
              {!loading ? (
                <span className="text-muted text-sm">
                  {templates.length} total, {publicTemplates} public
                </span>
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

            {!loading && !error && templates.length === 0 ? (
              <EmptyState
                {...footballEmptyPreset("availability")}
                actionLabel="Go to training sessions"
                actionHref="/dashboard/sessions"
              />
            ) : null}

            {!loading && !error && templates.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {templates.map((template) => (
                  <article key={template.id} className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold tracking-tight">
                          {getDayLabel(template.day_of_week)} · {template.session_type}
                        </h3>
                        <p className="text-muted mt-1 text-sm">
                          {formatTime(template.start_time)} - {formatTime(template.end_time)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDelete(template.id)}
                        disabled={deletingId === template.id}
                        className="text-muted hover:text-red-500 inline-flex items-center justify-center rounded-lg p-2 transition-colors disabled:opacity-60"
                        aria-label="Delete availability"
                      >
                        {deletingId === template.id ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Trash2 className="size-4" aria-hidden />
                        )}
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                      <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
                        <p className="text-muted text-xs">Duration</p>
                        <p className="mt-1 font-medium">{formatMinutes(template.duration_minutes)}</p>
                      </div>
                      <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
                        <p className="text-muted text-xs">Pricing</p>
                        <p className="mt-1 font-medium">
                          {formatPoundsFromPence(template.default_price)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
                        <p className="text-muted text-xs">Capacity</p>
                        <p className="mt-1 inline-flex items-center gap-1 font-medium">
                          <Users className="size-3.5" aria-hidden />
                          {template.default_capacity}
                        </p>
                      </div>
                      <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
                        <p className="text-muted text-xs">Visibility</p>
                        <p className="mt-1 inline-flex items-center gap-1 font-medium">
                          {template.is_public ? (
                            <>
                              <Eye className="size-3.5" aria-hidden />
                              Public
                            </>
                          ) : (
                            <>
                              <EyeOff className="size-3.5" aria-hidden />
                              Private
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <p className="text-muted mt-4 inline-flex items-center gap-1.5 text-xs">
                      <Clock3 className="size-3.5" aria-hidden />
                      Use this template when creating a live session in Sessions.
                    </p>
                  </article>
                ))}
              </div>
            ) : null}
          </section>

          {coachId ? (
            <RecurringSeriesManager
              coachId={coachId}
              academyId={academyId}
              availabilityTemplates={templates}
              series={recurringSeries}
              onSeriesChange={setRecurringSeries}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
