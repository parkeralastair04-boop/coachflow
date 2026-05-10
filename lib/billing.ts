export type PlanId = "starter" | "pro" | "academy";

export type BillingPlan = {
  id: PlanId;
  name: string;
  price: string;
  monthlyPounds: number;
  description: string;
  features: string[];
  highlighted?: boolean;
  stripePriceId: string;
};

export const BILLING_PLANS: BillingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    price: "£29",
    monthlyPounds: 29,
    description: "Solo coaches and small groups getting organised.",
    stripePriceId: "price_1TVUx9BLSYOb3SSr7cskHYON",
    features: [
      "Up to 40 active players",
      "Online bookings",
      "Email reminders",
      "Basic reporting",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "£79",
    monthlyPounds: 79,
    description: "Growing academies with multiple squads.",
    stripePriceId: "price_1TVUxVBLSYOb3SSriUY0bkRy",
    highlighted: true,
    features: [
      "Unlimited players",
      "Parent CRM & segments",
      "Attendance & no-show alerts",
      "Automated payments",
      "AI session summaries",
    ],
  },
  {
    id: "academy",
    name: "Academy",
    price: "£149",
    monthlyPounds: 149,
    description: "Multi-site programmes and franchised brands.",
    stripePriceId: "price_1TVUxmBLSYOb3SSrY00JmqgV",
    features: [
      "Everything in Pro",
      "Multi-location",
      "Custom roles & permissions",
      "Priority support",
      "API access (coming soon)",
    ],
  },
];

export function getPlanById(planId: string) {
  return BILLING_PLANS.find((plan) => plan.id === planId);
}
