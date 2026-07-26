import "server-only";

import type { PlanId } from "@/lib/billing";
import { getOptionalServerEnv } from "@/lib/env/server";

/**
 * Founder complimentary emails from server-only env (comma-separated).
 * Never import this module from client components.
 */
export function getFounderEmails(): readonly string[] {
  // Prefer Awarix env; fall back to pre-rebrand var so existing deploys keep access.
  const raw =
    getOptionalServerEnv("AWARIX_FOUNDER_EMAILS") ||
    getOptionalServerEnv("COACHFLOW_FOUNDER_EMAILS");
  if (!raw) return [];
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isFounder(email: string | null | undefined): boolean {
  if (!email?.trim()) return false;
  const normalized = email.trim().toLowerCase();
  return getFounderEmails().some((founder) => founder === normalized);
}

export type AccountBillingAccess = {
  plan: PlanId;
  status: "active" | "inactive";
  isFounder: boolean;
};
