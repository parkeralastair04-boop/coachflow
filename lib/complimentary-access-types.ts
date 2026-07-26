/**
 * Client-safe complimentary access types (no founder allowlist).
 * Server resolution lives in `lib/complimentary-access.ts`.
 */
import type { PlanId } from "@/lib/billing";

export type ComplimentaryAccessType = "founder" | "beta_tester";

export type ComplimentaryAccess = {
  plan: PlanId;
  status: "active" | "inactive";
  isFounder: boolean;
  isBetaTester: boolean;
  hasComplimentaryAccess: boolean;
  accessType: ComplimentaryAccessType | null;
};

export const EMPTY_COMPLIMENTARY_ACCESS: ComplimentaryAccess = {
  plan: "starter",
  status: "inactive",
  isFounder: false,
  isBetaTester: false,
  hasComplimentaryAccess: false,
  accessType: null,
};
