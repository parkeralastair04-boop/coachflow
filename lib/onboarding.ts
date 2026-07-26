export const ONBOARDING_METADATA_KEYS = {
  completedAt: "onboarding_completed_at",
  pausedAt: "onboarding_paused_at",
  currentStep: "onboarding_current_step",
  bookingLinkShared: "onboarding_booking_link_shared",
} as const;

/** Critical-path wizard steps (academy → session → share link → done). */
export const ONBOARDING_STEP_COUNT = 4;

export type OnboardingStepId = 1 | 2 | 3 | 4;

export type OnboardingMetadata = {
  completedAt: string | null;
  pausedAt: string | null;
  currentStep: OnboardingStepId;
  bookingLinkShared: boolean;
};

/** Checklist keys for the activation critical path only. */
export type OnboardingChecklistKey =
  | "academy"
  | "session"
  | "booking_page"
  | "booking_link";

export type OnboardingChecklistItem = {
  key: OnboardingChecklistKey;
  label: string;
  complete: boolean;
  /** Deep-link into the next action. */
  href?: string;
  /** Wizard step to resume when continuing setup. */
  resumeStep?: OnboardingStepId;
};

export type OnboardingProgress = {
  items: OnboardingChecklistItem[];
  completedCount: number;
  totalCount: number;
  percent: number;
  isComplete: boolean;
  nextIncomplete: OnboardingChecklistItem | null;
};

/**
 * Map legacy 6-step wizard positions onto the 4-step critical path.
 * Old: 1 academy, 2 player, 3 team, 4 session, 5 share, 6 ready
 * New: 1 academy, 2 session, 3 share, 4 ready
 *
 * Values 1–4 are already on the new scale and must pass through unchanged.
 * Only legacy values 5–6 (and anything above) are remapped.
 */
export function migrateOnboardingStep(value: unknown): OnboardingStepId {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  if (parsed <= 4) return parsed as OnboardingStepId;
  if (parsed === 5) return 3;
  return 4;
}

export function parseOnboardingMetadata(
  metadata: Record<string, unknown> | null | undefined,
): OnboardingMetadata {
  const completedAtRaw = metadata?.[ONBOARDING_METADATA_KEYS.completedAt];
  const completedAt = typeof completedAtRaw === "string" ? completedAtRaw : null;
  const pausedAtRaw = metadata?.[ONBOARDING_METADATA_KEYS.pausedAt];
  const pausedAt = typeof pausedAtRaw === "string" ? pausedAtRaw : null;
  const bookingLinkShared =
    metadata?.[ONBOARDING_METADATA_KEYS.bookingLinkShared] === true ||
    metadata?.[ONBOARDING_METADATA_KEYS.bookingLinkShared] === "true";

  return {
    completedAt,
    pausedAt,
    currentStep: migrateOnboardingStep(
      metadata?.[ONBOARDING_METADATA_KEYS.currentStep],
    ),
    bookingLinkShared,
  };
}

export function isOnboardingComplete(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  return Boolean(parseOnboardingMetadata(metadata).completedAt);
}

/** Auto-open wizard only for brand-new coaches who have not paused or finished. */
export function shouldAutoShowOnboarding(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  const state = parseOnboardingMetadata(metadata);
  return !state.completedAt && !state.pausedAt;
}

export function buildOnboardingProgress(args: {
  hasAcademy: boolean;
  hasSession: boolean;
  hasBookingPage: boolean;
  bookingLinkShared: boolean;
}): OnboardingProgress {
  const items: OnboardingChecklistItem[] = [
    {
      key: "academy",
      label: "Name your academy",
      complete: args.hasAcademy,
      href: "/dashboard#getting-started",
      resumeStep: 1,
    },
    {
      key: "session",
      label: "Publish your first training",
      complete: args.hasSession,
      href: "/dashboard/sessions",
      resumeStep: 2,
    },
    {
      key: "booking_page",
      label: "Get your booking page live",
      complete: args.hasBookingPage,
      href: "/dashboard#getting-started",
      resumeStep: 1,
    },
    {
      key: "booking_link",
      label: "Share your booking link",
      complete: args.bookingLinkShared,
      href: "/dashboard#getting-started",
      resumeStep: 3,
    },
  ];

  const completedCount = items.filter((item) => item.complete).length;
  const totalCount = items.length;
  const percent = Math.round((completedCount / totalCount) * 100);
  const nextIncomplete = items.find((item) => !item.complete) ?? null;

  return {
    items,
    completedCount,
    totalCount,
    percent,
    isComplete: completedCount === totalCount,
    nextIncomplete,
  };
}

/** First-run dashboard: no players, sessions, or bookings yet. */
export function isFirstRunDashboard(args: {
  hasPlayer: boolean;
  hasSession: boolean;
  hasBooking: boolean;
}): boolean {
  return !args.hasPlayer && !args.hasSession && !args.hasBooking;
}

/** Critical path unfinished — simplify nav until done. */
export function isActivationSetupIncomplete(args: {
  completedAt: string | null;
  progress: OnboardingProgress;
}): boolean {
  if (args.completedAt) return false;
  return !args.progress.isComplete;
}

export function getDefaultSessionDateTime(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(17, 0, 0, 0);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function getPortalOrigin(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin.replace(/\/$/, "");
  return "";
}
