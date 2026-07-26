export const PARENT_JOURNEY_EVENTS = [
  "claim_account",
  "first_login",
  "return_visit",
  "report_opened",
  "booking_completed",
  "payment_completed",
  "notification_opened",
] as const;

export type ParentJourneyEventName = (typeof PARENT_JOURNEY_EVENTS)[number];

export const PARENT_ONBOARDING_METADATA_KEY = "parent_onboarding_completed";
export const PARENT_FIRST_LOGIN_METADATA_KEY = "parent_first_login_at";
export const PARENT_ACCOUNT_KIND_METADATA_KEY = "account_kind";
