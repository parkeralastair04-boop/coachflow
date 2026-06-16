import type { PlanId } from "@/lib/billing";
import { isBetaTester } from "@/lib/beta-testers";
import { isFounder } from "@/lib/founders";

export type ComplimentaryAccessType = "founder" | "beta_tester";

export type ComplimentaryAccess = {
  plan: PlanId;
  status: "active" | "inactive";
  isFounder: boolean;
  isBetaTester: boolean;
  hasComplimentaryAccess: boolean;
  /** Set when the account has complimentary Academy access. */
  accessType: ComplimentaryAccessType | null;
};

/** Resolves founder and beta tester complimentary Academy access from auth profile data. */
export function getComplimentaryAccess(args: {
  email: string | null | undefined;
  metadata?: Record<string, unknown> | null;
}): ComplimentaryAccess {
  const founder = isFounder(args.email);
  const betaTester = isBetaTester(args.metadata);

  if (founder) {
    return {
      plan: "academy",
      status: "active",
      isFounder: true,
      isBetaTester: false,
      hasComplimentaryAccess: true,
      accessType: "founder",
    };
  }

  if (betaTester) {
    return {
      plan: "academy",
      status: "active",
      isFounder: false,
      isBetaTester: true,
      hasComplimentaryAccess: true,
      accessType: "beta_tester",
    };
  }

  return {
    plan: "starter",
    status: "inactive",
    isFounder: false,
    isBetaTester: false,
    hasComplimentaryAccess: false,
    accessType: null,
  };
}

export function hasComplimentaryAccess(args: {
  email: string | null | undefined;
  metadata?: Record<string, unknown> | null;
}): boolean {
  return getComplimentaryAccess(args).hasComplimentaryAccess;
}
