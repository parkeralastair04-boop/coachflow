import type { Metadata } from "next";
import type { ReactNode } from "react";
import { privateRouteMetadata } from "@/lib/private-route-metadata";

export const metadata: Metadata = {
  ...privateRouteMetadata,
  title: "Billing",
};

export default function BillingLayout({ children }: { children: ReactNode }) {
  return children;
}
