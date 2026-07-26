"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarRange, Loader2, Trash2 } from "lucide-react";
import { CampHubPanel } from "@/components/camp-hub-panel";
import { CampOverviewCard } from "@/components/camp-overview-card";
import { FeaturePageHeader } from "@/components/feature-page-header";
import { SetupRequiredPanel } from "@/components/setup-required-panel";
import {
  aggregateCampEnrolments,
  buildCampActivityTimeline,
  buildCampAttendanceConcerns,
  buildCampAttendanceSummary,
  buildCampAttendeeCards,
  buildCampHubSummaryCopy,
  buildCampIncomeSummary,
  buildCampInsightLeaders,
  buildCampLateArrivals,
  buildCampMissingReportPlayers,
  buildCampOverviewMetrics,
  buildCampReportsByPlayer,
  buildAttendanceByPlayer,
  filterCampAttendanceRows,
  getCampLinkedSessions,
  getCampPlayerIds,
  parseCampPrice,
  sumPaidCampBookingIncome,
  type CampAttendanceRow,
  type CampBookingRow,
  type CampEnrolmentRow,
  type CampPlayerSource,
  type CampReportRow,
  type CampRow,
  type CampSessionRow,
  type CampWithStats,
} from "@/lib/camp-insights";
import { createClient } from "@/lib/supabase";
import { MIN_CAPACITY } from "@/lib/validation/constants";
import {
  getSetupRequiredMessage,
  isMissingTableError,
  resolveQueryError,
} from "@/lib/supabase-errors";
import { sanitizeDashboardSaveError } from "@/lib/user-facing-errors";
import { PanelSkeleton } from "@/components/branded-loading";

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

