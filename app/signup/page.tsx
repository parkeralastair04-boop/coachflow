import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { SignupForm } from "@/components/signup-form";

export const metadata: Metadata = {
  title: "Create account",
};

export default function SignupPage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-black/[0.06] px-4 py-4 dark:border-white/[0.08] sm:px-6">
        <Link href="/" className="inline-flex" aria-label="CoachFlow home">
          <BrandLogo className="h-10" priority />
        </Link>
      </header>
      <div className="mesh-gradient flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
        <div className="glass-panel w-full max-w-md rounded-2xl p-8 shadow-lg sm:p-10">
          <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
          <p className="text-muted mt-2 text-sm">
            Start your trial — connect Supabase to enable email signup.
          </p>
          <SignupForm className="mt-8" />
        </div>
      </div>
    </div>
  );
}
