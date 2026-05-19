import type { PlanId } from "@/lib/billing";
import { buildPlanComparisonFromDefinitions, type FeatureKey } from "@/lib/feature-definitions";
import { planHasFeature } from "@/lib/subscription";

export type ComparisonRow =
  | { kind: "feature"; label: string; featureKey: FeatureKey }
  | { kind: "plans"; label: string; plans: Record<PlanId, boolean> };

export type ComparisonCategory = {
  name: string;
  rows: ComparisonRow[];
};

/** Static rows that are not tied to a single gate feature. */
const STATIC_COMPARISON_ROWS: ComparisonCategory[] = [
  {
    name: "Core Platform",
    rows: [
      {
        kind: "plans",
        label: "Dashboard",
        plans: { starter: true, pro: true, academy: true },
      },
    ],
  },
  {
    name: "Payments & Billing",
    rows: [
      {
        kind: "plans",
        label: "Coach Billing Portal",
        plans: { starter: true, pro: true, academy: true },
      },
      {
        kind: "plans",
        label: "Stripe Webhooks",
        plans: { starter: true, pro: true, academy: true },
      },
    ],
  },
  {
    name: "Communication & Automation",
    rows: [
      {
        kind: "plans",
        label: "Notification Preferences",
        plans: { starter: false, pro: false, academy: true },
      },
    ],
  },
];

function mergeComparisonCategories(): ComparisonCategory[] {
  const fromDefinitions = buildPlanComparisonFromDefinitions();
  const merged = new Map<string, ComparisonRow[]>();

  for (const category of [...fromDefinitions, ...STATIC_COMPARISON_ROWS]) {
    const existing = merged.get(category.name) ?? [];
    const rows = category.rows.map((row) =>
      "featureKey" in row
        ? ({ kind: "feature" as const, label: row.label, featureKey: row.featureKey })
        : row,
    );
    merged.set(category.name, [...existing, ...rows]);
  }

  return [...merged.entries()].map(([name, rows]) => ({ name, rows }));
}

/** Feature matrix for the public pricing page — sourced from `FEATURE_DEFINITIONS`. */
export const PLAN_COMPARISON: ComparisonCategory[] = mergeComparisonCategories();

export function isComparisonRowIncluded(plan: PlanId, row: ComparisonRow): boolean {
  if (row.kind === "feature") {
    return planHasFeature(plan, row.featureKey);
  }
  return row.plans[plan];
}
