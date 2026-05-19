import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { SignupForm } from "@/components/signup-form";

export const metadata: Metadata = {
  title: "Create account",
};

function SignupFormFallback() {
  return (
    <div className="text-muted flex h-64 items-center justify-center text-sm">
      Loading form…
    </div>
  );
}

export default function SignupPage() {
  return (
    <div className="mesh-gradient flex min-h-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
        <Link href="/" className="mb-10 inline-flex" aria-label="CoachFlow home">
          <BrandLogo size="auth" priority />
        </Link>
        <div className="glass-panel w-full max-w-md rounded-2xl p-8 sm:p-10">
          <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
          <p className="text-muted mt-2 text-sm">
            Start your trial — connect Supabase to enable email signup.
          </p>
          <Suspense fallback={<SignupFormFallback />}>
            <SignupForm className="mt-8" />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
