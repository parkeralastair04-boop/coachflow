"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Loader2,
  RefreshCw,
  Repeat,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import {
  BotProtectionFields,
  readHoneypotFromForm,
} from "@/components/bot-protection-fields";
import { FormErrorAlert } from "@/components/form-error-alert";
import { HONEYPOT_FIELD_NAME } from "@/lib/bot-protection-shared";
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
import { isValidEmail } from "@/lib/validation/email";
import { sanitizeBookingPortalError } from "@/lib/user-facing-errors";
import { normalisePhone } from "@/lib/validation/phone";
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
  checkoutExpiresAt?: string | null;
  status?: "pending" | "confirmed" | "waitlist" | "cancelled";
  familyPortalUrl?: string | null;
  familyInviteKind?: "claim" | "sign_in" | null;
  error?: string;
};

type RecurringCheckoutResponse = {
  enrolmentId?: string | null;
  checkoutUrl?: string | null;
  checkoutExpiresAt?: string | null;
  error?: string;
};

const CHECKOUT_PENDING_STORAGE_KEY = "awarix_checkout_pending";
const CHECKOUT_EXPIRES_AT_STORAGE_KEY = "awarix_checkout_expires_at";

type BookingPortalResponse = PublicBookingPayload & {
  error?: string;
};

const CHECKOUT_POLL_INTERVAL_MS = 2000;
const CHECKOUT_POLL_MAX_MS = 30000;

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function pollCheckoutConfirmation(
  endpoint: string,
  checkoutSessionId: string,
  isConfirmed: (payload: Record<string, unknown>) => boolean,
  isCancelled: () => boolean,
): Promise<"confirmed" | "timeout" | "error"> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < CHECKOUT_POLL_MAX_MS) {
    if (isCancelled()) return "error";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutSessionId }),
      });
      const payload = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        if (response.status === 409) {
          // Payment still processing — keep polling.
        } else {
          return "error";
        }
      } else if (isConfirmed(payload)) {
        return "confirmed";
      }
    } catch {
      return "error";
    }

    if (Date.now() - startedAt >= CHECKOUT_POLL_MAX_MS) {
      break;
    }

    await sleep(CHECKOUT_POLL_INTERVAL_MS);
  }

  return "timeout";
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

type StatusBannerKind = "success" | "waitlist" | "cancelled" | "timeout";

const STATUS_BANNER_COPY: Record<Exclude<StatusBannerKind, "cancelled" | "success" | "waitlist">, string> = {
  timeout:
    "Payment received. Confirmation may take a few minutes. Please check your email shortly.",
};

type CompletedBooking = {
  kind: "success" | "waitlist" | "timeout";
  childName: string;
  parentEmail: string;
  productLabel: string;
  scheduleLabel: string;
  location: string | null;
  isRecurring: boolean;
  familyPortalUrl?: string | null;
  familyInviteKind?: "claim" | "sign_in" | null;
};

const POLL_STATUS_MESSAGES = [
  "Completing your booking…",
  "Waiting for confirmation…",
  "Confirmation email on the way…",
] as const;

function getLowestMonthlyPriceLabel(series: PublicRecurringSeriesRow[]): string | null {
  if (series.length === 0) return null;
  const lowest = series.reduce((min, item) =>
    item.monthly_price < min.monthly_price ? item : min,
  );
  return formatPoundsFromPence(lowest.monthly_price, lowest.currency.toUpperCase());
}

function getSessionsWithSpaces(
  sessions: PublicSessionRow[],
  options?: { excludeSessionId?: string; limit?: number },
): PublicSessionRow[] {
  const limit = options?.limit ?? 3;
  return sessions
    .filter(
      (session) =>
        !session.is_full &&
        session.remaining_spaces > 0 &&
        session.session_id !== options?.excludeSessionId,
    )
    .slice(0, limit);
}

function formatHoldWindowMessage(expiresAt?: string | null): string {
  const defaultMessage =
    "We'll hold this place for around 30 minutes while payment is completed.";

  if (!expiresAt) return defaultMessage;

  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) return defaultMessage;

  const timeLabel = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);

  return `We'll hold this place while payment is completed, until around ${timeLabel}.`;
}

function WeeklyPackageValueSection({ fromPriceLabel }: { fromPriceLabel: string | null }) {
  return (
    <div className="mb-4 rounded-2xl bg-black/[0.02] p-5 dark:bg-white/[0.03] sm:p-6">
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
        Weekly training packages
      </h2>
      <p className="text-muted mt-2 text-sm leading-relaxed">
        Train every week with a regular monthly payment.
      </p>
      <ul className="mt-4 space-y-2 text-sm leading-relaxed">
        <li className="flex items-start gap-2">
          <Check className="text-accent mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Guaranteed place</span>
        </li>
        <li className="flex items-start gap-2">
          <Check className="text-accent mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Monthly payment</span>
        </li>
        <li className="flex items-start gap-2">
          <Check className="text-accent mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Regular weekly training</span>
        </li>
      </ul>
      {fromPriceLabel ? (
        <p className="mt-4 text-sm font-medium">From {fromPriceLabel}/month</p>
      ) : null}
    </div>
  );
}

