import type { PlanId } from "@/lib/billing";
import { getPlanById } from "@/lib/billing";

export const PLAN_ORDER = ["starter", "pro", "academy"] as const satisfies readonly PlanId[];

/** Keys used for `hasFeatureAccess`, sidebar locks, and API checks. */
export const FEATURE_KEYS = [
  "players",
  "sessions",
  "booking_portal",
  "group_registers",
  "offline_registers",
  "reports",
  "saved_reports",
  "parent_emails",
  "automations",
  "analytics",
  "referrals",
  "camps",
  "parent_payments",
  "checkout_links",
  "insights",
  "push_notifications",
  "white_label",
  "multi_academy",
  "custom_domains",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type FeatureDefinition = {
  /** Stable marketing / audit identifier */
  id: string;
  /** Access-control key (may be shared by multiple definitions) */
  gateFeature: FeatureKey;
  title: string;
  benefits: readonly string[];
  minimumPlan: PlanId;
  comparisonLabel: string;
  category: string;
};

export const FEATURE_DEFINITIONS: readonly FeatureDefinition[] = [
  {
    id: "players",
    gateFeature: "players",
    title: "Player CRM",
    benefits: [
      "Centralise every player and parent contact",
      "Notes and squad context in one searchable list",
    ],
    minimumPlan: "starter",
    comparisonLabel: "Player CRM",
    category: "Core Platform",
  },
  {
    id: "sessions",
    gateFeature: "sessions",
    title: "Session Scheduling",
    benefits: [
      "Plan coaching blocks with dates and locations",
      "Keep your weekly calendar organised for staff and parents",
    ],
    minimumPlan: "starter",
    comparisonLabel: "Session Scheduling",
    category: "Core Platform",
  },
  {
    id: "booking_portal",
    gateFeature: "booking_portal",
    title: "Public Booking Portal",
    benefits: [
      "Parents book trials, sessions, and camps online",
      "Structured enquiries flow straight into your CRM",
    ],
    minimumPlan: "starter",
    comparisonLabel: "Public Booking Portal",
    category: "Camps & Booking",
  },
  {
    id: "group_registers",
    gateFeature: "group_registers",
    title: "Group Registers",
    benefits: [
      "Mark attendance quickly on mobile",
      "See who attended each session at a glance",
    ],
    minimumPlan: "pro",
    comparisonLabel: "Group Registers",
    category: "Core Platform",
  },
  {
    id: "offline_registers",
    gateFeature: "offline_registers",
    title: "Offline Registers",
    benefits: [
      "Mark rolls without signal on the pitch",
      "Sync attendance automatically when you reconnect",
    ],
    minimumPlan: "academy",
    comparisonLabel: "Offline Registers",
    category: "Camps & Booking",
  },
  {
    id: "ai_reports",
    gateFeature: "reports",
    title: "AI Progress Reports",
    benefits: [
      "Turn session notes into parent-ready summaries in seconds",
      "Edit tone and detail before you save or send",
    ],
    minimumPlan: "pro",
    comparisonLabel: "AI Progress Reports",
    category: "AI & Reports",
  },
  {
    id: "pdf_exports",
    gateFeature: "reports",
    title: "PDF Report Exports",
    benefits: [
      "Download branded PDFs for email or print",
      "Share professional progress updates offline",
    ],
    minimumPlan: "pro",
    comparisonLabel: "PDF Report Exports",
    category: "AI & Reports",
  },
  {
    id: "saved_reports",
    gateFeature: "saved_reports",
    title: "Saved Reports Library",
    benefits: [
      "Store every report in one history per player",
      "Re-send or download past updates without re-generating",
    ],
    minimumPlan: "pro",
    comparisonLabel: "Saved Reports",
    category: "AI & Reports",
  },
  {
    id: "parent_emails",
    gateFeature: "parent_emails",
    title: "Parent Email Reports",
    benefits: [
      "Email reports directly from CoachFlow",
      "Branded templates using your academy identity",
    ],
    minimumPlan: "pro",
    comparisonLabel: "Parent Email Reports",
    category: "AI & Reports",
  },
  {
    id: "insights",
    gateFeature: "insights",
    title: "AI Business Insights",
    benefits: [
      "AI priorities from live academy data",
      "Retention, revenue, and camp opportunities in one briefing",
    ],
    minimumPlan: "academy",
    comparisonLabel: "AI Business Insights",
    category: "AI & Reports",
  },
  {
    id: "automations",
    gateFeature: "automations",
    title: "CRM Automations",
    benefits: [
      "Automated parent emails for bookings and follow-ups",
      "Consistent communication without manual copy-paste",
    ],
    minimumPlan: "pro",
    comparisonLabel: "CRM Automations",
    category: "Communication & Automation",
  },
  {
    id: "push_notifications",
    gateFeature: "push_notifications",
    title: "Push Notifications",
    benefits: [
      "Native mobile alerts for bookings and payments",
      "Choose exactly which events ping your phone",
    ],
    minimumPlan: "academy",
    comparisonLabel: "Push Notifications",
    category: "Communication & Automation",
  },
  {
    id: "analytics",
    gateFeature: "analytics",
    title: "Analytics Dashboard",
    benefits: [
      "Track players, revenue, reports, and subscriptions",
      "Spot trends before they affect cashflow",
    ],
    minimumPlan: "pro",
    comparisonLabel: "Analytics Dashboard",
    category: "Growth & Marketing",
  },
  {
    id: "referrals",
    gateFeature: "referrals",
    title: "Referral Program",
    benefits: [
      "Invite other coaches with your personal link",
      "Earn account credit when referrals convert",
    ],
    minimumPlan: "pro",
    comparisonLabel: "Referral Program",
    category: "Growth & Marketing",
  },
  {
    id: "camps",
    gateFeature: "camps",
    title: "Camp Management",
    benefits: [
      "Publish holiday camps with pricing and capacity",
      "Track enrolments and waitlists in one place",
    ],
    minimumPlan: "academy",
    comparisonLabel: "Camp Management",
    category: "Camps & Booking",
  },
  {
    id: "parent_payments",
    gateFeature: "parent_payments",
    title: "Parent Payments",
    benefits: [
      "Stripe customers and recurring parent subscriptions",
      "See failed payments before they become churn",
    ],
    minimumPlan: "academy",
    comparisonLabel: "Parent Payments",
    category: "Payments & Billing",
  },
  {
    id: "checkout_links",
    gateFeature: "checkout_links",
    title: "Checkout Links",
    benefits: [
      "Send one-off or recurring payment links to parents",
      "Collect fees without manual bank transfers",
    ],
    minimumPlan: "academy",
    comparisonLabel: "Checkout Links",
    category: "Payments & Billing",
  },
  {
    id: "white_label",
    gateFeature: "white_label",
    title: "White Label Branding",
    benefits: [
      "Your logo, colours, and academy name everywhere",
      "Parents see your brand—not generic software",
    ],
    minimumPlan: "academy",
    comparisonLabel: "White Label Branding",
    category: "White Label & Academy",
  },
  {
    id: "multi_academy",
    gateFeature: "multi_academy",
    title: "Multi-Academy Support",
    benefits: [
      "Invite multiple coaches to one academy workspace",
      "Shared settings with per-coach operations",
    ],
    minimumPlan: "academy",
    comparisonLabel: "Multi-Academy Support",
    category: "White Label & Academy",
  },
  {
    id: "custom_domains",
    gateFeature: "custom_domains",
    title: "Custom Domains",
    benefits: [
      "Host booking and parent flows on your domain",
      "Professional URLs for marketing and email",
    ],
    minimumPlan: "academy",
    comparisonLabel: "Custom Domains",
    category: "White Label & Academy",
  },
] as const;

export type FeatureDefinitionId = (typeof FEATURE_DEFINITIONS)[number]["id"];

const PLAN_RANK: Record<PlanId, number> = {
  starter: 0,
  pro: 1,
  academy: 2,
};

export function planMeetsMinimum(plan: PlanId, minimumPlan: PlanId): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[minimumPlan];
}

