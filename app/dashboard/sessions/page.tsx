import type { Metadata } from "next";
import { SessionsManager } from "@/components/sessions-manager";

export const metadata: Metadata = {
  title: "Sessions",
};

export default function SessionsPage() {
  return <SessionsManager />;
}
