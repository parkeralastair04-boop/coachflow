import type { PlanId } from "@/lib/billing";
import { getComplimentaryAccess } from "@/lib/complimentary-access";

export const FOUNDER_EMAILS = ["parkeralastair04@gmail.com"] as const;

export function isFounder(email: string | null | undefined): boolean {
  if (!email?.trim()) return false;
  const normalized = email.trim().toLowerCase();
  return (FOUNDER_EMAILS as readonly string[]).some(
    (founder) => founder.toLowerCase() === normalized,
  );
}

export type AccountBillingAccess = {
  plan: PlanId;
  status: "active" | "inactive";
  isFounder: boolean;
};

/** Effective billing access for UI and gates. Founders always get Academy with active status. */
export function getAccountBillingAccess(
  email: string | null | undefined,
  metadata?: Record<string, unknown> | null,
): AccountBillingAccess {
  const access = getComplimentaryAccess({ email, metadata });
  return {
    plan: access.plan,
    status: access.status,
    isFounder: access.isFounder,
  };
}
