import type { Metadata } from "next";
import { PlayersManager } from "@/components/players-manager";

export const metadata: Metadata = {
  title: "Players",
};

export default function PlayersPage() {
  return <PlayersManager />;
}
