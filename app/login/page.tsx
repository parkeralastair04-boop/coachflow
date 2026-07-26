import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/football/auth-card";
import { LoginForm } from "@/components/login-form";
import { ContentSkeleton } from "@/components/branded-loading";
import { privateRouteMetadata } from "@/lib/private-route-metadata";

export const metadata: Metadata = {
  ...privateRouteMetadata,
  title: "Sign in",
};

function LoginFormFallback() {
  return <ContentSkeleton rows={2} />;
}

export default function LoginPage() {
  return (
    <AuthCard
      title="Back on the pitch"
      description="Sign in to manage sessions, parent bookings, and your academy."
    >
      <Suspense fallback={<LoginFormFallback />}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
