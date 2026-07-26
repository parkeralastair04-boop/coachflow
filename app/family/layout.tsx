import type { Metadata } from "next";
import { privateRouteMetadata } from "@/lib/private-route-metadata";

/**
 * Root family segment layout — no auth gate.
 * Authenticated portal chrome lives in `(portal)/layout.tsx`.
 * `/family/claim` stays public for booking invite links.
 */
export const metadata: Metadata = {
  ...privateRouteMetadata,
  title: "Family training hub",
  description: "View sessions, attendance, reports, camps, and payments for your children.",
};

export default function FamilyRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
