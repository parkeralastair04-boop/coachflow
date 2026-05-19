import { BILLING_PLANS } from "@/lib/billing";
import {
  buildFeatureAccess,
  FEATURE_DEFINITIONS,
  FEATURE_KEYS,
  type FeatureKey,
} from "@/lib/feature-definitions";
import { FEATURE_ACCESS } from "@/lib/subscription";

export type FeatureGatingValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

const GATED_PAGE_FEATURES: { path: string; feature: FeatureKey }[] = [
  { path: "/dashboard/reports", feature: "reports" },
  { path: "/dashboard/analytics", feature: "analytics" },
  { path: "/dashboard/automations", feature: "automations" },
  { path: "/dashboard/insights", feature: "insights" },
  { path: "/dashboard/registers", feature: "group_registers" },
  { path: "/dashboard/camps", feature: "camps" },
  { path: "/dashboard/payments", feature: "parent_payments" },
  { path: "/dashboard/referrals", feature: "referrals" },
  { path: "/dashboard/academy", feature: "white_label" },
  { path: "/dashboard/settings/notifications", feature: "push_notifications" },
];

export function validateFeatureGating(): FeatureGatingValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const built = buildFeatureAccess();
  for (const plan of BILLING_PLANS.map((p) => p.id)) {
    const expected = [...built[plan]].sort().join(",");
    const actual = [...FEATURE_ACCESS[plan]].sort().join(",");
    if (expected !== actual) {
      errors.push(
        `FEATURE_ACCESS.${plan} is out of sync with FEATURE_DEFINITIONS (expected ${expected}, got ${actual}).`,
      );
    }
  }

  for (const key of FEATURE_KEYS) {
    const used = FEATURE_DEFINITIONS.some((definition) => definition.gateFeature === key);
    if (!used) {
      warnings.push(`Feature key "${key}" has no FEATURE_DEFINITIONS entry.`);
    }
  }

  for (const definition of FEATURE_DEFINITIONS) {
    if (!FEATURE_KEYS.includes(definition.gateFeature)) {
      errors.push(
        `Definition "${definition.id}" uses unknown gateFeature "${definition.gateFeature}".`,
      );
    }
  }

  const ids = FEATURE_DEFINITIONS.map((definition) => definition.id);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    errors.push(`Duplicate feature definition ids: ${[...new Set(duplicateIds)].join(", ")}`);
  }

  for (const { path, feature } of GATED_PAGE_FEATURES) {
    if (!FEATURE_KEYS.includes(feature)) {
      errors.push(`Gated page ${path} references unknown feature "${feature}".`);
    }
  }

  const auditedIds = [
    "ai_reports",
    "pdf_exports",
    "parent_emails",
    "automations",
    "push_notifications",
    "camps",
    "offline_registers",
    "parent_payments",
    "checkout_links",
    "booking_portal",
    "referrals",
    "white_label",
    "multi_academy",
    "insights",
    "custom_domains",
  ];
  for (const id of auditedIds) {
    if (!FEATURE_DEFINITIONS.some((definition) => definition.id === id)) {
      errors.push(`Missing audited feature definition: ${id}`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
