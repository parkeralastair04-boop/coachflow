import type { Metadata } from "next";
import { AccountSettingsManager } from "@/components/account-settings-manager";

export const metadata: Metadata = {
  title: "Profile",
};

export default function AccountSettingsPage() {
  return <AccountSettingsManager />;
}
