import { computeCoachingIncomeMetrics } from "@/lib/coaching-income";
import { aggregateCampEnrolments, parseCampPrice, type CampEnrolmentRow, type CampRow } from "@/lib/camp-insights";
import type { SessionBookingStatus } from "@/lib/booking-system";
import { subscriptionNeedsAttention } from "@/lib/payment-status-labels";
import type {
  CoachWageRow,
  ExpenseCategory,
  FinanceBudgetRow,
  FinanceExpenseRow,
  FinanceInvoiceRow,
} from "@/lib/finance-types";
import { FACILITY_CATEGORIES, penceToPounds } from "@/lib/finance-types";

type BookingRow = {
  booking_status: SessionBookingStatus;
  payment_status: string;
  amount: number;
  created_at: string;
};

type SubscriptionRow = {
  amount: number;
  interval: "monthly" | "weekly" | null;
  status: string;
};

export type FinanceOverview = {
  incomeThisMonth: number;
  recurringMonthlyIncome: number;
  campIncomeThisMonth: number;
  outstandingPayments: number;
  expensesThisMonth: number;
  profitThisMonth: number;
  projectedMonthlyIncome: number;
  projectedAnnualIncome: number;
  cashFlowThisMonth: number;
  netProfitYtd: number;
  rollingTwelveMonthProfit: number;
};

export type FinanceTrendPoint = {
  monthKey: string;
  label: string;
  income: number;
  expenses: number;
  profit: number;
};

export type FinanceDashboardSnapshot = {
  outstandingInvoices: number;
  recentExpenses: FinanceExpenseRow[];
  incomeThisWeek: number;
  profitThisMonth: number;
  upcomingCoachPayments: number;
};

export type FinanceAnalyticsSummary = {
  incomeSeries: FinanceTrendPoint[];
  expenseBreakdown: Array<{ category: ExpenseCategory; total: number }>;
  incomeBreakdown: {
    bookings: number;
    subscriptions: number;
    camps: number;
  };
  campProfitability: Array<{ campId: string; campName: string; revenue: number; expenses: number; profit: number }>;
  payrollSummary: {
    outstanding: number;
    paid: number;
    byType: Record<string, number>;
  };
  budgetAlerts: Array<{ message: string; severity: "warning" | "info" }>;
};