type CampFieldErrors = {
  name?: string;
  startDate?: string;
  endDate?: string;
  capacity?: string;
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

function parsePrice(input: string): number {
  return parseCampPrice(input);
}

export function CampsManager() {
  const searchParams = useSearchParams();
  const focusCampId = searchParams.get("camp")?.trim() ?? null;
  const focusHandledRef = useRef<string | null>(null);

  const [form, setForm] = useState<CampFormState>(defaultForm);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [camps, setCamps] = useState<CampWithStats[]>([]);
  const [enrolments, setEnrolments] = useState<CampEnrolmentRow[]>([]);
  const [sessions, setSessions] = useState<CampSessionRow[]>([]);
  const [bookings, setBookings] = useState<CampBookingRow[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<CampAttendanceRow[]>([]);
  const [reportRows, setReportRows] = useState<CampReportRow[]>([]);
  const [players, setPlayers] = useState<CampPlayerSource[]>([]);
  const [selectedCampId, setSelectedCampId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CampFieldErrors>({});
  const [setupTables, setSetupTables] = useState<string[]>([]);

  const hasCamps = useMemo(() => camps.length > 0, [camps.length]);
  const selectedCamp = useMemo(
    () => camps.find((camp) => camp.id === selectedCampId) ?? null,
    [camps, selectedCampId],
  );

  const attendanceByPlayer = useMemo(
    () => buildAttendanceByPlayer(attendanceRows),
    [attendanceRows],
  );

  const reportsByPlayer = useMemo(
    () => buildCampReportsByPlayer(reportRows),
    [reportRows],
  );

  const campHubById = useMemo(() => {
    const map = new Map<
      string,
      {
        overview: ReturnType<typeof buildCampOverviewMetrics>;
        registerSessionId: string | null;
      }
    >();

    for (const camp of camps) {
      const linkedSessions = getCampLinkedSessions(camp, sessions);
      const linkedSessionIds = new Set(linkedSessions.map((session) => session.id));
      const paidIncome = sumPaidCampBookingIncome(bookings, linkedSessionIds);
      const playerIds = getCampPlayerIds({ linkedSessions, bookings });
      const filteredAttendance = filterCampAttendanceRows(
        attendanceRows,
        linkedSessionIds,
        new Set(playerIds),
      );
      const attendanceSummary = buildCampAttendanceSummary({
        linkedSessions,
        attendanceRows: filteredAttendance,
        playerIds,
      });

      map.set(camp.id, {
        overview: buildCampOverviewMetrics(camp, paidIncome),
        registerSessionId: attendanceSummary.primarySessionId,
      });
    }

    return map;
  }, [camps, sessions, bookings, attendanceRows]);

  const currentCampHub = useMemo(() => {
    if (!selectedCamp) return null;

    const linkedSessions = getCampLinkedSessions(selectedCamp, sessions);
    const linkedSessionIds = new Set(linkedSessions.map((session) => session.id));
    const campEnrolments = enrolments.filter((row) => row.camp_id === selectedCamp.id);
    const paidIncome = sumPaidCampBookingIncome(bookings, linkedSessionIds);
    const playerIds = getCampPlayerIds({ linkedSessions, bookings });
    const filteredAttendance = filterCampAttendanceRows(
      attendanceRows,
      linkedSessionIds,
      new Set(playerIds),
    );
    const attendanceSummary = buildCampAttendanceSummary({
      linkedSessions,
      attendanceRows: filteredAttendance,
      playerIds,
    });
    const attendeeCards = buildCampAttendeeCards({
      playerIds,
      players,
      attendanceByPlayer,
      reportsByPlayer,
    });
    const concerns = buildCampAttendanceConcerns({
      cards: attendeeCards,
      attendanceByPlayer,
    });
    const missingReports = buildCampMissingReportPlayers(attendeeCards);
    const playerNameById = new Map(
      attendeeCards.map((card) => [card.playerId, card.playerName]),
    );

    return {
      summaryCopy: buildCampHubSummaryCopy({
        camp: selectedCamp,
        attendanceRate: attendanceSummary.averageRate,
        attendeeCount: attendeeCards.length,
        concernCount: concerns.length,
        missingReportCount: missingReports.length,
      }),
      incomeSummary: buildCampIncomeSummary({
        camp: selectedCamp,
        paidBookingIncome: paidIncome,
        averageAttendanceRate: attendanceSummary.averageRate,
      }),
      attendance: attendanceSummary,
      attendeeCards,
      leaders: buildCampInsightLeaders(attendeeCards),
      missingReports,
      concerns,
      lateArrivals: buildCampLateArrivals({
        cards: attendeeCards,
        attendanceRows: filteredAttendance,
        linkedSessionIds,
      }),
      timeline: buildCampActivityTimeline({
        camp: selectedCamp,
        enrolments: campEnrolments,
        bookings,
        linkedSessionIds,
        attendanceRows: filteredAttendance,
        reports: reportRows.filter((report) => playerIds.includes(report.player_id)),
        playerNameById,
      }),
      linkedSessionCount: linkedSessions.length,
    };
  }, [
    selectedCamp,
    sessions,
    enrolments,
    bookings,
    attendanceRows,
    reportRows,
    players,
    attendanceByPlayer,
    reportsByPlayer,
  ]);

  const loadCoachData = useCallback(async (userId: string, preferredCampId?: string | null) => {
    setLoading(true);
    setError(null);
    setSetupTables([]);
    try {
      const supabase = createClient();
      const [
        { data: campRows, error: campsError },
        { data: enrolRows, error: enError },
        { data: sessionRows, error: sessionsError },
        { data: bookingRows, error: bookingsError },
        { data: attendanceData, error: attendanceError },
        { data: reportData, error: reportsError },
        { data: playerRows, error: playersError },
      ] = await Promise.all([
        supabase
          .from("camps")
          .select(
            "id, coach_id, name, description, start_date, end_date, start_time, end_time, age_group, capacity, price, location, notes, created_at, website_visible",
          )
          .eq("coach_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("camp_enrolments")
          .select("id, camp_id, status, created_at")
          .eq("coach_id", userId),
        supabase
          .from("sessions")
          .select("id, session_date, group_name, session_type, session_players(player_id)")
          .eq("coach_id", userId),
        supabase
          .from("session_bookings")
          .select(
            "id, session_id, player_id, booking_status, payment_status, amount, created_at",
          )
          .eq("coach_id", userId),
        supabase
          .from("session_attendance")
          .select("session_id, player_id, status, recorded_at")
          .eq("coach_id", userId),
        supabase
          .from("progress_reports")
          .select("id, player_id, created_at")
          .eq("coach_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("players")
          .select(
            "id, player_name, primary_position, parent_email, team_players(team:teams(id, team_name, age_group, team_color))",
          )
          .eq("coach_id", userId),
      ]);

      if (campsError) {
        if (isMissingTableError(campsError)) {
          setSetupTables(["camps", "camp_enrolments"]);
          return;
        }
        setError(resolveQueryError(campsError, "camps").message);
        return;
      }

      const list = (campRows ?? []) as CampRow[];
      const enrolmentList = (enrolRows ?? []) as CampEnrolmentRow[];

      setEnrolments(enrolmentList);
      setSessions((sessionRows ?? []) as CampSessionRow[]);
      setBookings((bookingRows ?? []) as CampBookingRow[]);
      setAttendanceRows((attendanceData ?? []) as CampAttendanceRow[]);
      setReportRows((reportData ?? []) as CampReportRow[]);
      setPlayers((playerRows ?? []) as CampPlayerSource[]);

      if (enError && !isMissingTableError(enError)) {
        setError(enError.message);
        return;
      }

      const aggregated = aggregateCampEnrolments(list, enrolmentList);
      setCamps(aggregated);
      setSelectedCampId((current) => {
        const nextId = preferredCampId ?? current;
        if (nextId && aggregated.some((camp) => camp.id === nextId)) return nextId;
        return aggregated[0]?.id ?? null;
      });

      if (sessionsError || bookingsError || attendanceError || reportsError || playersError) {
        const optionalError =
          sessionsError?.message ??
          bookingsError?.message ??
          attendanceError?.message ??
          reportsError?.message ??
          playersError?.message;
        if (optionalError) setError(optionalError);
      }
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
    if (!focusCampId || loading || camps.length === 0) return;
    if (focusHandledRef.current === focusCampId) return;
    if (!camps.some((camp) => camp.id === focusCampId)) return;
    focusHandledRef.current = focusCampId;
    const frame = window.requestAnimationFrame(() => {
      setSelectedCampId(focusCampId);
      document.getElementById("camp-hub-panel")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusCampId, loading, camps]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!coachId) {
      setSubmitError("You must be signed in to create a camp.");
      return;
    }

    setSubmitError(null);

    const nextFieldErrors: CampFieldErrors = {};
    if (!form.name.trim()) {
      nextFieldErrors.name = "Camp name is required.";
    }
    if (!form.startDate) {
      nextFieldErrors.startDate = "Start date is required.";
    }
    if (!form.endDate) {
      nextFieldErrors.endDate = "End date is required.";
    }
    if (
      form.startDate &&
      form.endDate &&
      new Date(form.endDate) < new Date(form.startDate)
    ) {
      nextFieldErrors.endDate = "End date must be on or after the start date.";
    }

    const capacity = Number.parseInt(form.capacity, 10);
    if (!Number.isFinite(capacity) || capacity < MIN_CAPACITY) {
      nextFieldErrors.capacity = `Maximum capacity must be at least ${MIN_CAPACITY}.`;
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setFieldErrors({});
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
        website_visible: false,
      };

      const { data, error: insertError } = await supabase
        .from("camps")
        .insert(payload)
        .select(
          "id, coach_id, name, description, start_date, end_date, start_time, end_time, age_group, capacity, price, location, notes, created_at, website_visible",
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
            revenue: 0,
          },
          ...cur,
        ]);
        setSelectedCampId(row.id);
        setForm(defaultForm);
        setFieldErrors({});
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

      const remaining = camps.filter((camp) => camp.id !== campId);
      setCamps(remaining);
      setEnrolments((cur) => cur.filter((row) => row.camp_id !== campId));
      if (selectedCampId === campId) {
        setSelectedCampId(remaining[0]?.id ?? null);
      }
    } catch (caughtError: unknown) {
      setSubmitError(getErrorMessage(caughtError));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="page-content-enter space-y-10">
      <FeaturePageHeader
        featureKey="camps"
        title="Holiday Camps"
        subtitle="Run holiday clubs as academy events — bookings, attendance, income, and development reports."
      />

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
              onChange={(e) => {
                setForm((c) => ({ ...c, name: e.target.value }));
                if (fieldErrors.name) setFieldErrors((c) => ({ ...c, name: undefined }));
              }}
              aria-invalid={fieldErrors.name ? true : undefined}
              aria-describedby={fieldErrors.name ? "campName-error" : undefined}
              className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2 dark:ring-offset-background"
              placeholder="e.g. Easter Skills Camp"
            />
            {fieldErrors.name ? (
              <p
                id="campName-error"
                role="alert"
                className="mt-2 break-words text-sm text-red-600 dark:text-red-400"
              >
                {fieldErrors.name}
              </p>
            ) : null}
          </div>

          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium" htmlFor="campDescription">
              Description
            </label>
            <textarea
              id="campDescription"
              value={form.description}
              onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
              className="border-border bg-background text-foreground focus-visible:ring-accent/40 min-h-20 w-full rounded-xl border px-3 py-2 text-sm outline-none ring-offset-2 focus-visible:ring-2 dark:ring-offset-background"
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
              onChange={(e) => {
                setForm((c) => ({ ...c, startDate: e.target.value }));
                if (fieldErrors.startDate) setFieldErrors((c) => ({ ...c, startDate: undefined }));
              }}
              aria-invalid={fieldErrors.startDate ? true : undefined}
              aria-describedby={fieldErrors.startDate ? "startDate-error" : undefined}
              className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2 dark:ring-offset-background"
            />
            {fieldErrors.startDate ? (
              <p
                id="startDate-error"
                role="alert"
                className="mt-2 break-words text-sm text-red-600 dark:text-red-400"
              >
                {fieldErrors.startDate}
              </p>
            ) : null}
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
              onChange={(e) => {
                setForm((c) => ({ ...c, endDate: e.target.value }));
                if (fieldErrors.endDate) setFieldErrors((c) => ({ ...c, endDate: undefined }));
              }}
              aria-invalid={fieldErrors.endDate ? true : undefined}
              aria-describedby={fieldErrors.endDate ? "endDate-error" : undefined}
              className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2 dark:ring-offset-background"
            />
            {fieldErrors.endDate ? (
              <p
                id="endDate-error"
                role="alert"
                className="mt-2 break-words text-sm text-red-600 dark:text-red-400"
              >
                {fieldErrors.endDate}
              </p>
            ) : null}
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
              className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2 dark:ring-offset-background"
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
              className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2 dark:ring-offset-background"
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
              className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2 dark:ring-offset-background"
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
              min={MIN_CAPACITY}
              required
              value={form.capacity}
              onChange={(e) => {
                setForm((c) => ({ ...c, capacity: e.target.value }));
                if (fieldErrors.capacity) setFieldErrors((c) => ({ ...c, capacity: undefined }));
              }}
              aria-invalid={fieldErrors.capacity ? true : undefined}
              aria-describedby={fieldErrors.capacity ? "capacity-error" : undefined}
              className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2 dark:ring-offset-background"
            />
            {fieldErrors.capacity ? (
              <p
                id="capacity-error"
                role="alert"
                className="mt-2 break-words text-sm text-red-600 dark:text-red-400"
              >
                {fieldErrors.capacity}
              </p>
            ) : null}
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
              className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2 dark:ring-offset-background"
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
              className="border-border bg-background text-foreground focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2 dark:ring-offset-background"
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
              className="border-border bg-background text-foreground focus-visible:ring-accent/40 min-h-24 w-full rounded-xl border px-3 py-2 text-sm outline-none ring-offset-2 focus-visible:ring-2 dark:ring-offset-background"
              placeholder="Staff briefing, safeguarding, equipment…"
            />
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
                  Saving camp…
                </>
              ) : (
                "Save camp"
              )}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-6" aria-labelledby="camps-overview-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="camps-overview-heading" className="text-lg font-semibold tracking-tight">
            Your camps
          </h2>
          {!loading && hasCamps ? (
            <span className="text-muted text-sm">{camps.length} total</span>
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

        {!loading && !error && !hasCamps ? (
          <div className="football-panel football-panel-interactive rounded-2xl p-10 text-center">
            <CalendarRange className="text-muted mx-auto size-10" aria-hidden />
            <p className="mt-4 font-medium">Create your first camp or holiday club.</p>
            <p className="text-muted mx-auto mt-2 max-w-md text-sm leading-relaxed">
              Use the form above to set dates, capacity, and pricing. Once published, share your
              booking page with parents to fill spaces.
            </p>
          </div>
        ) : null}

        {!loading && !error && hasCamps ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {camps.map((camp) => {
              const hubData = campHubById.get(camp.id);
              if (!hubData) return null;
              return (
                <div key={camp.id} className="relative">
                  <CampOverviewCard
                    camp={camp}
                    metrics={hubData.overview}
                    registerSessionId={hubData.registerSessionId}
                    selected={selectedCampId === camp.id}
                    onSelect={() => setSelectedCampId(camp.id)}
                  />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
                    <label className="text-muted inline-flex min-h-11 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(camp.website_visible)}
                        onChange={(event) => {
                          void (async () => {
                            const next = event.target.checked;
                            const supabase = createClient();
                            const { error: updateError } = await supabase
                              .from("camps")
                              .update({ website_visible: next })
                              .eq("id", camp.id)
                              .eq("coach_id", coachId);
                            if (updateError) {
                              setError(
                                sanitizeDashboardSaveError(updateError, {
                                  logLabel: "camps-website-visible",
                                }),
                              );
                              return;
                            }
                            setCamps((current) =>
                              current.map((item) =>
                                item.id === camp.id
                                  ? { ...item, website_visible: next }
                                  : item,
                              ),
                            );
                          })();
                        }}
                        className="accent-[var(--accent)] size-4 rounded"
                      />
                      Show on website
                    </label>
                    <button
                      type="button"
                      disabled={deletingId === camp.id}
                      onClick={() => void handleDelete(camp.id)}
                      className="text-muted hover:text-red-500 focus-visible:ring-accent/40 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
                    >
                      {deletingId === camp.id ? (
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

      {selectedCamp && currentCampHub ? (
        <div id="camp-hub-panel" className="space-y-6">
          <CampHubPanel
            camp={selectedCamp}
            summaryCopy={currentCampHub.summaryCopy}
            incomeSummary={currentCampHub.incomeSummary}
            attendance={currentCampHub.attendance}
            attendeeCards={currentCampHub.attendeeCards}
            leaders={currentCampHub.leaders}
            missingReports={currentCampHub.missingReports}
            concerns={currentCampHub.concerns}
            lateArrivals={currentCampHub.lateArrivals}
            timeline={currentCampHub.timeline}
            linkedSessionCount={currentCampHub.linkedSessionCount}
            loading={loading}
          />
        </div>
      ) : null}
      </>
      ) : null}
    </div>
  );
}
