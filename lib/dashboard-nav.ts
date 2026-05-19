import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  BellRing,
  Brain,
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  Gift,
  HelpCircle,
  LayoutDashboard,
  LifeBuoy,
  Palette,
  PoundSterling,
  Tent,
  UserSquare2,
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
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    id: "coaching",
    title: "Coaching Operations",
    icon: Users,
    items: [
      { href: "/dashboard/players", label: "Players", icon: UserSquare2, feature: "players" },
      { href: "/dashboard/sessions", label: "Sessions", icon: CalendarDays, feature: "sessions" },
      {
        href: "/dashboard/registers",
        label: "Registers",
        icon: ClipboardList,
        feature: "group_registers",
      },
      { href: "/dashboard/camps", label: "Camps", icon: Tent, feature: "camps" },
      { href: "/book", label: "Bookings", icon: CalendarCheck, external: true },
    ],
  },
  {
    id: "ai-reports",
    title: "AI & Reports",
    icon: Brain,
    items: [
      { href: "/dashboard/reports", label: "Reports", icon: FileText, feature: "reports" },
      { href: "/dashboard/insights", label: "Insights", icon: Brain, feature: "insights" },
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
      { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
      {
        href: "/dashboard/payments",
        label: "Payments",
        icon: Wallet,
        feature: "parent_payments",
      },
      {
        href: "/dashboard/analytics",
        label: "Analytics",
        icon: BarChart3,
        feature: "analytics",
      },
      { href: "/dashboard/referrals", label: "Referrals", icon: Gift, feature: "referrals" },
    ],
  },
  {
    id: "academy",
    title: "Academy",
    icon: Building2,
    items: [
      {
        href: "/dashboard/academy",
        label: "Academy Settings",
        icon: Building2,
        feature: "white_label",
      },
    ],
  },
  {
    id: "settings-help",
    title: "Settings & Help",
    icon: LifeBuoy,
    items: [
      {
        href: "/dashboard/settings/notifications",
        label: "Notification Settings",
        icon: Bell,
        feature: "push_notifications",
      },
      {
        href: "/dashboard/settings/appearance",
        label: "Appearance",
        icon: Palette,
      },
      { href: "/dashboard/help", label: "Help & Support", icon: HelpCircle },
    ],
  },
];

export const SIDEBAR_STORAGE_KEY = "coachflow:sidebar-sections";

export function getPathBase(href: string): string {
  if (href.startsWith("mailto:") || href.startsWith("http")) return href;
  return href.split("#")[0] ?? href;
}

export function isNavItemActive(pathname: string, href: string): boolean {
  const base = getPathBase(href);
  if (base.startsWith("mailto:") || base.startsWith("http")) return false;
  if (base === "/dashboard") return pathname === "/dashboard";
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function findSectionIdForPath(
  pathname: string,
  sections: DashboardNavSection[] = DASHBOARD_NAV_SECTIONS,
): string | null {
  for (const section of sections) {
    if (section.items.some((item) => isNavItemActive(pathname, item.href))) {
      return section.id;
    }
  }
  return null;
}

export function getDefaultSectionState(pathname: string): Record<string, boolean> {
  const activeId = findSectionIdForPath(pathname);
  return Object.fromEntries(
    DASHBOARD_NAV_SECTIONS.map((section) => [
      section.id,
      section.id === activeId || section.id === "overview",
    ]),
  );
}
