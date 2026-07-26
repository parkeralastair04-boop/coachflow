import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  BellRing,
  ClipboardList,
  ClipboardPen,
  Cone,
  CreditCard,
  Film,
  Flag,
  Gift,
  HelpCircle,
  Inbox,
  LandPlot,
  LayoutDashboard,
  Mail,
  Newspaper,
  Palette,
  PoundSterling,
  Rocket,
  Settings,
  Shirt,
  Tent,
  Trophy,
  UserRound,
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
      { href: "/dashboard#getting-started", label: "Match-Ready", icon: Rocket },
      { href: "/dashboard/help", label: "Help & Support", icon: HelpCircle },
    ],
  },
  {
    id: "coaching",
    title: "On the Pitch",
    icon: LandPlot,
    items: [
      { href: "/dashboard/players", label: "Active Squad", icon: Shirt, feature: "players" },
      { href: "/dashboard/teams", label: "Squads", icon: Flag },
      {
        href: "/dashboard/availability",
        label: "When you coach",
        icon: LandPlot,
        feature: "sessions",
      },
      {
        href: "/dashboard/sessions",
        label: "Training Sessions",
        icon: Cone,
        feature: "sessions",
      },
      {
        href: "/dashboard/registers",
        label: "Session Registers",
        icon: ClipboardList,
        feature: "group_registers",
      },
      { href: "/dashboard/camps", label: "Holiday Camps", icon: Tent, feature: "camps" },
      {
        href: "/dashboard/matches",
        label: "Match Centre",
        icon: Trophy,
        feature: "match_centre",
      },
      {
        href: "/dashboard/training",
        label: "Training Planner",
        icon: ClipboardPen,
        feature: "training_planner",
      },
      {
        href: "/dashboard/video",
        label: "Video Analysis",
        icon: Film,
        feature: "video_analysis",
      },
    ],
  },
  {
    id: "reports-insights",
    title: "Development & Performance",
    icon: Activity,
    items: [
      {
        href: "/dashboard/reports",
        label: "Player Development",
        icon: ClipboardPen,
        feature: "reports",
      },
      {
        href: "/dashboard/analytics",
        label: "Performance Insights",
        icon: Activity,
        feature: "analytics",
      },
      {
        href: "/dashboard/insights",
        label: "AI Coaching Insights",
        icon: Activity,
        feature: "insights",
      },
    ],
  },
  {
    id: "communication",
    title: "Club Communication",
    icon: BellRing,
    items: [
      {
        href: "/dashboard/communication",
        label: "Parent Updates",
        icon: Mail,
        feature: "parent_emails",
      },
      {
        href: "/dashboard/news",
        label: "Academy News",
        icon: Newspaper,
        feature: "academy_news",
      },
      {
        href: "/dashboard/enquiries",
        label: "Family Enquiries",
        icon: Inbox,
        feature: "academy_enquiries",
      },
      {
        href: "/dashboard/automations",
        label: "Automatic Messages",
        icon: BellRing,
        feature: "automations",
      },
      {
        href: "/dashboard/settings/notifications",
        label: "Pitch-Side Alerts",
        icon: Bell,
        feature: "push_notifications",
      },
    ],
  },
  {
    id: "payments-growth",
    title: "Academy Finance",
    icon: PoundSterling,
    items: [
      {
        href: "/dashboard/payments",
        label: "Parent Payments",
        icon: Wallet,
        feature: "parent_payments",
      },
      {
        href: "/dashboard/finance",
        label: "Finance Centre",
        icon: Activity,
        feature: "finance_centre",
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
        label: "Profile",
        icon: UserRound,
      },
      { href: "/dashboard/billing", label: "Your Awarix plan", icon: CreditCard },
      {
        href: "/dashboard/settings/appearance",
        label: "Appearance",
        icon: Palette,
      },
      {
        href: "/dashboard/academy",
        label: "Academy Settings",
        icon: Flag,
        feature: "white_label",
      },
    ],
  },
];

export const SIDEBAR_STORAGE_KEY = "awarix:sidebar-sections:v2";

/** Shown under nav items until the coach receives their first parent booking. */
export const SETUP_PHASE_NAV_HINTS: Partial<Record<string, string>> = {
  "/dashboard/analytics": "Best after your first parent booking",
  "/dashboard/camps": "Set up once regular sessions are running",
  "/dashboard/referrals": "Invite other coaches when you're live",
  "/dashboard/automations": "Turn on after parents start booking",
  "/dashboard/insights": "Unlocks once you have session data",
};

/** Nav section ids visible while the activation critical path is incomplete. */
export const SETUP_PHASE_NAV_SECTION_IDS = new Set([
  "overview",
  "coaching",
  "settings",
]);

/** Href allowlist during setup (critical path + essentials). */
export const SETUP_PHASE_NAV_HREFS = new Set([
  "/dashboard",
  "/dashboard#getting-started",
  "/dashboard/help",
  "/dashboard/players",
  "/dashboard/teams",
  "/dashboard/sessions",
  "/dashboard/availability",
  "/dashboard/settings/account",
  "/dashboard/settings/appearance",
  "/dashboard/billing",
]);

export function filterNavForSetupPhase(
  sections: DashboardNavSection[],
): DashboardNavSection[] {
  return sections
    .filter((section) => SETUP_PHASE_NAV_SECTION_IDS.has(section.id))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => SETUP_PHASE_NAV_HREFS.has(item.href)),
    }))
    .filter((section) => section.items.length > 0);
}

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
