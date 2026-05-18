import type { Metadata } from "next";
import { NotificationSettingsManager } from "@/components/notification-settings-manager";

export const metadata: Metadata = {
  title: "Notification Settings",
};

export default function NotificationSettingsPage() {
  return <NotificationSettingsManager />;
}
