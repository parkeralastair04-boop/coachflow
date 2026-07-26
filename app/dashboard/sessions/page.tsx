import type { Metadata } from "next";
import { SessionsManager } from "@/components/sessions-manager";

export const metadata: Metadata = {
  title: "Training Sessions",
};

export default function SessionsPage() {
  return <SessionsManager />;
}