export function formatFinanceCurrency(pounds: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(pounds);
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(monthKeyValue: string): string {
  const [year, month] = monthKeyValue.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(
    new Date(year, month - 1, 1),
  );
}

function isInMonth(dateIso: string, target: Date): boolean {
  const date = new Date(dateIso);
  return date.getFullYear() === target.getFullYear() && date.getMonth() === target.getMonth();
}

function isInWeek(dateIso: string, now: Date): boolean {
  const date = new Date(dateIso);
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return date >= start && date < end;
}

function sumExpenses(
  expenses: FinanceExpenseRow[],
  predicate: (expense: FinanceExpenseRow) => boolean,
): number {
  return expenses.filter(predicate).reduce((sum, expense) => sum + penceToPounds(expense.amount_pence), 0);
}

function campIncomeForMonth(camps: CampRow[], enrolments: CampEnrolmentRow[], now: Date): number {
  const stats = aggregateCampEnrolments(camps, enrolments);
  return stats
    .filter((camp) => isInMonth(camp.start_date, now))
    .reduce((sum, camp) => sum + camp.revenue, 0);
}

function totalCampRevenue(camps: CampRow[], enrolments: CampEnrolmentRow[]): number {
  return aggregateCampEnrolments(camps, enrolments).reduce((sum, camp) => sum + camp.revenue, 0);
}

export function buildFinanceOverview(args: {
  bookings: BookingRow[];
  subscriptions: SubscriptionRow[];
  camps: CampRow[];
  enrolments: CampEnrolmentRow[];
  expenses: FinanceExpenseRow[];
  invoices: FinanceInvoiceRow[];
  now?: Date;
}): FinanceOverview {
  const now = args.now ?? new Date();
  const incomeMetrics = computeCoachingIncomeMetrics(args.bookings, args.subscriptions, now);
  const campIncome = campIncomeForMonth(args.camps, args.enrolments, now);

  const incomeThisMonth =
    incomeMetrics.monthlyBookingIncome + incomeMetrics.activeMonthlyPaymentIncome + campIncome;

  const expensesThisMonth = sumExpenses(args.expenses, (expense) => isInMonth(expense.expense_date, now));
  const profitThisMonth = incomeThisMonth - expensesThisMonth;

  const outstandingInvoices = args.invoices
    .filter((invoice) => invoice.status === "outstanding")
    .reduce((sum, invoice) => sum + penceToPounds(invoice.amount_pence), 0);

  const outstandingSubscriptions = args.subscriptions
    .filter((subscription) => subscriptionNeedsAttention(subscription.status))
    .reduce((sum, subscription) => sum + subscription.amount / 100, 0);

  const projectedMonthlyIncome =
    incomeMetrics.activeMonthlyPaymentIncome +
    incomeMetrics.monthlyBookingIncome +
    campIncome;

  const yearStart = new Date(now.getFullYear(), 0, 1);
  const incomeYtd =
    args.bookings
      .filter(
        (booking) =>
          booking.booking_status === "confirmed" &&
          booking.payment_status === "paid" &&
          new Date(booking.created_at) >= yearStart,
      )
      .reduce((sum, booking) => sum + booking.amount / 100, 0) +
    incomeMetrics.activeMonthlyPaymentIncome * (now.getMonth() + 1) +
    args.camps
      .filter((camp) => new Date(camp.start_date) >= yearStart)
      .reduce((sum, camp) => {
        const enrolled = args.enrolments.filter(
          (row) => row.camp_id === camp.id && row.status === "enrolled",
        ).length;
        return sum + parseCampPrice(camp.price) * enrolled;
      }, 0);

  const expensesYtd = sumExpenses(
    args.expenses,
    (expense) => new Date(expense.expense_date) >= yearStart,
  );

  const rollingStart = new Date(now);
  rollingStart.setMonth(rollingStart.getMonth() - 11);
  rollingStart.setDate(1);

  const rollingIncome =
    args.bookings
      .filter(
        (booking) =>
          booking.booking_status === "confirmed" &&
          booking.payment_status === "paid" &&
          new Date(booking.created_at) >= rollingStart,
      )
      .reduce((sum, booking) => sum + booking.amount / 100, 0) +
    incomeMetrics.activeMonthlyPaymentIncome * 12;

  const rollingExpenses = sumExpenses(
    args.expenses,
    (expense) => new Date(expense.expense_date) >= rollingStart,
  );

  const paidExpensesThisMonth = sumExpenses(
    args.expenses,
    (expense) => isInMonth(expense.expense_date, now) && expense.is_paid,
  );

  return {
    incomeThisMonth,
    recurringMonthlyIncome: incomeMetrics.activeMonthlyPaymentIncome,
    campIncomeThisMonth: campIncome,
    outstandingPayments: outstandingInvoices + outstandingSubscriptions,
    expensesThisMonth,
    profitThisMonth,
    projectedMonthlyIncome,
    projectedAnnualIncome: projectedMonthlyIncome * 12,
    cashFlowThisMonth: incomeThisMonth - paidExpensesThisMonth,
    netProfitYtd: incomeYtd - expensesYtd,
    rollingTwelveMonthProfit: rollingIncome - rollingExpenses,
  };
}

export function buildFinanceTrendSeries(args: {
  bookings: BookingRow[];
  subscriptions: SubscriptionRow[];
  camps: CampRow[];
  enrolments: CampEnrolmentRow[];
  expenses: FinanceExpenseRow[];
  months?: number;
  now?: Date;
}): FinanceTrendPoint[] {
  const now = args.now ?? new Date();
  const months = args.months ?? 6;
  const points: FinanceTrendPoint[] = [];

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = monthKey(date);
    const incomeMetrics = computeCoachingIncomeMetrics(args.bookings, args.subscriptions, date);
    const campIncome = campIncomeForMonth(args.camps, args.enrolments, date);
    const income = incomeMetrics.monthlyBookingIncome + incomeMetrics.activeMonthlyPaymentIncome + campIncome;
    const expenses = sumExpenses(args.expenses, (expense) => expense.expense_date.startsWith(key));
    points.push({
      monthKey: key,
      label: monthLabel(key),
      income,
      expenses,
      profit: income - expenses,
    });
  }

  return points;
}

export function buildFinanceDashboardSnapshot(args: {
  bookings: BookingRow[];
  subscriptions: SubscriptionRow[];
  expenses: FinanceExpenseRow[];
  invoices: FinanceInvoiceRow[];
  wages: CoachWageRow[];
  camps: CampRow[];
  enrolments: CampEnrolmentRow[];
  now?: Date;
}): FinanceDashboardSnapshot {
  const now = args.now ?? new Date();
  const overview = buildFinanceOverview({
    bookings: args.bookings,
    subscriptions: args.subscriptions,
    camps: args.camps,
    enrolments: args.enrolments,
    expenses: args.expenses,
    invoices: args.invoices,
    now,
  });

  const incomeThisWeek = args.bookings
    .filter(
      (booking) =>
        booking.booking_status === "confirmed" &&
        booking.payment_status === "paid" &&
        isInWeek(booking.created_at, now),
    )
    .reduce((sum, booking) => sum + booking.amount / 100, 0);

  const upcomingCoachPayments = args.wages
    .filter((wage) => wage.status === "outstanding")
    .reduce((sum, wage) => sum + penceToPounds(wage.amount_pence), 0);

  return {
    outstandingInvoices: args.invoices.filter((invoice) => invoice.status === "outstanding").length,
    recentExpenses: [...args.expenses]
      .sort((a, b) => b.expense_date.localeCompare(a.expense_date))
      .slice(0, 3),
    incomeThisWeek,
    profitThisMonth: overview.profitThisMonth,
    upcomingCoachPayments,
  };
}

