import type { Metadata } from "next";
import { AcademySettingsManager } from "@/components/academy-settings-manager";

export const metadata: Metadata = {
  title: "Academy Settings",
};

export default function AcademySettingsPage() {
  return <AcademySettingsManager />;
}
