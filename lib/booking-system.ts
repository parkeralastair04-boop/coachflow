export const SESSION_TYPE_OPTIONS = ["1-to-1", "Group Session", "Camp"] as const;

export type SessionTypeOption = (typeof SESSION_TYPE_OPTIONS)[number];

export const DAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
] as const;

export type CoachAvailabilityRow = {
  id: string;
  coach_id: string;
  academy_id?: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  session_type: SessionTypeOption;
  duration_minutes: number;
  default_price: number;
  default_capacity: number;
  is_public: boolean;
  created_at: string;
};

export type SessionBookingStatus =
  | "pending"
  | "confirmed"
  | "waitlist"
  | "cancelled";

export type SessionPaymentStatus =
  | "requires_payment"
  | "paid"
  | "not_required"
  | "failed"
  | "refunded";

export type SessionBookingRow = {
  id: string;
  coach_id: string;
  academy_id?: string | null;
  session_id: string;
  player_id: string;
  parent_name: string | null;
  parent_email: string;
  parent_phone?: string | null;
  amount: number;
  currency: string;
  payment_status: SessionPaymentStatus;
  booking_status: SessionBookingStatus;
  notes?: string | null;
  expires_at?: string | null;
  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  recurring_enrolment_id?: string | null;
  created_at: string;
};

export type PublicSessionRow = {
  session_id: string;
  coach_id: string;
  academy_id?: string | null;
  coach_slug?: string | null;
  academy_slug?: string | null;
  group_name: string | null;
  session_type: string | null;
  session_date: string;
  duration_minutes: number;
  location: string | null;
  notes: string | null;
  price: number;
  capacity: number;
  remaining_spaces: number;
  waitlist_count: number;
  is_full: boolean;
};

export type PublicRecurringSeriesRow = {
  recurring_series_id: string;
  coach_id: string;
  academy_id: string | null;
  coach_slug: string | null;
  academy_slug: string | null;
  title: string;
  session_type: string;
  day_of_week: number;
  start_time: string;
  duration_minutes: number;
  location: string | null;
  notes: string | null;
  capacity: number;
  monthly_price: number;
  currency: string;
  active_subscriptions: number;
  remaining_spaces: number;
};

export type RecurringSessionSeriesRow = {
  id: string;
  coach_id: string;
  academy_id: string | null;
  source_availability_id: string | null;
  title: string;
  session_type: SessionTypeOption;
  day_of_week: number;
  start_time: string;
  duration_minutes: number;
  location: string | null;
  notes: string | null;
  capacity: number;
  monthly_price: number;
  currency: string;
  is_public: boolean;
  booking_enabled: boolean;
  is_active: boolean;
  rolling_weeks: number;
  created_at: string;
};

export type PlayerRecurringEnrolmentRow = {
  id: string;
  coach_id: string;
  academy_id: string | null;
  recurring_series_id: string;
  player_id: string;
  parent_name: string | null;
  parent_email: string;
  parent_phone: string | null;
  notes: string | null;
  status: "pending" | "active" | "paused" | "cancelled";
  billing_interval: "monthly";
  monthly_price: number;
  starts_on: string;
  ends_on: string | null;
  stripe_checkout_session_id: string | null;
  created_at: string;
};

export function getDayLabel(dayOfWeek: number): string {
  return DAY_OPTIONS.find((option) => option.value === dayOfWeek)?.label ?? "Unknown";
}

export function formatPoundsFromPence(value: number, currency = "GBP"): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(value / 100);
}

export function parsePoundsToPence(input: string): number {
  const parsed = Number.parseFloat(input.replace(/[£,\s]/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

export function formatMinutes(value: number): string {
  if (value % 60 === 0) {
    const hours = value / 60;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${value} mins`;
}
