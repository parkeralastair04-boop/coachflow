import type { PlanId } from "@/lib/billing";
import { getPlanById } from "@/lib/billing";

export const PLAN_ORDER = ["starter", "pro", "academy"] as const satisfies readonly PlanId[];

/** Display order for pricing comparison categories. */
export const FEATURE_CATEGORY_ORDER = [
  "Core Coaching",
  "Players & Development",
  "Teams & Attendance",
  "Bookings",
  "Reports & AI",
  "Communication",
  "Finance",
  "Academy Website",
  "Parent Experience",
  "Media",
  "Administration",
  "Support",
] as const;

export type FeatureCategory = (typeof FEATURE_CATEGORY_ORDER)[number];

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
  "match_centre",
  "training_planner",
  "video_analysis",
  "academy_news",
  "academy_enquiries",
  "parent_payments",
  "finance_centre",
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
  category: FeatureCategory;
};

export const FEATURE_DEFINITIONS: readonly FeatureDefinition[] = [
  {
    id: "players",
    gateFeature: "players",
    title: "Active Squad",
    benefits: [
      "Every player with parent contacts and coaching notes",
      "Search and update squad context before training",
    ],
    minimumPlan: "starter",
    comparisonLabel: "Active Squad",
    category: "Players & Development",
  },
  {
    id: "sessions",
    gateFeature: "sessions",
    title: "Training Sessions",
    benefits: [
      "Plan 1-to-1 and group sessions with dates and locations",
      "Keep your weekly coaching calendar clear and bookable",
    ],
    minimumPlan: "starter",
    comparisonLabel: "Training sessions",
    category: "Core Coaching",
  },
  {
    id: "booking_portal",
    gateFeature: "booking_portal",
    title: "Public Booking Page",
    benefits: [
      "Parents book training online from your public link",
      "Child and parent details land straight in your squad",
    ],
    minimumPlan: "starter",
    comparisonLabel: "Public booking page",
    category: "Bookings",
  },
  {
    id: "match_centre",
    gateFeature: "match_centre",
    title: "Match Centre",
    benefits: [
      "Plan fixtures, squads, and matchday registers",
      "Record results and generate AI match reports",
    ],
    minimumPlan: "pro",
    comparisonLabel: "Match Centre",
    category: "Core Coaching",
  },
  {
    id: "training_planner",
    gateFeature: "training_planner",
    title: "Training Planner",
    benefits: [
      "Build session plans, drills, and pitch diagrams",
      "Link plans to sessions and parent preparation notes",
    ],
    minimumPlan: "pro",
    comparisonLabel: "Training Planner",
    category: "Core Coaching",
  },
  {
    id: "group_registers",
    gateFeature: "group_registers",
    title: "Attendance Registers",
    benefits: [
      "Mark attendance quickly on mobile",
      "See who made each session",
    ],
    minimumPlan: "pro",
    comparisonLabel: "Attendance registers",
    category: "Teams & Attendance",
  },
  {
    id: "offline_registers",
    gateFeature: "offline_registers",
    title: "Offline Registers",
    benefits: [
      "Mark attendance without signal on the pitch",
      "Sync automatically when you reconnect",
    ],
    minimumPlan: "pro",
    comparisonLabel: "Offline register sync",
    category: "Teams & Attendance",
  },
  {
    id: "ai_reports",
    gateFeature: "reports",
    title: "AI Development Reports",
    benefits: [
      "Turn session notes into parent-ready summaries",
      "Edit tone and detail before you save or send",
    ],
    minimumPlan: "pro",
    comparisonLabel: "AI development reports",
    category: "Reports & AI",
  },
  {
    id: "pdf_exports",
    gateFeature: "reports",
    title: "PDF Report Exports",
    benefits: [
      "Download branded PDFs for email or print",
      "Share progress updates offline",
    ],
    minimumPlan: "pro",
    comparisonLabel: "PDF report exports",
    category: "Reports & AI",
  },
  {
    id: "saved_reports",
    gateFeature: "saved_reports",
    title: "Saved Reports Library",
    benefits: [
      "Keep a report history per player",
      "Re-send or download past updates",
    ],
    minimumPlan: "pro",
    comparisonLabel: "Saved reports library",
    category: "Reports & AI",
  },
  {
    id: "analytics",
    gateFeature: "analytics",
    title: "Performance Insights",
    benefits: [
      "See players, attendance, income, and reports together",
      "Spot trends before they affect retention",
    ],
    minimumPlan: "pro",
    comparisonLabel: "Performance Insights",
    category: "Reports & AI",
  },
  {
    id: "insights",
    gateFeature: "insights",
    title: "AI Coaching Insights",
    benefits: [
      "Priorities from your live academy data",
      "Retention risks and follow-ups in one briefing",
    ],
    minimumPlan: "academy",
    comparisonLabel: "AI coaching insights",
    category: "Reports & AI",
  },
  {
    id: "parent_emails",
    gateFeature: "parent_emails",
    title: "Parent Updates",
    benefits: [
      "Send announcements and email reports to parents",
      "Reach audiences by team, camp, or selected players",
    ],
    minimumPlan: "pro",
    comparisonLabel: "Parent Updates",
    category: "Communication",
  },
  {
    id: "automations",
    gateFeature: "automations",
    title: "Automatic Messages",
    benefits: [
      "Reminders and follow-ups for bookings and attendance",
      "Consistent parent email without manual copy-paste",
    ],
    minimumPlan: "pro",
    comparisonLabel: "Automatic parent messages",
    category: "Communication",
  },
  {
    id: "push_notifications",
    gateFeature: "push_notifications",
    title: "Pitch-Side Alerts",
    benefits: [
      "Mobile alerts for bookings and payments",
      "Choose which events notify you",
    ],
    minimumPlan: "academy",
    comparisonLabel: "Pitch-side alerts",
    category: "Communication",
  },
  {
    id: "academy_enquiries",
    gateFeature: "academy_enquiries",
    title: "Family Enquiries",
    benefits: [
      "Receive questions from your public contact page",
      "Review and reply from your academy hub",
    ],
    minimumPlan: "academy",
    comparisonLabel: "Family enquiries",
    category: "Communication",
  },
  {
    id: "camps",
    gateFeature: "camps",
    title: "Holiday Camps",
    benefits: [
      "Publish camps with pricing and capacity",
      "Follow enrolments and waitlists",
    ],
    minimumPlan: "academy",
    comparisonLabel: "Holiday camps",
    category: "Bookings",
  },
  {
    id: "parent_payments",
    gateFeature: "parent_payments",
    title: "Parent Payments",
    benefits: [
      "Stripe customers and recurring parent subscriptions",
      "Spot failed payments before they become churn",
    ],
    minimumPlan: "academy",
    comparisonLabel: "Parent Stripe payments",
    category: "Finance",
  },
  {
    id: "checkout_links",
    gateFeature: "checkout_links",
    title: "Checkout Links",
    benefits: [
      "Send one-off or recurring payment links",
      "Collect fees without bank-transfer chasing",
    ],
    minimumPlan: "academy",
    comparisonLabel: "Checkout links",
    category: "Finance",
  },
  {
    id: "finance_centre",
    gateFeature: "finance_centre",
    title: "Finance Centre",
    benefits: [
      "See income, expenses, payroll, and profit",
      "Budget alerts and PDF finance reports",
    ],
    minimumPlan: "academy",
    comparisonLabel: "Finance Centre",
    category: "Finance",
  },
  {
    id: "video_analysis",
    gateFeature: "video_analysis",
    title: "Video Analysis",
    benefits: [
      "Organise match and training clips with player tags",
      "Share selected moments with parents",
    ],
    minimumPlan: "pro",
    comparisonLabel: "Video analysis",
    category: "Media",
  },
  {
    id: "academy_news",
    gateFeature: "academy_news",
    title: "Club News",
    benefits: [
      "Publish news on your academy website",
      "Share camps, fixtures, and club updates",
    ],
    minimumPlan: "academy",
    comparisonLabel: "Club news",
    category: "Academy Website",
  },
  {
    id: "white_label",
    gateFeature: "white_label",
    title: "Club Branding",
    benefits: [
      "Your crest, colours, and academy name across Awarix",
      "Parents see your club, not generic software",
    ],
    minimumPlan: "academy",
    comparisonLabel: "Club branding",
    category: "Administration",
  },
  {
    id: "multi_academy",
    gateFeature: "multi_academy",
    title: "Multi-Coach Academy",
    benefits: [
      "Multiple coaches under one academy identity",
      "Shared branding and settings",
    ],
    minimumPlan: "academy",
    comparisonLabel: "Multi-coach academy",
    category: "Administration",
  },
  {
    id: "custom_domains",
    gateFeature: "custom_domains",
    title: "Custom Domain",
    benefits: [
      "Store your academy domain for branded links",
      "Keep booking and website URLs consistent",
    ],
    minimumPlan: "academy",
    comparisonLabel: "Custom domain",
    category: "Administration",
  },
  {
    id: "referrals",
    gateFeature: "referrals",
    title: "Coach Referrals",
    benefits: [
      "Invite other coaches with your personal link",
      "Earn credit when referrals convert",
    ],
    minimumPlan: "pro",
    comparisonLabel: "Coach referrals",
    category: "Administration",
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

export function getIncludedOnPlanLabel(plan: PlanId): string {
  return `Included on ${getPlanDisplayName(plan)}`;
}

export function buildPlanComparisonFromDefinitions(): {
  name: FeatureCategory;
  rows: { label: string; featureKey: FeatureKey }[];
}[] {
  const byCategory = new Map<FeatureCategory, { label: string; featureKey: FeatureKey }[]>();

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
