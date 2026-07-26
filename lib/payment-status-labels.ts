const STATUS_LABELS: Record<string, string> = {
  past_due: "Payment overdue",
  incomplete: "Awaiting payment details",
  incomplete_expired: "Payment expired",
  unpaid: "Payment failed",
  trialing: "Trial period",
  active: "Active",
  customer_created: "Parent payment setup complete",
  canceled: "Cancelled",
  cancelled: "Cancelled",
};

const STATUS_HELPER_COPY: Record<string, string> = {
  past_due: "Ask the parent to update their payment details.",
  incomplete: "Waiting for the parent to finish setting up payment.",
  incomplete_expired: "A new payment link may be needed.",
  unpaid: "A new payment link may be needed.",
};

export const SUBSCRIPTION_NEEDS_ATTENTION_STATUSES = [
  "past_due",
  "unpaid",
  "incomplete",
  "incomplete_expired",
] as const;

/** @deprecated Use getSubscriptionStatusHelperCopy instead */
export const PAYMENT_STATUS_HELPER_COPY =
  "Ask the parent to update their payment details.";

export function getSubscriptionStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}

export function getSubscriptionStatusHelperCopy(status: string): string | null {
  if (STATUS_HELPER_COPY[status]) {
    return STATUS_HELPER_COPY[status];
  }

  if (subscriptionNeedsAttention(status)) {
    return PAYMENT_STATUS_HELPER_COPY;
  }

  return null;
}

export function subscriptionNeedsAttention(status: string): boolean {
  return SUBSCRIPTION_NEEDS_ATTENTION_STATUSES.includes(
    status as (typeof SUBSCRIPTION_NEEDS_ATTENTION_STATUSES)[number],
  );
}
