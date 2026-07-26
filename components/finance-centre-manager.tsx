"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  FileText,
  Loader2,
  Mail,
  Plus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { ReactNode } from "react";
import { FeaturePageHeader } from "@/components/feature-page-header";
import { FormErrorAlert } from "@/components/form-error-alert";
import { SetupRequiredPanel } from "@/components/setup-required-panel";
import type { FinanceDashboardPayload } from "@/app/api/finance/dashboard/route";
import {
  filterFacilityExpenses,
  formatFinanceCurrency,
  monthKey,
  monthLabel,
} from "@/lib/finance-insights";
import { generateFinanceReportPdf, getFinanceReportFilename } from "@/lib/finance-pdf";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  INVOICE_STATUS_LABELS,
  WAGE_PAYMENT_TYPES,
  WAGE_PAYMENT_TYPE_LABELS,
  poundsToPence,
  penceToPounds,
  type ExpenseCategory,
  type InvoiceStatus,
  type WagePaymentType,
} from "@/lib/finance-types";
import {
  getCommunicationTemplate,
  renderCommunicationTemplate,
} from "@/lib/communication-templates";
import { createClient } from "@/lib/supabase";
import { getSetupRequiredMessage, isMissingTableError } from "@/lib/supabase-errors";
import { sanitizeDashboardSaveError } from "@/lib/user-facing-errors";
import { cn } from "@/lib/utils";

type View = "overview" | "expenses" | "wages" | "facility" | "budget" | "invoices" | "reports";

const VIEWS: { id: View; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "expenses", label: "Expenses" },
  { id: "wages", label: "Coach payments" },
  { id: "facility", label: "Facility costs" },
  { id: "budget", label: "Budgeting" },
  { id: "invoices", label: "Invoices" },
  { id: "reports", label: "Reports" },
];

function StatCard({
  label,
  value,
  hint,
  trend,
}: {
  label: string;
  value: string;
  hint?: string;
  trend?: "up" | "down";
}) {
  const Icon = trend === "down" ? TrendingDown : TrendingUp;
  return (
    <article className="rounded-xl bg-black/[0.02] px-4 py-4 dark:bg-white/[0.03]">
      <p className="text-muted text-xs">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        {trend ? <Icon className="text-accent size-4" aria-hidden /> : null}
        <p className="text-lg font-semibold tracking-tight">{value}</p>
      </div>
      {hint ? <p className="text-muted mt-1 text-xs">{hint}</p> : null}
    </article>
  );
}

