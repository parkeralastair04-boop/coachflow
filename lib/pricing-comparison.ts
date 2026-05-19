import type { PlanId } from "@/lib/billing";
import { planHasFeature, type FeatureKey } from "@/lib/subscription";

export type ComparisonRow =
  | { kind: "feature"; label: string; featureKey: FeatureKey }
  | { kind: "plans"; label: string; plans: Record<PlanId, boolean> };

export type ComparisonCategory = {
  name: string;
  rows: ComparisonRow[];
};

/** Feature matrix for the public pricing page. Uses `planHasFeature` where possible. */
export const PLAN_COMPARISON: ComparisonCategory[] = [
  {
    name: "Core Platform",
    rows: [
      { kind: "feature", label: "Player CRM", featureKey: "players" },
      { kind: "feature", label: "Session Scheduling", featureKey: "sessions" },
      { kind: "feature", label: "Group Registers", featureKey: "group_registers" },
      {
        kind: "plans",
        label: "Dashboard",
        plans: { starter: true, pro: true, academy: true },
      },
    ],
  },
  {
    name: "AI & Reports",
    rows: [
      { kind: "feature", label: "AI Progress Reports", featureKey: "reports" },
      { kind: "feature", label: "PDF Report Exports", featureKey: "reports" },
      { kind: "feature", label: "Parent Email Reports", featureKey: "parent_emails" },
      { kind: "feature", label: "AI Business Insights", featureKey: "insights" },
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
      { kind: "feature", label: "Parent Payments", featureKey: "parent_payments" },
      { kind: "feature", label: "Checkout Links", featureKey: "parent_payments" },
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
      { kind: "feature", label: "CRM Automations", featureKey: "automations" },
      {
        kind: "plans",
        label: "Push Notifications",
        plans: { starter: false, pro: false, academy: true },
      },
      {
        kind: "plans",
        label: "Notification Preferences",
        plans: { starter: false, pro: false, academy: true },
      },
    ],
  },
  {
    name: "Camps & Booking",
    rows: [
      { kind: "feature", label: "Camp Management", featureKey: "camps" },
      { kind: "feature", label: "Offline Registers", featureKey: "offline_registers" },
      {
        kind: "plans",
        label: "Public Booking Portal",
        plans: { starter: true, pro: true, academy: true },
      },
    ],
  },
  {
    name: "Growth & Marketing",
    rows: [
      { kind: "feature", label: "Analytics Dashboard", featureKey: "analytics" },
      {
        kind: "plans",
        label: "Referral Program",
        plans: { starter: false, pro: true, academy: true },
      },
    ],
  },
  {
    name: "White Label & Academy",
    rows: [
      {
        kind: "plans",
        label: "White Label Branding",
        plans: { starter: false, pro: false, academy: true },
      },
      {
        kind: "plans",
        label: "Multi-Academy Support",
        plans: { starter: false, pro: false, academy: true },
      },
      {
        kind: "plans",
        label: "Custom Domains",
        plans: { starter: false, pro: false, academy: true },
      },
    ],
  },
];

export function isComparisonRowIncluded(plan: PlanId, row: ComparisonRow): boolean {
  if (row.kind === "feature") {
    return planHasFeature(plan, row.featureKey);
  }
  return row.plans[plan];
}
