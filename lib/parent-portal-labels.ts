const PARENT_PACKAGE_LABELS: Record<string, string> = {
  active: "Active",
  trialing: "Trial period",
  past_due: "Payment overdue",
  unpaid: "Payment failed",
  incomplete: "Awaiting payment details",
  incomplete_expired: "Payment expired",
  customer_created: "Setup complete",
  canceled: "Cancelled",
  cancelled: "Cancelled",
};

export function getParentPackageStatusLabel(status: string): string {
  return PARENT_PACKAGE_LABELS[status] ?? status.replaceAll("_", " ");
}

export function getParentBookingStatusLabel(status: string): string {
  if (status === "confirmed") return "Confirmed";
  if (status === "pending") return "Awaiting confirmation";
  if (status === "waitlist") return "Waiting list";
  if (status === "cancelled") return "Cancelled";
  return status.replaceAll("_", " ");
}

export function getParentPaymentStatusLabel(status: string | null): string {
  if (!status) return "Not required";
  if (status === "paid") return "Paid";
  if (status === "requires_payment") return "Payment due";
  if (status === "not_required") return "Included";
  if (status === "failed") return "Payment failed";
  if (status === "refunded") return "Refunded";
  return status.replaceAll("_", " ");
}

export function getParentCampStatusLabel(
  status: "booked" | "waitlist" | "available",
): string {
  if (status === "booked") return "Booked";
  if (status === "waitlist") return "Waiting list";
  return "Places available";
}

export function getParentIntervalLabel(interval: "weekly" | "monthly" | null): string {
  if (interval === "weekly") return "Weekly package";
  if (interval === "monthly") return "Monthly package";
  return "Training package";
}
