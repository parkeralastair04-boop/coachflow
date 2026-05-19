import type { Metadata } from "next";
import { HelpSupportManager } from "@/components/help-support-manager";

export const metadata: Metadata = {
  title: "Help & Support",
};

export default function HelpPage() {
  return <HelpSupportManager />;
}
