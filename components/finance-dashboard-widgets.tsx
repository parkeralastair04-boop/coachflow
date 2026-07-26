"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, PoundSterling } from "lucide-react";
import {
  DashboardWidgetPanel,
  DashboardWidgetStat,
} from "@/components/dashboard/dashboard-widget-panel";
import {
  buildFinanceDashboardSnapshot,
  formatFinanceCurrency,
} from "@/lib/finance-insights";
import { createClient } from "@/lib/supabase";
import { isMissingTableError } from "@/lib/supabase-errors";
import type { CampEnrolmentRow, CampRow } from "@/lib/camp-insights";
import type { CoachWageRow, FinanceExpenseRow, FinanceInvoiceRow } from "@/lib/finance-types";

export function FinanceDashboardWidgets() {
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<ReturnType<typeof buildFinanceDashboardSnapshot> | null>(
    null,
  );

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [
        bookingsRes,
        subscriptionsRes,
        campsRes,
        enrolmentsRes,
        expensesRes,
        invoicesRes,
        wagesRes,
      ] = await Promise.all([
        supabase
          .from("session_bookings")
          .select("booking_status, payment_status, amount, created_at")
          .eq("coach_id", user.id),
        supabase.from("parent_subscriptions").select("amount, interval, status").eq("coach_id", user.id),
        supabase.from("camps").select("*").eq("coach_id", user.id),
        supabase.from("camp_enrolments").select("id, camp_id, status, created_at").eq("coach_id", user.id),
        supabase.from("finance_expenses").select("*").eq("coach_id", user.id),
        supabase.from("finance_invoices").select("*").eq("coach_id", user.id),
        supabase.from("coach_wage_records").select("*").eq("coach_id", user.id),
      ]);

      if (expensesRes.error && isMissingTableError(expensesRes.error)) return;
      if (bookingsRes.error) throw bookingsRes.error;

      setSnapshot(
        buildFinanceDashboardSnapshot({
          bookings: bookingsRes.data ?? [],
          subscriptions: subscriptionsRes.data ?? [],
          camps: (campsRes.data ?? []) as CampRow[],
          enrolments: (enrolmentsRes.data ?? []) as CampEnrolmentRow[],
          expenses: (expensesRes.data ?? []) as FinanceExpenseRow[],
          invoices: (invoicesRes.data ?? []) as FinanceInvoiceRow[],
          wages: (wagesRes.data ?? []) as CoachWageRow[],
        }),
      );
    } catch {
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadSnapshot();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadSnapshot]);

  if (loading) {
    return (
      <DashboardWidgetPanel
        id="finance-widgets"
        title="Finance Centre"
        description="Income, expenses, invoices, and coach payroll at a glance."
        icon={PoundSterling}
        href="/dashboard/finance"
        linkLabel="Open Finance Centre"
      >
        <p className="text-muted flex items-center gap-2 text-sm" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading finance widgets...
        </p>
      </DashboardWidgetPanel>
    );
  }

  if (!snapshot) return null;

  return (
    <DashboardWidgetPanel
      id="finance-widgets"
      title="Finance Centre"
      description="Income, expenses, invoices, and coach payroll at a glance."
      icon={PoundSterling}
      href="/dashboard/finance"
      linkLabel="Open Finance Centre"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <DashboardWidgetStat label="Outstanding invoices" value={String(snapshot.outstandingInvoices)} />
        <DashboardWidgetStat label="Income this week" value={formatFinanceCurrency(snapshot.incomeThisWeek)} />
        <DashboardWidgetStat label="Profit this month" value={formatFinanceCurrency(snapshot.profitThisMonth)} />
        <DashboardWidgetStat
          label="Upcoming coach payments"
          value={formatFinanceCurrency(snapshot.upcomingCoachPayments)}
        />
        <DashboardWidgetStat label="Recent expenses" value={String(snapshot.recentExpenses.length)} />
      </div>
    </DashboardWidgetPanel>
  );
}
