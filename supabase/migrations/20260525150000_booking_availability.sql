-- Availability-driven session booking system.

create table if not exists public.coach_availability (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  session_type text not null check (session_type in ('1-to-1', 'Group Session', 'Camp')),
  duration_minutes integer not null check (duration_minutes between 15 and 480),
  default_price integer not null default 0 check (default_price >= 0),
  default_capacity integer not null default 1 check (default_capacity >= 1),
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists coach_availability_coach_id_idx
  on public.coach_availability (coach_id);

create index if not exists coach_availability_day_of_week_idx
  on public.coach_availability (coach_id, day_of_week, start_time);

alter table public.coach_availability enable row level security;

create policy "coach_availability_select_own" on public.coach_availability
  for select using (auth.uid() = coach_id);

create policy "coach_availability_insert_own" on public.coach_availability
  for insert with check (auth.uid() = coach_id);

create policy "coach_availability_update_own" on public.coach_availability
  for update using (auth.uid() = coach_id) with check (auth.uid() = coach_id);

create policy "coach_availability_delete_own" on public.coach_availability
  for delete using (auth.uid() = coach_id);

alter table public.sessions
  alter column player_id drop not null;

alter table public.sessions
  add column if not exists duration_minutes integer not null default 60
    check (duration_minutes between 15 and 480),
  add column if not exists price integer not null default 0 check (price >= 0),
  add column if not exists capacity integer not null default 1 check (capacity >= 1),
  add column if not exists is_public boolean not null default false,
  add column if not exists source_availability_id uuid references public.coach_availability (id) on delete set null;

update public.sessions s
set capacity = greatest(
  1,
  coalesce((
    select count(*)
    from public.session_players sp
    where sp.session_id = s.id
  ), 0),
  case when s.player_id is null then 0 else 1 end
)
where s.capacity = 1;

drop policy if exists "sessions_insert_own" on public.sessions;
drop policy if exists "sessions_update_own" on public.sessions;

create policy "sessions_insert_own" on public.sessions
  for insert with check (
    auth.uid() = coach_id
    and (
      player_id is null
      or exists (
        select 1 from public.players p
        where p.id = player_id and p.coach_id = auth.uid()
      )
    )
  );

create policy "sessions_update_own" on public.sessions
  for update using (auth.uid() = coach_id)
  with check (
    auth.uid() = coach_id
    and (
      player_id is null
      or exists (
        select 1 from public.players p
        where p.id = player_id and p.coach_id = auth.uid()
      )
    )
  );

create table if not exists public.session_bookings (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  parent_name text,
  parent_email text not null,
  parent_phone text,
  amount integer not null default 0 check (amount >= 0),
  currency text not null default 'gbp',
  payment_status text not null default 'requires_payment'
    check (payment_status in ('requires_payment', 'paid', 'not_required', 'failed', 'refunded')),
  booking_status text not null default 'pending'
    check (booking_status in ('pending', 'confirmed', 'waitlist', 'cancelled')),
  notes text,
  expires_at timestamptz,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now()
);

create index if not exists session_bookings_coach_id_idx
  on public.session_bookings (coach_id, created_at desc);

create index if not exists session_bookings_session_id_idx
  on public.session_bookings (session_id, booking_status, payment_status);

create index if not exists session_bookings_player_id_idx
  on public.session_bookings (player_id);

create unique index if not exists session_bookings_checkout_session_id_idx
  on public.session_bookings (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

alter table public.session_bookings enable row level security;

create policy "session_bookings_select_own" on public.session_bookings
  for select using (auth.uid() = coach_id);

create policy "session_bookings_insert_own" on public.session_bookings
  for insert with check (
    auth.uid() = coach_id
    and exists (
      select 1
      from public.sessions s
      where s.id = session_id
        and s.coach_id = auth.uid()
    )
    and exists (
      select 1
      from public.players p
      where p.id = player_id
        and p.coach_id = auth.uid()
    )
  );

create policy "session_bookings_update_own" on public.session_bookings
  for update using (auth.uid() = coach_id)
  with check (auth.uid() = coach_id);

create policy "session_bookings_delete_own" on public.session_bookings
  for delete using (auth.uid() = coach_id);

create or replace function public.list_public_sessions(
  p_coach_id uuid
)
returns table (
  session_id uuid,
  coach_id uuid,
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
  with booking_stats as (
    select
      sb.session_id,
      count(*) filter (
        where sb.booking_status = 'confirmed'
      ) as confirmed_count,
      count(*) filter (
        where sb.booking_status = 'pending'
          and coalesce(sb.expires_at, now() + interval '1 minute') > now()
      ) as pending_count,
      count(*) filter (
        where sb.booking_status = 'waitlist'
      ) as waitlist_count
    from public.session_bookings sb
    group by sb.session_id
  )
  select
    s.id as session_id,
    s.coach_id,
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
  left join booking_stats bs on bs.session_id = s.id
  where s.coach_id = p_coach_id
    and s.is_public = true
    and s.session_date >= now() - interval '15 minutes'
  order by s.session_date asc;
$$;

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
  amount integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.sessions%rowtype;
  v_player_id uuid;
  v_booking_id uuid;
  v_confirmed_count integer := 0;
  v_pending_count integer := 0;
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
      player_name,
      date_of_birth,
      parent_name,
      parent_email,
      parent_phone,
      notes
    )
    values (
      v_session.coach_id,
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
        and coalesce(sb.expires_at, now() + interval '1 minute') > now()
    )
    into v_confirmed_count, v_pending_count
    from public.session_bookings sb
   where sb.session_id = v_session.id;

  if greatest(v_session.capacity - v_confirmed_count - v_pending_count, 0) = 0 then
    insert into public.session_bookings (
      coach_id,
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
    select v_booking_id, v_player_id, v_session.coach_id, 'waitlist'::text, 'not_required'::text, v_session.price;
    return;
  end if;

  insert into public.session_bookings (
    coach_id,
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
    case when v_session.price > 0 then now() + interval '30 minutes' else null end
  )
  returning id into v_booking_id;

  return query
  select
    v_booking_id,
    v_player_id,
    v_session.coach_id,
    case when v_session.price > 0 then 'pending' else 'confirmed' end,
    case when v_session.price > 0 then 'requires_payment' else 'not_required' end,
    v_session.price;
end;
$$;

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

  update public.session_bookings
     set booking_status = 'confirmed',
         payment_status = case
           when amount > 0 then 'paid'
           else payment_status
         end,
         stripe_checkout_session_id = coalesce(p_stripe_checkout_session_id, stripe_checkout_session_id),
         stripe_payment_intent_id = coalesce(p_stripe_payment_intent_id, stripe_payment_intent_id),
         expires_at = null
   where id = p_booking_id
     and booking_status = 'pending'
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

grant execute on function public.list_public_sessions(uuid) to anon, authenticated;

grant execute on function public.create_public_session_booking(
  uuid,
  text,
  date,
  text,
  text,
  text,
  text
) to anon, authenticated;

grant execute on function public.confirm_public_session_booking(
  uuid,
  text,
  text
) to anon, authenticated;
