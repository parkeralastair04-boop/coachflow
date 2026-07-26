import type { SessionBookingStatus } from "@/lib/booking-system";

export type BookingDisplayInput = {
  booking_status: SessionBookingStatus;
  payment_status: string;
  expires_at?: string | null;
};

export type BookingDisplayStatus = {
  label: string;
  description: string;
  tone: "confirmed" | "pending" | "waitlist" | "neutral";
};

export function getBookingDisplayStatus(
  booking: BookingDisplayInput,
  now = Date.now(),
): BookingDisplayStatus {
  if (booking.booking_status === "waitlist") {
    return {
      label: "On waitlist",
      description: "Parent joined the waitlist — contact them if a space opens.",
      tone: "waitlist",
    };
  }

  if (booking.booking_status === "confirmed") {
    return {
      label: "Confirmed",
      description: "Space secured — player is on the session.",
      tone: "confirmed",
    };
  }

  if (booking.booking_status === "pending") {
    const expired =
      booking.expires_at && new Date(booking.expires_at).getTime() <= now;
    if (expired) {
      return {
        label: "Payment expired",
        description: "Checkout was not completed in time.",
        tone: "neutral",
      };
    }
    if (booking.payment_status === "requires_payment") {
      return {
        label: "Waiting for payment",
        description: "Parent started checkout — space is held until they pay or it expires.",
        tone: "pending",
      };
    }
    return {
      label: "Pending",
      description: "Booking is being processed.",
      tone: "pending",
    };
  }

  return {
    label: "Cancelled",
    description: "This booking is no longer active.",
    tone: "neutral",
  };
}

export const BOOKING_STATUS_HELPER_COPY =
  "Unpaid bookings automatically expire. No action needed yet.";
