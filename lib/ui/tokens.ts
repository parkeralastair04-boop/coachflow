/**
 * Design tokens for Awarix UI consistency.
 * Prefer these over one-off Tailwind values in new UI.
 */

export const ICON_SIZES = {
  xs: "size-3.5",
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
  xl: "size-7",
} as const;

export type IconSize = keyof typeof ICON_SIZES;

/** Default Lucide size classes by context. */
export const ICON_CONTEXT = {
  inline: ICON_SIZES.sm,
  button: ICON_SIZES.sm,
  empty: ICON_SIZES.xl,
  header: ICON_SIZES.md,
  nav: ICON_SIZES.md,
} as const;

export const TYPE = {
  pageTitle: "text-2xl font-semibold tracking-tight sm:text-3xl",
  sectionTitle: "text-lg font-semibold tracking-tight",
  cardTitle: "text-base font-semibold tracking-tight",
  statValue: "text-3xl font-semibold tracking-tight tabular-nums",
  label: "text-sm font-medium",
  description: "text-muted text-sm leading-relaxed",
  helper: "text-muted text-xs leading-relaxed",
  tableHeader: "text-muted text-xs font-semibold uppercase tracking-wide",
  tableCell: "text-sm",
  marketingHero: "text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl",
  marketingLead: "text-muted text-base leading-relaxed sm:text-lg",
} as const;

export const LAYOUT = {
  pageMax: "mx-auto w-full max-w-6xl",
  pageStack: "space-y-8",
} as const;

export const SPACE = {
  fieldGap: "gap-4",
  formGap: "gap-5",
  sectionGap: "gap-6",
  stackTight: "gap-2",
  stack: "gap-3",
} as const;

/** Shared surface recipes — prefer over inventing glass/football combinations. */
export const SURFACE = {
  panel: "football-panel rounded-2xl p-5 sm:p-6",
  panelInteractive: "football-panel football-panel-interactive rounded-2xl p-5 sm:p-6",
  panelSpacious: "football-panel rounded-2xl p-6 sm:p-8",
  well: "rounded-xl bg-surface-subtle",
  iconBadge:
    "bg-accent/12 ring-accent/25 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1",
  iconBadgeSm:
    "bg-accent/12 ring-accent/25 flex size-10 shrink-0 items-center justify-center rounded-xl ring-1",
} as const;

export const MOTION = {
  durationFast: "150ms",
  duration: "180ms",
  durationSlow: "220ms",
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
} as const;

export const FOCUS_RING =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background";
