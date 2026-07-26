import type { LucideIcon } from "lucide-react";

/** Visual identity for dashboard metric tiles — football academy zones. */
export type DashboardMetricTheme = {
  stripe: string;
  iconWrap: string;
  icon: string;
  glow: string;
};

export const DASHBOARD_METRIC_THEMES = {
  squad: {
    stripe: "bg-emerald-400",
    iconWrap: "bg-emerald-500/15 ring-emerald-500/25",
    icon: "text-emerald-400",
    glow: "shadow-[0_0_40px_-12px_rgba(52,211,153,0.35)]",
  },
  sessions: {
    stripe: "bg-amber-400",
    iconWrap: "bg-amber-500/15 ring-amber-500/25",
    icon: "text-amber-400",
    glow: "shadow-[0_0_40px_-12px_rgba(251,191,36,0.3)]",
  },
  bookings: {
    stripe: "bg-sky-400",
    iconWrap: "bg-sky-500/15 ring-sky-500/25",
    icon: "text-sky-400",
    glow: "shadow-[0_0_40px_-12px_rgba(56,189,248,0.3)]",
  },
  income: {
    stripe: "bg-lime-400",
    iconWrap: "bg-lime-500/15 ring-lime-500/25",
    icon: "text-lime-400",
    glow: "shadow-[0_0_40px_-12px_rgba(163,230,53,0.25)]",
  },
} as const satisfies Record<string, DashboardMetricTheme>;

export type DashboardMetricThemeKey = keyof typeof DASHBOARD_METRIC_THEMES;

export type DashboardSectionIcon = LucideIcon;
