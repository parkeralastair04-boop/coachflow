import "server-only";

import { isBetaTester } from "@/lib/beta-testers";
import { isFounder } from "@/lib/founders";
import type { ComplimentaryAccess } from "@/lib/complimentary-access-types";

export type {
  ComplimentaryAccess,
  ComplimentaryAccessType,
} from "@/lib/complimentary-access-types";

/**
 * Resolves founder (server env allowlist) and beta tester (app_metadata only).
 * Server-only — never import from client bundles.
 */
export function getComplimentaryAccess(args: {
  email: string | null | undefined;
  /** Auth app_metadata only (admin-writable). */
  appMetadata?: Record<string, unknown> | null;
}): ComplimentaryAccess {
  const founder = isFounder(args.email);
  const betaTester = isBetaTester(args.appMetadata);

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
  appMetadata?: Record<string, unknown> | null;
}): boolean {
  return getComplimentaryAccess(args).hasComplimentaryAccess;
}
