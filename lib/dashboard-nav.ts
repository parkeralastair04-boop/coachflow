import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  BellRing,
  Brain,
  Building2,
  CalendarRange,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  Gift,
  HelpCircle,
  LayoutDashboard,
  Palette,
  PoundSterling,
  Rocket,
  Settings,
  Tent,
  UserSquare2,
  Shield,
  Users,
  Wallet,
} from "lucide-react";
import type { FeatureKey } from "@/lib/subscription";

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** When set, item is locked if the feature is not on the current plan. */
  feature?: FeatureKey;
  external?: boolean;
};

export type DashboardNavSection = {
  id: string;
  title: string;
  icon: LucideIcon;
  items: DashboardNavItem[];
};

export const DASHBOARD_NAV_SECTIONS: DashboardNavSection[] = [
  {
    id: "overview",
    title: "Overview",
    icon: LayoutDashboard,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard#getting-started", label: "Getting Started", icon: Rocket },
      { href: "/dashboard/help", label: "Help & Support", icon: HelpCircle },
    ],
  },
  {
    id: "coaching",
    title: "Coaching Operations",
    icon: Users,
    items: [
      { href: "/dashboard/players", label: "Players", icon: UserSquare2, feature: "players" },
      { href: "/dashboard/teams", label: "Teams", icon: Shield },
      {
        href: "/dashboard/availability",
        label: "Booking & Availability",
        icon: CalendarRange,
        feature: "sessions",
      },
      { href: "/dashboard/sessions", label: "Sessions", icon: CalendarDays, feature: "sessions" },
      {
        href: "/dashboard/registers",
        label: "Registers",
        icon: ClipboardList,
        feature: "group_registers",
      },
      { href: "/dashboard/camps", label: "Camps", icon: Tent, feature: "camps" },
    ],
  },
  {
    id: "reports-insights",
    title: "Reports & Insights",
    icon: Brain,
    items: [
      { href: "/dashboard/reports", label: "Reports", icon: FileText, feature: "reports" },
      { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, feature: "analytics" },
      { href: "/dashboard/insights", label: "AI Insights", icon: Brain, feature: "insights" },
    ],
  },
  {
    id: "communication",
    title: "Communication",
    icon: BellRing,
    items: [
      {
        href: "/dashboard/automations",
        label: "Automations",
        icon: BellRing,
        feature: "automations",
      },
      {
        href: "/dashboard/settings/notifications",
        label: "Notifications",
        icon: Bell,
        feature: "push_notifications",
      },
    ],
  },
  {
    id: "payments-growth",
    title: "Payments & Growth",
    icon: PoundSterling,
    items: [
      {
        href: "/dashboard/payments",
        label: "Parent Payments",
        icon: Wallet,
        feature: "parent_payments",
      },
      { href: "/dashboard/referrals", label: "Referrals", icon: Gift, feature: "referrals" },
    ],
  },
  {
    id: "settings",
    title: "Settings",
    icon: Settings,
    items: [
      {
        href: "/dashboard/settings/account",
        label: "Account",
        icon: Settings,
      },
      { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
      {
        href: "/dashboard/settings/appearance",
        label: "Appearance",
        icon: Palette,
      },
      {
        href: "/dashboard/academy",
        label: "Academy Settings",
        icon: Building2,
        feature: "white_label",
      },
    ],
  },
];

export const SIDEBAR_STORAGE_KEY = "coachflow:sidebar-sections:v2";

const DEFAULT_EXPANDED_SECTIONS = new Set(["overview", "coaching", "settings"]);

export function getPathBase(href: string): string {
  if (href.startsWith("mailto:") || href.startsWith("http")) return href;
  return href.split("#")[0] ?? href;
}

export function getPathHash(href: string): string | null {
  const hash = href.split("#")[1];
  return hash ? `#${hash}` : null;
}

export function normalizeUrlHash(hash: string): string {
  if (!hash) return "";
  return hash.startsWith("#") ? hash : `#${hash}`;
}

export function isNavItemActive(
  pathname: string,
  href: string,
  currentHash = "",
): boolean {
  const base = getPathBase(href);
  const itemHash = getPathHash(href);
  const normalizedHash = normalizeUrlHash(currentHash);

  if (base.startsWith("mailto:") || base.startsWith("http")) return false;
  if (itemHash) {
    return pathname === base && normalizedHash === itemHash;
  }
  if (base === "/dashboard") {
    return pathname === "/dashboard" && !normalizedHash;
  }
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function findSectionIdForPath(
  pathname: string,
  sections: DashboardNavSection[] = DASHBOARD_NAV_SECTIONS,
  currentHash = "",
): string | null {
  for (const section of sections) {
    if (section.items.some((item) => isNavItemActive(pathname, item.href, currentHash))) {
      return section.id;
    }
  }
  return null;
}

export function getDefaultSectionState(
  pathname: string,
  currentHash = "",
): Record<string, boolean> {
  const activeId = findSectionIdForPath(pathname, DASHBOARD_NAV_SECTIONS, currentHash);
  return Object.fromEntries(
    DASHBOARD_NAV_SECTIONS.map((section) => [
      section.id,
      DEFAULT_EXPANDED_SECTIONS.has(section.id) || section.id === activeId,
    ]),
  );
}
