import { Suspense } from "react";
import { ParentFamilyDashboard } from "@/components/parent-family-dashboard";

export default function FamilyPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-10 text-sm" role="status">
          Loading your family’s training…
        </div>
      }
    >
      <ParentFamilyDashboard />
    </Suspense>
  );
}
