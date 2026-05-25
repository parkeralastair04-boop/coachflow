"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ArrowRight,
  CalendarCheck,
  Clock3,
  Loader2,
  MapPin,
  PoundSterling,
  RefreshCw,
  Repeat,
  Users,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { FeatureInfoTooltip } from "@/components/feature-info-tooltip";
import {
  formatMinutes,
  formatPoundsFromPence,
  getDayLabel,
  type PublicRecurringSeriesRow,
  type PublicSessionRow,
} from "@/lib/booking-system";
import {
  getPortalQueryValue,
  type PublicBookingPayload,
  type PublicPortal,
  type PublicPortalTenant,
} from "@/lib/public-booking";
import { cn } from "@/lib/utils";

type BookingPortalProps = {
  tenant: PublicPortalTenant;
  initialQuery: {
    booking?: string | null;
    subscription?: string | null;
    checkoutSessionId?: string | null;
  };
};

type BookingResponse = {
  bookingId?: string | null;
  checkoutUrl?: string | null;
  status?: "pending" | "confirmed" | "waitlist" | "cancelled";
  error?: string;
};

type RecurringCheckoutResponse = {
  enrolmentId?: string | null;
  checkoutUrl?: string | null;
  error?: string;
};

type BookingPortalResponse = PublicBookingPayload & {
  error?: string;
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

function formatSessionDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function getSessionTitle(session: PublicSessionRow): string {
  return session.group_name?.trim() || session.session_type?.trim() || "Coaching session";
}

function getTenantPath(tenant: PublicPortalTenant) {
  return tenant.kind === "coach"
    ? `/book/${tenant.slug}`
    : `/academy/${tenant.slug}/book`;
}

export function BookingPortal({ tenant, initialQuery }: BookingPortalProps) {
  const [portal, setPortal] = useState<PublicPortal | null>(null);
  const [sessions, setSessions] = useState<PublicSessionRow[]>([]);
  const [recurringSeries, setRecurringSeries] = useState<PublicRecurringSeriesRow[]>([]);
  const [selectedType, setSelectedType] = useState<"session" | "recurring">("session");
  const [selectedId, setSelectedId] = useState("");
  const [childName, setChildName] = useState("");
  const [childDateOfBirth, setChildDateOfBirth] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmingCheckout, setConfirmingCheckout] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedSession = useMemo(
    () =>
      selectedType === "session"
        ? sessions.find((session) => session.session_id === selectedId) ?? null
        : null,
    [selectedId, selectedType, sessions],
  );

  const selectedRecurringSeries = useMemo(
    () =>
      selectedType === "recurring"
        ? recurringSeries.find((series) => series.recurring_series_id === selectedId) ?? null
        : null,
    [recurringSeries, selectedId, selectedType],
  );

  const brandStyle = portal
    ? ({
        "--accent": portal.primary_color,
        "--accent-dim": `${portal.primary_color}24`,
        "--ring-glow": `${portal.primary_color}66`,
      } as CSSProperties)
    : undefined;

  const portalName = portal?.display_name ?? "CoachFlow";
  const portalQuery = getPortalQueryValue(tenant);

  const fetchPortalData = useCallback(
    async (silent = false) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const response = await fetch(`/api/bookings?${portalQuery}`);
        const payload = (await response.json()) as BookingPortalResponse;

        if (!response.ok) {
          setError(payload.error ?? "Could not load booking portal.");
          return;
        }

        const nextSessions = payload.sessions ?? [];
        const nextRecurringSeries = payload.recurringSeries ?? [];
        setPortal(payload.portal);
        setSessions(nextSessions);
        setRecurringSeries(nextRecurringSeries);
        setSelectedId((current) => {
          const selectedSessionExists = nextSessions.some(
            (session) => session.session_id === current,
          );
          const selectedSeriesExists = nextRecurringSeries.some(
            (series) => series.recurring_series_id === current,
          );

          if (
            (selectedType === "session" && selectedSessionExists) ||
            (selectedType === "recurring" && selectedSeriesExists)
          ) {
            return current;
          }

          if (nextSessions[0]) {
            setSelectedType("session");
            return nextSessions[0].session_id;
          }
          if (nextRecurringSeries[0]) {
            setSelectedType("recurring");
            return nextRecurringSeries[0].recurring_series_id;
          }
          return "";
        });
      } catch (caughtError: unknown) {
        setError(getErrorMessage(caughtError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [portalQuery, selectedType],
  );

  useEffect(() => {
    let cancelled = false;

    async function initPortal() {
      try {
        const response = await fetch(`/api/bookings?${portalQuery}`);
        const payload = (await response.json()) as BookingPortalResponse;

        if (cancelled) return;
        if (!response.ok) {
          setError(payload.error ?? "Could not load booking portal.");
          setLoading(false);
          return;
        }

        const nextSessions = payload.sessions ?? [];
        const nextRecurringSeries = payload.recurringSeries ?? [];
        setPortal(payload.portal);
        setSessions(nextSessions);
        setRecurringSeries(nextRecurringSeries);

        if (nextSessions[0]) {
          setSelectedType("session");
          setSelectedId(nextSessions[0].session_id);
        } else if (nextRecurringSeries[0]) {
          setSelectedType("recurring");
          setSelectedId(nextRecurringSeries[0].recurring_series_id);
        } else {
          setSelectedId("");
        }

        setLoading(false);
      } catch (caughtError: unknown) {
        if (!cancelled) {
          setError(getErrorMessage(caughtError));
          setLoading(false);
        }
      }
    }

    void initPortal();
    return () => {
      cancelled = true;
    };
  }, [portalQuery]);

  useEffect(() => {
    if (initialQuery.booking !== "success" || !initialQuery.checkoutSessionId) return;

    let cancelled = false;

    async function confirmOneOffBooking() {
      setConfirmingCheckout(true);
      setError(null);
      try {
        const response = await fetch("/api/bookings/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkoutSessionId: initialQuery.checkoutSessionId }),
        });
        const payload = (await response.json()) as {
          confirmedNow?: boolean;
          error?: string;
        };

        if (!response.ok) {
          if (!cancelled) {
            setError(payload.error ?? "Could not confirm payment.");
          }
          return;
        }

        if (!cancelled) {
          setSuccess(
            payload.confirmedNow
              ? "Payment received and booking confirmed. A confirmation email is on the way."
              : "Your booking was already confirmed.",
          );
          await fetchPortalData(true);
          window.history.replaceState({}, "", getTenantPath(tenant));
        }
      } catch (caughtError: unknown) {
        if (!cancelled) {
          setError(getErrorMessage(caughtError));
        }
      } finally {
        if (!cancelled) {
          setConfirmingCheckout(false);
        }
      }
    }

    void confirmOneOffBooking();
    return () => {
      cancelled = true;
    };
  }, [fetchPortalData, initialQuery.booking, initialQuery.checkoutSessionId, tenant]);

  useEffect(() => {
    if (initialQuery.subscription !== "success" || !initialQuery.checkoutSessionId) return;

    let cancelled = false;

    async function confirmRecurringSubscription() {
      setConfirmingCheckout(true);
      setError(null);
      try {
        const response = await fetch("/api/bookings/recurring/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkoutSessionId: initialQuery.checkoutSessionId }),
        });
        const payload = (await response.json()) as {
          recurringStatus?: string;
          error?: string;
        };

        if (!response.ok) {
          if (!cancelled) {
            setError(payload.error ?? "Could not confirm recurring subscription.");
          }
          return;
        }

        if (!cancelled) {
          setSuccess(
            payload.recurringStatus === "active"
              ? "Recurring subscription confirmed. Future weekly sessions will be added to the register automatically."
              : "Recurring subscription was recorded.",
          );
          await fetchPortalData(true);
          window.history.replaceState({}, "", getTenantPath(tenant));
        }
      } catch (caughtError: unknown) {
        if (!cancelled) {
          setError(getErrorMessage(caughtError));
        }
      } finally {
        if (!cancelled) {
          setConfirmingCheckout(false);
        }
      }
    }

    void confirmRecurringSubscription();
    return () => {
      cancelled = true;
    };
  }, [fetchPortalData, initialQuery.subscription, initialQuery.checkoutSessionId, tenant]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedType === "session" && !selectedSession) {
      setError("Please choose a session before booking.");
      return;
    }
    if (selectedType === "recurring" && !selectedRecurringSeries) {
      setError("Please choose a recurring coaching option.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (selectedType === "session" && selectedSession) {
        const response = await fetch(`/api/bookings?${portalQuery}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: selectedSession.session_id,
            childName,
            childDateOfBirth,
            parentName,
            parentEmail,
            parentPhone,
            notes,
          }),
        });
        const payload = (await response.json()) as BookingResponse;
        if (!response.ok) {
          setError(payload.error ?? "Could not submit booking.");
          return;
        }

        if (payload.checkoutUrl) {
          window.location.href = payload.checkoutUrl;
          return;
        }

        setSuccess(
          payload.status === "waitlist"
            ? "This session is full, so your child has been added to the waitlist."
            : "Booking confirmed. Please check your email for the session details.",
        );
      }

      if (selectedType === "recurring" && selectedRecurringSeries) {
        const response = await fetch(`/api/bookings/recurring?${portalQuery}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recurringSeriesId: selectedRecurringSeries.recurring_series_id,
            childName,
            childDateOfBirth,
            parentName,
            parentEmail,
            parentPhone,
            notes,
          }),
        });
        const payload = (await response.json()) as RecurringCheckoutResponse;
        if (!response.ok) {
          setError(payload.error ?? "Could not create recurring subscription.");
          return;
        }

        if (payload.checkoutUrl) {
          window.location.href = payload.checkoutUrl;
          return;
        }

        setSuccess("Recurring subscription started.");
      }

      setChildName("");
      setChildDateOfBirth("");
      setParentName("");
      setParentEmail("");
      setParentPhone("");
      setNotes("");
      await fetchPortalData(true);
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setSubmitting(false);
    }
  }

  const submitLabel = selectedSession
    ? selectedSession.is_full
      ? "Join waitlist"
      : selectedSession.price > 0
        ? `Pay ${formatPoundsFromPence(selectedSession.price)} and book`
        : "Confirm booking"
    : selectedRecurringSeries
      ? `Subscribe from ${formatPoundsFromPence(
          selectedRecurringSeries.monthly_price,
          selectedRecurringSeries.currency.toUpperCase(),
        )} / month`
      : "Complete booking";

  return (
    <div className="flex min-h-full flex-col" style={brandStyle}>
      <header className="border-b border-black/[0.06] px-4 py-5 dark:border-white/[0.08] sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <BrandLogo
            src={portal?.logo_url ?? "/logo.png"}
            alt={portalName}
            size="navbar"
            priority
          />
          <a
            href="#booking-form"
            className="bg-foreground text-background hover:opacity-90 inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium transition-opacity"
          >
            Start booking
          </a>
        </div>
      </header>

      <main className="flex-1">
        <section className="mesh-gradient border-b border-black/[0.06] px-4 py-16 dark:border-white/[0.08] sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="text-accent mb-4 flex items-center gap-2 text-sm font-medium tracking-wide uppercase">
                {tenant.kind === "coach" ? "Coach portal" : "Academy portal"}
                <FeatureInfoTooltip featureKey="booking-portal" />
              </p>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                Book coaching with {portalName}.
              </h1>
              <p className="text-muted mt-6 max-w-xl text-lg leading-relaxed">
                Choose a one-off public session or a recurring monthly coaching subscription,
                all scoped to this coach or academy portal with live branding, pricing, and
                availability.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#products"
                  className="border-border hover:bg-black/[0.03] inline-flex h-12 items-center justify-center rounded-full border px-8 text-sm font-medium transition-colors dark:hover:bg-white/[0.06]"
                >
                  View options
                </a>
                <a
                  href="#booking-form"
                  className="bg-accent text-white hover:opacity-90 inline-flex h-12 items-center justify-center rounded-full px-8 text-sm font-medium transition-opacity"
                >
                  Choose option
                  <ArrowRight className="ml-2 size-4" aria-hidden />
                </a>
              </div>
            </div>

            <div className="glass-panel rounded-3xl p-6 sm:p-8">
              <CalendarCheck className="text-accent size-10" aria-hidden />
              <h2 className="mt-5 text-2xl font-semibold tracking-tight">
                Multi-tenant public booking
              </h2>
              <p className="text-muted mt-3 text-sm leading-relaxed">
                This portal only shows coaching products for the current {tenant.kind}. One-off
                sessions use per-child checkout, and recurring options bill monthly through Stripe.
              </p>
              <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-black/[0.03] p-4 dark:bg-white/[0.04]">
                  <dt className="text-muted">One-off sessions</dt>
                  <dd className="mt-1 text-xl font-semibold">{sessions.length}</dd>
                </div>
                <div className="rounded-2xl bg-black/[0.03] p-4 dark:bg-white/[0.04]">
                  <dt className="text-muted">Recurring options</dt>
                  <dd className="mt-1 text-xl font-semibold">{recurringSeries.length}</dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() => void fetchPortalData(true)}
                className="border-border hover:bg-black/[0.03] mt-5 inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors dark:hover:bg-white/[0.06]"
              >
                {refreshing ? (
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="mr-2 size-4" aria-hidden />
                )}
                Refresh availability
              </button>
            </div>
          </div>
        </section>

        <section id="products" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl space-y-14">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">One-off public sessions</h2>
              <p className="text-muted mt-3 max-w-2xl text-base leading-relaxed">
                Upcoming paid or free sessions with live remaining spaces and automatic waitlists.
              </p>

              {loading ? (
                <div className="glass-panel mt-10 flex items-center gap-3 rounded-2xl p-6 text-sm">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Loading booking options...
                </div>
              ) : null}

              {!loading && sessions.length === 0 ? (
                <div className="glass-panel mt-10 rounded-3xl p-8 text-center">
                  <CalendarCheck className="text-muted mx-auto size-8" aria-hidden />
                  <p className="mt-3 font-medium">No public sessions are live right now</p>
                  <p className="text-muted mt-1 text-sm">
                    New public sessions will appear here when booking is enabled.
                  </p>
                </div>
              ) : null}

              {!loading && sessions.length > 0 ? (
                <div className="mt-10 grid gap-4 lg:grid-cols-3">
                  {sessions.map((session) => (
                    <article
                      key={session.session_id}
                      className={cn(
                        "glass-panel flex flex-col rounded-2xl p-6 transition-colors",
                        selectedType === "session" &&
                          selectedId === session.session_id &&
                          "ring-accent/30 ring-2",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold">{getSessionTitle(session)}</h3>
                          <p className="text-muted mt-1 text-sm">
                            {formatSessionDate(session.session_date)}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1",
                            session.is_full
                              ? "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300"
                              : "bg-accent/10 text-accent ring-accent/20",
                          )}
                        >
                          {session.is_full
                            ? "Waitlist only"
                            : `${session.remaining_spaces} spaces left`}
                        </span>
                      </div>

                      <div className="mt-5 grid gap-3 text-sm">
                        <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
                          <p className="text-muted text-xs">Price per child</p>
                          <p className="mt-1 inline-flex items-center gap-1 font-medium">
                            <PoundSterling className="size-3.5" aria-hidden />
                            {formatPoundsFromPence(session.price)}
                          </p>
                        </div>
                        <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
                          <p className="text-muted text-xs">Session details</p>
                          <p className="mt-1 inline-flex items-center gap-1 font-medium">
                            <Clock3 className="size-3.5" aria-hidden />
                            {session.session_type ?? "Session"} · {formatMinutes(session.duration_minutes)}
                          </p>
                        </div>
                        <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
                          <p className="text-muted text-xs">Capacity</p>
                          <p className="mt-1 inline-flex items-center gap-1 font-medium">
                            <Users className="size-3.5" aria-hidden />
                            {session.capacity} total · {session.waitlist_count} waitlist
                          </p>
                        </div>
                      </div>

                      {session.location ? (
                        <p className="mt-4 inline-flex items-center gap-1.5 text-sm">
                          <MapPin className="text-muted size-3.5" aria-hidden />
                          {session.location}
                        </p>
                      ) : null}

                      {session.notes ? (
                        <p className="text-muted mt-4 rounded-xl bg-black/[0.02] p-3 text-sm dark:bg-white/[0.03]">
                          {session.notes}
                        </p>
                      ) : null}

                      <a
                        href="#booking-form"
                        onClick={() => {
                          setSelectedType("session");
                          setSelectedId(session.session_id);
                        }}
                        className="bg-foreground text-background hover:opacity-90 mt-6 inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium transition-opacity"
                      >
                        {session.is_full ? "Join waitlist" : "Choose session"}
                      </a>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>

            <div>
              <h2 className="text-3xl font-semibold tracking-tight">
                Recurring monthly subscriptions
              </h2>
              <p className="text-muted mt-3 max-w-2xl text-base leading-relaxed">
                Weekly recurring coaching products with monthly Stripe billing and automatic
                enrolment into future generated sessions.
              </p>

              {!loading && recurringSeries.length === 0 ? (
                <div className="glass-panel mt-10 rounded-3xl p-8 text-center">
                  <Repeat className="text-muted mx-auto size-8" aria-hidden />
                  <p className="mt-3 font-medium">No recurring subscriptions are live yet</p>
                  <p className="text-muted mt-1 text-sm">
                    Monthly recurring coaching offers will appear here when they are published.
                  </p>
                </div>
              ) : null}

              {!loading && recurringSeries.length > 0 ? (
                <div className="mt-10 grid gap-4 lg:grid-cols-3">
                  {recurringSeries.map((series) => (
                    <article
                      key={series.recurring_series_id}
                      className={cn(
                        "glass-panel flex flex-col rounded-2xl p-6 transition-colors",
                        selectedType === "recurring" &&
                          selectedId === series.recurring_series_id &&
                          "ring-accent/30 ring-2",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold">{series.title}</h3>
                          <p className="text-muted mt-1 text-sm">
                            {getDayLabel(series.day_of_week)} at {series.start_time.slice(0, 5)}
                          </p>
                        </div>
                        <span className="bg-accent/10 text-accent ring-accent/20 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1">
                          {series.remaining_spaces} spaces left
                        </span>
                      </div>

                      <div className="mt-5 grid gap-3 text-sm">
                        <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
                          <p className="text-muted text-xs">Monthly billing</p>
                          <p className="mt-1 inline-flex items-center gap-1 font-medium">
                            <Repeat className="size-3.5" aria-hidden />
                            {formatPoundsFromPence(
                              series.monthly_price,
                              series.currency.toUpperCase(),
                            )}
                          </p>
                        </div>
                        <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
                          <p className="text-muted text-xs">Weekly session</p>
                          <p className="mt-1 inline-flex items-center gap-1 font-medium">
                            <Clock3 className="size-3.5" aria-hidden />
                            {series.session_type} · {formatMinutes(series.duration_minutes)}
                          </p>
                        </div>
                        <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
                          <p className="text-muted text-xs">Subscribers</p>
                          <p className="mt-1 inline-flex items-center gap-1 font-medium">
                            <Users className="size-3.5" aria-hidden />
                            {series.active_subscriptions} active · {series.capacity} capacity
                          </p>
                        </div>
                      </div>

                      {series.location ? (
                        <p className="mt-4 inline-flex items-center gap-1.5 text-sm">
                          <MapPin className="text-muted size-3.5" aria-hidden />
                          {series.location}
                        </p>
                      ) : null}

                      {series.notes ? (
                        <p className="text-muted mt-4 rounded-xl bg-black/[0.02] p-3 text-sm dark:bg-white/[0.03]">
                          {series.notes}
                        </p>
                      ) : null}

                      <a
                        href="#booking-form"
                        onClick={() => {
                          setSelectedType("recurring");
                          setSelectedId(series.recurring_series_id);
                        }}
                        className="bg-foreground text-background hover:opacity-90 mt-6 inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium transition-opacity"
                      >
                        Subscribe child
                      </a>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section id="booking-form" className="px-4 pb-20 sm:px-6 lg:px-8">
          <div className="glass-panel mx-auto max-w-3xl rounded-3xl p-6 sm:p-8">
            <h2 className="text-2xl font-semibold tracking-tight">Complete your booking</h2>

            {selectedSession ? (
              <div className="mt-3 rounded-2xl bg-black/[0.02] p-4 text-sm dark:bg-white/[0.03]">
                <p className="font-medium">{getSessionTitle(selectedSession)}</p>
                <p className="text-muted mt-1">
                  {formatSessionDate(selectedSession.session_date)} ·{" "}
                  {formatPoundsFromPence(selectedSession.price)} per child ·{" "}
                  {selectedSession.remaining_spaces} spaces left
                </p>
              </div>
            ) : null}

            {selectedRecurringSeries ? (
              <div className="mt-3 rounded-2xl bg-black/[0.02] p-4 text-sm dark:bg-white/[0.03]">
                <p className="font-medium">{selectedRecurringSeries.title}</p>
                <p className="text-muted mt-1">
                  {getDayLabel(selectedRecurringSeries.day_of_week)} at{" "}
                  {selectedRecurringSeries.start_time.slice(0, 5)} ·{" "}
                  {formatPoundsFromPence(
                    selectedRecurringSeries.monthly_price,
                    selectedRecurringSeries.currency.toUpperCase(),
                  )}{" "}
                  per month
                </p>
              </div>
            ) : null}

            <form className="mt-8 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium" htmlFor="bookingType">
                  Booking type
                </label>
                <select
                  id="bookingType"
                  value={selectedType}
                  onChange={(event) => {
                    const nextType = event.target.value as "session" | "recurring";
                    setSelectedType(nextType);
                    if (nextType === "session") {
                      setSelectedId(sessions[0]?.session_id ?? "");
                    } else {
                      setSelectedId(recurringSeries[0]?.recurring_series_id ?? "");
                    }
                  }}
                  className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
                >
                  <option value="session">One-off public session</option>
                  <option value="recurring">Recurring monthly subscription</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium" htmlFor="selection">
                  {selectedType === "session" ? "Session" : "Recurring coaching option"}
                </label>
                <select
                  id="selection"
                  value={selectedId}
                  onChange={(event) => setSelectedId(event.target.value)}
                  className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
                >
                  {selectedType === "session"
                    ? sessions.map((session) => (
                        <option key={session.session_id} value={session.session_id}>
                          {getSessionTitle(session)} · {formatSessionDate(session.session_date)}
                        </option>
                      ))
                    : recurringSeries.map((series) => (
                        <option
                          key={series.recurring_series_id}
                          value={series.recurring_series_id}
                        >
                          {series.title} · {getDayLabel(series.day_of_week)} at{" "}
                          {series.start_time.slice(0, 5)}
                        </option>
                      ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="childName">
                  Child name
                </label>
                <input
                  id="childName"
                  required
                  value={childName}
                  onChange={(event) => setChildName(event.target.value)}
                  className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="dob">
                  Child date of birth
                </label>
                <input
                  id="dob"
                  type="date"
                  value={childDateOfBirth}
                  onChange={(event) => setChildDateOfBirth(event.target.value)}
                  className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="parentName">
                  Parent name
                </label>
                <input
                  id="parentName"
                  value={parentName}
                  onChange={(event) => setParentName(event.target.value)}
                  className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="parentEmail">
                  Parent email
                </label>
                <input
                  id="parentEmail"
                  type="email"
                  required
                  value={parentEmail}
                  onChange={(event) => setParentEmail(event.target.value)}
                  className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="parentPhone">
                  Parent phone
                </label>
                <input
                  id="parentPhone"
                  type="tel"
                  value={parentPhone}
                  onChange={(event) => setParentPhone(event.target.value)}
                  className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium" htmlFor="notes">
                  Notes
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="border-border bg-background text-foreground focus:ring-accent/40 min-h-24 w-full rounded-xl border px-3 py-2 text-sm outline-none ring-offset-2 focus:ring-2"
                  placeholder="Goals, medical notes, availability requests, or anything the coach should know..."
                />
              </div>

              {selectedSession ? (
                <div className="sm:col-span-2 rounded-2xl bg-black/[0.02] p-4 text-sm dark:bg-white/[0.03]">
                  <p className="font-medium">
                    {selectedSession.is_full
                      ? "This session is full. Submitting will place your child on the waitlist."
                      : selectedSession.price > 0
                        ? "Pricing is per booked child. Stripe checkout secures the space immediately."
                        : "This session is free and will confirm immediately after submission."}
                  </p>
                </div>
              ) : null}

              {selectedRecurringSeries ? (
                <div className="sm:col-span-2 rounded-2xl bg-black/[0.02] p-4 text-sm dark:bg-white/[0.03]">
                  <p className="font-medium">
                    Monthly subscription billing will run through Stripe, and your child will be
                    auto-enrolled into the rolling weekly session series.
                  </p>
                </div>
              ) : null}

              {(error ||
                initialQuery.booking === "cancelled" ||
                initialQuery.subscription === "cancelled") &&
              !success ? (
                <p className="sm:col-span-2 text-sm text-red-600 dark:text-red-400">
                  {error ??
                    (initialQuery.subscription === "cancelled"
                      ? "Subscription checkout was cancelled before completion."
                      : "Checkout was cancelled before the booking was completed.")}
                </p>
              ) : null}

              {success ? (
                <p className="sm:col-span-2 text-sm text-accent">{success}</p>
              ) : null}

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={submitting || confirmingCheckout || !selectedId}
                  className="bg-accent text-white hover:opacity-90 inline-flex h-11 w-full items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity disabled:opacity-60 sm:w-auto"
                >
                  {submitting || confirmingCheckout ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                      {confirmingCheckout ? "Confirming..." : "Submitting..."}
                    </>
                  ) : (
                    submitLabel
                  )}
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
