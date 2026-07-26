-- M4-03: Payment-integrity grant lockdown.
-- Canonical entrypoint for all three RPCs: lib/booking-confirmation.ts
-- (service_role via createAdminClient). Public poll endpoints use read-only
-- get_booking_confirmation_status / get_recurring_confirmation_status only.

-- confirm_public_session_booking(uuid, text, text)
revoke execute on function public.confirm_public_session_booking(
  uuid, text, text
) from anon, authenticated;

revoke execute on function public.confirm_public_session_booking(
  uuid, text, text
) from public;

grant execute on function public.confirm_public_session_booking(
  uuid, text, text
) to service_role;

comment on function public.confirm_public_session_booking(uuid, text, text) is
  'Stripe webhook confirmation only. Canonical entrypoint: lib/booking-confirmation.ts (service_role).';

-- confirm_public_recurring_enrolment(uuid, text, text, text, timestamptz)
revoke execute on function public.confirm_public_recurring_enrolment(
  uuid, text, text, text, timestamptz
) from anon, authenticated;

revoke execute on function public.confirm_public_recurring_enrolment(
  uuid, text, text, text, timestamptz
) from public;

grant execute on function public.confirm_public_recurring_enrolment(
  uuid, text, text, text, timestamptz
) to service_role;

comment on function public.confirm_public_recurring_enrolment(uuid, text, text, text, timestamptz) is
  'Stripe webhook enrolment confirmation only. Canonical entrypoint: lib/booking-confirmation.ts (service_role).';

-- sync_recurring_subscription_state(text, text, timestamptz)
revoke execute on function public.sync_recurring_subscription_state(
  text, text, timestamptz
) from anon, authenticated;

revoke execute on function public.sync_recurring_subscription_state(
  text, text, timestamptz
) from public;

grant execute on function public.sync_recurring_subscription_state(
  text, text, timestamptz
) to service_role;

comment on function public.sync_recurring_subscription_state(text, text, timestamptz) is
  'Stripe subscription snapshot sync only. Canonical entrypoint: lib/booking-confirmation.ts (service_role); payments dashboard via createAdminClient().';
