import "server-only";

import type Stripe from "stripe";
import { getStripeServerClient } from "@/lib/stripe";

export const AWARIX_USER_ID_METADATA_KEY = "awarix_user_id";
/**
 * Pre-rebrand Stripe metadata key. Read-only for ownership of existing customers.
 * New customers write `awarix_user_id` only.
 */
export const LEGACY_USER_ID_METADATA_KEY = "coachflow_user_id";

export type StripeCustomerOwnership =
  | "owned"
  | "foreign"
  | "unbound"
  | "deleted";

export type StripeCustomerOwnershipErrorCode =
  | "owned_by_other"
  | "unbound"
  | "not_found"
  | "deleted"
  | "user_required";

export class StripeCustomerOwnershipError extends Error {
  constructor(
    message: string,
    readonly code: StripeCustomerOwnershipErrorCode,
  ) {
    super(message);
    this.name = "StripeCustomerOwnershipError";
  }
}

export function getAwarixUserIdFromCustomer(
  customer: Stripe.Customer | Stripe.DeletedCustomer,
): string | null {
  if (customer.deleted) return null;
  const current = customer.metadata?.[AWARIX_USER_ID_METADATA_KEY];
  if (typeof current === "string" && current.trim()) return current.trim();
  const legacy = customer.metadata?.[LEGACY_USER_ID_METADATA_KEY];
  return typeof legacy === "string" && legacy.trim() ? legacy.trim() : null;
}

export function evaluateStripeCustomerOwnership(
  customer: Stripe.Customer | Stripe.DeletedCustomer,
  userId: string,
): StripeCustomerOwnership {
  if (customer.deleted) return "deleted";
  const ownerId = getAwarixUserIdFromCustomer(customer);
  if (!ownerId) return "unbound";
  if (ownerId === userId) return "owned";
  return "foreign";
}

/**
 * Fail closed unless the Stripe customer is explicitly bound to this user.
 * Never treats email match as ownership.
 */
export function assertStripeCustomerOwnedByUser(
  customer: Stripe.Customer | Stripe.DeletedCustomer,
  userId: string,
): asserts customer is Stripe.Customer {
  const ownership = evaluateStripeCustomerOwnership(customer, userId);
  switch (ownership) {
    case "owned":
      return;
    case "deleted":
      throw new StripeCustomerOwnershipError(
        "Stripe customer was deleted.",
        "deleted",
      );
    case "foreign":
      throw new StripeCustomerOwnershipError(
        "Stripe customer belongs to another Awarix account.",
        "owned_by_other",
      );
    case "unbound":
      throw new StripeCustomerOwnershipError(
        "Stripe customer is not bound to an Awarix account. Administrative repair required.",
        "unbound",
      );
    default:
      throw new StripeCustomerOwnershipError(
        "Stripe customer ownership could not be verified.",
        "unbound",
      );
  }
}

export function logStripeCustomerOwnershipIncident(args: {
  event: string;
  userId: string;
  customerId?: string | null;
  code?: string;
  detail?: string;
}): void {
  console.error(
    `[stripe-customer-ownership] ${args.event} user=${args.userId} customer=${args.customerId ?? "none"} code=${args.code ?? "n/a"} ${args.detail ?? ""}`.trim(),
  );
}

/**
 * Resolve an Awarix SaaS Stripe customer for checkout.
 * Email alone never establishes ownership.
 * Existing awarix_user_id is never overwritten.
 */
