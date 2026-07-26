-- M4-02: Read-only confirmation status lookups for post-checkout polling.

create or replace function public.get_booking_confirmation_status(
  p_stripe_checkout_session_id text
)
returns table (
  booking_id uuid,
  booking_status text,
  payment_status text,
  confirmed boolean
)
language sql
security definer
set search_path = public
as $$
  select
    sb.id as booking_id,
    sb.booking_status,
    sb.payment_status,
    (sb.booking_status = 'confirmed') as confirmed
  from public.session_bookings sb
  where sb.stripe_checkout_session_id = nullif(trim(p_stripe_checkout_session_id), '')
  limit 1;
$$;

create or replace function public.get_recurring_confirmation_status(
  p_stripe_checkout_session_id text
)
returns table (
  enrolment_id uuid,
  recurring_status text,
  subscription_status text,
  confirmed boolean
)
language sql
security definer
set search_path = public
as $$
  select
    pre.id as enrolment_id,
    pre.status as recurring_status,
    ps.status as subscription_status,
    (pre.status = 'active') as confirmed
  from public.player_recurring_enrolments pre
  left join public.parent_subscriptions ps
    on ps.recurring_enrolment_id = pre.id
  where pre.stripe_checkout_session_id = nullif(trim(p_stripe_checkout_session_id), '')
  limit 1;
$$;

grant execute on function public.get_booking_confirmation_status(text) to anon, authenticated;

grant execute on function public.get_recurring_confirmation_status(text) to anon, authenticated;
