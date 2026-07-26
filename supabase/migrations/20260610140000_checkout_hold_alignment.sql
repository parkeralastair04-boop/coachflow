-- 0.3-10: Align Stripe Checkout expiry with booking holds; persist checkout session ids.

alter table public.player_recurring_enrolments
  add column if not exists expires_at timestamptz;

update public.player_recurring_enrolments
   set expires_at = created_at + interval '30 minutes'
 where status = 'pending'
   and expires_at is null;

update public.session_bookings
   set expires_at = created_at + interval '30 minutes'
 where booking_status = 'pending'
   and expires_at is null;

create index if not exists player_recurring_enrolments_series_expires_idx
  on public.player_recurring_enrolments (recurring_series_id, status, expires_at);

create unique index if not exists player_recurring_enrolments_checkout_session_id_idx
  on public.player_recurring_enrolments (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

-- ---------------------------------------------------------------------------
-- Portal session listing: align pending-hold rule with create_public_session_booking
-- ---------------------------------------------------------------------------

create or replace function public.list_public_sessions_for_portal(
  p_coach_slug text default null,
  p_academy_slug text default null
)
returns table (
  session_id uuid,
  coach_id uuid,
  academy_id uuid,
  coach_slug text,
  academy_slug text,
  group_name text,
  session_type text,
  session_date timestamptz,
  duration_minutes integer,
  location text,
  notes text,
  price integer,
  capacity integer,
  remaining_spaces integer,
  waitlist_count integer,
  is_full boolean
)
language sql
security definer
set search_path = public
as $$
  with portal as (
    select * from public.get_public_portal_by_coach_slug(p_coach_slug)
    union all
    select * from public.get_public_portal_by_academy_slug(p_academy_slug)
    limit 1
  ),
  booking_stats as (
    select
      sb.session_id,
      count(*) filter (where sb.booking_status = 'confirmed') as confirmed_count,
      count(*) filter (
        where sb.booking_status = 'pending'
          and sb.expires_at is not null
          and sb.expires_at > now()
      ) as pending_count,
      count(*) filter (where sb.booking_status = 'waitlist') as waitlist_count
    from public.session_bookings sb
    group by sb.session_id
  )
  select
    s.id as session_id,
    s.coach_id,
    s.academy_id,
    cpp.slug as coach_slug,
    a.slug as academy_slug,
    s.group_name,
    s.session_type,
    s.session_date,
    s.duration_minutes,
    s.location,
    s.notes,
    s.price,
    s.capacity,
    greatest(
      s.capacity - coalesce(bs.confirmed_count, 0) - coalesce(bs.pending_count, 0),
      0
    ) as remaining_spaces,
    coalesce(bs.waitlist_count, 0) as waitlist_count,
    (
      greatest(
        s.capacity - coalesce(bs.confirmed_count, 0) - coalesce(bs.pending_count, 0),
        0
      ) = 0
    ) as is_full
  from public.sessions s
  join portal p
    on (
      (p.portal_kind = 'coach' and s.coach_id = p.coach_id)
      or (p.portal_kind = 'academy' and s.academy_id = p.academy_id)
    )
  left join booking_stats bs on bs.session_id = s.id
  left join public.coach_public_profiles cpp on cpp.coach_id = s.coach_id
  left join public.academies a on a.id = s.academy_id
  where s.is_public = true
    and s.booking_enabled = true
    and s.capacity > 0
    and s.session_date >= now() - interval '15 minutes'
    and coalesce(cpp.booking_enabled, true) = true
  order by s.session_date asc;
$$;

-- ---------------------------------------------------------------------------
-- Session bookings: return expires_at from create RPC
-- ---------------------------------------------------------------------------

drop function if exists public.create_public_session_booking(
  uuid, text, date, text, text, text, text
);

create or replace function public.create_public_session_booking(
  p_session_id uuid,
  p_child_name text,
  p_child_date_of_birth date,
  p_parent_name text,
  p_parent_email text,
  p_parent_phone text,
  p_notes text
)
returns table (
  booking_id uuid,
  player_id uuid,
  coach_id uuid,
  booking_status text,
  payment_status text,
  amount integer,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_session public.sessions%rowtype;
  v_player_id uuid;
  v_booking_id uuid;
  v_confirmed_count integer := 0;
  v_pending_count integer := 0;
  v_expires_at timestamptz;
begin
  if p_session_id is null then
    raise exception 'session_id is required';
  end if;
  if nullif(trim(p_child_name), '') is null then
    raise exception 'child_name is required';
  end if;
  if nullif(trim(p_parent_email), '') is null then
    raise exception 'parent_email is required';
  end if;

  select *
    into v_session
    from public.sessions s
   where s.id = p_session_id
     and s.is_public = true
     and s.booking_enabled = true
     and s.session_date >= now() - interval '15 minutes'
   for update;

  if v_session.id is null then
    raise exception 'session is not available for public booking';
  end if;

  select p.id
    into v_player_id
    from public.players p
   where p.coach_id = v_session.coach_id
     and lower(p.player_name) = lower(trim(p_child_name))
     and lower(coalesce(p.parent_email, '')) = lower(trim(p_parent_email))
   order by p.created_at asc
   limit 1;

  if v_player_id is null then
    insert into public.players (
      coach_id,
      academy_id,
      player_name,
      date_of_birth,
      parent_name,
      parent_email,
      parent_phone,
      notes
    )
    values (
      v_session.coach_id,
      v_session.academy_id,
      trim(p_child_name),
      p_child_date_of_birth,
      nullif(trim(coalesce(p_parent_name, '')), ''),
      trim(p_parent_email),
      nullif(trim(coalesce(p_parent_phone, '')), ''),
      'Created from public session booking'
    )
    returning id into v_player_id;
  end if;

  select
    count(*) filter (where sb.booking_status = 'confirmed'),
    count(*) filter (
      where sb.booking_status = 'pending'
        and sb.expires_at is not null
        and sb.expires_at > now()
    )
    into v_confirmed_count, v_pending_count
    from public.session_bookings sb
   where sb.session_id = v_session.id;

  if greatest(v_session.capacity - v_confirmed_count - v_pending_count, 0) = 0 then
    insert into public.session_bookings (
      coach_id,
      academy_id,
      session_id,
      player_id,
      parent_name,
      parent_email,
      parent_phone,
      amount,
      currency,
      payment_status,
      booking_status,
      notes
    )
    values (
      v_session.coach_id,
      v_session.academy_id,
      v_session.id,
      v_player_id,
      nullif(trim(coalesce(p_parent_name, '')), ''),
      trim(p_parent_email),
      nullif(trim(coalesce(p_parent_phone, '')), ''),
      v_session.price,
      'gbp',
      'not_required',
      'waitlist',
      nullif(trim(coalesce(p_notes, '')), '')
    )
    returning id into v_booking_id;

    return query
    select
      v_booking_id,
      v_player_id,
      v_session.coach_id,
      'waitlist'::text,
      'not_required'::text,
      v_session.price,
      null::timestamptz;
    return;
  end if;

  v_expires_at := case
    when v_session.price > 0 then now() + interval '30 minutes'
    else null
  end;

  insert into public.session_bookings (
    coach_id,
    academy_id,
    session_id,
    player_id,
    parent_name,
    parent_email,
    parent_phone,
    amount,
    currency,
    payment_status,
    booking_status,
    notes,
    expires_at
  )
  values (
    v_session.coach_id,
    v_session.academy_id,
    v_session.id,
    v_player_id,
    nullif(trim(coalesce(p_parent_name, '')), ''),
    trim(p_parent_email),
    nullif(trim(coalesce(p_parent_phone, '')), ''),
    v_session.price,
    'gbp',
    case when v_session.price > 0 then 'requires_payment' else 'not_required' end,
    case when v_session.price > 0 then 'pending' else 'confirmed' end,
    nullif(trim(coalesce(p_notes, '')), ''),
    v_expires_at
  )
  returning id into v_booking_id;

  return query
  select
    v_booking_id,
    v_player_id,
    v_session.coach_id,
    case when v_session.price > 0 then 'pending' else 'confirmed' end,
    case when v_session.price > 0 then 'requires_payment' else 'not_required' end,
    v_session.price,
    v_expires_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Recurring enrolments: 30-minute pending holds + capacity alignment
-- ---------------------------------------------------------------------------

drop function if exists public.create_public_recurring_enrolment(
  uuid, text, date, text, text, text, text
);

create or replace function public.create_public_recurring_enrolment(
  p_series_id uuid,
  p_child_name text,
  p_child_date_of_birth date,
  p_parent_name text,
  p_parent_email text,
  p_parent_phone text,
  p_notes text
)
returns table (
  enrolment_id uuid,
  player_id uuid,
  coach_id uuid,
  academy_id uuid,
  title text,
  monthly_price integer,
  currency text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_series public.recurring_session_series%rowtype;
  v_player_id uuid;
  v_enrolment_id uuid;
  v_expires_at timestamptz;
  v_reserved_count integer := 0;
begin
  if p_series_id is null then
    raise exception 'series_id is required';
  end if;
  if nullif(trim(p_child_name), '') is null then
    raise exception 'child_name is required';
  end if;
  if nullif(trim(p_parent_email), '') is null then
    raise exception 'parent_email is required';
  end if;

  select *
    into v_series
    from public.recurring_session_series rss
   where rss.id = p_series_id
     and rss.is_public = true
     and rss.booking_enabled = true
     and rss.is_active = true
   for update;

  if v_series.id is null then
    raise exception 'recurring series is not available';
  end if;

  select count(*)
    into v_reserved_count
    from public.player_recurring_enrolments pre
   where pre.recurring_series_id = v_series.id
     and (
       pre.status = 'active'
       or (
         pre.status = 'pending'
         and pre.expires_at is not null
         and pre.expires_at > now()
       )
     );

  if v_reserved_count >= v_series.capacity then
    raise exception 'recurring series is full';
  end if;

  select p.id
    into v_player_id
    from public.players p
   where p.coach_id = v_series.coach_id
     and lower(p.player_name) = lower(trim(p_child_name))
     and lower(coalesce(p.parent_email, '')) = lower(trim(p_parent_email))
   order by p.created_at asc
   limit 1;

  if v_player_id is null then
    insert into public.players (
      coach_id,
      academy_id,
      player_name,
      date_of_birth,
      parent_name,
      parent_email,
      parent_phone,
      notes
    )
    values (
      v_series.coach_id,
      v_series.academy_id,
      trim(p_child_name),
      p_child_date_of_birth,
      nullif(trim(coalesce(p_parent_name, '')), ''),
      trim(p_parent_email),
      nullif(trim(coalesce(p_parent_phone, '')), ''),
      'Created from public recurring subscription'
    )
    returning id into v_player_id;
  end if;

  insert into public.player_recurring_enrolments (
    coach_id,
    academy_id,
    recurring_series_id,
    player_id,
    parent_name,
    parent_email,
    parent_phone,
    notes,
    status,
    monthly_price,
    expires_at
  )
  values (
    v_series.coach_id,
    v_series.academy_id,
    v_series.id,
    v_player_id,
    nullif(trim(coalesce(p_parent_name, '')), ''),
    trim(p_parent_email),
    nullif(trim(coalesce(p_parent_phone, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    'pending',
    v_series.monthly_price,
    now() + interval '30 minutes'
  )
  on conflict (recurring_series_id, player_id) do update
    set parent_name = excluded.parent_name,
        parent_email = excluded.parent_email,
        parent_phone = excluded.parent_phone,
        notes = excluded.notes,
        monthly_price = excluded.monthly_price,
        status = case
          when public.player_recurring_enrolments.status = 'cancelled' then 'pending'
          else public.player_recurring_enrolments.status
        end,
        expires_at = case
          when public.player_recurring_enrolments.status in ('cancelled', 'pending')
            then now() + interval '30 minutes'
          else public.player_recurring_enrolments.expires_at
        end
  returning id, expires_at into v_enrolment_id, v_expires_at;

  return query
  select
    v_enrolment_id,
    v_player_id,
    v_series.coach_id,
    v_series.academy_id,
    v_series.title,
    v_series.monthly_price,
    v_series.currency,
    v_expires_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Portal listing: expired pending enrolments do not consume capacity
-- ---------------------------------------------------------------------------

create or replace function public.list_public_recurring_series_for_portal(
  p_coach_slug text default null,
  p_academy_slug text default null
)
returns table (
  recurring_series_id uuid,
  coach_id uuid,
  academy_id uuid,
  coach_slug text,
  academy_slug text,
  title text,
  session_type text,
  day_of_week integer,
  start_time time,
  duration_minutes integer,
  location text,
  notes text,
  capacity integer,
  monthly_price integer,
  currency text,
  active_subscriptions integer,
  remaining_spaces integer
)
language sql
security definer
set search_path = public
as $$
  with portal as (
    select * from public.get_public_portal_by_coach_slug(p_coach_slug)
    union all
    select * from public.get_public_portal_by_academy_slug(p_academy_slug)
    limit 1
  ),
  enrolment_stats as (
    select
      pre.recurring_series_id,
      count(*) filter (where pre.status = 'active') as active_count,
      count(*) filter (
        where pre.status = 'active'
           or (
             pre.status = 'pending'
             and pre.expires_at is not null
             and pre.expires_at > now()
           )
      ) as reserved_count
    from public.player_recurring_enrolments pre
    group by pre.recurring_series_id
  )
  select
    rss.id as recurring_series_id,
    rss.coach_id,
    rss.academy_id,
    cpp.slug as coach_slug,
    a.slug as academy_slug,
    rss.title,
    rss.session_type,
    rss.day_of_week,
    rss.start_time,
    rss.duration_minutes,
    rss.location,
    rss.notes,
    rss.capacity,
    rss.monthly_price,
    rss.currency,
    coalesce(es.active_count, 0) as active_subscriptions,
    greatest(rss.capacity - coalesce(es.reserved_count, 0), 0) as remaining_spaces
  from public.recurring_session_series rss
  join portal p
    on (
      (p.portal_kind = 'coach' and rss.coach_id = p.coach_id)
      or (p.portal_kind = 'academy' and rss.academy_id = p.academy_id)
    )
  left join enrolment_stats es on es.recurring_series_id = rss.id
  left join public.coach_public_profiles cpp on cpp.coach_id = rss.coach_id
  left join public.academies a on a.id = rss.academy_id
  where rss.is_public = true
    and rss.booking_enabled = true
    and rss.is_active = true
    and rss.capacity > 0
    and coalesce(cpp.booking_enabled, true) = true
  order by rss.created_at asc;
$$;

-- ---------------------------------------------------------------------------
-- Attach Stripe checkout session ids (service_role only via API routes)
-- ---------------------------------------------------------------------------

create or replace function public.attach_stripe_checkout_to_session_booking(
  p_booking_id uuid,
  p_stripe_checkout_session_id text,
  p_checkout_expires_at bigint
)
returns table (
  booking_id uuid,
  stripe_checkout_session_id text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.session_bookings%rowtype;
begin
  if p_booking_id is null then
    raise exception 'booking_id is required';
  end if;
  if nullif(trim(p_stripe_checkout_session_id), '') is null then
    raise exception 'stripe_checkout_session_id is required';
  end if;
  if p_checkout_expires_at is null or p_checkout_expires_at <= 0 then
    raise exception 'checkout_expires_at is required';
  end if;

  select *
    into v_booking
    from public.session_bookings sb
   where sb.id = p_booking_id
   for update;

  if v_booking.id is null then
    raise exception 'booking not found';
  end if;

  if v_booking.booking_status <> 'pending' then
    raise exception 'booking is not awaiting payment';
  end if;

  if v_booking.payment_status <> 'requires_payment' then
    raise exception 'booking does not require payment';
  end if;

  update public.session_bookings
     set stripe_checkout_session_id = trim(p_stripe_checkout_session_id),
         expires_at = to_timestamp(p_checkout_expires_at)
   where id = p_booking_id
  returning * into v_booking;

  return query
  select v_booking.id, v_booking.stripe_checkout_session_id, v_booking.expires_at;
end;
$$;

create or replace function public.attach_stripe_checkout_to_recurring_enrolment(
  p_enrolment_id uuid,
  p_stripe_checkout_session_id text,
  p_checkout_expires_at bigint
)
returns table (
  enrolment_id uuid,
  stripe_checkout_session_id text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrolment public.player_recurring_enrolments%rowtype;
begin
  if p_enrolment_id is null then
    raise exception 'enrolment_id is required';
  end if;
  if nullif(trim(p_stripe_checkout_session_id), '') is null then
    raise exception 'stripe_checkout_session_id is required';
  end if;
  if p_checkout_expires_at is null or p_checkout_expires_at <= 0 then
    raise exception 'checkout_expires_at is required';
  end if;

  select *
    into v_enrolment
    from public.player_recurring_enrolments pre
   where pre.id = p_enrolment_id
   for update;

  if v_enrolment.id is null then
    raise exception 'recurring enrolment not found';
  end if;

  if v_enrolment.status <> 'pending' then
    raise exception 'recurring enrolment is not awaiting checkout';
  end if;

  update public.player_recurring_enrolments
     set stripe_checkout_session_id = trim(p_stripe_checkout_session_id),
         expires_at = to_timestamp(p_checkout_expires_at)
   where id = p_enrolment_id
  returning * into v_enrolment;

  return query
  select v_enrolment.id, v_enrolment.stripe_checkout_session_id, v_enrolment.expires_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Confirm path: clear recurring hold expiry on activation
-- ---------------------------------------------------------------------------

create or replace function public.confirm_public_recurring_enrolment(
  p_enrolment_id uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_subscription_status text,
  p_current_period_end timestamptz
)
returns table (
  parent_subscription_id uuid,
  recurring_enrolment_id uuid,
  player_id uuid,
  coach_id uuid,
  academy_id uuid,
  recurring_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrolment public.player_recurring_enrolments%rowtype;
  v_series public.recurring_session_series%rowtype;
  v_parent_subscription_id uuid;
  v_next_status text;
begin
  select *
    into v_enrolment
    from public.player_recurring_enrolments pre
   where pre.id = p_enrolment_id
   for update;

  if v_enrolment.id is null then
    raise exception 'recurring enrolment not found';
  end if;

  select *
    into v_series
    from public.recurring_session_series rss
   where rss.id = v_enrolment.recurring_series_id;

  if v_series.id is null then
    raise exception 'recurring series not found';
  end if;

  v_next_status := case
    when p_subscription_status in ('active', 'trialing') then 'active'
    when p_subscription_status in ('canceled', 'cancelled') then 'cancelled'
    else 'paused'
  end;

  insert into public.parent_subscriptions (
    coach_id,
    academy_id,
    player_id,
    stripe_customer_id,
    stripe_subscription_id,
    amount,
    currency,
    interval,
    status,
    current_period_end,
    subscription_kind,
    recurring_series_id,
    recurring_enrolment_id
  )
  values (
    v_enrolment.coach_id,
    v_enrolment.academy_id,
    v_enrolment.player_id,
    p_stripe_customer_id,
    p_stripe_subscription_id,
    v_enrolment.monthly_price,
    coalesce(v_series.currency, 'gbp'),
    'monthly',
    p_subscription_status,
    p_current_period_end,
    'recurring_series',
    v_enrolment.recurring_series_id,
    v_enrolment.id
  )
  on conflict (stripe_subscription_id) do update
    set academy_id = excluded.academy_id,
        amount = excluded.amount,
        currency = excluded.currency,
        interval = excluded.interval,
        status = excluded.status,
        current_period_end = excluded.current_period_end,
        subscription_kind = excluded.subscription_kind,
        recurring_series_id = excluded.recurring_series_id,
        recurring_enrolment_id = excluded.recurring_enrolment_id
  returning id into v_parent_subscription_id;

  update public.player_recurring_enrolments
     set status = v_next_status,
         expires_at = null
   where id = v_enrolment.id;

  perform public.sync_recurring_enrolment_bookings(v_enrolment.id);

  return query
  select
    v_parent_subscription_id,
    v_enrolment.id,
    v_enrolment.player_id,
    v_enrolment.coach_id,
    v_enrolment.academy_id,
    v_next_status;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant execute on function public.create_public_session_booking(
  uuid, text, date, text, text, text, text
) to anon, authenticated;

grant execute on function public.create_public_recurring_enrolment(
  uuid, text, date, text, text, text, text
) to anon, authenticated;

grant execute on function public.attach_stripe_checkout_to_session_booking(
  uuid, text, bigint
) to service_role;

grant execute on function public.attach_stripe_checkout_to_recurring_enrolment(
  uuid, text, bigint
) to service_role;
