import type { SessionBookingStatus } from "@/lib/booking-system";
import { countPendingCheckouts, countWaitlistChildren } from "@/lib/revenue-at-risk";

type SubscriptionRow = {
  amount: number;
  interval: "monthly" | "weekly" | null;
  status: string;
};

type BookingRow = {
  booking_status: SessionBookingStatus;
  payment_status: string;
  expires_at?: string | null;
  amount: number;
  created_at: string;
};

export type CoachingIncomeMetrics = {
  monthlyBookingIncome: number;
  activeMonthlyPaymentIncome: number;
  familiesCompletingPayment: number;
  familiesWaiting: number;
};

function subscriptionMonthlyIncome(subscription: SubscriptionRow): number {
  if (subscription.status !== "active" && subscription.status !== "trialing") {
    return 0;
  }

  const pounds = subscription.amount / 100;
  if (subscription.interval === "weekly") return (pounds * 52) / 12;
  if (subscription.interval === "monthly") return pounds;
  return 0;
}

function isCurrentMonth(dateIso: string, now: Date): boolean {
  const date = new Date(dateIso);
  return (
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  );
}

export function computeCoachingIncomeMetrics(
  bookings: BookingRow[],
  subscriptions: SubscriptionRow[],
  now = new Date(),
): CoachingIncomeMetrics {
  const monthlyBookingIncome =
    bookings
      .filter(
        (booking) =>
          booking.booking_status === "confirmed" &&
          booking.payment_status === "paid" &&
          isCurrentMonth(booking.created_at, now),
      )
      .reduce((sum, booking) => sum + booking.amount / 100, 0);

  const activeMonthlyPaymentIncome = subscriptions.reduce(
    (sum, subscription) => sum + subscriptionMonthlyIncome(subscription),
    0,
  );

  return {
    monthlyBookingIncome,
    activeMonthlyPaymentIncome,
    familiesCompletingPayment: countPendingCheckouts(bookings),
    familiesWaiting: countWaitlistChildren(bookings),
  };
}

export function formatCoachingIncome(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatWaitingFamiliesCopy(count: number): string {
  return count === 1
    ? "1 family is waiting for a place."
    : `${count} families are waiting for places.`;
}

export function formatCompletingPaymentCopy(count: number): string {
  return count === 1 ? "1 family" : `${count} families`;
}
