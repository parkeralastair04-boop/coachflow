import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/football/auth-card";
import { ContentSkeleton } from "@/components/branded-loading";
import { SignupForm } from "@/components/signup-form";
import { privateRouteMetadata } from "@/lib/private-route-metadata";

export const metadata: Metadata = {
  ...privateRouteMetadata,
  title: "Create account",
};

function SignupFormFallback() {
  return <ContentSkeleton rows={2} />;
}

export default function SignupPage() {
  return (
    <AuthCard
      title="Start developing players"
      description="Create your account, name your academy, publish a session, and share a booking link parents can use today."
    >
      <Suspense fallback={<SignupFormFallback />}>
        <SignupForm />
      </Suspense>
    </AuthCard>
  );
}
