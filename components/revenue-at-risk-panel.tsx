"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import {
  formatFamilyCount,
  formatSubscriptionAttentionCount,
  formatWaitlistChildrenCount,
  hasRevenueAtRisk,
  summarizeRevenueAtRisk,
  type RevenueAtRiskCounts,
} from "@/lib/revenue-at-risk";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const EMPTY_COUNTS: RevenueAtRiskCounts = {
  pendingCheckouts: 0,
  failedSubscriptions: 0,
  waitlistChildren: 0,
};

export function RevenueAtRiskPanel({ className }: { className?: string }) {
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<RevenueAtRiskCounts>(EMPTY_COUNTS);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const [{ data: bookings }, { data: subscriptions }] = await Promise.all([
          supabase
            .from("session_bookings")
            .select("booking_status, payment_status, expires_at")
            .eq("coach_id", user.id),
          supabase
            .from("parent_subscriptions")
            .select("status")
            .eq("coach_id", user.id),
        ]);

        if (cancelled) return;

        setCounts(
          summarizeRevenueAtRisk({
            bookings: bookings ?? [],
            subscriptions: subscriptions ?? [],
          }),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section
        className={cn("glass-panel flex items-center gap-3 rounded-2xl p-6 text-sm", className)}
        aria-busy="true"
      >
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Checking bookings and payments...
      </section>
    );
  }

  if (!hasRevenueAtRisk(counts)) {
    return null;
  }

  return (
    <section
      className={cn("glass-panel interactive-surface rounded-2xl p-6 sm:p-8", className)}
      aria-labelledby="revenue-at-risk-heading"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/25">
          <AlertTriangle className="size-5 text-amber-800 dark:text-amber-200" aria-hidden />
        </div>
        <div className="min-w-0">
          <h2 id="revenue-at-risk-heading" className="text-lg font-semibold tracking-tight">
            Revenue at risk
          </h2>
          <p className="text-muted mt-1 text-sm leading-relaxed">
            Families and monthly payment plans that may need a quick follow-up.
          </p>
        </div>
      </div>

      <ul className="mt-6 space-y-3" role="list">
        {counts.pendingCheckouts > 0 ? (
          <li
            role="status"
            aria-live="polite"
            className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm"
          >
            <p className="font-medium">
              {formatFamilyCount(counts.pendingCheckouts)} still completing payment
            </p>
            <p className="text-muted mt-1 text-xs leading-relaxed">
              Places are temporarily reserved while parents complete payment.
            </p>
          </li>
        ) : null}

        {counts.failedSubscriptions > 0 ? (
          <li
            role="status"
            aria-live="polite"
            className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm"
          >
            <p className="font-medium">
              {formatSubscriptionAttentionCount(counts.failedSubscriptions)}
            </p>
            <p className="text-muted mt-1 text-xs leading-relaxed">
              Ask parents to update their payment details.
            </p>
          </li>
        ) : null}

        {counts.waitlistChildren > 0 ? (
          <li
            role="status"
            aria-live="polite"
            className="rounded-2xl border border-black/[0.06] bg-black/[0.02] px-4 py-3 text-sm dark:border-white/[0.08] dark:bg-white/[0.03]"
          >
            <p className="font-medium">{formatWaitlistChildrenCount(counts.waitlistChildren)}</p>
            <p className="text-muted mt-1 text-xs leading-relaxed">
              Contact families if a place opens up.
            </p>
          </li>
        ) : null}
      </ul>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        {counts.pendingCheckouts > 0 || counts.waitlistChildren > 0 ? (
          <Link
            href="/dashboard/sessions"
            className="border-border hover:bg-surface-hover inline-flex h-10 items-center justify-center rounded-full border px-5 text-sm font-medium transition-colors dark:hover:bg-white/[0.06]"
          >
            View sessions
            <ArrowRight className="ml-2 size-4" aria-hidden />
          </Link>
        ) : null}
        {counts.failedSubscriptions > 0 ? (
          <Link
            href="/dashboard/payments"
            className="border-border hover:bg-surface-hover inline-flex h-10 items-center justify-center rounded-full border px-5 text-sm font-medium transition-colors dark:hover:bg-white/[0.06]"
          >
            View payments
            <ArrowRight className="ml-2 size-4" aria-hidden />
          </Link>
        ) : null}
      </div>
    </section>
  );
}