function BookingComparisonPanel() {
  return (
    <div className="glass-panel interactive-surface rounded-2xl p-5 sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight">Compare your options</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-black/[0.02] p-4 dark:bg-white/[0.03]">
          <h3 className="font-medium">One-off session</h3>
          <ul className="text-muted mt-3 space-y-1.5 text-sm leading-relaxed">
            <li>Pay per session</li>
            <li>Flexible attendance</li>
          </ul>
        </div>
        <div className="rounded-xl bg-black/[0.02] p-4 dark:bg-white/[0.03]">
          <h3 className="font-medium">Weekly package</h3>
          <ul className="text-muted mt-3 space-y-1.5 text-sm leading-relaxed">
            <li>Guaranteed weekly place</li>
            <li>Monthly payment</li>
            <li>Regular training</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function WaitlistAlternativeSessions({
  sessions,
  onSelectSession,
}: {
  sessions: PublicSessionRow[];
  onSelectSession: (sessionId: string) => void;
}) {
  if (sessions.length === 0) return null;

  return (
    <div
      className="rounded-2xl border border-black/[0.06] bg-black/[0.02] p-4 dark:border-white/[0.08] dark:bg-white/[0.03]"
      role="group"
      aria-label="Other sessions with spaces"
    >
      <p className="text-sm font-medium">Other sessions with spaces</p>
      <ul className="mt-3 space-y-2">
        {sessions.map((session) => (
          <li key={session.session_id}>
            <button
              type="button"
              onClick={() => onSelectSession(session.session_id)}
              className="border-border hover:bg-surface-hover focus-visible:ring-accent/50 w-full rounded-xl border px-4 py-3 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
            >
              <span className="font-medium">{formatSessionDate(session.session_date)}</span>
              <span className="text-muted mt-0.5 block">
                {getSessionTitle(session)}
                {session.location ? ` · ${session.location}` : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function toTelHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function SupportSection({
  email,
  phone,
}: {
  email: string | null;
  phone?: string | null;
}) {
  const supportPhone = phone?.trim() || null;

  return (
    <div className="rounded-2xl bg-black/[0.02] px-4 py-3.5 dark:bg-white/[0.03]">
      <p className="text-sm font-medium">Questions? Contact your coach</p>
      {email || supportPhone ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {email ? (
            <a
              href={`mailto:${email}`}
              className="bg-background border-border hover:bg-surface-hover focus-visible:ring-accent/50 inline-flex min-h-11 flex-1 items-center justify-center rounded-full border px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06] sm:flex-none"
            >
              Email {email}
            </a>
          ) : null}
          {supportPhone ? (
            <a
              href={toTelHref(supportPhone)}
              aria-label={`Call your coach on ${supportPhone}`}
              className="bg-background border-border hover:bg-surface-hover focus-visible:ring-accent/50 inline-flex min-h-11 flex-1 items-center justify-center rounded-full border px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06] sm:flex-none"
            >
              Call your coach
            </a>
          ) : null}
        </div>
      ) : (
        <p className="text-muted mt-1.5 text-sm leading-relaxed">
          Please contact your coach directly.
        </p>
      )}
    </div>
  );
}

function SecurePaymentPanel() {
  return (
    <div className="sm:col-span-2 rounded-2xl border border-black/[0.06] bg-black/[0.02] p-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
      <p className="text-sm font-medium">Secure online payments</p>
      <ul className="text-muted mt-3 space-y-2 text-sm leading-relaxed">
        <li className="flex items-start gap-2">
          <Check className="text-accent mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Complete your booking securely</span>
        </li>
        <li className="flex items-start gap-2">
          <Check className="text-accent mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Your place is held while payment completes</span>
        </li>
        <li className="flex items-start gap-2">
          <Check className="text-accent mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Confirmation email sent after booking</span>
        </li>
      </ul>
      <p className="text-muted/80 mt-3 text-xs">Payments provided by Stripe.</p>
    </div>
  );
}

function BookingStatusBanner({
  kind,
  bannerRef,
}: {
  kind: "cancelled" | "timeout";
  bannerRef?: RefObject<HTMLDivElement | null>;
}) {
  if (kind === "cancelled") {
    return (
      <div
        ref={bannerRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-sm leading-relaxed text-red-900 outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 sm:p-6 dark:text-red-100"
      >
        <p className="font-medium">Your payment was cancelled.</p>
        <p className="mt-2">No payment has been taken.</p>
        <p className="mt-2">
          You can return and complete your booking at any time while spaces remain.
        </p>
        <p className="mt-2 text-red-800/80 dark:text-red-200/80">
          Your place has not been confirmed.
        </p>
        <a
          href="#booking-form"
          className="bg-foreground text-background hover:opacity-90 mt-5 inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium transition-opacity"
        >
          Continue booking
        </a>
      </div>
    );
  }

  return (
    <div
      ref={bannerRef}
      tabIndex={-1}
      role="status"
      aria-live="polite"
      className="rounded-2xl border border-accent/25 bg-accent/5 p-5 text-sm leading-relaxed text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent/50 sm:p-6"
    >
      <p className="flex items-start gap-2">
        <CheckCircle2 className="text-accent mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{STATUS_BANNER_COPY.timeout}</span>
      </p>
    </div>
  );
}

function BookingConfirmationPanel({
  booking,
  supportEmail,
  supportPhone,
  panelRef,
  alternativeSessions,
  onSelectSession,
  onViewSessions,
}: {
  booking: CompletedBooking;
  supportEmail: string | null;
  supportPhone?: string | null;
  panelRef?: RefObject<HTMLDivElement | null>;
  alternativeSessions: PublicSessionRow[];
  onSelectSession: (sessionId: string) => void;
  onViewSessions: () => void;
}) {
  const isWaitlist = booking.kind === "waitlist";
  const isRecurringSuccess = !isWaitlist && booking.isRecurring;

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="status"
      aria-live="polite"
      className="glass-panel rounded-3xl p-6 outline-none focus-visible:ring-2 focus-visible:ring-accent/50 sm:p-8"
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 className="text-accent mt-0.5 size-6 shrink-0" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">
            {isWaitlist ? "Added to waitlist" : "Booking confirmed"}
          </h2>
          {isWaitlist ? (
            <p className="text-muted mt-2 text-sm leading-relaxed">
              No payment required. We&apos;ll contact you if a place becomes available.
            </p>
          ) : isRecurringSuccess ? (
            <p className="text-muted mt-2 text-sm leading-relaxed">
              Your child now has a regular weekly place.
            </p>
          ) : (
            <p className="text-muted mt-2 text-sm leading-relaxed">
              Confirmation email sent to {booking.parentEmail}
            </p>
          )}
        </div>
      </div>

      <dl className="mt-6 space-y-3 rounded-2xl bg-black/[0.02] p-4 text-sm dark:bg-white/[0.03]">
        <div>
          <dt className="text-muted text-xs font-medium uppercase tracking-wide">Child</dt>
          <dd className="mt-1 font-medium">{booking.childName}</dd>
        </div>
        <div>
          <dt className="text-muted text-xs font-medium uppercase tracking-wide">
            {booking.isRecurring ? "Package" : "Session"}
          </dt>
          <dd className="mt-1 font-medium">{booking.productLabel}</dd>
        </div>
        <div>
          <dt className="text-muted text-xs font-medium uppercase tracking-wide">When</dt>
          <dd className="mt-1 font-medium">{booking.scheduleLabel}</dd>
        </div>
        {booking.location ? (
          <div>
            <dt className="text-muted text-xs font-medium uppercase tracking-wide">Location</dt>
            <dd className="mt-1 font-medium">{booking.location}</dd>
          </div>
        ) : null}
      </dl>

      {isWaitlist ? (
        <div className="mt-6">
          <WaitlistAlternativeSessions
            sessions={alternativeSessions}
            onSelectSession={onSelectSession}
          />
        </div>
      ) : null}

      {!isWaitlist ? (
        <div className="mt-6 rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.03]">
          <p className="text-sm font-medium">
            {booking.familyInviteKind === "sign_in"
              ? "View bookings in your family dashboard"
              : "Create your family account"}
          </p>
          <p className="text-muted mt-1 text-sm leading-relaxed">
            {booking.familyInviteKind === "sign_in"
              ? "Sign in with this email to see sessions, reports, and payments."
              : "Check your confirmation email for a secure link, or continue below after the email arrives."}
          </p>
          <a
            href={
              booking.familyPortalUrl?.trim() ||
              `/login?next=${encodeURIComponent("/family")}`
            }
            className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent/50 mt-3 inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {booking.familyInviteKind === "sign_in"
              ? "Open family dashboard"
              : "Set up family access"}
          </a>
        </div>
      ) : null}

      {!isWaitlist && !booking.isRecurring ? (
        <div className="mt-6">
          <p className="text-sm font-medium">Ready to book another session?</p>
          <button
            type="button"
            onClick={onViewSessions}
            className="border-border hover:bg-surface-hover focus-visible:ring-accent/50 mt-3 inline-flex min-h-11 items-center justify-center rounded-full border px-5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
          >
            View available sessions
          </button>
        </div>
      ) : null}

      <div className="mt-6">
        <SupportSection email={supportEmail} phone={supportPhone} />
      </div>
    </div>
  );
}

function AvailabilityBadge({
  isFull,
  remainingSpaces,
}: {
  isFull: boolean;
  remainingSpaces: number;
}) {
  if (isFull) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-950 ring-1 ring-amber-700/25 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-400/30">
        <Clock3 className="size-3 shrink-0" aria-hidden />
        Waitlist only
      </span>
    );
  }

  return (
    <span className="bg-accent/15 text-accent-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-accent/35 dark:text-foreground">
      <Check className="size-3 shrink-0" aria-hidden />
      {remainingSpaces} spaces left
    </span>
  );
}

function MobileStickyBookingBar({
  productName,
  priceLabel,
  onContinue,
}: {
  productName: string;
  priceLabel: string;
  onContinue: () => void;
}) {
  return (
    <div
      className="border-border bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t p-4 backdrop-blur lg:hidden"
      role="region"
      aria-label="Selected session summary"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{productName}</p>
          <p className="text-muted truncate text-xs">{priceLabel}</p>
        </div>
        <button
          type="button"
          onClick={onContinue}
          className="bg-accent focus-visible:ring-accent/50 shrink-0 rounded-full px-5 py-2.5 text-sm font-medium text-white outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Continue booking
        </button>
      </div>
    </div>
  );
}

function SelectedProductSummary({
  label,
  title,
  detail,
  onChangeSelection,
}: {
  label: string;
  title: string;
  detail: string;
  onChangeSelection: () => void;
}) {
  return (
    <div className="mt-6">
      <p className="text-sm font-medium">{label}</p>
      <div className="mt-2 rounded-2xl bg-black/[0.02] p-4 text-sm dark:bg-white/[0.03]">
        <p className="font-medium">{title}</p>
        <p className="text-muted mt-1 leading-relaxed">{detail}</p>
      </div>
      <button
        type="button"
        onClick={onChangeSelection}
        className="border-border hover:bg-surface-hover focus-visible:ring-accent/50 mt-3 inline-flex h-10 items-center justify-center rounded-full border px-5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
      >
        Change selection
      </button>
    </div>
  );
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
  const [turnstileToken, setTurnstileToken] = useState("");
  const formRef = useRef<HTMLFormElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmingCheckout, setConfirmingCheckout] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<StatusBannerKind | null>(() =>
    initialQuery.booking === "cancelled" || initialQuery.subscription === "cancelled"
      ? "cancelled"
      : null,
  );
  const [completedBooking, setCompletedBooking] = useState<CompletedBooking | null>(null);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [pollMessageIndex, setPollMessageIndex] = useState(0);
  const [selectionAnnouncement, setSelectionAnnouncement] = useState("");
  const [checkoutPendingFlag, setCheckoutPendingFlag] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(CHECKOUT_PENDING_STORAGE_KEY) === "1";
  });
  const [checkoutExpiresAt, setCheckoutExpiresAt] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.sessionStorage.getItem(CHECKOUT_EXPIRES_AT_STORAGE_KEY);
  });
  const [fieldErrors, setFieldErrors] = useState<{
    childName?: string;
    parentEmail?: string;
  }>({});
  const statusBannerRef = useRef<HTMLDivElement>(null);
  const bookingFormRef = useRef<HTMLDivElement>(null);
  const childNameRef = useRef<HTMLInputElement>(null);
  const parentEmailRef = useRef<HTMLInputElement>(null);
  const confirmationPanelRef = useRef<HTMLDivElement>(null);
  const formErrorSummaryRef = useRef<HTMLDivElement>(null);
  const productsRef = useRef<HTMLDivElement>(null);
  const sessionCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const seriesCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const hashHandledRef = useRef(false);

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

  const hasPaidCheckout =
    (selectedSession !== null && selectedSession.price > 0 && !selectedSession.is_full) ||
    selectedRecurringSeries !== null;

  const lowestMonthlyPriceLabel = useMemo(
    () => getLowestMonthlyPriceLabel(recurringSeries),
    [recurringSeries],
  );

  const waitlistAlternativeSessions = useMemo(
    () =>
      selectedSession?.is_full
        ? getSessionsWithSpaces(sessions, { excludeSessionId: selectedSession.session_id })
        : [],
    [selectedSession, sessions],
  );

  const confirmationAlternativeSessions = useMemo(
    () => (completedBooking?.kind === "waitlist" ? getSessionsWithSpaces(sessions) : []),
    [completedBooking?.kind, sessions],
  );

  const brandStyle = portal
    ? ({
        "--accent": portal.primary_color,
        "--accent-dim": `${portal.primary_color}24`,
        "--ring-glow": `${portal.primary_color}66`,
      } as CSSProperties)
    : undefined;

  const portalName = portal?.display_name ?? "Book training";
  const supportEmail = portal?.support_email?.trim() || null;
  const supportPhone = portal?.support_phone?.trim() || null;
  const portalQuery = getPortalQueryValue(tenant);
  const hasProducts = sessions.length > 0 || recurringSeries.length > 0;
  const bookingComplete = completedBooking !== null;
  const showConfirmationPanel =
    bookingComplete && (completedBooking.kind === "success" || completedBooking.kind === "waitlist");
  const showCheckoutHoldMessage =
    (checkoutPendingFlag && statusBanner !== "cancelled" && !showConfirmationPanel) ||
    confirmingCheckout ||
    (submitting && hasPaidCheckout);
  const showMobileStickyBar = Boolean(selectedId) && !showConfirmationPanel;

  const stickyBarProductName = selectedSession
    ? getSessionTitle(selectedSession)
    : selectedRecurringSeries
      ? selectedRecurringSeries.title
      : "";
  const stickyBarPriceLabel = selectedSession
    ? selectedSession.is_full
      ? "Waitlist — no payment"
      : selectedSession.price > 0
        ? `${formatPoundsFromPence(selectedSession.price)} per child`
        : "Free session"
    : selectedRecurringSeries
      ? `${formatPoundsFromPence(
          selectedRecurringSeries.monthly_price,
          selectedRecurringSeries.currency.toUpperCase(),
        )} per month`
      : "";

  const scrollToBookingForm = useCallback(() => {
    bookingFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      childNameRef.current?.focus();
    }, 350);
  }, []);

  const scrollToProducts = useCallback(() => {
    productsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleViewAvailableSessions = useCallback(() => {
    setCompletedBooking(null);
    setStatusBanner(null);
    scrollToProducts();
  }, [scrollToProducts]);

  const selectSession = useCallback(
    (sessionId: string, options?: { focusForm?: boolean }) => {
      const session = sessions.find((item) => item.session_id === sessionId);
      if (!session) return;

      setSelectedType("session");
      setSelectedId(sessionId);
      setStatusBanner(null);
      setCompletedBooking(null);
      setSelectionAnnouncement(
        `Selected ${getSessionTitle(session)} on ${formatSessionDate(session.session_date)}`,
      );

      if (options?.focusForm !== false) {
        scrollToBookingForm();
      }
    },
    [sessions, scrollToBookingForm],
  );

  const handleSelectAlternativeSession = useCallback(
    (sessionId: string) => {
      setCompletedBooking(null);
      setStatusBanner(null);
      selectSession(sessionId);
    },
    [selectSession],
  );

  const selectRecurringSeries = useCallback(
    (seriesId: string, options?: { focusForm?: boolean }) => {
      const series = recurringSeries.find((item) => item.recurring_series_id === seriesId);
      if (!series) return;

      setSelectedType("recurring");
      setSelectedId(seriesId);
      setStatusBanner(null);
      setCompletedBooking(null);
      setSelectionAnnouncement(
        `Selected ${series.title} on ${getDayLabel(series.day_of_week)} at ${series.start_time.slice(0, 5)}`,
      );

      if (options?.focusForm !== false) {
        scrollToBookingForm();
      }
    },
    [recurringSeries, scrollToBookingForm],
  );

  const handleChangeSelection = useCallback(() => {
    const focusTarget =
      selectedType === "session"
        ? sessionCardRefs.current[selectedId]
        : seriesCardRefs.current[selectedId];

    scrollToProducts();
    window.setTimeout(() => {
      focusTarget?.focus();
    }, 350);
  }, [scrollToProducts, selectedId, selectedType]);

  const handleSessionRadioKeyDown = useCallback(
    (event: React.KeyboardEvent, sessionIndex: number) => {
      if (!sessions.length) return;

      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        const nextIndex = (sessionIndex + 1) % sessions.length;
        const nextId = sessions[nextIndex].session_id;
        selectSession(nextId, { focusForm: false });
        window.setTimeout(() => sessionCardRefs.current[nextId]?.focus(), 0);
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        const prevIndex = (sessionIndex - 1 + sessions.length) % sessions.length;
        const prevId = sessions[prevIndex].session_id;
        selectSession(prevId, { focusForm: false });
        window.setTimeout(() => sessionCardRefs.current[prevId]?.focus(), 0);
      } else if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        selectSession(sessions[sessionIndex].session_id);
      }
    },
    [selectSession, sessions],
  );

  const handleSeriesRadioKeyDown = useCallback(
    (event: React.KeyboardEvent, seriesIndex: number) => {
      if (!recurringSeries.length) return;

      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        const nextIndex = (seriesIndex + 1) % recurringSeries.length;
        const nextId = recurringSeries[nextIndex].recurring_series_id;
        selectRecurringSeries(nextId, { focusForm: false });
        window.setTimeout(() => seriesCardRefs.current[nextId]?.focus(), 0);
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        const prevIndex = (seriesIndex - 1 + recurringSeries.length) % recurringSeries.length;
        const prevId = recurringSeries[prevIndex].recurring_series_id;
        selectRecurringSeries(prevId, { focusForm: false });
        window.setTimeout(() => seriesCardRefs.current[prevId]?.focus(), 0);
      } else if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        selectRecurringSeries(recurringSeries[seriesIndex].recurring_series_id);
      }
    },
    [recurringSeries, selectRecurringSeries],
  );

  const buildCompletedBookingSnapshot = useCallback(
    (args: {
      kind: CompletedBooking["kind"];
      childName: string;
      parentEmail: string;
    }): CompletedBooking | null => {
      if (selectedSession) {
        return {
          kind: args.kind,
          childName: args.childName,
          parentEmail: args.parentEmail,
          productLabel: getSessionTitle(selectedSession),
          scheduleLabel: formatSessionDate(selectedSession.session_date),
          location: selectedSession.location,
          isRecurring: false,
        };
      }
      if (selectedRecurringSeries) {
        return {
          kind: args.kind,
          childName: args.childName,
          parentEmail: args.parentEmail,
          productLabel: selectedRecurringSeries.title,
          scheduleLabel: `${getDayLabel(selectedRecurringSeries.day_of_week)} at ${selectedRecurringSeries.start_time.slice(0, 5)}`,
          location: selectedRecurringSeries.location,
          isRecurring: true,
        };
      }
      return null;
    },
    [selectedRecurringSeries, selectedSession],
  );

  useEffect(() => {
    if (statusBanner === "cancelled" || showConfirmationPanel) {
      window.sessionStorage.removeItem(CHECKOUT_PENDING_STORAGE_KEY);
      window.sessionStorage.removeItem(CHECKOUT_EXPIRES_AT_STORAGE_KEY);
    }
  }, [showConfirmationPanel, statusBanner]);

  useEffect(() => {
    if (!statusBanner || statusBanner === "success" || statusBanner === "waitlist") return;
    statusBannerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (statusBanner === "cancelled" || statusBanner === "timeout") {
      window.setTimeout(() => statusBannerRef.current?.focus(), 350);
    }
  }, [statusBanner]);

  useEffect(() => {
    if (!showConfirmationPanel) return;
    window.setTimeout(() => confirmationPanelRef.current?.focus(), 350);
  }, [showConfirmationPanel]);

  useEffect(() => {
    if (!confirmingCheckout) return;

    const timers = [
      window.setTimeout(() => setPollMessageIndex(1), 5000),
      window.setTimeout(() => setPollMessageIndex(2), 15000),
    ];

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [confirmingCheckout]);

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
          setError(sanitizeBookingPortalError(payload.error, { logLabel: "booking-portal-load" }));
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
        setError(sanitizeBookingPortalError(caughtError, { logLabel: "booking-portal-load" }));
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
          setError(sanitizeBookingPortalError(payload.error, { logLabel: "booking-portal-load" }));
          setLoading(false);
          return;
        }

        const nextSessions = payload.sessions ?? [];
        const nextRecurringSeries = payload.recurringSeries ?? [];
        setPortal(payload.portal);
        setSessions(nextSessions);
        setRecurringSeries(nextRecurringSeries);

        setLoading(false);
      } catch (caughtError: unknown) {
        if (!cancelled) {
          setError(sanitizeBookingPortalError(caughtError, { logLabel: "booking-portal-load" }));
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
    if (loading || hashHandledRef.current) return;

    const hash = window.location.hash;
    const sessionMatch = hash.match(/^#session-(.+)$/);
    if (sessionMatch?.[1] && sessions.some((session) => session.session_id === sessionMatch[1])) {
      hashHandledRef.current = true;
      const sessionId = sessionMatch[1];
      window.setTimeout(() => {
        selectSession(sessionId);
      }, 0);
      return;
    }

    const seriesMatch = hash.match(/^#series-(.+)$/);
    if (
      seriesMatch?.[1] &&
      recurringSeries.some((series) => series.recurring_series_id === seriesMatch[1])
    ) {
      hashHandledRef.current = true;
      const seriesId = seriesMatch[1];
      window.setTimeout(() => {
        setRecurringOpen(true);
        selectRecurringSeries(seriesId);
      }, 0);
    }
  }, [loading, recurringSeries, selectRecurringSeries, selectSession, sessions]);

  useEffect(() => {
    if (initialQuery.booking !== "success" || !initialQuery.checkoutSessionId) return;

    let cancelled = false;

    async function confirmOneOffBooking() {
      setConfirmingCheckout(true);
      setPollMessageIndex(0);
      setError(null);
      try {
        const outcome = await pollCheckoutConfirmation(
          "/api/bookings/confirm",
          initialQuery.checkoutSessionId!,
          (payload) =>
            payload.confirmed === true && payload.bookingStatus === "confirmed",
          () => cancelled,
        );

        if (cancelled) return;

        if (outcome === "error") {
          setStatusBanner("timeout");
          setCheckoutPendingFlag(false);
          return;
        }

        if (outcome === "timeout") {
          const snapshot = buildCompletedBookingSnapshot({
            kind: "timeout",
            childName: childName.trim() || "Your child",
            parentEmail: parentEmail.trim(),
          });
          if (snapshot) setCompletedBooking(snapshot);
          setStatusBanner("timeout");
        } else {
          const snapshot = buildCompletedBookingSnapshot({
            kind: "success",
            childName: childName.trim() || "Your child",
            parentEmail: parentEmail.trim(),
          });
          if (snapshot) {
            setCompletedBooking(snapshot);
          } else {
            setCompletedBooking({
              kind: "success",
              childName: childName.trim() || "Your child",
              parentEmail: parentEmail.trim() || "your email address",
              productLabel: "Your training session",
              scheduleLabel: "Details in your confirmation email",
              location: null,
              isRecurring: false,
            });
          }
          setStatusBanner("success");
          setCheckoutPendingFlag(false);
        }

        await fetchPortalData(true);
        window.history.replaceState({}, "", getTenantPath(tenant));
      } catch (caughtError: unknown) {
        if (!cancelled) {
          setError(sanitizeBookingPortalError(caughtError, { logLabel: "booking-portal-load" }));
        }
      } finally {
        if (!cancelled) {
          setConfirmingCheckout(false);
          setPollMessageIndex(0);
        }
      }
    }

    void confirmOneOffBooking();
    return () => {
      cancelled = true;
    };
  }, [
    buildCompletedBookingSnapshot,
    childName,
    fetchPortalData,
    initialQuery.booking,
    initialQuery.checkoutSessionId,
    parentEmail,
    tenant,
  ]);

  useEffect(() => {
    if (initialQuery.subscription !== "success" || !initialQuery.checkoutSessionId) return;

    let cancelled = false;

    async function confirmRecurringSubscription() {
      setConfirmingCheckout(true);
      setPollMessageIndex(0);
      setError(null);
      try {
        const outcome = await pollCheckoutConfirmation(
          "/api/bookings/recurring/confirm",
          initialQuery.checkoutSessionId!,
          (payload) =>
            payload.confirmed === true && payload.recurringStatus === "active",
          () => cancelled,
        );

        if (cancelled) return;

        if (outcome === "error") {
          setStatusBanner("timeout");
          setCheckoutPendingFlag(false);
          return;
        }

        if (outcome === "timeout") {
          const snapshot = buildCompletedBookingSnapshot({
            kind: "timeout",
            childName: childName.trim() || "Your child",
            parentEmail: parentEmail.trim(),
          });
          if (snapshot) setCompletedBooking(snapshot);
          setStatusBanner("timeout");
        } else {
          const snapshot = buildCompletedBookingSnapshot({
            kind: "success",
            childName: childName.trim() || "Your child",
            parentEmail: parentEmail.trim(),
          });
          if (snapshot) {
            setCompletedBooking(snapshot);
          } else {
            setCompletedBooking({
              kind: "success",
              childName: childName.trim() || "Your child",
              parentEmail: parentEmail.trim() || "your email address",
              productLabel: "Your weekly training package",
              scheduleLabel: "Details in your confirmation email",
              location: null,
              isRecurring: true,
            });
          }
          setStatusBanner("success");
          setCheckoutPendingFlag(false);
        }

        await fetchPortalData(true);
        window.history.replaceState({}, "", getTenantPath(tenant));
      } catch (caughtError: unknown) {
        if (!cancelled) {
          setError(sanitizeBookingPortalError(caughtError, { logLabel: "booking-portal-load" }));
        }
      } finally {
        if (!cancelled) {
          setConfirmingCheckout(false);
          setPollMessageIndex(0);
        }
      }
    }

    void confirmRecurringSubscription();
    return () => {
      cancelled = true;
    };
  }, [
    buildCompletedBookingSnapshot,
    childName,
    fetchPortalData,
    initialQuery.checkoutSessionId,
    initialQuery.subscription,
    parentEmail,
    tenant,
  ]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedType === "session" && !selectedSession) {
      setError("Please choose a session before booking.");
      return;
    }
    if (selectedType === "recurring" && !selectedRecurringSeries) {
      setError("Please choose a weekly training package.");
      return;
    }

    const nextFieldErrors: { childName?: string; parentEmail?: string } = {};
    const trimmedChildName = childName.trim();
    const trimmedParentEmail = parentEmail.trim();

    if (!trimmedChildName) {
      nextFieldErrors.childName = "Child name is required.";
    }
    if (!trimmedParentEmail) {
      nextFieldErrors.parentEmail = "Parent email is required.";
    } else if (!isValidEmail(trimmedParentEmail)) {
      nextFieldErrors.parentEmail = "Please enter a valid email address.";
    }

    if (nextFieldErrors.childName || nextFieldErrors.parentEmail) {
      setFieldErrors(nextFieldErrors);
      setError(null);
      setStatusBanner(null);
      window.setTimeout(() => {
        if (nextFieldErrors.childName) {
          formErrorSummaryRef.current?.focus();
          childNameRef.current?.focus();
        } else if (nextFieldErrors.parentEmail) {
          formErrorSummaryRef.current?.focus();
          parentEmailRef.current?.focus();
        }
      }, 0);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    setError(null);
    setStatusBanner(null);

    try {
      if (selectedType === "session" && selectedSession) {
        const response = await fetch(`/api/bookings?${portalQuery}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: selectedSession.session_id,
            childName: trimmedChildName,
            childDateOfBirth,
            parentName,
            parentEmail: trimmedParentEmail,
            parentPhone: normalisePhone(parentPhone) ?? "",
            notes,
            turnstileToken: turnstileToken || undefined,
            [HONEYPOT_FIELD_NAME]: formRef.current
              ? readHoneypotFromForm(formRef.current)
              : "",
          }),
        });
        const payload = (await response.json()) as BookingResponse;
        if (!response.ok) {
          setError(
            sanitizeBookingPortalError(payload.error, {
              logLabel: "booking-portal-submit",
            }),
          );
          return;
        }

        if (payload.checkoutUrl) {
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem(CHECKOUT_PENDING_STORAGE_KEY, "1");
            if (payload.checkoutExpiresAt) {
              window.sessionStorage.setItem(
                CHECKOUT_EXPIRES_AT_STORAGE_KEY,
                payload.checkoutExpiresAt,
              );
              setCheckoutExpiresAt(payload.checkoutExpiresAt);
            }
          }
          setCheckoutPendingFlag(true);
          window.location.href = payload.checkoutUrl;
          return;
        }

        const snapshot = buildCompletedBookingSnapshot({
          kind: payload.status === "waitlist" ? "waitlist" : "success",
          childName: trimmedChildName,
          parentEmail: trimmedParentEmail,
        });
        if (snapshot) {
          setCompletedBooking({
            ...snapshot,
            familyPortalUrl: payload.familyPortalUrl ?? null,
            familyInviteKind: payload.familyInviteKind ?? null,
          });
        }
        setStatusBanner(payload.status === "waitlist" ? "waitlist" : "success");
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(CHECKOUT_PENDING_STORAGE_KEY);
          window.sessionStorage.removeItem(CHECKOUT_EXPIRES_AT_STORAGE_KEY);
        }
        setCheckoutPendingFlag(false);
        setCheckoutExpiresAt(null);
      }

      if (selectedType === "recurring" && selectedRecurringSeries) {
        const response = await fetch(`/api/bookings/recurring?${portalQuery}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recurringSeriesId: selectedRecurringSeries.recurring_series_id,
            childName: trimmedChildName,
            childDateOfBirth,
            parentName,
            parentEmail: trimmedParentEmail,
            parentPhone: normalisePhone(parentPhone) ?? "",
            notes,
            turnstileToken: turnstileToken || undefined,
            [HONEYPOT_FIELD_NAME]: formRef.current
              ? readHoneypotFromForm(formRef.current)
              : "",
          }),
        });
        const payload = (await response.json()) as RecurringCheckoutResponse;
        if (!response.ok) {
          setError(
            sanitizeBookingPortalError(payload.error, {
              logLabel: "booking-portal-recurring",
            }),
          );
          return;
        }

        if (payload.checkoutUrl) {
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem(CHECKOUT_PENDING_STORAGE_KEY, "1");
            if (payload.checkoutExpiresAt) {
              window.sessionStorage.setItem(
                CHECKOUT_EXPIRES_AT_STORAGE_KEY,
                payload.checkoutExpiresAt,
              );
              setCheckoutExpiresAt(payload.checkoutExpiresAt);
            }
          }
          setCheckoutPendingFlag(true);
          window.location.href = payload.checkoutUrl;
          return;
        }

        const snapshot = buildCompletedBookingSnapshot({
          kind: "success",
          childName: trimmedChildName,
          parentEmail: trimmedParentEmail,
        });
        if (snapshot) setCompletedBooking(snapshot);
        setStatusBanner("success");
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(CHECKOUT_PENDING_STORAGE_KEY);
          window.sessionStorage.removeItem(CHECKOUT_EXPIRES_AT_STORAGE_KEY);
        }
        setCheckoutPendingFlag(false);
        setCheckoutExpiresAt(null);
      }

      await fetchPortalData(true);
    } catch (caughtError: unknown) {
      setError(
        sanitizeBookingPortalError(caughtError, { logLabel: "booking-portal-submit" }),
      );
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
      ? `Start weekly package from ${formatPoundsFromPence(
          selectedRecurringSeries.monthly_price,
          selectedRecurringSeries.currency.toUpperCase(),
        )} / month`
      : "Complete booking";

  return (
    <div className="flex min-h-full flex-col" style={brandStyle}>
      <header className="border-b border-black/[0.06] px-4 py-5 dark:border-white/[0.08] sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          {portal?.logo_url ? (
            <BrandLogo
              src={portal.logo_url}
              alt={portalName}
              size="portalHeader"
              priority
            />
          ) : (
            <p className="min-w-0 truncate text-lg font-semibold tracking-tight sm:text-xl">
              {portalName}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={
                tenant.kind === "academy"
                  ? `/academy/${encodeURIComponent(tenant.slug)}`
                  : hasProducts
                    ? "#booking-form"
                    : "#products"
              }
              className="border-border hover:bg-surface-hover focus-visible:ring-accent/50 inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
            >
              {tenant.kind === "academy" ? "Academy website" : "Browse"}
            </a>
            <a
              href={hasProducts ? "#booking-form" : "#products"}
              className="bg-foreground text-background hover:opacity-90 inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium transition-opacity"
            >
              {hasProducts ? "Start booking" : "View sessions"}
            </a>
          </div>
        </div>
      </header>

      <main className={cn("flex-1", showMobileStickyBar && "pb-28 lg:pb-0")}>
        <section className="football-booking-hero relative border-b border-black/[0.06] px-4 py-8 dark:border-white/[0.08] sm:px-6 lg:px-8 lg:py-24">
          <div className="pointer-events-none absolute inset-0 tactical-grid opacity-[0.1]" aria-hidden />
          <div className="pointer-events-none absolute inset-0 pitch-surface-subtle opacity-50" aria-hidden />
          <div className="relative mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10">
            <div className="lg:order-1">
              <p className="text-accent mb-2 text-sm font-medium tracking-wide uppercase lg:mb-4">
                Book football training with {portalName}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl lg:text-6xl">
                {portalName}
              </h1>
              <p className="text-muted mt-3 hidden max-w-xl text-lg leading-relaxed lg:mt-6 lg:block">
                Reserve a place for your child in a few minutes. Pick a session, enter their
                details, and receive confirmation by email.
              </p>
              <div className="mt-6 hidden flex-col gap-3 sm:flex-row lg:flex">
                <a
                  href="#products"
                  className="border-border hover:bg-surface-hover focus-visible:ring-accent/50 inline-flex h-12 items-center justify-center rounded-full border px-8 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
                >
                  View sessions
                </a>
                <a
                  href="#booking-form"
                  className="bg-accent focus-visible:ring-accent/50 inline-flex h-12 items-center justify-center rounded-full px-8 text-sm font-medium text-white outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Book now
                  <ArrowRight className="ml-2 size-4" aria-hidden />
                </a>
              </div>
            </div>

            <div className="glass-panel order-first rounded-2xl p-4 sm:p-6 lg:order-2 lg:rounded-3xl lg:p-8">
              <CalendarCheck className="text-accent hidden size-10 lg:block" aria-hidden />
              <h2 className="text-lg font-semibold tracking-tight lg:mt-5 lg:text-2xl">
                How booking works
              </h2>
              <ol className="text-muted mt-3 space-y-2 text-sm leading-relaxed lg:mt-4 lg:space-y-3">
                <li className="flex gap-3">
                  <span className="bg-accent/12 text-accent flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                    1
                  </span>
                  <span>Choose a session or weekly training package</span>
                </li>
                <li className="flex gap-3">
                  <span className="bg-accent/12 text-accent flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                    2
                  </span>
                  <span>Enter your child&apos;s details and your contact information</span>
                </li>
                <li className="flex gap-3">
                  <span className="bg-accent/12 text-accent flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                    3
                  </span>
                  <span>Complete your booking securely when a session has a fee</span>
                </li>
                <li className="flex gap-3">
                  <span className="bg-accent/12 text-accent flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                    4
                  </span>
                  <span>Receive confirmation by email, then create your family account to manage bookings</span>
                </li>
              </ol>
              {!loading ? (
                <dl className="mt-6 hidden grid-cols-2 gap-3 text-sm lg:grid">
                  <div className="rounded-2xl bg-black/[0.03] p-4 dark:bg-white/[0.04]">
                    <dt className="text-muted">Sessions available</dt>
                    <dd className="mt-1 text-xl font-semibold">{sessions.length}</dd>
                  </div>
                  <div className="rounded-2xl bg-black/[0.03] p-4 dark:bg-white/[0.04]">
                    <dt className="text-muted">Weekly packages</dt>
                    <dd className="mt-1 text-xl font-semibold">{recurringSeries.length}</dd>
                  </div>
                </dl>
              ) : null}
              <button
                type="button"
                onClick={() => void fetchPortalData(true)}
                className="border-border hover:bg-surface-hover focus-visible:ring-accent/50 mt-4 hidden h-10 items-center justify-center rounded-full border px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:mt-5 lg:inline-flex dark:hover:bg-white/[0.06]"
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

        <section id="products" ref={productsRef} className="px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-6xl space-y-14">
            <div className="sr-only" aria-live="polite">
              {selectionAnnouncement}
            </div>
            {!loading && !hasProducts ? (
              <div className="glass-panel rounded-3xl p-8 text-center sm:p-10">
                <CalendarCheck className="text-muted mx-auto size-8" aria-hidden />
                <p className="mt-3 text-lg font-medium">No sessions are currently available</p>
                <p className="text-muted mx-auto mt-2 max-w-md text-sm leading-relaxed">
                  Please check back soon — new training sessions will appear here when they are
                  published.
                </p>
                {supportEmail || supportPhone ? (
                  <div className="mt-6">
                    <SupportSection email={supportEmail} phone={supportPhone} />
                  </div>
                ) : (
                  <div className="mt-6">
                    <SupportSection email={null} />
                  </div>
                )}
              </div>
            ) : null}

            {hasProducts ? (
            <>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Training sessions</h2>
              <p className="text-muted mt-3 max-w-2xl text-base leading-relaxed">
                Upcoming sessions with live spaces remaining. Join the waitlist if a session is
                full.
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
                  <p className="mt-3 font-medium">No upcoming sessions right now</p>
                  <p className="text-muted mt-1 text-sm">
                    New sessions will appear here when they are published.
                  </p>
                </div>
              ) : null}

              {!loading && sessions.length > 0 ? (
                <div
                  className="mt-10 grid gap-4 lg:grid-cols-3"
                  role="radiogroup"
                  aria-label="Available training sessions"
                >
                  {sessions.map((session, sessionIndex) => {
                    const isSelected =
                      selectedType === "session" && selectedId === session.session_id;

                    return (
                      <div
                        key={session.session_id}
                        id={`session-${session.session_id}`}
                        ref={(element) => {
                          sessionCardRefs.current[session.session_id] = element;
                        }}
                        role="radio"
                        aria-checked={isSelected}
                        tabIndex={isSelected || (!selectedId && sessionIndex === 0) ? 0 : -1}
                        onKeyDown={(event) => handleSessionRadioKeyDown(event, sessionIndex)}
                        onClick={() => selectSession(session.session_id)}
                        className={cn(
                          "glass-panel focus-visible:ring-accent/50 flex cursor-pointer flex-col rounded-2xl p-6 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                          isSelected &&
                            "ring-accent border-accent/40 border-l-4 ring-2",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold">
                              {formatSessionDate(session.session_date)}
                            </p>
                            <h3 className="text-muted mt-1 text-sm font-medium">
                              {getSessionTitle(session)}
                            </h3>
                          </div>
                          <AvailabilityBadge
                            isFull={session.is_full}
                            remainingSpaces={session.remaining_spaces}
                          />
                        </div>

                        <div className="mt-5 space-y-1.5 text-sm">
                          {session.location ? <p>{session.location}</p> : null}
                          <p className="font-medium">
                            {session.price > 0
                              ? `${formatPoundsFromPence(session.price)} per child`
                              : "Free session"}
                          </p>
                          <p className="text-muted">{formatMinutes(session.duration_minutes)}</p>
                        </div>

                        {session.notes ? (
                          <p className="text-muted mt-4 rounded-xl bg-black/[0.02] p-3 text-sm dark:bg-white/[0.03]">
                            {session.notes}
                          </p>
                        ) : null}

                        <p
                          className={cn(
                            "mt-6 text-sm font-medium",
                            isSelected ? "text-accent" : "text-muted",
                          )}
                          aria-hidden
                        >
                          {isSelected
                            ? "✓ Selected"
                            : session.is_full
                              ? "Tap to join waitlist"
                              : "Tap to choose session"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {sessions.length > 0 && recurringSeries.length > 0 ? (
              <BookingComparisonPanel />
            ) : null}

            {recurringSeries.length > 0 ? (
            <div>
              <WeeklyPackageValueSection fromPriceLabel={lowestMonthlyPriceLabel} />
            <div className="rounded-3xl border border-black/[0.06] dark:border-white/[0.08]">
              <button
                type="button"
                aria-expanded={recurringOpen}
                aria-controls="weekly-packages-panel"
                onClick={() => setRecurringOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left sm:px-8"
              >
                <div>
                  <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                    Choose a weekly package
                  </h2>
                  <p className="text-muted mt-1 text-sm leading-relaxed">
                    See available days, times, and monthly prices.
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "text-muted size-5 shrink-0 transition-transform",
                    recurringOpen && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>

              <div
                id="weekly-packages-panel"
                hidden={!recurringOpen}
                className="border-t border-black/[0.06] px-6 pb-8 dark:border-white/[0.08] sm:px-8"
              >
                {!loading && recurringSeries.length === 0 ? (
                  <div className="glass-panel mt-6 rounded-3xl p-8 text-center">
                    <Repeat className="text-muted mx-auto size-8" aria-hidden />
                    <p className="mt-3 font-medium">No weekly packages available yet</p>
                    <p className="text-muted mt-1 text-sm">
                      Monthly training packages will appear here when they are published.
                    </p>
                  </div>
                ) : null}

                {!loading && recurringSeries.length > 0 ? (
                  <div
                    className="mt-6 grid gap-4 lg:grid-cols-3"
                    role="radiogroup"
                    aria-label="Weekly training packages"
                  >
                    {recurringSeries.map((series, seriesIndex) => {
                      const isSelected =
                        selectedType === "recurring" &&
                        selectedId === series.recurring_series_id;

                      return (
                        <div
                          key={series.recurring_series_id}
                          id={`series-${series.recurring_series_id}`}
                          ref={(element) => {
                            seriesCardRefs.current[series.recurring_series_id] = element;
                          }}
                          role="radio"
                          aria-checked={isSelected}
                          tabIndex={
                            isSelected ||
                            (!selectedId && sessions.length === 0 && seriesIndex === 0)
                              ? 0
                              : -1
                          }
                          onKeyDown={(event) => handleSeriesRadioKeyDown(event, seriesIndex)}
                          onClick={() => selectRecurringSeries(series.recurring_series_id)}
                          className={cn(
                            "glass-panel focus-visible:ring-accent/50 flex cursor-pointer flex-col rounded-2xl p-6 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                            isSelected &&
                              "ring-accent border-accent/40 border-l-4 ring-2",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-lg font-semibold">
                                {getDayLabel(series.day_of_week)} at{" "}
                                {series.start_time.slice(0, 5)}
                              </p>
                              <h3 className="text-muted mt-1 text-sm font-medium">
                                Weekly training package
                              </h3>
                              <p className="text-muted mt-0.5 text-xs">{series.title}</p>
                            </div>
                            <AvailabilityBadge
                              isFull={false}
                              remainingSpaces={series.remaining_spaces}
                            />
                          </div>

                          <div className="mt-5 space-y-1.5 text-sm">
                            {series.location ? <p>{series.location}</p> : null}
                            <p className="font-medium">
                              {formatPoundsFromPence(
                                series.monthly_price,
                                series.currency.toUpperCase(),
                              )}{" "}
                              per month
                            </p>
                            <p className="text-muted">{formatMinutes(series.duration_minutes)}</p>
                          </div>

                          {series.notes ? (
                            <p className="text-muted mt-4 rounded-xl bg-black/[0.02] p-3 text-sm dark:bg-white/[0.03]">
                              {series.notes}
                            </p>
                          ) : null}

                          <p
                            className={cn(
                              "mt-6 text-sm font-medium",
                              isSelected ? "text-accent" : "text-muted",
                            )}
                            aria-hidden
                          >
                            {isSelected ? "✓ Selected" : "Choose weekly package"}
                          </p>
                        </div>
                      );
                    })}
                </div>
              ) : null}
              </div>
            </div>
            </div>
            ) : null}
            </>
            ) : null}
          </div>
        </section>

        {hasProducts ? (
        <section id="booking-form" ref={bookingFormRef} className="px-4 pb-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl space-y-6">
            {statusBanner === "cancelled" || statusBanner === "timeout" ? (
              <BookingStatusBanner kind={statusBanner} bannerRef={statusBannerRef} />
            ) : null}

            {showConfirmationPanel && completedBooking ? (
              <BookingConfirmationPanel
                booking={completedBooking}
                supportEmail={supportEmail}
                supportPhone={supportPhone}
                panelRef={confirmationPanelRef}
                alternativeSessions={confirmationAlternativeSessions}
                onSelectSession={handleSelectAlternativeSession}
                onViewSessions={handleViewAvailableSessions}
              />
            ) : (
          <div className="glass-panel rounded-3xl p-6 sm:p-8">
            <h2 className="text-2xl font-semibold tracking-tight">Complete your booking</h2>

            {!selectedId ? (
              <p className="text-muted mt-4 text-sm leading-relaxed">
                Choose a training session above to continue with your booking.
              </p>
            ) : null}

            {selectedSession ? (
              <SelectedProductSummary
                label="Selected training session"
                title={getSessionTitle(selectedSession)}
                detail={`${formatSessionDate(selectedSession.session_date)} · ${
                  selectedSession.price > 0
                    ? `${formatPoundsFromPence(selectedSession.price)} per child`
                    : "Free session"
                } · ${
                  selectedSession.is_full
                    ? "Waitlist only"
                    : `${selectedSession.remaining_spaces} spaces left`
                }${selectedSession.location ? ` · ${selectedSession.location}` : ""}`}
                onChangeSelection={handleChangeSelection}
              />
            ) : null}

            {selectedRecurringSeries ? (
              <SelectedProductSummary
                label="Weekly training package"
                title={selectedRecurringSeries.title}
                detail={`Regular weekly place · ${getDayLabel(selectedRecurringSeries.day_of_week)} at ${selectedRecurringSeries.start_time.slice(0, 5)} · ${formatPoundsFromPence(
                  selectedRecurringSeries.monthly_price,
                  selectedRecurringSeries.currency.toUpperCase(),
                )} per month · ${selectedRecurringSeries.remaining_spaces} spaces left${
                  selectedRecurringSeries.location ? ` · ${selectedRecurringSeries.location}` : ""
                }`}
                onChangeSelection={handleChangeSelection}
              />
            ) : null}

            {selectedId ? (
            <form
              ref={formRef}
              className="mt-8 grid gap-4 sm:grid-cols-2"
              onSubmit={handleSubmit}
              noValidate
            >
              {showCheckoutHoldMessage ? (
                <div
                  className="sm:col-span-2 rounded-2xl border border-accent/25 bg-accent/5 p-4 text-sm leading-relaxed"
                  role="status"
                  aria-live="polite"
                >
                  <p className="font-medium">
                    {formatHoldWindowMessage(checkoutExpiresAt)}
                  </p>
                </div>
              ) : null}

              {fieldErrors.childName || fieldErrors.parentEmail ? (
                <div
                  ref={formErrorSummaryRef}
                  tabIndex={-1}
                  role="alert"
                  aria-live="assertive"
                  className="sm:col-span-2 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-900 outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 dark:text-red-100"
                >
                  <p className="font-medium">Please fix the following:</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {fieldErrors.childName ? <li>{fieldErrors.childName}</li> : null}
                    {fieldErrors.parentEmail ? <li>{fieldErrors.parentEmail}</li> : null}
                  </ul>
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="childName">
                  Child name <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  id="childName"
                  ref={childNameRef}
                  required
                  value={childName}
                  onChange={(event) => {
                    setChildName(event.target.value);
                    if (fieldErrors.childName) {
                      setFieldErrors((current) => ({ ...current, childName: undefined }));
                    }
                  }}
                  aria-invalid={fieldErrors.childName ? true : undefined}
                  aria-describedby={fieldErrors.childName ? "childName-error" : undefined}
                  className="border-border bg-background text-foreground focus-visible:ring-accent/50 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                />
                {fieldErrors.childName ? (
                  <p
                    id="childName-error"
                    className="mt-2 break-words text-sm text-red-600 dark:text-red-400"
                  >
                    {fieldErrors.childName}
                  </p>
                ) : null}
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
                  aria-describedby="child-data-privacy-hint"
                  className="border-border bg-background text-foreground focus-visible:ring-accent/50 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
                  className="border-border bg-background text-foreground focus-visible:ring-accent/50 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="parentEmail">
                  Parent email <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  id="parentEmail"
                  ref={parentEmailRef}
                  type="email"
                  autoComplete="email"
                  required
                  value={parentEmail}
                  onChange={(event) => {
                    setParentEmail(event.target.value);
                    if (fieldErrors.parentEmail) {
                      setFieldErrors((current) => ({ ...current, parentEmail: undefined }));
                    }
                  }}
                  aria-invalid={fieldErrors.parentEmail ? true : undefined}
                  aria-describedby={fieldErrors.parentEmail ? "parentEmail-error" : undefined}
                  className="border-border bg-background text-foreground focus-visible:ring-accent/50 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                />
                {fieldErrors.parentEmail ? (
                  <p
                    id="parentEmail-error"
                    className="mt-2 break-words text-sm text-red-600 dark:text-red-400"
                  >
                    {fieldErrors.parentEmail}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="parentPhone">
                  Parent phone
                </label>
                <input
                  id="parentPhone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={parentPhone}
                  onChange={(event) => setParentPhone(event.target.value)}
                  aria-describedby="parentPhone-hint"
                  className="border-border bg-background text-foreground focus-visible:ring-accent/50 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                />
                <p id="parentPhone-hint" className="text-muted mt-2 text-xs leading-relaxed">
                  Optional. Used if your coach needs to contact you about changes.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium" htmlFor="notes">
                  Notes
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  aria-describedby="notes-hint child-data-privacy-hint"
                  className="border-border bg-background text-foreground focus-visible:ring-accent/50 min-h-24 w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  placeholder="Goals, medical notes, availability requests, or anything the coach should know..."
                />
                <p id="notes-hint" className="text-muted mt-2 text-xs leading-relaxed">
                  Only shared with your coach and used for your child&apos;s booking. Medical
                  details and availability notes stay private between you and your coach.
                </p>
              </div>

              <div
                id="child-data-privacy-hint"
                className="sm:col-span-2 rounded-2xl bg-black/[0.02] p-4 text-sm leading-relaxed dark:bg-white/[0.03]"
              >
                <p>
                  Information shared here is only used to manage coaching sessions and communicate
                  with parents.
                </p>
                <p className="mt-2">
                  <Link
                    href="/privacy"
                    className="text-foreground focus-visible:ring-accent/50 font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                  >
                    Read our Privacy Policy
                  </Link>
                </p>
              </div>

              {selectedSession?.is_full && waitlistAlternativeSessions.length > 0 ? (
                <div className="sm:col-span-2">
                  <WaitlistAlternativeSessions
                    sessions={waitlistAlternativeSessions}
                    onSelectSession={selectSession}
                  />
                </div>
              ) : null}

              {selectedSession ? (
                <div className="sm:col-span-2 rounded-2xl bg-black/[0.02] p-4 text-sm dark:bg-white/[0.03]">
                  <p className="font-medium">
                    {selectedSession.is_full
                      ? "This session is full. Submitting will place your child on the waitlist. No payment is required for the waitlist."
                      : selectedSession.price > 0
                        ? "Pricing is per child. Complete your booking securely to confirm the place."
                        : "This session is free and will confirm immediately after you submit."}
                  </p>
                </div>
              ) : null}

              {selectedRecurringSeries ? (
                <div className="sm:col-span-2 rounded-2xl bg-black/[0.02] p-4 text-sm dark:bg-white/[0.03]">
                  <p className="font-medium">
                    Your child gets a regular weekly place with one monthly payment.
                  </p>
                </div>
              ) : null}

              {hasPaidCheckout ? <SecurePaymentPanel /> : null}

              {error ? <FormErrorAlert message={error} className="sm:col-span-2" /> : null}

              <div className="relative sm:col-span-2">
                <BotProtectionFields onTurnstileToken={setTurnstileToken} />
              </div>

              <div className="sm:col-span-2">
                <SupportSection email={supportEmail} phone={supportPhone} />
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={submitting || confirmingCheckout || !selectedId}
                  className="bg-accent focus-visible:ring-accent/50 inline-flex h-11 w-full items-center justify-center rounded-full px-6 text-sm font-medium text-white outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 sm:w-auto"
                >
                  {submitting || confirmingCheckout ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                      {confirmingCheckout
                        ? POLL_STATUS_MESSAGES[pollMessageIndex]
                        : "Submitting..."}
                    </>
                  ) : (
                    submitLabel
                  )}
                </button>
              </div>
            </form>
            ) : null}
          </div>
            )}
          </div>
        </section>
        ) : null}
      </main>

      {showMobileStickyBar ? (
        <MobileStickyBookingBar
          productName={stickyBarProductName}
          priceLabel={stickyBarPriceLabel}
          onContinue={scrollToBookingForm}
        />
      ) : null}

      <footer
        role="contentinfo"
        className="border-t border-black/[0.06] px-4 py-10 dark:border-white/[0.08] sm:px-6 lg:px-8"
      >
        <div className="text-muted mx-auto flex max-w-3xl flex-col items-center gap-3 text-center text-sm">
          <p className="leading-relaxed font-medium text-foreground">Questions? Contact your coach</p>
          {supportEmail || supportPhone ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              {supportEmail ? (
                <a
                  href={`mailto:${supportEmail}`}
                  className="text-foreground focus-visible:ring-accent/50 inline-flex min-h-11 items-center justify-center rounded-full px-4 font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2"
                >
                  {supportEmail}
                </a>
              ) : null}
              {supportPhone ? (
                <a
                  href={toTelHref(supportPhone)}
                  aria-label={`Call your coach on ${supportPhone}`}
                  className="text-foreground focus-visible:ring-accent/50 inline-flex min-h-11 items-center justify-center rounded-full px-4 font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2"
                >
                  Call your coach
                </a>
              ) : null}
            </div>
          ) : (
            <p className="leading-relaxed">Please contact your coach directly.</p>
          )}
          <nav
            className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-2"
            aria-label="Legal links"
          >
            <Link
              href="/privacy"
              className="text-foreground focus-visible:ring-accent/50 font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-foreground focus-visible:ring-accent/50 font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              Terms of Service
            </Link>
          </nav>
          <p className="text-muted/80 pt-2 text-xs">Powered by Awarix</p>
        </div>
      </footer>
    </div>
  );
}
