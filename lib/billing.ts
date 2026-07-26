export type PlanId = "starter" | "pro" | "academy";

export type BillingPlan = {
  id: PlanId;
  name: string;
  price: string;
  monthlyPounds: number;
  description: string;
  features: string[];
  highlighted?: boolean;
  /** Shown on pricing cards and the comparison table header. */
  badge?: string;
  stripePriceId: string;
};

type BillingPlanBase = Omit<BillingPlan, "stripePriceId">;

const BILLING_PLAN_BASE: BillingPlanBase[] = [
  {
    id: "starter",
    name: "Starter",
    price: "£29",
    monthlyPounds: 29,
    description: "Built for independent coaches and small squads.",
    features: [
      "Active Squad & parent contacts",
      "Teams & age-group squads",
      "Training sessions & availability",
      "Public booking page",
      "Parent / family login",
      "Awarix plan billing",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "£79",
    monthlyPounds: 79,
    description: "For coaches running multiple squads and parent programmes.",
    highlighted: true,
    badge: "Most chosen",
    features: [
      "Everything in Starter",
      "Attendance registers (incl. offline sync)",
      "AI development reports & PDF exports",
      "Parent updates & automations",
      "Match Centre, Training Planner & Video",
      "Performance Insights & coach referrals",
    ],
  },
  {
    id: "academy",
    name: "Academy",
    price: "£149",
    monthlyPounds: 149,
    description:
      "For multi-team academies with club branding and a public website.",
    badge: "Built for academies",
    features: [
      "Everything in Pro",
      "Parent Stripe payments & checkout links",
      "Finance Centre",
      "Camps & public academy website",
      "Club branding & multi-coach access",
      "News, family enquiries & SEO-ready pages",
    ],
  },
];

const PRICE_ENV_KEYS: Record<PlanId, string> = {
  starter: "STRIPE_PRICE_STARTER",
  pro: "STRIPE_PRICE_PRO",
  academy: "STRIPE_PRICE_ACADEMY",
};

function resolveStripePriceId(planId: PlanId): string {
  const envName = PRICE_ENV_KEYS[planId];
  const value = process.env[envName]?.trim() ?? "";
  return value;
}

/** Plans with Stripe Price IDs from environment variables. */
export const BILLING_PLANS: BillingPlan[] = BILLING_PLAN_BASE.map((plan) => ({
  ...plan,
  stripePriceId: resolveStripePriceId(plan.id),
}));

export function getPlanById(planId: string) {
  return BILLING_PLANS.find((plan) => plan.id === planId);
}

export function getStripePriceEnvName(planId: PlanId): string {
  return PRICE_ENV_KEYS[planId];
}

/** Throws if any paid plan is missing a configured Stripe Price ID. */
export function assertStripePricesConfigured(): void {
  const missing = BILLING_PLANS.filter((plan) => !plan.stripePriceId?.trim()).map(
    (plan) => PRICE_ENV_KEYS[plan.id],
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing Stripe price environment variables: ${missing.join(", ")}`,
    );
  }
}
