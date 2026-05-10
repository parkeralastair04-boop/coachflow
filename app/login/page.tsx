import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
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
    <div className="flex min-h-full flex-col">
      <header className="border-b border-black/[0.06] px-4 py-4 dark:border-white/[0.08] sm:px-6">
        <Link href="/" className="font-semibold tracking-tight">
          CoachFlow
        </Link>
      </header>
      <div className="mesh-gradient flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
        <div className="glass-panel w-full max-w-md rounded-2xl p-8 shadow-lg sm:p-10">
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
