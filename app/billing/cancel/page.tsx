import Link from "next/link";

export default function BillingCancelPage() {
  return (
    <div className="mesh-gradient flex min-h-screen items-center justify-center px-4">
      <div className="glass-panel w-full max-w-lg rounded-3xl p-8 text-center sm:p-10">
        <h1 className="text-3xl font-semibold tracking-tight">Checkout cancelled</h1>
        <p className="text-muted mt-3 text-sm sm:text-base">
          No worries, your plan was not changed. You can try again anytime.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/pricing"
            className="bg-foreground text-background hover:opacity-90 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity"
          >
            Return to Pricing
          </Link>
          <Link
            href="/dashboard/billing"
            className="border-border hover:bg-black/[0.03] inline-flex h-11 items-center justify-center rounded-full border px-6 text-sm font-medium transition-colors dark:hover:bg-white/[0.06]"
          >
            Billing Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
