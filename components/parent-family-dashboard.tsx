"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CalendarPlus,
  CreditCard,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  Phone,
  Tent,
  UserRound,
} from "lucide-react";
import { ParentMatchFixtures } from "@/components/parent-match-fixtures";
import { ParentOnboardingTour } from "@/components/parent-onboarding-tour";
import { ParentSuccessMoment } from "@/components/parent-success-moment";
import { ParentTrainingPreparation } from "@/components/parent-training-preparation";
import { ParentVideoClips } from "@/components/parent-video-clips";
import { StructuredReportDisplay } from "@/components/structured-report-display";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { footballEmptyPreset } from "@/lib/football-identity";
import { TYPE } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";
import { generateReportPdf, getReportPdfFilename } from "@/lib/report-pdf";
import { trackParentJourneyEvent } from "@/lib/parent-journey-client";
import {
  PARENT_FIRST_LOGIN_METADATA_KEY,
  PARENT_ONBOARDING_METADATA_KEY,
} from "@/lib/parent-journey-types";
import {
  buildGoogleCalendarUrl,
  formatMoney,
  formatParentReportDate,
  formatPortalDate,
  formatPortalTime,
} from "@/lib/parent-portal-format";
import type {
  ParentFamilyDashboard as ParentFamilyDashboardData,
  ParentReportItem,
} from "@/lib/parent-portal-types";
import { createClient } from "@/lib/supabase";
import { sanitizeUserFacingError } from "@/lib/user-facing-errors";
import { PanelSkeleton } from "@/components/branded-loading";

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl bg-black/[0.02] px-4 py-3 dark:bg-white/[0.03]">
      <p className="text-muted text-xs font-medium">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function ParentReportPanel({
  report,
  onClose,
}: {
  report: ParentReportItem | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    if (!report) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, report]);

  if (!report) return null;

  const activeReport = report;

  async function handleDownloadPdf() {
    setPdfError(null);
    setDownloadingPdf(true);
    try {
      const bytes = await generateReportPdf({
        playerName: activeReport.playerName,
        report: activeReport.report,
        date: new Date(activeReport.created_at),
      });
      const pdfBuffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(pdfBuffer).set(bytes);
      const blob = new Blob([pdfBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = getReportPdfFilename(
        activeReport.playerName,
        new Date(activeReport.created_at),
      );
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      setPdfError(
        sanitizeUserFacingError(error, {
          context: "general",
          logLabel: "parent-report-pdf",
        }),
      );
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="parent-report-title"
        className="bg-background max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="parent-report-title" className="text-lg font-semibold tracking-tight">
              {report.playerName}&apos;s progress report
            </h2>
            <p className="text-muted mt-1 text-sm">{formatParentReportDate(report.created_at)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-foreground focus-visible:ring-accent/40 inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Close
          </button>
        </div>

        <div className="mt-6">
          <StructuredReportDisplay report={report.report} />
        </div>

        {pdfError ? (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
            {pdfError}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleDownloadPdf()}
            disabled={downloadingPdf}
            className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
          >
            {downloadingPdf ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <FileText className="size-4" aria-hidden />
            )}
            Open PDF
          </button>
        </div>
      </div>
    </div>
  );
}

export function ParentFamilyDashboard() {
  const searchParams = useSearchParams();
  const showWelcome = searchParams.get("welcome") === "1";
  const [data, setData] = useState<ParentFamilyDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<ParentReportItem | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [showSuccessMoment, setShowSuccessMoment] = useState(showWelcome);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const visitTracked = useRef(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/family/dashboard", { cache: "no-store" });
      const payload = (await response.json()) as ParentFamilyDashboardData & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load your family dashboard.");
      }
      setData(payload);
    } catch (caughtError: unknown) {
      setError(
        sanitizeUserFacingError(caughtError, {
          context: "general",
          logLabel: "parent-family-dashboard",
        }),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadDashboard();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadDashboard]);

  useEffect(() => {
    if (visitTracked.current) return;
    visitTracked.current = true;

    async function trackVisit() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
      const firstLoginAt = metadata[PARENT_FIRST_LOGIN_METADATA_KEY];
      const onboardingDone = Boolean(metadata[PARENT_ONBOARDING_METADATA_KEY]);

      if (!firstLoginAt) {
        await supabase.auth.updateUser({
          data: { [PARENT_FIRST_LOGIN_METADATA_KEY]: new Date().toISOString() },
        });
        await trackParentJourneyEvent("first_login", { source: "family_dashboard" });
        if (!onboardingDone) setShowOnboarding(true);
      } else {
        await trackParentJourneyEvent("return_visit", { source: "family_dashboard" });
        if (!onboardingDone && showWelcome) setShowOnboarding(true);
      }

      if (showWelcome) setShowSuccessMoment(true);
    }

    void trackVisit();
  }, [showWelcome]);

  function openReport(report: ParentReportItem) {
    setSelectedReport(report);
    void trackParentJourneyEvent("report_opened", { reportId: report.id });
  }

  const primaryCoach = data?.coachContacts[0] ?? null;
  const weeklyPackage = useMemo(
    () => data?.subscriptions.find((item) => item.isWeeklyActive) ?? null,
    [data?.subscriptions],
  );

  async function handleUpdatePaymentDetails(stripeCustomerId?: string) {
    setBillingError(null);
    setBillingLoading(true);
    try {
      const response = await fetch("/api/family/billing-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stripeCustomerId }),
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Unable to open payment details.");
      }
      window.location.href = payload.url;
    } catch (caughtError: unknown) {
      setBillingError(
        sanitizeUserFacingError(caughtError, {
          context: "general",
          logLabel: "parent-billing-portal",
        }),
      );
    } finally {
      setBillingLoading(false);
    }
  }

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="page-content-enter space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className={cn(TYPE.label, "text-muted")}>Family training hub</p>
          <h1 className={cn(TYPE.pageTitle, "mt-1")}>
            Hello {data?.welcomeName ?? "there"}
          </h1>
          <p className={cn(TYPE.description, "mt-2 max-w-2xl")} role="status">
            {loading
              ? "Loading your family overview..."
              : data?.children.length
                ? "Upcoming training, attendance, development reports, camps, and payments."
                : "Sign in with the parent email linked to your child to see sessions and reports here."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/family/manage"
            className={buttonVariants({ variant: "accent", shape: "soft" })}
          >
            Manage family
          </Link>
        </div>
      </header>

      {error ? (
        <div className="football-panel football-panel-interactive rounded-2xl p-6 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <PanelSkeleton />
      ) : null}

      {!loading && data ? (
        <>
          {showSuccessMoment ? (
            <ParentSuccessMoment
              data={data}
              onContinue={() => {
                setShowSuccessMoment(false);
                if (typeof window !== "undefined") {
                  window.history.replaceState({}, "", "/family");
                }
              }}
            />
          ) : null}

          {data.awaitingActions.length > 0 && !showSuccessMoment ? (
            <section
              className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6"
              aria-labelledby="awaiting-actions-heading"
            >
              <h2 id="awaiting-actions-heading" className="text-lg font-semibold tracking-tight">
                What needs attention
              </h2>
              <ul className="mt-4 space-y-2" role="list">
                {data.awaitingActions.map((item) => (
                  <li key={item.id}>
                    {item.href.startsWith("#") ? (
                      <button
                        type="button"
                        onClick={() => scrollToSection(item.href.slice(1))}
                        className="text-left text-sm font-medium text-accent underline-offset-4 hover:underline"
                      >
                        {item.label}
                      </button>
                    ) : (
                      <Link
                        href={item.href}
                        className="text-sm font-medium text-accent underline-offset-4 hover:underline"
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="family-summary-heading">
            <h2 id="family-summary-heading" className="sr-only">
              Family summary
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <SummaryCard label="Upcoming sessions" value={data.summary.upcomingSessions} />
              <SummaryCard label="Attendance %" value={`${data.summary.attendancePercent}%`} />
              <SummaryCard label="Shared reports" value={data.summary.reportsAvailable} />
              <SummaryCard
                label="Active weekly package"
                value={data.summary.activeWeeklyPackages}
              />
              <SummaryCard label="Upcoming camps" value={data.summary.upcomingCamps} />
            </div>
          </section>

          <section aria-labelledby="children-heading">
            <h2 id="children-heading" className="text-lg font-semibold tracking-tight">
              Your children
            </h2>
            {data.children.length === 0 ? (
              <EmptyState
                variant="plain"
                className="mt-4"
                {...footballEmptyPreset("players")}
                title="No players linked yet"
                description="Ask your coach to use the same parent email on your child's squad profile."
              />
            ) : (
              <ul className="mt-4 grid gap-4 lg:grid-cols-2" role="list" aria-label="Your children">
                {data.children.map((child) => {
                  const coach = data.coachContacts.find(
                    (contact) => contact.coachId === child.coachId,
                  );
                  const childReports = data.reports.filter(
                    (report) => report.playerId === child.playerId,
                  );
                  const latestReport = childReports[0] ?? null;

                  return (
                    <li
                      key={child.playerId}
                      className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6"
                      role="listitem"
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className="bg-accent/10 text-accent ring-accent/20 flex size-14 shrink-0 items-center justify-center rounded-2xl ring-1"
                          aria-hidden
                        >
                          <UserRound className="size-7" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-lg font-semibold tracking-tight">{child.playerName}</h3>
                          <p className="text-muted mt-1 text-sm">
                            {child.primaryPosition ?? "Position not set"} · {child.teamLabel}
                          </p>
                          <p className="text-muted mt-2 text-sm">
                            {Math.round(child.attendanceRate)}% attendance · Last report:{" "}
                            {formatParentReportDate(child.lastReportDate)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (latestReport) openReport(latestReport);
                            else scrollToSection("family-reports");
                          }}
                          className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
                        >
                          <FileText className="size-4" aria-hidden />
                          View report
                        </button>
                        <button
                          type="button"
                          onClick={() => scrollToSection("family-sessions")}
                          className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
                        >
                          <CalendarPlus className="size-4" aria-hidden />
                          View sessions
                        </button>
                        <button
                          type="button"
                          onClick={() => scrollToSection("family-contact")}
                          className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
                        >
                          <Mail className="size-4" aria-hidden />
                          Contact coach
                        </button>
                        {coach?.bookingSlug ? (
                          <Link
                            href={`/book/${coach.bookingSlug}`}
                            className="text-accent focus-visible:ring-accent/40 inline-flex min-h-11 items-center gap-2 text-sm font-medium underline-offset-4 hover:underline outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          >
                            <ExternalLink className="size-4" aria-hidden />
                            Book training
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section
            id="family-sessions"
            className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6"
            aria-labelledby="upcoming-sessions-heading"
          >
            <h2 id="upcoming-sessions-heading" className="text-lg font-semibold tracking-tight">
              Upcoming sessions
            </h2>
            {data.upcomingSessions.length === 0 ? (
              <EmptyState
                variant="plain"
                className="mt-4"
                {...footballEmptyPreset("sessions")}
                title="No training booked yet"
                description="When your coach confirms a session, it will appear here ready for match day."
              />
            ) : (
              <ul className="mt-4 space-y-3" role="list" aria-label="Upcoming sessions">
                {data.upcomingSessions.map((session) => (
                  <li
                    key={session.id}
                    className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]"
                    role="listitem"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{session.sessionTitle}</p>
                        <p className="text-muted mt-1 text-sm">
                          {session.playerName} · {formatPortalDate(session.sessionDate)} at{" "}
                          {formatPortalTime(session.sessionDate)}
                        </p>
                        <p className="text-muted mt-1 text-sm">
                          {session.location?.trim() || "Location to be confirmed"} ·{" "}
                          {session.bookingStatusLabel}
                        </p>
                      </div>
                      <a
                        href={buildGoogleCalendarUrl({
                          title: `${session.sessionTitle} — ${session.playerName}`,
                          startIso: session.sessionDate,
                          durationMinutes: session.durationMinutes,
                          location: session.location,
                        })}
                        target="_blank"
                        rel="noreferrer"
                        className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
                      >
                        <CalendarPlus className="size-4" aria-hidden />
                        Add to calendar
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6"
            aria-labelledby="attendance-history-heading"
          >
            <h2 id="attendance-history-heading" className="text-lg font-semibold tracking-tight">
              Attendance history
            </h2>
            <p className="text-muted mt-1 text-sm">Last five sessions</p>

            {data.attendanceHistory.length === 0 ? (
              <EmptyState
                variant="plain"
                className="mt-4"
                {...footballEmptyPreset("analytics")}
                title="No attendance recorded yet"
                description="Register marks from recent training sessions will show here."
              />
            ) : (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {(["present", "late", "absent"] as const).map((status) => {
                    const count = data.attendanceHistory.filter(
                      (entry) => entry.status === status,
                    ).length;
                    const percent = Math.round(
                      (count / Math.max(data.attendanceHistory.length, 1)) * 100,
                    );
                    const label =
                      status === "present" ? "Present" : status === "late" ? "Late" : "Absent";
                    return (
                      <div
                        key={status}
                        className="rounded-xl bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]"
                      >
                        <p className="text-muted text-xs">{label}</p>
                        <p className="mt-1 font-semibold">
                          {count} · {percent}%
                        </p>
                      </div>
                    );
                  })}
                </div>
                <ul className="mt-4 space-y-2" role="list" aria-label="Recent attendance">
                  {data.attendanceHistory.map((entry) => (
                    <li
                      key={`${entry.sessionId}-${entry.playerId}-${entry.sessionDate}`}
                      className="rounded-xl bg-black/[0.02] px-3 py-2 text-sm dark:bg-white/[0.03]"
                      role="listitem"
                    >
                      <span className="font-medium">{entry.playerName}</span>
                      <span className="text-muted">
                        {" "}
                        — {formatPortalDate(entry.sessionDate)} · {entry.sessionName} ·{" "}
                        {entry.statusLabel}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section
            id="family-reports"
            className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6"
            aria-labelledby="reports-heading"
          >
            <h2 id="reports-heading" className="text-lg font-semibold tracking-tight">
              Player development
            </h2>
            {data.reports.length === 0 ? (
              <EmptyState
                variant="plain"
                className="mt-4"
                {...footballEmptyPreset("reports")}
                title="No development reports yet"
                description="Your coach will share player development notes when they are ready for you."
              />
            ) : (
              <ul className="mt-4 space-y-3" role="list" aria-label="Progress reports">
                {data.reports.map((report) => (
                  <li
                    key={report.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]"
                    role="listitem"
                  >
                    <div>
                      <p className="font-medium">{report.playerName}</p>
                      <p className="text-muted mt-1 text-sm">
                        {formatParentReportDate(report.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openReport(report)}
                        className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        <FileText className="size-4" aria-hidden />
                        View online
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <ParentMatchFixtures />
          <ParentTrainingPreparation />
          <ParentVideoClips />

          <section
            className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6"
            aria-labelledby="camps-heading"
          >
            <h2 id="camps-heading" className="text-lg font-semibold tracking-tight">
              Camps
            </h2>
            {data.camps.length === 0 ? (
              <p className="text-muted mt-4 text-sm" role="status">
                No upcoming camps right now.
              </p>
            ) : (
              <ul className="mt-4 space-y-3" role="list" aria-label="Upcoming camps">
                {data.camps.map((camp) => (
                  <li
                    key={camp.id}
                    className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]"
                    role="listitem"
                  >
                    <div className="flex items-start gap-3">
                      <Tent className="text-accent mt-0.5 size-5 shrink-0" aria-hidden />
                      <div>
                        <p className="font-medium">{camp.name}</p>
                        <p className="text-muted mt-1 text-sm">
                          {formatPortalDate(camp.startDate)} – {formatPortalDate(camp.endDate)}
                          {camp.location ? ` · ${camp.location}` : ""}
                        </p>
                        <p className="text-muted mt-1 text-sm">
                          {camp.playerName ? `${camp.playerName} · ` : ""}
                          {camp.statusLabel}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6"
            aria-labelledby="payments-heading"
          >
            <h2 id="payments-heading" className="text-lg font-semibold tracking-tight">
              Payments
            </h2>

            {weeklyPackage ? (
              <div className="mt-4 rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]">
                <p className="font-medium">{weeklyPackage.intervalLabel}</p>
                <p className="text-muted mt-1 text-sm" role="status">
                  {weeklyPackage.playerName} · {weeklyPackage.statusLabel} ·{" "}
                  {formatMoney(weeklyPackage.amount, weeklyPackage.currency)}
                </p>
                <p className="text-muted mt-1 text-sm">
                  Next payment date:{" "}
                  {weeklyPackage.currentPeriodEnd
                    ? formatPortalDate(weeklyPackage.currentPeriodEnd)
                    : "To be confirmed"}
                </p>
              </div>
            ) : (
              <p className="text-muted mt-4 text-sm" role="status">
                No active weekly package on this account.
              </p>
            )}

            <h3 className="mt-6 text-sm font-semibold">Recent payments</h3>
            {data.recentPayments.length === 0 ? (
              <p className="text-muted mt-2 text-sm">No recent payments recorded.</p>
            ) : (
              <ul className="mt-3 space-y-2" role="list" aria-label="Recent payments">
                {data.recentPayments.map((payment) => (
                  <li
                    key={payment.id}
                    className="rounded-xl bg-black/[0.02] px-3 py-2 text-sm dark:bg-white/[0.03]"
                    role="listitem"
                  >
                    <span className="font-medium">
                      {formatMoney(payment.amount, payment.currency)}
                    </span>
                    <span className="text-muted">
                      {" "}
                      — {payment.playerName} · {payment.description} ·{" "}
                      {formatPortalDate(payment.created_at)} · {payment.statusLabel}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {billingError ? (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
                {billingError}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => void handleUpdatePaymentDetails(weeklyPackage?.stripeCustomerId)}
              disabled={billingLoading || data.subscriptions.length === 0}
              className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/40 mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
            >
              {billingLoading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <CreditCard className="size-4" aria-hidden />
              )}
              Update payment details
            </button>
          </section>

          <section
            id="family-contact"
            className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6"
            aria-labelledby="contact-heading"
          >
            <h2 id="contact-heading" className="text-lg font-semibold tracking-tight">
              Contact coach
            </h2>
            {data.coachContacts.length === 0 ? (
              <p className="text-muted mt-4 text-sm" role="status">
                Coach contact details are not available yet.
              </p>
            ) : (
              <ul className="mt-4 space-y-4" role="list" aria-label="Coach contacts">
                {data.coachContacts.map((coach) => (
                  <li
                    key={coach.coachId}
                    className="rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]"
                    role="listitem"
                  >
                    <p className="font-medium">{coach.displayName}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {coach.supportEmail ? (
                        <a
                          href={`mailto:${coach.supportEmail}`}
                          className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
                        >
                          <Mail className="size-4" aria-hidden />
                          Email
                        </a>
                      ) : null}
                      {coach.supportPhone ? (
                        <a
                          href={`tel:${coach.supportPhone}`}
                          className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
                        >
                          <Phone className="size-4" aria-hidden />
                          Phone
                        </a>
                      ) : null}
                      {coach.supportEmail ? (
                        <a
                          href={`mailto:${coach.supportEmail}?subject=${encodeURIComponent("Message from parent")}`}
                          className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
                        >
                          <Mail className="size-4" aria-hidden />
                          Send message
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {primaryCoach?.supportEmail ? (
              <p className="text-muted mt-4 text-sm">
                For session changes, use the booking page or email {primaryCoach.displayName}{" "}
                directly.
              </p>
            ) : null}
          </section>
        </>
      ) : null}

      <ParentReportPanel report={selectedReport} onClose={() => setSelectedReport(null)} />
      {showOnboarding ? (
        <ParentOnboardingTour onComplete={() => setShowOnboarding(false)} />
      ) : null}
    </div>
  );
}
