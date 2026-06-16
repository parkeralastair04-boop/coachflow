import type { Metadata } from "next";
import { AccountSettingsManager } from "@/components/account-settings-manager";

export const metadata: Metadata = {
  title: "Account Settings",
};

export default function AccountSettingsPage() {
  return <AccountSettingsManager />;
}