/** Builds plan → feature access map from `FEATURE_DEFINITIONS`. */
export function buildFeatureAccess(): Record<PlanId, readonly FeatureKey[]> {
  const sets: Record<PlanId, Set<FeatureKey>> = {
    starter: new Set(),
    pro: new Set(),
    academy: new Set(),
  };

  for (const definition of FEATURE_DEFINITIONS) {
    for (const plan of PLAN_ORDER) {
      if (planMeetsMinimum(plan, definition.minimumPlan)) {
        sets[plan].add(definition.gateFeature);
      }
    }
  }

  return {
    starter: [...sets.starter],
    pro: [...sets.pro],
    academy: [...sets.academy],
  };
}

export function getPlanDisplayName(planId: PlanId): string {
  return getPlanById(planId)?.name ?? planId;
}

export function getDefinitionById(id: string): FeatureDefinition | undefined {
  return FEATURE_DEFINITIONS.find((definition) => definition.id === id);
}

export function getDefinitionsForGateFeature(
  gateFeature: FeatureKey,
): readonly FeatureDefinition[] {
  return FEATURE_DEFINITIONS.filter((definition) => definition.gateFeature === gateFeature);
}

/** Primary copy for upgrade prompts and gates. */
export function getPrimaryDefinitionForGateFeature(
  gateFeature: FeatureKey,
): FeatureDefinition {
  const matches = getDefinitionsForGateFeature(gateFeature);
  if (matches.length === 0) {
    throw new Error(`No feature definition for gate feature: ${gateFeature}`);
  }
  return matches.reduce((lowest, current) =>
    PLAN_RANK[current.minimumPlan] < PLAN_RANK[lowest.minimumPlan] ? current : lowest,
  );
}

export function getMinimumPlanForGateFeature(gateFeature: FeatureKey): PlanId {
  return getPrimaryDefinitionForGateFeature(gateFeature).minimumPlan;
}

export function buildPlanComparisonFromDefinitions(): {
  name: string;
  rows: { label: string; featureKey: FeatureKey }[];
}[] {
  const byCategory = new Map<string, { label: string; featureKey: FeatureKey }[]>();

  for (const definition of FEATURE_DEFINITIONS) {
    const rows = byCategory.get(definition.category) ?? [];
    rows.push({
      label: definition.comparisonLabel,
      featureKey: definition.gateFeature,
    });
    byCategory.set(definition.category, rows);
  }

  return [...byCategory.entries()].map(([name, rows]) => ({ name, rows }));
}
