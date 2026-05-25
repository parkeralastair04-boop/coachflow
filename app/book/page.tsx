import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingPortal } from "@/components/booking-portal";

export const metadata: Metadata = {
  title: "Book Football Coaching",
  description:
    "Book live public football sessions with upfront payment and automatic waitlists through CoachFlow.",
};

export default function BookPage() {
  return (
    <Suspense fallback={null}>
      <BookingPortal />
    </Suspense>
  );
}
