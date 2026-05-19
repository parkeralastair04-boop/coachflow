import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

function LoginFormFallback() {
  return (
    <div className="text-muted flex h-64 items-center justify-center text-sm">
      Loading form…
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="mesh-gradient flex min-h-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
        <Link href="/" className="mb-10 inline-flex" aria-label="CoachFlow home">
          <BrandLogo size="auth" priority />
        </Link>
        <div className="glass-panel w-full max-w-md rounded-2xl p-8 sm:p-10">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-muted mt-2 text-sm">
            Sign in to manage your coaching business.
          </p>
          <Suspense fallback={<LoginFormFallback />}>
            <LoginForm className="mt-8" />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
