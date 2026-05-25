"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  Loader2,
  MapPin,
  PoundSterling,
  Trash2,
  Users,
} from "lucide-react";
import { FeaturePageHeader } from "@/components/feature-page-header";
import { SetupRequiredPanel } from "@/components/setup-required-panel";
import { createClient } from "@/lib/supabase";
import {
  getSetupRequiredMessage,
  isMissingTableError,
  resolveQueryError,
} from "@/lib/supabase-errors";

type CampRow = {
  id: string;
  coach_id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  age_group: string | null;
  capacity: number;
  price: number;
  location: string | null;
  notes: string | null;
  created_at: string;
};

type CampFormState = {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  ageGroup: string;
  capacity: string;
  price: string;
  location: string;
  notes: string;
};

const defaultForm: CampFormState = {
  name: "",
  description: "",
  startDate: "",
  endDate: "",
  startTime: "09:00",
  endTime: "15:00",
  ageGroup: "",
  capacity: "16",
  price: "",
  location: "",
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

function formatDate(value: string): string {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

function formatTime(value: string): string {
  if (!value) return "—";
  const parts = value.split(":");
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
  return value;
}

function formatPricePounds(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

function parsePrice(input: string): number {
  const n = Number.parseFloat(input.replace(/[£,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

type CampWithStats = CampRow & {
  enrolled: number;
  waitlist: number;
  remaining: number;
};

function aggregateEnrolments(
  camps: CampRow[],
  rows: { camp_id: string; status: string }[] | null,
): CampWithStats[] {
  const byCamp = new Map<string, { enrolled: number; waitlist: number }>();
  for (const c of camps) {
    byCamp.set(c.id, { enrolled: 0, waitlist: 0 });
  }
  for (const r of rows ?? []) {
    const cur = byCamp.get(r.camp_id);
    if (!cur) continue;
    if (r.status === "enrolled") cur.enrolled += 1;
    else if (r.status === "waitlist") cur.waitlist += 1;
  }
  return camps.map((c) => {
    const { enrolled, waitlist } = byCamp.get(c.id) ?? {
      enrolled: 0,
      waitlist: 0,
    };
    const remaining = Math.max(0, c.capacity - enrolled);
    return { ...c, enrolled, waitlist, remaining };
  });
}

export function CampsManager() {
  const [form, setForm] = useState<CampFormState>(defaultForm);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [camps, setCamps] = useState<CampWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [setupTables, setSetupTables] = useState<string[]>([]);

  const hasCamps = useMemo(() => camps.length > 0, [camps.length]);

  const loadCamps = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    setSetupTables([]);
    try {
      const supabase = createClient();
      const { data: campRows, error: campsError } = await supabase
        .from("camps")
        .select(
          "id, coach_id, name, description, start_date, end_date, start_time, end_time, age_group, capacity, price, location, notes, created_at",
        )
        .eq("coach_id", userId)
        .order("created_at", { ascending: false });

      if (campsError) {
        if (isMissingTableError(campsError)) {
          setSetupTables(["camps", "camp_enrolments"]);
          return;
        }
        const resolved = resolveQueryError(campsError, "camps");
        setError(resolved.message);
        return;
      }

      const list = (campRows ?? []) as CampRow[];
      if (list.length === 0) {
        setCamps([]);
        return;
      }

      const ids = list.map((c) => c.id);
      const { data: enrolRows, error: enError } = await supabase
        .from("camp_enrolments")
        .select("camp_id, status")
        .in("camp_id", ids);

      if (enError) {
        setError(enError.message);
        return;
      }

      setCamps(aggregateEnrolments(list, enrolRows as { camp_id: string; status: string }[]));
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
          setError("You must be signed in to manage camps.");
          setLoading(false);
          return;
        }
        setCoachId(user.id);
        await loadCamps(user.id);
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
  }, [loadCamps]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!coachId) {
      setSubmitError("You must be signed in to create a camp.");
      return;
    }

    setSubmitError(null);

    if (!form.startDate || !form.endDate) {
      setSubmitError("Start and end dates are required.");
      return;
    }
    if (new Date(form.endDate) < new Date(form.startDate)) {
      setSubmitError("End date must be on or after the start date.");
      return;
    }

    const capacity = Number.parseInt(form.capacity, 10);
    if (!Number.isFinite(capacity) || capacity < 1) {
      setSubmitError("Maximum capacity must be at least 1.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        coach_id: coachId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        start_date: form.startDate,
        end_date: form.endDate,
        start_time: form.startTime.length === 5 ? `${form.startTime}:00` : form.startTime,
        end_time: form.endTime.length === 5 ? `${form.endTime}:00` : form.endTime,
        age_group: form.ageGroup.trim() || null,
        capacity,
        price: parsePrice(form.price),
        location: form.location.trim() || null,
        notes: form.notes.trim() || null,
      };

      const { data, error: insertError } = await supabase
        .from("camps")
        .insert(payload)
        .select(
          "id, coach_id, name, description, start_date, end_date, start_time, end_time, age_group, capacity, price, location, notes, created_at",
        )
        .single();

      if (insertError) {
        setSubmitError(insertError.message);
        return;
      }

      if (data) {
        const row = data as CampRow;
        setCamps((cur) => [
          {
            ...row,
            enrolled: 0,
            waitlist: 0,
            remaining: row.capacity,
          },
          ...cur,
        ]);
        setForm(defaultForm);
      }
    } catch (caughtError: unknown) {
      setSubmitError(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(campId: string) {
    if (!coachId) {
      setSubmitError("You must be signed in to delete a camp.");
      return;
    }
    if (!window.confirm("Delete this camp? Enrolment records for this camp will be removed.")) {
      return;
    }

    setSubmitError(null);
    setDeletingId(campId);
    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from("camps")
        .delete()
        .eq("id", campId)
        .eq("coach_id", coachId);

      if (deleteError) {
        setSubmitError(deleteError.message);
        return;
      }

      setCamps((cur) => cur.filter((c) => c.id !== campId));
    } catch (caughtError: unknown) {
      setSubmitError(getErrorMessage(caughtError));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-10">
      <FeaturePageHeader
        featureKey="camps"
        title="Camps"
        subtitle="Create holiday blocks, set capacity and pricing, and track enrolments and waitlists."
      />

      <section className="glass-panel rounded-2xl p-5 sm:p-6">
        <p className="text-sm font-medium">Camp migration stays in phase 2.</p>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          Camps continue to run on the current camp workflow while the new booking system
          rolls out for 1-to-1 and Group Session bookings first. Once phase 1 is stable,
          CoachFlow can decide whether camps should be generated from availability templates
          or move into the same `session_bookings` model as a specialised product.
        </p>
      </section>

      {setupTables.length > 0 ? (
        <SetupRequiredPanel
          {...getSetupRequiredMessage(setupTables)}
          tables={setupTables}
        />
      ) : null}

      {setupTables.length === 0 ? (
      <>
      <section className="glass-panel rounded-2xl p-6 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-8">
        <div className="flex items-start gap-3">
          <div className="bg-accent/10 ring-accent/20 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
            <CalendarRange className="text-accent size-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Create camp</h2>
            <p className="text-muted mt-1 text-sm">
              New camps are saved to your Supabase project and visible only to your account.
            </p>
          </div>
        </div>

        <form className="mt-8 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium" htmlFor="campName">
              Camp name <span className="text-red-500">*</span>
            </label>
            <input
              id="campName"
              required
              value={form.name}
              onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 dark:ring-offset-background"
              placeholder="e.g. Easter Skills Camp"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium" htmlFor="campDescription">
              Description
            </label>
            <textarea
              id="campDescription"
              value={form.description}
              onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
              className="border-border bg-background text-foreground focus:ring-accent/40 min-h-20 w-full rounded-xl border px-3 py-2 text-sm outline-none ring-offset-2 focus:ring-2 dark:ring-offset-background"
              placeholder="What parents can expect, focus areas, kit list…"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="startDate">
              Start date <span className="text-red-500">*</span>
            </label>
            <input
              id="startDate"
              type="date"
              required
              value={form.startDate}
              onChange={(e) => setForm((c) => ({ ...c, startDate: e.target.value }))}
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 dark:ring-offset-background"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="endDate">
              End date <span className="text-red-500">*</span>
            </label>
            <input
              id="endDate"
              type="date"
              required
              value={form.endDate}
              onChange={(e) => setForm((c) => ({ ...c, endDate: e.target.value }))}
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 dark:ring-offset-background"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="dailyStart">
              Daily start time <span className="text-red-500">*</span>
            </label>
            <input
              id="dailyStart"
              type="time"
              required
              value={form.startTime}
              onChange={(e) => setForm((c) => ({ ...c, startTime: e.target.value }))}
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 dark:ring-offset-background"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="dailyEnd">
              Daily end time <span className="text-red-500">*</span>
            </label>
            <input
              id="dailyEnd"
              type="time"
              required
              value={form.endTime}
              onChange={(e) => setForm((c) => ({ ...c, endTime: e.target.value }))}
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 dark:ring-offset-background"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="ageGroup">
              Age group
            </label>
            <input
              id="ageGroup"
              value={form.ageGroup}
              onChange={(e) => setForm((c) => ({ ...c, ageGroup: e.target.value }))}
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 dark:ring-offset-background"
              placeholder="e.g. U10–U12"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="capacity">
              Maximum capacity <span className="text-red-500">*</span>
            </label>
            <input
              id="capacity"
              type="number"
              min={1}
              required
              value={form.capacity}
              onChange={(e) => setForm((c) => ({ ...c, capacity: e.target.value }))}
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 dark:ring-offset-background"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="price">
              Price (£)
            </label>
            <input
              id="price"
              type="text"
              inputMode="decimal"
              value={form.price}
              onChange={(e) => setForm((c) => ({ ...c, price: e.target.value }))}
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 dark:ring-offset-background"
              placeholder="e.g. 120 or 120.00"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="location">
              Location
            </label>
            <input
              id="location"
              value={form.location}
              onChange={(e) => setForm((c) => ({ ...c, location: e.target.value }))}
              className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2 dark:ring-offset-background"
              placeholder="e.g. Main pitch, Sports Centre"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium" htmlFor="campNotes">
              Notes
            </label>
            <textarea
              id="campNotes"
              value={form.notes}
              onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))}
              className="border-border bg-background text-foreground focus:ring-accent/40 min-h-24 w-full rounded-xl border px-3 py-2 text-sm outline-none ring-offset-2 focus:ring-2 dark:ring-offset-background"
              placeholder="Staff briefing, safeguarding, equipment…"
            />
          </div>

          {submitError ? (
            <p className="sm:col-span-2 text-sm text-red-600 dark:text-red-400">{submitError}</p>
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
                  Saving camp…
                </>
              ) : (
                "Save camp"
              )}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Your camps</h2>
          {!loading && hasCamps ? (
            <span className="text-muted text-sm">{camps.length} total</span>
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
            Loading camps…
          </div>
        ) : null}

        {!loading && !error && !hasCamps ? (
          <div className="glass-panel rounded-2xl p-10 text-center">
            <CalendarRange className="text-muted mx-auto size-10" aria-hidden />
            <p className="mt-4 font-medium">No camps yet</p>
            <p className="text-muted mt-1 text-sm">
              Run the Supabase migration for <code className="text-foreground">camps</code> and{" "}
              <code className="text-foreground">camp_enrolments</code>, then create your first block
              above.
            </p>
          </div>
        ) : null}

        {!loading && !error && hasCamps ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {camps.map((camp) => {
              const priceNum =
                typeof camp.price === "number" ? camp.price : Number.parseFloat(String(camp.price));
              return (
                <article
                  key={camp.id}
                  className="glass-panel relative overflow-hidden rounded-2xl p-6 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:p-7"
                >
                  <div className="from-accent/6 pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent to-transparent" />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold tracking-tight">{camp.name}</h3>
                      {camp.age_group ? (
                        <p className="text-muted mt-1 text-xs font-medium uppercase tracking-wide">
                          {camp.age_group}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      disabled={deletingId === camp.id}
                      onClick={() => void handleDelete(camp.id)}
                      className="text-muted hover:text-red-500 inline-flex shrink-0 items-center justify-center rounded-xl p-2 transition-colors disabled:opacity-60"
                      aria-label={`Delete ${camp.name}`}
                    >
                      {deletingId === camp.id ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <Trash2 className="size-4" aria-hidden />
                      )}
                    </button>
                  </div>

                  <p className="text-muted relative mt-3 text-sm leading-relaxed">
                    {camp.description ?? "No description"}
                  </p>

                  <dl className="relative mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <div className="rounded-xl bg-black/[0.03] px-3 py-2.5 dark:bg-white/[0.04]">
                      <dt className="text-muted text-xs font-medium">Dates</dt>
                      <dd className="mt-0.5 font-medium">
                        {formatDate(camp.start_date)} – {formatDate(camp.end_date)}
                      </dd>
                    </div>
                    <div className="rounded-xl bg-black/[0.03] px-3 py-2.5 dark:bg-white/[0.04]">
                      <dt className="text-muted text-xs font-medium">Daily hours</dt>
                      <dd className="mt-0.5 font-medium">
                        {formatTime(camp.start_time)} – {formatTime(camp.end_time)}
                      </dd>
                    </div>
                    <div className="col-span-2 rounded-xl bg-black/[0.03] px-3 py-2.5 sm:col-span-1 dark:bg-white/[0.04]">
                      <dt className="text-muted flex items-center gap-1 text-xs font-medium">
                        <PoundSterling className="size-3" aria-hidden />
                        Price
                      </dt>
                      <dd className="mt-0.5 font-medium">
                        {Number.isFinite(priceNum) ? formatPricePounds(priceNum) : "—"}
                      </dd>
                    </div>
                    {camp.location ? (
                      <div className="col-span-2 rounded-xl bg-black/[0.03] px-3 py-2.5 sm:col-span-3 dark:bg-white/[0.04]">
                        <dt className="text-muted flex items-center gap-1 text-xs font-medium">
                          <MapPin className="size-3" aria-hidden />
                          Location
                        </dt>
                        <dd className="mt-0.5">{camp.location}</dd>
                      </div>
                    ) : null}
                  </dl>

                  <div className="relative mt-5 grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-black/[0.06] px-3 py-3 text-center dark:border-white/[0.08]">
                      <Users className="text-accent mx-auto size-4" aria-hidden />
                      <p className="text-muted mt-1 text-[10px] font-medium uppercase tracking-wide">
                        Enrolled
                      </p>
                      <p className="mt-0.5 text-lg font-semibold tabular-nums">{camp.enrolled}</p>
                    </div>
                    <div className="rounded-xl border border-black/[0.06] px-3 py-3 text-center dark:border-white/[0.08]">
                      <p className="text-muted text-[10px] font-medium uppercase tracking-wide">
                        Remaining
                      </p>
                      <p className="mt-2 text-lg font-semibold tabular-nums text-accent">
                        {camp.remaining}
                      </p>
                    </div>
                    <div className="rounded-xl border border-black/[0.06] px-3 py-3 text-center dark:border-white/[0.08]">
                      <p className="text-muted text-[10px] font-medium uppercase tracking-wide">
                        Waitlist
                      </p>
                      <p className="mt-2 text-lg font-semibold tabular-nums">{camp.waitlist}</p>
                    </div>
                  </div>

                  {camp.notes ? (
                    <p className="text-muted relative mt-4 rounded-xl bg-black/[0.02] p-3 text-xs leading-relaxed dark:bg-white/[0.03]">
                      {camp.notes}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
      </>
      ) : null}
    </div>
  );
}
