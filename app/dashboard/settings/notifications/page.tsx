import type { Metadata } from "next";
import { FeatureGate } from "@/components/feature-gate";
import { NotificationSettingsManager } from "@/components/notification-settings-manager";

export const metadata: Metadata = {
  title: "Pitch-Side Alerts",
};

export default function NotificationSettingsPage() {
  return (
    <FeatureGate feature="push_notifications">
      <NotificationSettingsManager />
    </FeatureGate>
  );
}
