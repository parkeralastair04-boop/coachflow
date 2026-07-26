export const EXPENSE_CATEGORIES = [
  "facility_hire",
  "equipment",
  "coach_wages",
  "referees",
  "marketing",
  "insurance",
  "travel",
  "pitch_hire",
  "hall_hire",
  "floodlights",
  "equipment_rental",
  "other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const FACILITY_CATEGORIES = [
  "facility_hire",
  "pitch_hire",
  "hall_hire",
  "floodlights",
  "equipment_rental",
] as const satisfies readonly ExpenseCategory[];

export type FacilityCategory = (typeof FACILITY_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  facility_hire: "Facility hire",
  equipment: "Equipment",
  coach_wages: "Coach wages",
  referees: "Referees",
  marketing: "Marketing",
  insurance: "Insurance",
  travel: "Travel",
  pitch_hire: "Pitch hire",
  hall_hire: "Hall hire",
  floodlights: "Floodlights",
  equipment_rental: "Equipment rental",
  other: "Other",
};

export const WAGE_PAYMENT_TYPES = ["session", "match", "camp", "wage"] as const;
export type WagePaymentType = (typeof WAGE_PAYMENT_TYPES)[number];

export const WAGE_PAYMENT_TYPE_LABELS: Record<WagePaymentType, string> = {
  session: "Session payment",
  match: "Match payment",
  camp: "Camp payment",
  wage: "Coach wage",
};

export const INVOICE_STATUSES = ["paid", "outstanding", "cancelled"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  paid: "Paid",
  outstanding: "Outstanding",
  cancelled: "Cancelled",
};

export type FinanceExpenseRow = {
  id: string;
  coach_id: string;
  academy_id: string | null;
  expense_date: string;
  amount_pence: number;
  category: ExpenseCategory;
  supplier: string | null;
  receipt_path: string | null;
  notes: string | null;
  is_recurring: boolean;
  is_paid: boolean;
  expense_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type FinanceBudgetRow = {
  id: string;
  coach_id: string;
  month_key: string;
  income_goal_pence: number;
  expense_target_pence: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type FinanceInvoiceRow = {
  id: string;
  coach_id: string;
  player_id: string | null;
  invoice_number: string;
  amount_pence: number;
  status: InvoiceStatus;
  due_date: string | null;
  description: string | null;
  notes: string | null;
  sent_at: string | null;
  paid_at: string | null;
  invoice_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CoachWageRow = {
  id: string;
  coach_id: string;
  payee_name: string;
  amount_pence: number;
  hourly_rate_pence: number | null;
  hours: number | null;
  payment_type: WagePaymentType;
  status: "outstanding" | "paid";
  session_id: string | null;
  camp_id: string | null;
  due_date: string | null;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export function isFacilityCategory(category: ExpenseCategory): category is FacilityCategory {
  return (FACILITY_CATEGORIES as readonly string[]).includes(category);
}

export function poundsToPence(value: number): number {
  return Math.round(value * 100);
}

export function penceToPounds(pence: number): number {
  return pence / 100;
}
