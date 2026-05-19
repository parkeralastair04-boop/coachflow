import type { Metadata } from "next";
import { ThemeSettingsManager } from "@/components/theme-settings-manager";

export const metadata: Metadata = {
  title: "Appearance",
};

export default function AppearanceSettingsPage() {
  return <ThemeSettingsManager />;
}
