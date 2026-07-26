import { NextResponse } from "next/server";
import {
  buildFinanceAnalyticsSummary,
  buildFinanceOverview,
  type FinanceOverview,
} from "@/lib/finance-insights";
import { requireFinanceAccess } from "@/lib/finance-access";
import type {
  CampEnrolmentRow,
  CampRow,
} from "@/lib/camp-insights";
import type {
  CoachWageRow,
  FinanceBudgetRow,
  FinanceExpenseRow,
  FinanceInvoiceRow,
} from "@/lib/finance-types";

export const runtime = "nodejs";

export type FinanceDashboardPayload = {
  overview: FinanceOverview;
  analytics: ReturnType<typeof buildFinanceAnalyticsSummary>;
  expenses: FinanceExpenseRow[];
  budgets: FinanceBudgetRow[];
  invoices: FinanceInvoiceRow[];
  wages: CoachWageRow[];
  players: Array<{ id: string; player_name: string; parent_email: string | null }>;
};

export async function GET() {
  try {
    const access = await requireFinanceAccess();
    if (!access.ok) return access.response;

    const [
      { data: bookings, error: bookingsError },
      { data: subscriptions, error: subscriptionsError },
      { data: camps, error: campsError },
      { data: enrolments, error: enrolmentsError },
      { data: expenses, error: expensesError },
      { data: budgets, error: budgetsError },
      { data: invoices, error: invoicesError },
      { data: wages, error: wagesError },
      { data: players, error: playersError },
    ] = await Promise.all([
      access.supabase
        .from("session_bookings")
        .select("booking_status, payment_status, amount, created_at")
        .eq("coach_id", access.coachId),
      access.supabase
        .from("parent_subscriptions")
        .select("amount, interval, status")
        .eq("coach_id", access.coachId),
      access.supabase.from("camps").select("*").eq("coach_id", access.coachId),
      access.supabase.from("camp_enrolments").select("id, camp_id, status, created_at").eq("coach_id", access.coachId),
      access.supabase.from("finance_expenses").select("*").eq("coach_id", access.coachId).order("expense_date", { ascending: false }),
      access.supabase.from("finance_budgets").select("*").eq("coach_id", access.coachId).order("month_key", { ascending: false }),
      access.supabase.from("finance_invoices").select("*").eq("coach_id", access.coachId).order("created_at", { ascending: false }),
      access.supabase.from("coach_wage_records").select("*").eq("coach_id", access.coachId).order("created_at", { ascending: false }),
      access.supabase
        .from("players")
        .select("id, player_name, parent_email")
        .eq("coach_id", access.coachId)
        .order("player_name", { ascending: true }),
    ]);

    const queryError =
      bookingsError ??
      subscriptionsError ??
      campsError ??
      enrolmentsError ??
      expensesError ??
      budgetsError ??
      invoicesError ??
      wagesError ??
      playersError;

    if (queryError) {
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    const payloadBookings = bookings ?? [];
    const payloadSubscriptions = subscriptions ?? [];
    const payloadCamps = (camps ?? []) as CampRow[];
    const payloadEnrolments = (enrolments ?? []) as CampEnrolmentRow[];
    const payloadExpenses = (expenses ?? []) as FinanceExpenseRow[];
    const payloadBudgets = (budgets ?? []) as FinanceBudgetRow[];
    const payloadInvoices = (invoices ?? []) as FinanceInvoiceRow[];
    const payloadWages = (wages ?? []) as CoachWageRow[];

    const overview = buildFinanceOverview({
      bookings: payloadBookings,
      subscriptions: payloadSubscriptions,
      camps: payloadCamps,
      enrolments: payloadEnrolments,
      expenses: payloadExpenses,
      invoices: payloadInvoices,
    });

    const analytics = buildFinanceAnalyticsSummary({
      bookings: payloadBookings,
      subscriptions: payloadSubscriptions,
      camps: payloadCamps,
      enrolments: payloadEnrolments,
      expenses: payloadExpenses,
      invoices: payloadInvoices,
      wages: payloadWages,
      budgets: payloadBudgets,
    });

    const payload: FinanceDashboardPayload = {
      overview,
      analytics,
      expenses: payloadExpenses,
      budgets: payloadBudgets,
      invoices: payloadInvoices,
      wages: payloadWages,
      players: players ?? [],
    };

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load finance dashboard.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
