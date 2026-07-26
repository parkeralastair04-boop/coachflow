export const ACTIVATION_EVENTS = [
  "signup_complete",
  "academy_created",
  "first_session",
  "booking_page_published",
  "booking_link_copied",
  "first_booking_received",
  "first_parent_account",
] as const;

export type ActivationEventName = (typeof ACTIVATION_EVENTS)[number];