export function FinanceCentreManager() {
  const [view, setView] = useState<View>("overview");
  const [data, setData] = useState<FinanceDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [setupTables, setSetupTables] = useState<string[]>([]);
  const [coachId, setCoachId] = useState<string | null>(null);

  const [expenseForm, setExpenseForm] = useState({
    expenseDate: new Date().toISOString().slice(0, 10),
    amount: "",
    category: "other" as ExpenseCategory,
    supplier: "",
    notes: "",
    isRecurring: false,
    isPaid: true,
    receiptPath: "",
  });

  const [wageForm, setWageForm] = useState({
    payeeName: "",
    amount: "",
    hourlyRate: "",
    hours: "",
    paymentType: "wage" as WagePaymentType,
    dueDate: "",
    notes: "",
  });

  const [budgetForm, setBudgetForm] = useState({
    monthKey: monthKey(new Date()),
    incomeGoal: "",
    expenseTarget: "",
    notes: "",
  });

  const [invoiceForm, setInvoiceForm] = useState({
    playerId: "",
    invoiceNumber: "",
    amount: "",
    dueDate: "",
    description: "",
    notes: "",
  });

  const facilityExpenses = useMemo(
    () => (data ? filterFacilityExpenses(data.expenses) : []),
    [data],
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setCoachId(user.id);

      const response = await fetch("/api/finance/dashboard");
      const payload = (await response.json()) as FinanceDashboardPayload & { error?: string };
      if (!response.ok) {
        if (payload.error?.includes("relation") || payload.error?.includes("does not exist")) {
          setSetupTables(["finance_expenses", "finance_budgets", "finance_invoices", "coach_wage_records"]);
          return;
        }
        throw new Error(payload.error ?? "Failed to load finance dashboard.");
      }
      setData(payload);
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      if (message.toLowerCase().includes("finance_expenses")) {
        setSetupTables(["finance_expenses"]);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadDashboard();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadDashboard]);

  async function handleAddExpense() {
    if (!coachId || !expenseForm.amount.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: insertError } = await supabase.from("finance_expenses").insert({
        coach_id: coachId,
        expense_date: expenseForm.expenseDate,
        amount_pence: poundsToPence(Number(expenseForm.amount)),
        category: expenseForm.category,
        supplier: expenseForm.supplier.trim() || null,
        notes: expenseForm.notes.trim() || null,
        receipt_path: expenseForm.receiptPath.trim() || null,
        is_recurring: expenseForm.isRecurring,
        is_paid: expenseForm.isPaid,
      });
      if (insertError) {
        if (isMissingTableError(insertError)) {
          setSetupTables(["finance_expenses"]);
          return;
        }
        throw insertError;
      }
      setStatusMessage("Expense saved.");
      setExpenseForm((current) => ({ ...current, amount: "", supplier: "", notes: "", receiptPath: "" }));
      await loadDashboard();
    } catch (caughtError) {
      setError(sanitizeDashboardSaveError(caughtError, { logLabel: "finance-expense" }));
    } finally {
      setSaving(false);
    }
  }

  async function handleAddWage() {
    if (!coachId || !wageForm.payeeName.trim() || !wageForm.amount.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: insertError } = await supabase.from("coach_wage_records").insert({
        coach_id: coachId,
        payee_name: wageForm.payeeName.trim(),
        amount_pence: poundsToPence(Number(wageForm.amount)),
        hourly_rate_pence: wageForm.hourlyRate ? poundsToPence(Number(wageForm.hourlyRate)) : null,
        hours: wageForm.hours ? Number(wageForm.hours) : null,
        payment_type: wageForm.paymentType,
        due_date: wageForm.dueDate || null,
        notes: wageForm.notes.trim() || null,
        status: "outstanding",
      });
      if (insertError) throw insertError;
      setStatusMessage("Coach payment recorded.");
      setWageForm({
        payeeName: "",
        amount: "",
        hourlyRate: "",
        hours: "",
        paymentType: "wage",
        dueDate: "",
        notes: "",
      });
      await loadDashboard();
    } catch (caughtError) {
      setError(sanitizeDashboardSaveError(caughtError, { logLabel: "finance-wage" }));
    } finally {
      setSaving(false);
    }
  }

  async function markWagePaid(wageId: string) {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("coach_wage_records")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", wageId);
      if (updateError) throw updateError;
      setStatusMessage("Coach payment marked as paid.");
      await loadDashboard();
    } catch (caughtError) {
      setError(sanitizeDashboardSaveError(caughtError, { logLabel: "finance-wage-paid" }));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveBudget() {
    if (!coachId) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: upsertError } = await supabase.from("finance_budgets").upsert(
        {
          coach_id: coachId,
          month_key: budgetForm.monthKey,
          income_goal_pence: poundsToPence(Number(budgetForm.incomeGoal || 0)),
          expense_target_pence: poundsToPence(Number(budgetForm.expenseTarget || 0)),
          notes: budgetForm.notes.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "coach_id,month_key" },
      );
      if (upsertError) throw upsertError;
      setStatusMessage("Monthly budget saved.");
      await loadDashboard();
    } catch (caughtError) {
      setError(sanitizeDashboardSaveError(caughtError, { logLabel: "finance-budget" }));
    } finally {
      setSaving(false);
    }
  }

  async function handleAddInvoice() {
    if (!coachId || !invoiceForm.invoiceNumber.trim() || !invoiceForm.amount.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: insertError } = await supabase.from("finance_invoices").insert({
        coach_id: coachId,
        player_id: invoiceForm.playerId || null,
        invoice_number: invoiceForm.invoiceNumber.trim(),
        amount_pence: poundsToPence(Number(invoiceForm.amount)),
        due_date: invoiceForm.dueDate || null,
        description: invoiceForm.description.trim() || null,
        notes: invoiceForm.notes.trim() || null,
        status: "outstanding",
      });
      if (insertError) throw insertError;
      setStatusMessage("Invoice created.");
      setInvoiceForm({
        playerId: "",
        invoiceNumber: "",
        amount: "",
        dueDate: "",
        description: "",
        notes: "",
      });
      await loadDashboard();
    } catch (caughtError) {
      setError(sanitizeDashboardSaveError(caughtError, { logLabel: "finance-invoice" }));
    } finally {
      setSaving(false);
    }
  }

  async function updateInvoiceStatus(invoiceId: string, status: InvoiceStatus) {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("finance_invoices")
        .update({
          status,
          paid_at: status === "paid" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoiceId);
      if (updateError) throw updateError;
      setStatusMessage(`Invoice marked as ${INVOICE_STATUS_LABELS[status].toLowerCase()}.`);
      await loadDashboard();
    } catch (caughtError) {
      setError(sanitizeDashboardSaveError(caughtError, { logLabel: "finance-invoice-status" }));
    } finally {
      setSaving(false);
    }
  }

  async function handleExportReport() {
    if (!data) return;
    setExporting(true);
    try {
      const bytes = await generateFinanceReportPdf({
        title: "Monthly finance report",
        overview: data.overview,
        analytics: data.analytics,
        generatedAt: new Date().toISOString(),
      });
      const buffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buffer).set(bytes);
      const blob = new Blob([buffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = getFinanceReportFilename("monthly-finance-report");
      anchor.click();
      URL.revokeObjectURL(url);
      setStatusMessage("Finance report downloaded.");
    } catch (caughtError) {
      setError(sanitizeDashboardSaveError(caughtError, { logLabel: "finance-report-pdf" }));
    } finally {
      setExporting(false);
    }
  }

  function buildInvoiceReminderCopy(invoiceNumber: string, amount: string, dueDate: string) {
    const template = getCommunicationTemplate("invoice_reminder");
    return renderCommunicationTemplate(template.defaultBody, {
      parent_name: "Parent",
      player_name: "your child",
      invoice_number: invoiceNumber,
      invoice_amount: amount,
      due_date: dueDate,
    });
  }

  if (setupTables.length > 0) {
    return (
      <div className="page-content-enter space-y-8">
        <FeaturePageHeader
          featureKey="finance"
          title="Finance Centre"
          subtitle="See what training earns, what it costs, and whether the academy is healthy."
        />
        <SetupRequiredPanel
          {...getSetupRequiredMessage(setupTables)}
          onRetry={() => void loadDashboard()}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="text-muted size-8 animate-spin" aria-hidden />
        <span className="sr-only">Loading finance centre</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-content-enter space-y-8">
        <FeaturePageHeader
          featureKey="finance"
          title="Finance Centre"
          subtitle="See what training earns, what it costs, and whether the academy is healthy."
        />
        <SetupRequiredPanel alert onRetry={() => void loadDashboard()} />
      </div>
    );
  }

  return (
    <div className="page-content-enter space-y-8">
      <FeaturePageHeader
        featureKey="finance"
        title="Finance Centre"
        subtitle="Understand where money comes from, where it goes, and whether your academy is profitable."
      />

      {error ? <FormErrorAlert message={error} /> : null}
      {statusMessage ? (
        <p className="text-accent text-sm" role="status" aria-live="polite">
          {statusMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Finance centre views">
        {VIEWS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              view === id
                ? "bg-foreground text-background"
                : "border-border hover:bg-surface-hover border dark:hover:bg-white/[0.06]",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "overview" ? (
        <section aria-labelledby="finance-overview-heading">
          <h2 id="finance-overview-heading" className="sr-only">
            Finance overview
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Income this month" value={formatFinanceCurrency(data.overview.incomeThisMonth)} trend="up" />
            <StatCard
              label="Recurring monthly income"
              value={formatFinanceCurrency(data.overview.recurringMonthlyIncome)}
              hint="Active parent subscriptions"
            />
            <StatCard label="Camp income" value={formatFinanceCurrency(data.overview.campIncomeThisMonth)} />
            <StatCard
              label="Outstanding payments"
              value={formatFinanceCurrency(data.overview.outstandingPayments)}
              trend="down"
            />
            <StatCard label="Expenses" value={formatFinanceCurrency(data.overview.expensesThisMonth)} trend="down" />
            <StatCard label="Profit" value={formatFinanceCurrency(data.overview.profitThisMonth)} trend="up" />
            <StatCard
              label="Projected monthly income"
              value={formatFinanceCurrency(data.overview.projectedMonthlyIncome)}
            />
            <StatCard
              label="Projected annual income"
              value={formatFinanceCurrency(data.overview.projectedAnnualIncome)}
            />
            <StatCard label="Cash flow" value={formatFinanceCurrency(data.overview.cashFlowThisMonth)} />
            <StatCard label="Year-to-date profit" value={formatFinanceCurrency(data.overview.netProfitYtd)} />
            <StatCard
              label="Rolling 12-month profit"
              value={formatFinanceCurrency(data.overview.rollingTwelveMonthProfit)}
            />
          </div>

          {data.analytics.budgetAlerts.length > 0 ? (
            <div className="mt-6 space-y-2" role="status" aria-live="polite">
              {data.analytics.budgetAlerts.map((alert) => (
                <p
                  key={alert.message}
                  className={cn(
                    "rounded-xl px-4 py-3 text-sm",
                    alert.severity === "warning"
                      ? "bg-amber-500/10 text-amber-800 dark:text-amber-200"
                      : "bg-accent/10 text-accent",
                  )}
                >
                  {alert.message}
                </p>
              ))}
            </div>
          ) : null}

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <ChartPanel title="Income, expenses, and profit" series={data.analytics.incomeSeries} />
            <div className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6">
              <h3 className="text-base font-semibold">Quick links</h3>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <Link href="/dashboard/payments" className="text-accent underline-offset-4 hover:underline">
                    Parent Payments (Stripe)
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/analytics" className="text-accent underline-offset-4 hover:underline">
                    Analytics dashboards
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/communication" className="text-accent underline-offset-4 hover:underline">
                    Send invoice reminders
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      {view === "expenses" ? (
        <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6" aria-labelledby="expenses-heading">
          <h2 id="expenses-heading" className="text-lg font-semibold">
            Expenses
          </h2>
          <p className="text-muted mt-1 text-sm">Record facility hire, equipment, wages, marketing, and other costs.</p>

          <form
            className="mt-6 grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              void handleAddExpense();
            }}
          >
            <Field label="Date">
              <input
                type="date"
                value={expenseForm.expenseDate}
                onChange={(event) => setExpenseForm((c) => ({ ...c, expenseDate: event.target.value }))}
                className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                required
              />
            </Field>
            <Field label="Amount (£)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={expenseForm.amount}
                onChange={(event) => setExpenseForm((c) => ({ ...c, amount: event.target.value }))}
                className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                required
              />
            </Field>
            <Field label="Category">
              <select
                value={expenseForm.category}
                onChange={(event) =>
                  setExpenseForm((c) => ({ ...c, category: event.target.value as ExpenseCategory }))
                }
                className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
              >
                {EXPENSE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {EXPENSE_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Supplier">
              <input
                type="text"
                value={expenseForm.supplier}
                onChange={(event) => setExpenseForm((c) => ({ ...c, supplier: event.target.value }))}
                className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
              />
            </Field>
            <Field label="Receipt reference">
              <input
                type="text"
                value={expenseForm.receiptPath}
                onChange={(event) => setExpenseForm((c) => ({ ...c, receiptPath: event.target.value }))}
                className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                placeholder="Filename or storage path"
              />
            </Field>
            <Field label="Notes">
              <input
                type="text"
                value={expenseForm.notes}
                onChange={(event) => setExpenseForm((c) => ({ ...c, notes: event.target.value }))}
                className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
              />
            </Field>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={expenseForm.isRecurring}
                onChange={(event) => setExpenseForm((c) => ({ ...c, isRecurring: event.target.checked }))}
              />
              Recurring expense
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={expenseForm.isPaid}
                onChange={(event) => setExpenseForm((c) => ({ ...c, isPaid: event.target.checked }))}
              />
              Paid
            </label>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-foreground text-background inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-medium"
              >
                {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                Add expense
              </button>
            </div>
          </form>

          <ExpenseList expenses={data.expenses} />
        </section>
      ) : null}

      {view === "wages" ? (
        <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6" aria-labelledby="wages-heading">
          <h2 id="wages-heading" className="text-lg font-semibold">
            Coach payments
          </h2>
          <p className="text-muted mt-1 text-sm">
            Session, match, camp, and wage payments. Payroll summary: outstanding{" "}
            {formatFinanceCurrency(data.analytics.payrollSummary.outstanding)}, paid{" "}
            {formatFinanceCurrency(data.analytics.payrollSummary.paid)}.
          </p>

          <form
            className="mt-6 grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              void handleAddWage();
            }}
          >
            <Field label="Payee name">
              <input
                type="text"
                value={wageForm.payeeName}
                onChange={(event) => setWageForm((c) => ({ ...c, payeeName: event.target.value }))}
                className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                required
              />
            </Field>
            <Field label="Amount (£)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={wageForm.amount}
                onChange={(event) => setWageForm((c) => ({ ...c, amount: event.target.value }))}
                className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                required
              />
            </Field>
            <Field label="Hourly rate (£)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={wageForm.hourlyRate}
                onChange={(event) => setWageForm((c) => ({ ...c, hourlyRate: event.target.value }))}
                className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
              />
            </Field>
            <Field label="Hours">
              <input
                type="number"
                min="0"
                step="0.25"
                value={wageForm.hours}
                onChange={(event) => setWageForm((c) => ({ ...c, hours: event.target.value }))}
                className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
              />
            </Field>
            <Field label="Payment type">
              <select
                value={wageForm.paymentType}
                onChange={(event) =>
                  setWageForm((c) => ({ ...c, paymentType: event.target.value as WagePaymentType }))
                }
                className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
              >
                {WAGE_PAYMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {WAGE_PAYMENT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Due date">
              <input
                type="date"
                value={wageForm.dueDate}
                onChange={(event) => setWageForm((c) => ({ ...c, dueDate: event.target.value }))}
                className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
              />
            </Field>
            <Field label="Notes">
              <input
                type="text"
                value={wageForm.notes}
                onChange={(event) => setWageForm((c) => ({ ...c, notes: event.target.value }))}
                className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2 md:col-span-2"
              />
            </Field>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-foreground text-background inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-medium"
              >
                {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                Record payment
              </button>
            </div>
          </form>

          <ul className="mt-6 space-y-3" role="list" aria-label="Coach payment records">
            {data.wages.map((wage) => (
              <li key={wage.id} className="rounded-xl bg-black/[0.02] px-4 py-3 dark:bg-white/[0.03]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{wage.payee_name}</p>
                    <p className="text-muted text-sm">
                      {WAGE_PAYMENT_TYPE_LABELS[wage.payment_type]} · {formatFinanceCurrency(penceToPounds(wage.amount_pence))}
                    </p>
                  </div>
                  {wage.status === "outstanding" ? (
                    <button
                      type="button"
                      onClick={() => void markWagePaid(wage.id)}
                      className="border-border inline-flex min-h-11 items-center rounded-full border px-4 text-sm"
                    >
                      Mark paid
                    </button>
                  ) : (
                    <span className="text-accent text-sm">Paid</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {view === "facility" ? (
        <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6" aria-labelledby="facility-heading">
          <h2 id="facility-heading" className="text-lg font-semibold">
            Facility costs
          </h2>
          <p className="text-muted mt-1 text-sm">Pitch hire, hall hire, floodlights, and equipment rental.</p>
          <ExpenseList expenses={facilityExpenses} />
        </section>
      ) : null}

      {view === "budget" ? (
        <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6" aria-labelledby="budget-heading">
          <h2 id="budget-heading" className="text-lg font-semibold">
            Monthly budget
          </h2>
          <form
            className="mt-6 grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSaveBudget();
            }}
          >
            <Field label="Month">
              <input
                type="month"
                value={budgetForm.monthKey}
                onChange={(event) => setBudgetForm((c) => ({ ...c, monthKey: event.target.value }))}
                className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
              />
            </Field>
            <Field label="Income goal (£)">
              <input
                type="number"
                min="0"
                step="1"
                value={budgetForm.incomeGoal}
                onChange={(event) => setBudgetForm((c) => ({ ...c, incomeGoal: event.target.value }))}
                className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
              />
            </Field>
            <Field label="Expense target (£)">
              <input
                type="number"
                min="0"
                step="1"
                value={budgetForm.expenseTarget}
                onChange={(event) => setBudgetForm((c) => ({ ...c, expenseTarget: event.target.value }))}
                className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
              />
            </Field>
            <Field label="Notes">
              <input
                type="text"
                value={budgetForm.notes}
                onChange={(event) => setBudgetForm((c) => ({ ...c, notes: event.target.value }))}
                className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
              />
            </Field>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-foreground text-background inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-medium"
              >
                Save budget
              </button>
            </div>
          </form>

          <ul className="mt-6 space-y-2" role="list" aria-label="Saved budgets">
            {data.budgets.map((budget) => (
              <li key={budget.id} className="rounded-xl bg-black/[0.02] px-4 py-3 text-sm dark:bg-white/[0.03]">
                {monthLabel(budget.month_key)} — income goal{" "}
                {formatFinanceCurrency(penceToPounds(budget.income_goal_pence))}, expense target{" "}
                {formatFinanceCurrency(penceToPounds(budget.expense_target_pence))}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {view === "invoices" ? (
        <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6" aria-labelledby="invoices-heading">
          <h2 id="invoices-heading" className="text-lg font-semibold">
            Invoices
          </h2>
          <p className="text-muted mt-1 text-sm">
            Coach-created invoices with PDF export and reminder templates. Parent Stripe billing stays in Parent Payments.
          </p>

          <form
            className="mt-6 grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              void handleAddInvoice();
            }}
          >
            <Field label="Player">
              <select
                value={invoiceForm.playerId}
                onChange={(event) => setInvoiceForm((c) => ({ ...c, playerId: event.target.value }))}
                className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
              >
                <option value="">No player linked</option>
                {data.players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.player_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Invoice number">
              <input
                type="text"
                value={invoiceForm.invoiceNumber}
                onChange={(event) => setInvoiceForm((c) => ({ ...c, invoiceNumber: event.target.value }))}
                className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                required
              />
            </Field>
            <Field label="Amount (£)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={invoiceForm.amount}
                onChange={(event) => setInvoiceForm((c) => ({ ...c, amount: event.target.value }))}
                className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                required
              />
            </Field>
            <Field label="Due date">
              <input
                type="date"
                value={invoiceForm.dueDate}
                onChange={(event) => setInvoiceForm((c) => ({ ...c, dueDate: event.target.value }))}
                className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
              />
            </Field>
            <Field label="Description">
              <input
                type="text"
                value={invoiceForm.description}
                onChange={(event) => setInvoiceForm((c) => ({ ...c, description: event.target.value }))}
                className="border-border bg-background focus-visible:ring-accent/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2 md:col-span-2"
              />
            </Field>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-foreground text-background inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-medium"
              >
                <Plus className="size-4" aria-hidden />
                Create invoice
              </button>
            </div>
          </form>

          <ul className="mt-6 space-y-3" role="list" aria-label="Invoices">
            {data.invoices.map((invoice) => (
              <li key={invoice.id} className="rounded-xl bg-black/[0.02] px-4 py-3 dark:bg-white/[0.03]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {invoice.invoice_number} · {formatFinanceCurrency(penceToPounds(invoice.amount_pence))}
                    </p>
                    <p className="text-muted text-sm">{INVOICE_STATUS_LABELS[invoice.status]}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {invoice.status === "outstanding" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void updateInvoiceStatus(invoice.id, "paid")}
                          className="inline-flex min-h-11 items-center rounded-full border px-4 text-sm"
                        >
                          Mark paid
                        </button>
                        <Link
                          href={`/dashboard/communication?template=invoice_reminder`}
                          className="inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm"
                          aria-label={`Send reminder for invoice ${invoice.invoice_number}`}
                        >
                          <Mail className="size-4" aria-hidden />
                          Remind
                        </Link>
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        const body = buildInvoiceReminderCopy(
                          invoice.invoice_number,
                          formatFinanceCurrency(penceToPounds(invoice.amount_pence)),
                          invoice.due_date ?? "soon",
                        );
                        void navigator.clipboard?.writeText(body);
                        setStatusMessage("Invoice copy saved to clipboard.");
                      }}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm"
                    >
                      <FileText className="size-4" aria-hidden />
                      Copy
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {view === "reports" ? (
        <section className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6" aria-labelledby="reports-heading">
          <h2 id="reports-heading" className="text-lg font-semibold">
            Finance reports
          </h2>
          <p className="text-muted mt-1 text-sm">
            Monthly profit and loss, income and expense breakdowns, camp profitability, and payroll summary.
          </p>
          <button
            type="button"
            onClick={() => void handleExportReport()}
            disabled={exporting}
            className="bg-foreground text-background mt-6 inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-medium"
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Download className="size-4" aria-hidden />
            )}
            Download monthly finance report (PDF)
          </button>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <BreakdownList
              title="Income breakdown"
              items={[
                { label: "Bookings", value: data.analytics.incomeBreakdown.bookings },
                { label: "Subscriptions", value: data.analytics.incomeBreakdown.subscriptions },
                { label: "Camps", value: data.analytics.incomeBreakdown.camps },
              ]}
            />
            <BreakdownList
              title="Expense breakdown"
              items={data.analytics.expenseBreakdown.map((item) => ({
                label: EXPENSE_CATEGORY_LABELS[item.category],
                value: item.total,
              }))}
            />
          </div>

          {data.analytics.campProfitability.length > 0 ? (
            <div className="mt-8">
              <h3 className="font-semibold">Camp profitability</h3>
              <ul className="mt-3 space-y-2 text-sm" role="list">
                {data.analytics.campProfitability.map((camp) => (
                  <li key={camp.campId}>
                    {camp.campName}: profit {formatFinanceCurrency(camp.profit)} (revenue{" "}
                    {formatFinanceCurrency(camp.revenue)}, expenses {formatFinanceCurrency(camp.expenses)})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-muted mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function ExpenseList({ expenses }: { expenses: FinanceDashboardPayload["expenses"] }) {
  if (expenses.length === 0) {
    return <p className="text-muted mt-6 text-sm">No expenses recorded yet.</p>;
  }
  return (
    <ul className="mt-6 space-y-3" role="list" aria-label="Expense records">
      {expenses.map((expense) => (
        <li key={expense.id} className="rounded-xl bg-black/[0.02] px-4 py-3 dark:bg-white/[0.03]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium">
                {EXPENSE_CATEGORY_LABELS[expense.category]} · {formatFinanceCurrency(penceToPounds(expense.amount_pence))}
              </p>
              <p className="text-muted text-sm">
                {expense.expense_date}
                {expense.supplier ? ` · ${expense.supplier}` : ""}
                {expense.is_recurring ? " · Recurring" : ""}
                {!expense.is_paid ? " · Unpaid" : ""}
              </p>
            </div>
            {expense.receipt_path ? (
              <span className="text-muted text-xs">Receipt: {expense.receipt_path}</span>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function BreakdownList({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: number }>;
}) {
  return (
    <div className="rounded-xl bg-black/[0.02] p-4 dark:bg-white/[0.03]">
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm" role="list">
        {items.length === 0 ? (
          <li className="text-muted">No data yet.</li>
        ) : (
          items.map((item) => (
            <li key={item.label} className="flex justify-between gap-4">
              <span>{item.label}</span>
              <span className="font-medium">{formatFinanceCurrency(item.value)}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function ChartPanel({
  title,
  series,
}: {
  title: string;
  series: FinanceDashboardPayload["analytics"]["incomeSeries"];
}) {
  const maxValue = Math.max(...series.flatMap((point) => [point.income, point.expenses, point.profit]), 1);
  return (
    <div className="football-panel football-panel-interactive rounded-2xl p-5 sm:p-6" aria-labelledby="finance-chart-heading">
      <h3 id="finance-chart-heading" className="text-base font-semibold">
        {title}
      </h3>
      <div className="mt-6 space-y-4" role="list" aria-label={title}>
        {series.map((point) => (
          <div key={point.monthKey} role="listitem">
            <div className="mb-1 flex justify-between text-xs">
              <span>{point.label}</span>
              <span className="text-muted">Profit {formatFinanceCurrency(point.profit)}</span>
            </div>
            <div className="space-y-1">
              <Bar label="Income" value={point.income} max={maxValue} tone="income" />
              <Bar label="Expenses" value={point.expenses} max={maxValue} tone="expense" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bar({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: "income" | "expense";
}) {
  const width = `${Math.max(4, (value / max) * 100)}%`;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted w-16">{label}</span>
      <div className="bg-black/[0.04] h-2 flex-1 overflow-hidden rounded-full dark:bg-white/[0.06]">
        <div
          className={cn("h-full rounded-full", tone === "income" ? "bg-accent" : "bg-amber-500")}
          style={{ width }}
          role="img"
          aria-label={`${label} ${formatFinanceCurrency(value)}`}
        />
      </div>
    </div>
  );
}

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "An unexpected error occurred.";
}
