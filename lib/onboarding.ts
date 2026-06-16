export const ONBOARDING_METADATA_KEYS = {
  completedAt: "onboarding_completed_at",
  pausedAt: "onboarding_paused_at",
  currentStep: "onboarding_current_step",
  bookingLinkShared: "onboarding_booking_link_shared",
} as const;

export const ONBOARDING_STEP_COUNT = 6;

export type OnboardingStepId = 1 | 2 | 3 | 4 | 5 | 6;

export type OnboardingMetadata = {
  completedAt: string | null;
  pausedAt: string | null;
  currentStep: OnboardingStepId;
  bookingLinkShared: boolean;
};

export type OnboardingChecklistKey =
  | "account"
  | "player"
  | "team"
  | "session"
  | "booking_link";

export type OnboardingChecklistItem = {
  key: OnboardingChecklistKey;
  label: string;
  complete: boolean;
};

export type OnboardingProgress = {
  items: OnboardingChecklistItem[];
  completedCount: number;
  totalCount: number;
  percent: number;
  isComplete: boolean;
};

function parseStep(value: unknown): OnboardingStepId {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (parsed >= 1 && parsed <= ONBOARDING_STEP_COUNT) {
    return parsed as OnboardingStepId;
  }
  return 1;
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
    currentStep: parseStep(metadata?.[ONBOARDING_METADATA_KEYS.currentStep]),
    bookingLinkShared,
  };
}

export function isOnboardingComplete(metadata: Record<string, unknown> | null | undefined): boolean {
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
  hasPlayer: boolean;
  hasTeam: boolean;
  hasSession: boolean;
  bookingLinkShared: boolean;
}): OnboardingProgress {
  const items: OnboardingChecklistItem[] = [
    { key: "account", label: "Create Account", complete: true },
    { key: "player", label: "Add First Player", complete: args.hasPlayer },
    { key: "team", label: "Create First Team", complete: args.hasTeam },
    { key: "session", label: "Create First Session", complete: args.hasSession },
    {
      key: "booking_link",
      label: "Share Booking Link",
      complete: args.bookingLinkShared,
    },
  ];

  const completedCount = items.filter((item) => item.complete).length;
  const totalCount = items.length;
  const percent = Math.round((completedCount / totalCount) * 100);

  return {
    items,
    completedCount,
    totalCount,
    percent,
    isComplete: completedCount === totalCount,
  };
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
