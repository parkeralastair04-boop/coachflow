"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CalendarCheck,
  Clock3,
  Loader2,
  MapPin,
  PoundSterling,
  Users,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { FeatureInfoTooltip } from "@/components/feature-info-tooltip";
import type { AcademyBranding } from "@/lib/academy-shared";
import { formatMinutes, formatPoundsFromPence, type PublicSessionRow } from "@/lib/booking-system";
import { cn } from "@/lib/utils";

type BookingResponse = {
  bookingId?: string | null;
  checkoutUrl?: string | null;
  status?: "pending" | "confirmed" | "waitlist" | "cancelled";
  error?: string;
};

type BookingPortalResponse = {
  academy?: AcademyBranding | null;
  sessions?: PublicSessionRow[];
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

export function BookingPortal() {
  const searchParams = useSearchParams();
  const bookingState = searchParams.get("booking");
  const checkoutSessionId = searchParams.get("checkout_session_id");

  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [sessions, setSessions] = useState<PublicSessionRow[]>([]);
  const [childName, setChildName] = useState("");
  const [childDateOfBirth, setChildDateOfBirth] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmingCheckout, setConfirmingCheckout] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [academy, setAcademy] = useState<AcademyBranding | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.session_id === selectedSessionId) ?? null,
    [sessions, selectedSessionId],
  );

  const brandStyle = academy
    ? ({
        "--accent": academy.primary_color,
        "--accent-dim": `${academy.primary_color}24`,
        "--ring-glow": `${academy.primary_color}66`,
      } as CSSProperties)
    : undefined;

  const academyName = academy?.name ?? "CoachFlow";

  const loadPortal = useCallback(async () => {
    try {
      const response = await fetch("/api/bookings");
      const payload = (await response.json()) as BookingPortalResponse;
      if (!response.ok) {
        setError(payload.error ?? "Could not load public sessions.");
        return;
      }

      const nextSessions = payload.sessions ?? [];
      setAcademy(payload.academy ?? null);
      setSessions(nextSessions);
      setSelectedSessionId((current) =>
        current && nextSessions.some((session) => session.session_id === current)
          ? current
          : nextSessions[0]?.session_id ?? "",
      );
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initPortal() {
      try {
        const response = await fetch("/api/bookings");
        const payload = (await response.json()) as BookingPortalResponse;
        if (!response.ok) {
          if (!cancelled) {
            setError(payload.error ?? "Could not load public sessions.");
            setLoading(false);
          }
          return;
        }

        const nextSessions = payload.sessions ?? [];
        if (!cancelled) {
          setAcademy(payload.academy ?? null);
          setSessions(nextSessions);
          setSelectedSessionId(nextSessions[0]?.session_id ?? "");
          setLoading(false);
        }
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
  }, []);

  useEffect(() => {
    if (bookingState !== "success" || !checkoutSessionId) return;

    let cancelled = false;

    async function confirmBooking() {
      setConfirmingCheckout(true);
      setError(null);
      try {
        const response = await fetch("/api/bookings/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkoutSessionId }),
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
          await loadPortal();
          window.history.replaceState({}, "", "/book");
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

    void confirmBooking();
    return () => {
      cancelled = true;
    };
  }, [bookingState, checkoutSessionId, loadPortal]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSession) {
      setError("Please choose a session before booking.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/bookings", {
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

      if (payload.status === "waitlist") {
        setSuccess("This session is full, so your child has been added to the waitlist.");
      } else {
        setSuccess("Booking confirmed. Please check your email for the session details.");
      }

      setChildName("");
      setChildDateOfBirth("");
      setParentName("");
      setParentEmail("");
      setParentPhone("");
      setNotes("");
      await loadPortal();
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
    } finally {
      setSubmitting(false);
    }
  }

  const bookButtonLabel = selectedSession?.is_full
    ? "Join waitlist"
    : selectedSession && selectedSession.price > 0
      ? `Pay ${formatPoundsFromPence(selectedSession.price)} and book`
      : "Confirm booking";

  return (
    <div className="flex min-h-full flex-col" style={brandStyle}>
      <header className="border-b border-black/[0.06] px-4 py-5 dark:border-white/[0.08] sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <BrandLogo
            src={academy?.logo_url ?? "/logo.png"}
            alt={academyName}
            size="navbar"
            priority
          />
          <a
            href="#booking-form"
            className="bg-foreground text-background hover:opacity-90 inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium transition-opacity"
          >
            Book now
          </a>
        </div>
      </header>

      <main className="flex-1">
        <section className="mesh-gradient border-b border-black/[0.06] px-4 py-16 dark:border-white/[0.08] sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="text-accent mb-4 flex items-center gap-2 text-sm font-medium tracking-wide uppercase">
                Booking portal
                <FeatureInfoTooltip featureKey="booking-portal" />
              </p>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                Book live coaching sessions with {academyName}.
              </h1>
              <p className="text-muted mt-6 max-w-xl text-lg leading-relaxed">
                Browse upcoming public sessions, secure your space with upfront payment,
                and move to the waitlist automatically when a session is full.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#sessions"
                  className="border-border hover:bg-black/[0.03] inline-flex h-12 items-center justify-center rounded-full border px-8 text-sm font-medium transition-colors dark:hover:bg-white/[0.06]"
                >
                  View sessions
                </a>
                <a
                  href="#booking-form"
                  className="bg-accent text-white hover:opacity-90 inline-flex h-12 items-center justify-center rounded-full px-8 text-sm font-medium transition-opacity"
                >
                  Start booking
                  <ArrowRight className="ml-2 size-4" aria-hidden />
                </a>
              </div>
            </div>

            <div className="glass-panel rounded-3xl p-6 sm:p-8">
              <CalendarCheck className="text-accent size-10" aria-hidden />
              <h2 className="mt-5 text-2xl font-semibold tracking-tight">
                Real-time public availability
              </h2>
              <p className="text-muted mt-3 text-sm leading-relaxed">
                Public sessions update from the coach dashboard. Paid sessions go straight
                to secure Stripe checkout, while full sessions switch to waitlist entry.
              </p>
              <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-black/[0.03] p-4 dark:bg-white/[0.04]">
                  <dt className="text-muted">Upcoming sessions</dt>
                  <dd className="mt-1 text-xl font-semibold">{sessions.length}</dd>
                </div>
                <div className="rounded-2xl bg-black/[0.03] p-4 dark:bg-white/[0.04]">
                  <dt className="text-muted">Payments</dt>
                  <dd className="mt-1 text-xl font-semibold">Upfront</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section id="sessions" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight">Upcoming public sessions</h2>
              <p className="text-muted mt-3 text-base leading-relaxed">
                Choose the session that fits best. Full sessions automatically offer the
                waitlist instead of overbooking.
              </p>
            </div>

            {loading ? (
              <div className="glass-panel mt-10 flex items-center gap-3 rounded-2xl p-6 text-sm">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading sessions...
              </div>
            ) : null}

            {!loading && !error && sessions.length === 0 ? (
              <div className="glass-panel mt-10 rounded-3xl p-8 text-center">
                <CalendarCheck className="text-muted mx-auto size-8" aria-hidden />
                <p className="mt-3 font-medium">No public sessions are live right now</p>
                <p className="text-muted mt-1 text-sm">
                  Check back soon for new 1-to-1 and group coaching dates.
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
                      selectedSessionId === session.session_id && "ring-accent/30 ring-2",
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
                        {session.is_full ? "Waitlist only" : `${session.remaining_spaces} spaces left`}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3 text-sm">
                      <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
                        <p className="text-muted text-xs">Price</p>
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
                          {session.capacity} total · {session.waitlist_count} on waitlist
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
                      onClick={() => setSelectedSessionId(session.session_id)}
                      className="bg-foreground text-background hover:opacity-90 mt-6 inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium transition-opacity"
                    >
                      {session.is_full ? "Join waitlist" : "Choose session"}
                    </a>
                  </article>
                ))}
              </div>
            ) : null}
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
                  {formatPoundsFromPence(selectedSession.price)} · {selectedSession.remaining_spaces} spaces left
                </p>
              </div>
            ) : null}

            <form className="mt-8 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium" htmlFor="session">
                  Session
                </label>
                <select
                  id="session"
                  value={selectedSessionId}
                  onChange={(event) => setSelectedSessionId(event.target.value)}
                  className="border-border bg-background text-foreground focus:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none ring-offset-2 focus:ring-2"
                >
                  {sessions.map((session) => (
                    <option key={session.session_id} value={session.session_id}>
                      {getSessionTitle(session)} · {formatSessionDate(session.session_date)}
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
                  placeholder="Goals, medical notes, or anything the coach should know..."
                />
              </div>

              {selectedSession ? (
                <div className="sm:col-span-2 rounded-2xl bg-black/[0.02] p-4 text-sm dark:bg-white/[0.03]">
                  <p className="font-medium">
                    {selectedSession.is_full
                      ? "This session is full. Submitting will place your child on the waitlist."
                      : selectedSession.price > 0
                        ? "Upfront payment secures the space immediately."
                        : "This session is free and will confirm immediately after submission."}
                  </p>
                  {!selectedSession.is_full && selectedSession.price > 0 ? (
                    <p className="text-muted mt-1">
                      You will be redirected to secure Stripe checkout after submitting the form.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {(error || bookingState === "cancelled") && !success ? (
                <p className="sm:col-span-2 text-sm text-red-600 dark:text-red-400">
                  {error ?? "Checkout was cancelled before the booking was completed."}
                </p>
              ) : null}

              {success ? (
                <p className="sm:col-span-2 text-sm text-accent">{success}</p>
              ) : null}

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={submitting || confirmingCheckout || !selectedSession}
                  className="bg-accent text-white hover:opacity-90 inline-flex h-11 w-full items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity disabled:opacity-60 sm:w-auto"
                >
                  {submitting || confirmingCheckout ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                      {confirmingCheckout ? "Confirming payment..." : "Submitting..."}
                    </>
                  ) : (
                    bookButtonLabel
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
