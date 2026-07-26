import type { Metadata } from "next";
import { Suspense } from "react";
import { PlayersManager } from "@/components/players-manager";

export const metadata: Metadata = {
  title: "Active Squad",
};

export default function PlayersPage() {
  return (
    <Suspense fallback={null}>
      <PlayersManager />
    </Suspense>
  );
}
