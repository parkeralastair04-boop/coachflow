import { getBookingDisplayStatus, type BookingDisplayInput } from "@/lib/session-booking-display";
import { subscriptionNeedsAttention } from "@/lib/payment-status-labels";

export type RevenueAtRiskCounts = {
  pendingCheckouts: number;
  failedSubscriptions: number;
  waitlistChildren: number;
};

type SessionBookingRow = BookingDisplayInput;

type ParentSubscriptionRow = {
  status: string;
};

export function countPendingCheckouts(
  bookings: SessionBookingRow[],
  now = Date.now(),
): number {
  return bookings.filter(
    (booking) => getBookingDisplayStatus(booking, now).label === "Waiting for payment",
  ).length;
}

export function countWaitlistChildren(
  bookings: Array<{ booking_status: string }>,
): number {
  return bookings.filter((booking) => booking.booking_status === "waitlist").length;
}

export function countSubscriptionsNeedingAttention(
  subscriptions: ParentSubscriptionRow[],
): number {
  return subscriptions.filter((subscription) =>
    subscriptionNeedsAttention(subscription.status),
  ).length;
}

export function summarizeRevenueAtRisk(args: {
  bookings: SessionBookingRow[];
  subscriptions: ParentSubscriptionRow[];
}): RevenueAtRiskCounts {
  return {
    pendingCheckouts: countPendingCheckouts(args.bookings),
    failedSubscriptions: countSubscriptionsNeedingAttention(args.subscriptions),
    waitlistChildren: countWaitlistChildren(args.bookings),
  };
}

export function hasRevenueAtRisk(counts: RevenueAtRiskCounts): boolean {
  return (
    counts.pendingCheckouts > 0 ||
    counts.failedSubscriptions > 0 ||
    counts.waitlistChildren > 0
  );
}

export function formatFamilyCount(count: number): string {
  return count === 1 ? "1 family is" : `${count} families are`;
}

export function formatSubscriptionAttentionCount(count: number): string {
  return count === 1
    ? "1 monthly payment plan needs attention"
    : `${count} monthly payment plans need attention`;
}

export function formatWaitlistChildrenCount(count: number): string {
  return count === 1
    ? "1 child is on a waitlist"
    : `${count} children are on waitlists`;
}
