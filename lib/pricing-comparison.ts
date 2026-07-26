import type { PlanId } from "@/lib/billing";
import {
  FEATURE_CATEGORY_ORDER,
  buildPlanComparisonFromDefinitions,
  type FeatureCategory,
  type FeatureKey,
} from "@/lib/feature-definitions";
import { planHasFeature } from "@/lib/subscription";

export type ComparisonRow =
  | { kind: "feature"; label: string; featureKey: FeatureKey }
  | { kind: "plans"; label: string; plans: Record<PlanId, boolean> };

export type ComparisonCategory = {
  name: FeatureCategory;
  rows: ComparisonRow[];
};

/** Ungated or cross-cutting capabilities that still belong on the matrix. */
const STATIC_COMPARISON_ROWS: ComparisonCategory[] = [
  {
    name: "Core Coaching",
    rows: [
      {
        kind: "plans",
        label: "Academy Pulse",
        plans: { starter: true, pro: true, academy: true },
      },
    ],
  },
  {
    name: "Teams & Attendance",
    rows: [
      {
        kind: "plans",
        label: "Teams & squads",
        plans: { starter: true, pro: true, academy: true },
      },
    ],
  },
  {
    name: "Academy Website",
    rows: [
      {
        kind: "plans",
        label: "Public academy website",
        plans: { starter: false, pro: false, academy: true },
      },
      {
        kind: "plans",
        label: "Home, About & Coaches",
        plans: { starter: false, pro: false, academy: true },
      },
      {
        kind: "plans",
        label: "Teams, Fixtures & Results",
        plans: { starter: false, pro: false, academy: true },
      },
      {
        kind: "plans",
        label: "Camps on the public website",
        plans: { starter: false, pro: false, academy: true },
      },
      {
        kind: "plans",
        label: "News & contact / enquiries",
        plans: { starter: false, pro: false, academy: true },
      },
      {
        kind: "plans",
        label: "SEO-ready public pages",
        plans: { starter: false, pro: false, academy: true },
      },
      {
        kind: "plans",
        label: "Website booking page",
        plans: { starter: false, pro: false, academy: true },
      },
    ],
  },
  {
    name: "Parent Experience",
    rows: [
      {
        kind: "plans",
        label: "Parent / family login",
        plans: { starter: true, pro: true, academy: true },
      },
      {
        kind: "plans",
        label: "Family training hub",
        plans: { starter: true, pro: true, academy: true },
      },
      {
        kind: "plans",
        label: "Parent session & attendance view",
        plans: { starter: true, pro: true, academy: true },
      },
      {
        kind: "plans",
        label: "Parent report access",
        plans: { starter: false, pro: true, academy: true },
      },
      {
        kind: "plans",
        label: "Parent payments & invoices",
        plans: { starter: false, pro: false, academy: true },
      },
      {
        kind: "plans",
        label: "Parent communications",
        plans: { starter: false, pro: true, academy: true },
      },
    ],
  },
  {
    name: "Finance",
    rows: [
      {
        kind: "plans",
        label: "Awarix billing portal",
        plans: { starter: true, pro: true, academy: true },
      },
    ],
  },
  {
    name: "Support",
    rows: [
      {
        kind: "plans",
        label: "In-app help & support",
        plans: { starter: true, pro: true, academy: true },
      },
    ],
  },
];

function mergeComparisonCategories(): ComparisonCategory[] {
  const fromDefinitions = buildPlanComparisonFromDefinitions();
  const merged = new Map<FeatureCategory, ComparisonRow[]>();

  for (const name of FEATURE_CATEGORY_ORDER) {
    merged.set(name, []);
  }

  for (const category of [...STATIC_COMPARISON_ROWS, ...fromDefinitions]) {
    const existing = merged.get(category.name) ?? [];
    const rows = category.rows.map((row) =>
      "featureKey" in row
        ? ({ kind: "feature" as const, label: row.label, featureKey: row.featureKey })
        : row,
    );
    merged.set(category.name, [...existing, ...rows]);
  }

  return FEATURE_CATEGORY_ORDER.map((name) => ({
    name,
    rows: merged.get(name) ?? [],
  })).filter((category) => category.rows.length > 0);
}

/** Feature matrix for the public pricing page — sourced from audited definitions. */
export const PLAN_COMPARISON: ComparisonCategory[] = mergeComparisonCategories();

export function isComparisonRowIncluded(plan: PlanId, row: ComparisonRow): boolean {
  if (row.kind === "feature") {
    return planHasFeature(plan, row.featureKey);
  }
  return row.plans[plan];
}
