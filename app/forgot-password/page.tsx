import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/football/auth-card";
import { ContentSkeleton } from "@/components/branded-loading";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { privateRouteMetadata } from "@/lib/private-route-metadata";

export const metadata: Metadata = {
  ...privateRouteMetadata,
  title: "Forgot password",
};

function ForgotPasswordFormFallback() {
  return <ContentSkeleton rows={2} />;
}

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      description="Enter your email and we will send you a link to choose a new password."
    >
      <Suspense fallback={<ForgotPasswordFormFallback />}>
        <ForgotPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