export async function resolveOrCreateStripeCustomerForUser(args: {
  email: string;
  userId: string;
  preferredCustomerId?: string | null;
}): Promise<Stripe.Customer> {
  const userId = args.userId.trim();
  if (!userId) {
    throw new StripeCustomerOwnershipError(
      "Authenticated user id is required for Stripe customer resolution.",
      "user_required",
    );
  }

  const stripe = getStripeServerClient();
  const email = args.email.trim().toLowerCase();

  const preferredId = args.preferredCustomerId?.trim() || null;
  if (preferredId) {
    const preferred = await stripe.customers.retrieve(preferredId);
    const ownership = evaluateStripeCustomerOwnership(preferred, userId);
    if (ownership === "owned") {
      return preferred as Stripe.Customer;
    }
    if (ownership === "foreign") {
      logStripeCustomerOwnershipIncident({
        event: "checkout_preferred_foreign",
        userId,
        customerId: preferredId,
        code: "owned_by_other",
      });
      throw new StripeCustomerOwnershipError(
        "Billing profile is linked to another Awarix account. Contact support.",
        "owned_by_other",
      );
    }
    logStripeCustomerOwnershipIncident({
      event: "checkout_preferred_unusable",
      userId,
      customerId: preferredId,
      code: ownership,
      detail: "Ignoring preferred customer; will resolve by metadata ownership.",
    });
  }

  const existing = await stripe.customers.list({ email, limit: 20 });
  const owned = existing.data.find(
    (customer) => evaluateStripeCustomerOwnership(customer, userId) === "owned",
  );
  if (owned) {
    return owned;
  }

  const foreign = existing.data.find(
    (customer) =>
      evaluateStripeCustomerOwnership(customer, userId) === "foreign",
  );
  if (foreign) {
    logStripeCustomerOwnershipIncident({
      event: "checkout_email_owned_by_other",
      userId,
      customerId: foreign.id,
      code: "owned_by_other",
    });
    throw new StripeCustomerOwnershipError(
      "A Stripe billing profile for this email belongs to another Awarix account. Contact support for repair.",
      "owned_by_other",
    );
  }

  // Unbound customers with the same email are ignored — never claimed by email.
  return stripe.customers.create({
    email,
    metadata: {
      [AWARIX_USER_ID_METADATA_KEY]: userId,
    },
  });
}

/**
 * Load a portal-eligible Stripe customer. Ownership must already be proven.
 * Never binds unbound customers.
 */
export async function resolveOwnedStripeCustomerForPortal(args: {
  userId: string;
  email: string;
  entitlementsCustomerId?: string | null;
}): Promise<Stripe.Customer> {
  const userId = args.userId.trim();
  const stripe = getStripeServerClient();

  const candidateIds: string[] = [];
  const fromEntitlements = args.entitlementsCustomerId?.trim();
  if (fromEntitlements) candidateIds.push(fromEntitlements);

  const existing = await stripe.customers.list({
    email: args.email.trim().toLowerCase(),
    limit: 20,
  });
  for (const customer of existing.data) {
    if (evaluateStripeCustomerOwnership(customer, userId) === "owned") {
      candidateIds.push(customer.id);
    }
  }

  const uniqueIds = [...new Set(candidateIds)];
  for (const customerId of uniqueIds) {
    const customer = await stripe.customers.retrieve(customerId);
    const ownership = evaluateStripeCustomerOwnership(customer, userId);
    if (ownership === "owned") {
      return customer as Stripe.Customer;
    }
    if (ownership === "foreign") {
      logStripeCustomerOwnershipIncident({
        event: "portal_foreign_customer",
        userId,
        customerId,
        code: "owned_by_other",
      });
      throw new StripeCustomerOwnershipError(
        "Billing profile belongs to another Awarix account.",
        "owned_by_other",
      );
    }
    if (ownership === "unbound") {
      logStripeCustomerOwnershipIncident({
        event: "portal_unbound_customer",
        userId,
        customerId,
        code: "unbound",
        detail: "Denied portal; administrative repair required.",
      });
      throw new StripeCustomerOwnershipError(
        "Billing profile is not bound to your account. Contact support for repair.",
        "unbound",
      );
    }
    if (ownership === "deleted") {
      logStripeCustomerOwnershipIncident({
        event: "portal_deleted_customer",
        userId,
        customerId,
        code: "deleted",
      });
    }
  }

  throw new StripeCustomerOwnershipError(
    "No Stripe billing profile is bound to this account. Start a plan from Pricing first.",
    "not_found",
  );
}
