"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock3, Loader2, PoundSterling, Users } from "lucide-react";
import {
  computeCoachingIncomeMetrics,
  formatCoachingIncome,
  formatCompletingPaymentCopy,
  formatWaitingFamiliesCopy,
  type CoachingIncomeMetrics,
} from "@/lib/coaching-income";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const EMPTY_METRICS: CoachingIncomeMetrics = {
  monthlyBookingIncome: 0,
  activeMonthlyPaymentIncome: 0,
  familiesCompletingPayment: 0,
  familiesWaiting: 0,
};

type IncomeCard = {
  id: string;
  label: string;
  value: string;
  valueAriaLabel: string;
  emptyCopy: string;
  href: string;
  icon: typeof PoundSterling;
  isEmpty: boolean;
};

function IncomeMetricCard({ card }: { card: IncomeCard }) {
  const Icon = card.icon;

  return (
    <Link
      href={card.href}
      className="dashboard-insight-panel interactive-surface focus-visible:ring-accent/50 block p-5 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:p-6"
      aria-labelledby={`${card.id}-label`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p id={`${card.id}-label`} className="text-muted text-[11px] font-bold tracking-[0.16em] uppercase">
            {card.label}
          </p>
          <p
            className="mt-2 text-3xl font-semibold tracking-tight"
            aria-label={card.valueAriaLabel}
          >
            {card.value}
          </p>
          <p className="text-muted mt-1 text-xs leading-relaxed">
            {card.isEmpty ? card.emptyCopy : "See details"}
          </p>
        </div>
        <div className="bg-accent/10 ring-accent/20 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
          <Icon className="text-accent size-5" aria-hidden />
        </div>
      </div>
      {!card.isEmpty ? (
        <span className="text-accent mt-4 inline-flex items-center gap-1.5 text-sm font-medium">
          See details
          <ArrowRight className="size-3.5" aria-hidden />
        </span>
      ) : null}
    </Link>
  );
}

export function CoachingIncomeSection({ className }: { className?: string }) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<CoachingIncomeMetrics>(EMPTY_METRICS);

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
            .select(
              "booking_status, payment_status, expires_at, amount, created_at",
            )
            .eq("coach_id", user.id),
          supabase
            .from("parent_subscriptions")
            .select("status, amount, interval")
            .eq("coach_id", user.id),
        ]);

        if (cancelled) return;

        setMetrics(
          computeCoachingIncomeMetrics(bookings ?? [], subscriptions ?? []),
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
        className={cn("dashboard-insight-panel flex items-center gap-3 p-6 text-sm", className)}
        aria-busy="true"
        aria-labelledby="coaching-income-heading"
      >
        <Loader2 className="size-4 animate-spin" aria-hidden />
        <h2 id="coaching-income-heading" className="sr-only">
          Your coaching income
        </h2>
        Loading your coaching income...
      </section>
    );
  }

  const cards: IncomeCard[] = [
    {
      id: "monthly-booking-income",
      label: "Monthly income from bookings",
      value:
        metrics.monthlyBookingIncome > 0
          ? formatCoachingIncome(metrics.monthlyBookingIncome)
          : "—",
      valueAriaLabel:
        metrics.monthlyBookingIncome > 0
          ? `${formatCoachingIncome(metrics.monthlyBookingIncome)} booking income this month`
          : "No booking income recorded this month yet",
      emptyCopy: "Paid session bookings this month will appear here.",
      href: "/dashboard/analytics",
      icon: PoundSterling,
      isEmpty: metrics.monthlyBookingIncome <= 0,
    },
    {
      id: "active-monthly-payments",
      label: "Monthly income from regular payments",
      value:
        metrics.activeMonthlyPaymentIncome > 0
          ? formatCoachingIncome(metrics.activeMonthlyPaymentIncome)
          : "—",
      valueAriaLabel:
        metrics.activeMonthlyPaymentIncome > 0
          ? `${formatCoachingIncome(metrics.activeMonthlyPaymentIncome)} from regular monthly payments`
          : "No regular monthly payments yet",
      emptyCopy: "Regular monthly payment plans will show here.",
      href: "/dashboard/payments",
      icon: PoundSterling,
      isEmpty: metrics.activeMonthlyPaymentIncome <= 0,
    },
    {
      id: "families-completing-payment",
      label: "Families completing payment",
      value:
        metrics.familiesCompletingPayment > 0
          ? String(metrics.familiesCompletingPayment)
          : "—",
      valueAriaLabel:
        metrics.familiesCompletingPayment > 0
          ? `${formatCompletingPaymentCopy(metrics.familiesCompletingPayment)} completing payment`
          : "No families completing payment right now",
      emptyCopy: "No families are completing payment right now.",
      href: "/dashboard/sessions",
      icon: Clock3,
      isEmpty: metrics.familiesCompletingPayment <= 0,
    },
    {
      id: "families-waiting",
      label: "Families waiting for places",
      value: metrics.familiesWaiting > 0 ? String(metrics.familiesWaiting) : "—",
      valueAriaLabel:
        metrics.familiesWaiting > 0
          ? formatWaitingFamiliesCopy(metrics.familiesWaiting)
          : "No families waiting for places",
      emptyCopy: "Waitlist demand will appear when sessions are full.",
      href: "/dashboard/sessions",
      icon: Users,
      isEmpty: metrics.familiesWaiting <= 0,
    },
  ];

  return (
    <section className={cn("space-y-4", className)} aria-labelledby="coaching-income-heading">
      <h2 id="coaching-income-heading" className="text-base font-semibold tracking-tight sm:text-lg">
        Academy income breakdown
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <IncomeMetricCard key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}