export function buildFinanceAnalyticsSummary(args: {
  bookings: BookingRow[];
  subscriptions: SubscriptionRow[];
  camps: CampRow[];
  enrolments: CampEnrolmentRow[];
  expenses: FinanceExpenseRow[];
  invoices: FinanceInvoiceRow[];
  wages: CoachWageRow[];
  budgets: FinanceBudgetRow[];
  now?: Date;
}): FinanceAnalyticsSummary {
  const now = args.now ?? new Date();
  const incomeMetrics = computeCoachingIncomeMetrics(args.bookings, args.subscriptions, now);
  const campRevenue = totalCampRevenue(args.camps, args.enrolments);
  const bookingRevenue = args.bookings
    .filter((booking) => booking.booking_status === "confirmed" && booking.payment_status === "paid")
    .reduce((sum, booking) => sum + booking.amount / 100, 0);

  const expenseBreakdown = args.expenses.reduce<Map<ExpenseCategory, number>>((map, expense) => {
    const current = map.get(expense.category) ?? 0;
    map.set(expense.category, current + penceToPounds(expense.amount_pence));
    return map;
  }, new Map());

  const campStats = aggregateCampEnrolments(args.camps, args.enrolments);
  const campProfitability = campStats.map((camp) => {
    const campExpenses = args.expenses
      .filter((expense) => {
        const data = expense.expense_data as { camp_id?: string };
        return data.camp_id === camp.id || expense.notes?.includes(camp.name);
      })
      .reduce((sum, expense) => sum + penceToPounds(expense.amount_pence), 0);
    return {
      campId: camp.id,
      campName: camp.name,
      revenue: camp.revenue,
      expenses: campExpenses,
      profit: camp.revenue - campExpenses,
    };
  });

  const payrollSummary = args.wages.reduce(
    (summary, wage) => {
      const amount = penceToPounds(wage.amount_pence);
      if (wage.status === "outstanding") summary.outstanding += amount;
      else summary.paid += amount;
      summary.byType[wage.payment_type] = (summary.byType[wage.payment_type] ?? 0) + amount;
      return summary;
    },
    { outstanding: 0, paid: 0, byType: {} as Record<string, number> },
  );

  const currentMonthKey = monthKey(now);
  const currentBudget = args.budgets.find((budget) => budget.month_key === currentMonthKey);
  const overview = buildFinanceOverview({
    bookings: args.bookings,
    subscriptions: args.subscriptions,
    camps: args.camps,
    enrolments: args.enrolments,
    expenses: args.expenses,
    invoices: args.invoices,
    now,
  });

  const budgetAlerts: FinanceAnalyticsSummary["budgetAlerts"] = [];
  if (currentBudget) {
    const incomeGoal = penceToPounds(currentBudget.income_goal_pence);
    const expenseTarget = penceToPounds(currentBudget.expense_target_pence);
    if (incomeGoal > 0 && overview.incomeThisMonth >= incomeGoal * 0.85 && overview.incomeThisMonth < incomeGoal) {
      budgetAlerts.push({
        message: `You are approaching your income goal for ${monthLabel(currentMonthKey)}.`,
        severity: "info",
      });
    }
    if (expenseTarget > 0 && overview.expensesThisMonth >= expenseTarget * 0.85) {
      budgetAlerts.push({
        message: `Expenses are nearing your monthly target of ${formatFinanceCurrency(expenseTarget)}.`,
        severity: "warning",
      });
    }
  }

  return {
    incomeSeries: buildFinanceTrendSeries(args),
    expenseBreakdown: [...expenseBreakdown.entries()].map(([category, total]) => ({ category, total })),
    incomeBreakdown: {
      bookings: bookingRevenue,
      subscriptions: incomeMetrics.activeMonthlyPaymentIncome,
      camps: campRevenue,
    },
    campProfitability,
    payrollSummary,
    budgetAlerts,
  };
}

export function filterFacilityExpenses(expenses: FinanceExpenseRow[]): FinanceExpenseRow[] {
  return expenses.filter((expense) =>
    (FACILITY_CATEGORIES as readonly string[]).includes(expense.category),
  );
}
