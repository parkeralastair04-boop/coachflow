import type { Metadata } from "next";
import { AvailabilityManager } from "@/components/availability-manager";

export const metadata: Metadata = {
  title: "Booking & Availability",
};

export default function AvailabilityPage() {
  return <AvailabilityManager />;
}
