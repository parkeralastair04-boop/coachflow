import type { Metadata } from "next";
import { ReferralsManager } from "@/components/referrals-manager";

export const metadata: Metadata = {
  title: "Referrals",
};

export default function ReferralsPage() {
  return <ReferralsManager />;
}
