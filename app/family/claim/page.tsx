import type { Metadata } from "next";
import { Suspense } from "react";
import { ParentClaimAccountForm } from "@/components/parent-claim-account-form";
import { privateRouteMetadata } from "@/lib/private-route-metadata";

export const metadata: Metadata = {
  ...privateRouteMetadata,
  title: "Claim family account",
  description: "Join your academy as a parent from a secure booking invite.",
};

export default function FamilyClaimPage() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6">
      <Suspense
        fallback={
          <div className="football-panel rounded-2xl p-5 text-sm sm:p-6" role="status">
            Loading invite…
          </div>
        }
      >
        <ParentClaimAccountForm />
      </Suspense>
    </div>
  );
}
