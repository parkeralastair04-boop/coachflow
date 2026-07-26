-- Hotfix: resolve booking_status / payment_status ambiguity in confirm_public_session_booking.

create or replace function public.confirm_public_session_booking(
  p_booking_id uuid,
  p_stripe_checkout_session_id text,
  p_stripe_payment_intent_id text
)
returns table (
  booking_id uuid,
  booking_status text,
  payment_status text,
  confirmed_now boolean
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_before public.session_bookings%rowtype;
  v_after public.session_bookings%rowtype;
begin
  select *
    into v_before
    from public.session_bookings sb
   where sb.id = p_booking_id
   for update;

  if v_before.id is null then
    raise exception 'booking not found';
  end if;

  if v_before.booking_status = 'waitlist' then
    return query
    select v_before.id, v_before.booking_status, v_before.payment_status, false;
    return;
  end if;

  update public.session_bookings sb
     set booking_status = 'confirmed',
         payment_status = case
           when sb.amount > 0 then 'paid'
           else sb.payment_status
         end,
         stripe_checkout_session_id = coalesce(p_stripe_checkout_session_id, sb.stripe_checkout_session_id),
         stripe_payment_intent_id = coalesce(p_stripe_payment_intent_id, sb.stripe_payment_intent_id),
         expires_at = null
   where sb.id = p_booking_id
     and sb.booking_status = 'pending'
  returning * into v_after;

  if v_after.id is null then
    select * into v_after from public.session_bookings where id = p_booking_id;
    return query
    select v_after.id, v_after.booking_status, v_after.payment_status, false;
    return;
  end if;

  return query
  select v_after.id, v_after.booking_status, v_after.payment_status, true;
end;
$$;
