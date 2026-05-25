import type { Metadata } from "next";
import { TeamsManager } from "@/components/teams-manager";

export const metadata: Metadata = {
  title: "Teams",
};

export default function TeamsPage() {
  return <TeamsManager />;
}
