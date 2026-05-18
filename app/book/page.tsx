import type { Metadata } from "next";
import { BookingPortal } from "@/components/booking-portal";

export const metadata: Metadata = {
  title: "Book Football Coaching",
  description:
    "Book 1-to-1 coaching, group sessions, and football camps through CoachFlow.",
};

export default function BookPage() {
  return <BookingPortal />;
}
