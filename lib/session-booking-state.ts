import type { SessionBookingStatus } from "@/lib/booking-system";

type BookingStateInput = {
  booking_status: SessionBookingStatus;
  expires_at?: string | null;
};

export type SessionBookingSummary = {
  confirmed: number;
  pending: number;
  waitlist: number;
  remainingSpaces: number;
  isFull: boolean;
};

export function summarizeSessionBookings(
  bookings: BookingStateInput[],
  capacity: number,
  now = Date.now(),
): SessionBookingSummary {
  const confirmed = bookings.filter((booking) => booking.booking_status === "confirmed").length;
  const pending = bookings.filter(
    (booking) =>
      booking.booking_status === "pending" &&
      (!booking.expires_at || new Date(booking.expires_at).getTime() > now),
  ).length;
  const waitlist = bookings.filter((booking) => booking.booking_status === "waitlist").length;
  const remainingSpaces = Math.max(capacity - confirmed - pending, 0);

  return {
    confirmed,
    pending,
    waitlist,
    remainingSpaces,
    isFull: remainingSpaces === 0,
  };
}

export function getBookingFlowState(args: {
  bookings: BookingStateInput[];
  capacity: number;
  price: number;
  now?: number;
}) {
  const summary = summarizeSessionBookings(args.bookings, args.capacity, args.now);

  if (summary.isFull) {
    return {
      ...summary,
      bookingStatus: "waitlist" as const,
      paymentStatus: "not_required" as const,
    };
  }

  if (args.price > 0) {
    return {
      ...summary,
      bookingStatus: "pending" as const,
      paymentStatus: "requires_payment" as const,
    };
  }

  return {
    ...summary,
    bookingStatus: "confirmed" as const,
    paymentStatus: "not_required" as const,
  };
}
