"use client";

import { useEffect, useState } from "react";
import { Cone, Goal, PoundSterling, Shirt } from "lucide-react";
import { ContentSkeleton } from "@/components/branded-loading";
import { DashboardMetricTile } from "@/components/dashboard/dashboard-metric-tile";
import {
  computeCoachingIncomeMetrics,
  formatCoachingIncome,
} from "@/lib/coaching-income";
import { DASHBOARD_METRIC_THEMES } from "@/lib/dashboard-visual";
import { FOOTBALL_LABELS } from "@/lib/football-identity";
import { createClient } from "@/lib/supabase";
import { TYPE } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

type OverviewCard = {
  id: string;
  label: string;
  numericValue?: number;
  value: string;
  valueAriaLabel: string;
  helper: string;
  emptyCopy: string;
  href: string;
  icon: typeof Shirt;
  themeKey: keyof typeof DASHBOARD_METRIC_THEMES;
  isEmpty: boolean;
};

function startOfTodayIso(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString();
}

export function DashboardStats({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "hero";
}) {
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<OverviewCard[]>([]);
  const isHero = variant === "hero";

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const [
          { count: playerCount },
          { count: sessionCount },
          { count: bookingCount },
          { data: bookings },
          { data: subscriptions },
        ] = await Promise.all([
          supabase
            .from("players")
            .select("id", { count: "exact", head: true })
            .eq("coach_id", user.id),
          supabase
            .from("sessions")
            .select("id", { count: "exact", head: true })
            .eq("coach_id", user.id)
            .gte("session_date", startOfTodayIso()),
          supabase
            .from("session_bookings")
            .select("id", { count: "exact", head: true })
            .eq("coach_id", user.id)
            .eq("booking_status", "confirmed"),
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

        const players = playerCount ?? 0;
        const sessions = sessionCount ?? 0;
        const bookingsConfirmed = bookingCount ?? 0;
        const incomeMetrics = computeCoachingIncomeMetrics(
          bookings ?? [],
          subscriptions ?? [],
        );
        const monthlyIncome =
          incomeMetrics.monthlyBookingIncome + incomeMetrics.activeMonthlyPaymentIncome;

        setCards([
          {
            id: "overview-players",
            label: FOOTBALL_LABELS.players,
            numericValue: players,
            value: String(players),
            valueAriaLabel:
              players === 1 ? "1 player in your squad" : `${players} players in your squad`,
            helper: players === 0 ? "Add your first player to the squad." : "Registered in your academy",
            emptyCopy: "Add your first player to the squad.",
            href: "/dashboard/players",
            icon: Shirt,
            themeKey: "squad",
            isEmpty: players === 0,
          },
          {
            id: "overview-sessions",
            label: FOOTBALL_LABELS.sessions,
            numericValue: sessions,
            value: String(sessions),
            valueAriaLabel:
              sessions === 1
                ? "1 upcoming training session"
                : `${sessions} upcoming training sessions`,
            helper: sessions === 0 ? "Set up your first training session." : "Scheduled on the pitch",
            emptyCopy: "Set up your first training session.",
            href: "/dashboard/sessions",
            icon: Cone,
            themeKey: "sessions",
            isEmpty: sessions === 0,
          },
          {
            id: "overview-bookings",
            label: FOOTBALL_LABELS.bookings,
            numericValue: bookingsConfirmed,
            value: String(bookingsConfirmed),
            valueAriaLabel:
              bookingsConfirmed === 1
                ? "1 confirmed parent booking"
                : `${bookingsConfirmed} confirmed parent bookings`,
            helper:
              bookingsConfirmed === 0
                ? "Share your booking link with parents."
                : "Families confirmed for training",
            emptyCopy: "Share your booking link with parents.",
            href: "/dashboard/sessions",
            icon: Goal,
            themeKey: "bookings",
            isEmpty: bookingsConfirmed === 0,
          },
          {
            id: "overview-income",
            label: "Academy income",
            value: formatCoachingIncome(monthlyIncome),
            valueAriaLabel: `${formatCoachingIncome(monthlyIncome)} monthly income from parents`,
            helper:
              monthlyIncome <= 0
                ? "Income appears after your first paid booking."
                : "Monthly revenue from families",
            emptyCopy: "Income appears after your first paid booking.",
            href: "/dashboard/analytics",
            icon: PoundSterling,
            themeKey: "income",
            isEmpty: monthlyIncome <= 0,
          },
        ]);
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
      <section className={className} aria-busy="true" aria-labelledby="dashboard-overview-heading">
        <h2 id="dashboard-overview-heading" className="sr-only">
          {FOOTBALL_LABELS.dashboardOverview}
        </h2>
        <ContentSkeleton rows={isHero ? 2 : 4} />
      </section>
    );
  }

  return (
    <section className={cn("space-y-4", className)} aria-labelledby="dashboard-overview-heading">
      {!isHero ? (
        <h2 id="dashboard-overview-heading" className={TYPE.sectionTitle}>
          {FOOTBALL_LABELS.dashboardOverview}
        </h2>
      ) : (
        <h2 id="dashboard-overview-heading" className="sr-only">
          {FOOTBALL_LABELS.dashboardOverview}
        </h2>
      )}

      <div
        className={cn(
          "grid gap-3 sm:gap-4",
          isHero
            ? "sm:grid-cols-2 xl:grid-cols-4"
            : "stagger-children sm:grid-cols-2 xl:grid-cols-4",
        )}
      >
        {cards.map((card) => (
          <DashboardMetricTile
            key={card.id}
            id={card.id}
            label={card.label}
            value={card.value}
            numericValue={card.numericValue}
            valueAriaLabel={card.valueAriaLabel}
            helper={card.isEmpty ? card.emptyCopy : card.helper}
            href={card.href}
            icon={card.icon}
            theme={DASHBOARD_METRIC_THEMES[card.themeKey]}
            isEmpty={card.isEmpty}
            variant={isHero ? "hero" : "default"}
          />
        ))}
      </div>
    </section>
  );
}
