import Link from "next/link";
import {
  TRIAL_PERIOD_DAYS,
  addTrialDays,
  formatUkLongDate,
} from "@/lib/trial-copy";

export default function BillingSuccessPage() {
  const trialEndsAt = addTrialDays(new Date(), TRIAL_PERIOD_DAYS);

  return (
    <div className="mesh-gradient flex min-h-screen items-center justify-center px-4">
      <div className="glass-panel w-full max-w-lg rounded-3xl p-8 text-center sm:p-10">
        <h1 className="text-3xl font-semibold tracking-tight">Trial started</h1>
        <p className="text-muted mt-3 text-sm sm:text-base">
          You won&apos;t be charged today. Your first payment will be collected on{" "}
          {formatUkLongDate(trialEndsAt)} unless you cancel before then.
        </p>
        <p className="text-muted mt-3 text-sm">
          Cancel anytime from Billing during your {TRIAL_PERIOD_DAYS}-day trial.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard/billing"
            className="bg-foreground text-background hover:opacity-90 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity"
          >
            Go to Billing
          </Link>
          <Link
            href="/dashboard"
            className="border-border hover:bg-black/[0.03] inline-flex h-11 items-center justify-center rounded-full border px-6 text-sm font-medium transition-colors dark:hover:bg-white/[0.06]"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
