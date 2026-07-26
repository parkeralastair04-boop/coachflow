import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/football/auth-card";
import { ContentSkeleton } from "@/components/branded-loading";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { privateRouteMetadata } from "@/lib/private-route-metadata";

export const metadata: Metadata = {
  ...privateRouteMetadata,
  title: "Set new password",
};

function ResetPasswordFormFallback() {
  return <ContentSkeleton rows={2} />;
}

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Choose a new password"
      description="Enter and confirm your new password to finish resetting your account."
    >
      <Suspense fallback={<ResetPasswordFormFallback />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
