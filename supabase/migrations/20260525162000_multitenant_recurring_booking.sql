-- Multi-tenant public portals and recurring child subscriptions.

create or replace function public.slugify_text(p_value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(p_value, '')), '[^a-z0-9]+', '-', 'g'));
$$;

alter table public.academies
  add column if not exists slug text;

update public.academies
set slug = concat(
  coalesce(nullif(public.slugify_text(name), ''), 'academy'),
  '-',
  substr(id::text, 1, 6)
)
where slug is null;

create unique index if not exists academies_slug_idx
  on public.academies (lower(slug))
  where slug is not null;

alter table public.coach_availability
  add column if not exists academy_id uuid references public.academies (id) on delete set null;

create index if not exists coach_availability_academy_id_idx
  on public.coach_availability (academy_id);

create table if not exists public.coach_public_profiles (
  coach_id uuid primary key references auth.users (id) on delete cascade,
  academy_id uuid references public.academies (id) on delete set null,
  slug text not null,
  display_name text not null,
  logo_url text,
  primary_color text not null default '#10B981',
  secondary_color text not null default '#0F172A',
  support_email text,
  booking_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists coach_public_profiles_slug_idx
  on public.coach_public_profiles (lower(slug));

create index if not exists coach_public_profiles_academy_id_idx
  on public.coach_public_profiles (academy_id);

alter table public.coach_public_profiles enable row level security;

create policy "coach_public_profiles_select_own" on public.coach_public_profiles
  for select using (auth.uid() = coach_id);

create policy "coach_public_profiles_insert_own" on public.coach_public_profiles
  for insert with check (auth.uid() = coach_id);

create policy "coach_public_profiles_update_own" on public.coach_public_profiles
  for update using (auth.uid() = coach_id)
  with check (auth.uid() = coach_id);

create policy "coach_public_profiles_delete_own" on public.coach_public_profiles
  for delete using (auth.uid() = coach_id);

insert into public.coach_public_profiles (
  coach_id,
  academy_id,
  slug,
  display_name,
  logo_url,
  primary_color,
  secondary_color,
  support_email
)
select
  u.id,
  academy_link.academy_id,
  concat(
    coalesce(
      nullif(public.slugify_text(coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1))), ''),
      'coach'
    ),
    '-',
    substr(u.id::text, 1, 6)
  ),
  coalesce(
    nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), ''),
    split_part(u.email, '@', 1),
    'Coach'
  ),
  academy.logo_url,
  coalesce(academy.primary_color, '#10B981'),
  coalesce(academy.secondary_color, '#0F172A'),
  coalesce(academy.support_email, u.email)
from auth.users u
left join lateral (
  select am.academy_id
  from public.academy_members am
  where am.user_id = u.id
  order by am.created_at asc
  limit 1
) academy_link on true
left join public.academies academy on academy.id = academy_link.academy_id
where not exists (
  select 1
  from public.coach_public_profiles cpp
  where cpp.coach_id = u.id
);

update public.coach_availability ca
set academy_id = cpp.academy_id
from public.coach_public_profiles cpp
where ca.coach_id = cpp.coach_id
  and ca.academy_id is null
  and cpp.academy_id is not null;

create table if not exists public.recurring_session_series (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  academy_id uuid references public.academies (id) on delete set null,
  source_availability_id uuid references public.coach_availability (id) on delete set null,
  title text not null,
  session_type text not null check (session_type in ('1-to-1', 'Group Session', 'Camp')),
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  duration_minutes integer not null check (duration_minutes between 15 and 480),
  location text,
  notes text,
  capacity integer not null default 1 check (capacity >= 1),
  monthly_price integer not null default 0 check (monthly_price >= 0),
  currency text not null default 'gbp',
  is_public boolean not null default false,
  booking_enabled boolean not null default true,
  is_active boolean not null default true,
  rolling_weeks integer not null default 8 check (rolling_weeks between 1 and 24),
  created_at timestamptz not null default now()
);

create index if not exists recurring_session_series_coach_id_idx
  on public.recurring_session_series (coach_id, created_at desc);

create index if not exists recurring_session_series_academy_id_idx
  on public.recurring_session_series (academy_id);

alter table public.recurring_session_series enable row level security;

create policy "recurring_session_series_select_own" on public.recurring_session_series
  for select using (auth.uid() = coach_id);

create policy "recurring_session_series_insert_own" on public.recurring_session_series
  for insert with check (auth.uid() = coach_id);

create policy "recurring_session_series_update_own" on public.recurring_session_series
  for update using (auth.uid() = coach_id)
  with check (auth.uid() = coach_id);

create policy "recurring_session_series_delete_own" on public.recurring_session_series
  for delete using (auth.uid() = coach_id);

create table if not exists public.player_recurring_enrolments (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  academy_id uuid references public.academies (id) on delete set null,
  recurring_series_id uuid not null references public.recurring_session_series (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  parent_name text,
  parent_email text not null,
  parent_phone text,
  notes text,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'paused', 'cancelled')),
  billing_interval text not null default 'monthly'
    check (billing_interval in ('monthly')),
  monthly_price integer not null default 0 check (monthly_price >= 0),
  starts_on date not null default current_date,
  ends_on date,
  stripe_checkout_session_id text,
  created_at timestamptz not null default now(),
  unique (recurring_series_id, player_id)
);

create index if not exists player_recurring_enrolments_coach_id_idx
  on public.player_recurring_enrolments (coach_id, created_at desc);

create index if not exists player_recurring_enrolments_series_id_idx
  on public.player_recurring_enrolments (recurring_series_id, status);

create index if not exists player_recurring_enrolments_player_id_idx
  on public.player_recurring_enrolments (player_id);

alter table public.player_recurring_enrolments enable row level security;

create policy "player_recurring_enrolments_select_own" on public.player_recurring_enrolments
  for select using (auth.uid() = coach_id);

create policy "player_recurring_enrolments_insert_own" on public.player_recurring_enrolments
  for insert with check (
    auth.uid() = coach_id
    and exists (
      select 1
      from public.recurring_session_series rss
      where rss.id = recurring_series_id
        and rss.coach_id = auth.uid()
    )
    and exists (
      select 1
      from public.players p
      where p.id = player_id
        and p.coach_id = auth.uid()
    )
  );

create policy "player_recurring_enrolments_update_own" on public.player_recurring_enrolments
  for update using (auth.uid() = coach_id)
  with check (auth.uid() = coach_id);

create policy "player_recurring_enrolments_delete_own" on public.player_recurring_enrolments
  for delete using (auth.uid() = coach_id);

alter table public.sessions
  add column if not exists booking_enabled boolean not null default true,
  add column if not exists recurring_series_id uuid references public.recurring_session_series (id) on delete set null;

update public.sessions s
set academy_id = cpp.academy_id
from public.coach_public_profiles cpp
where s.coach_id = cpp.coach_id
  and s.academy_id is null
  and cpp.academy_id is not null;

create unique index if not exists sessions_recurring_series_date_idx
  on public.sessions (recurring_series_id, session_date)
  where recurring_series_id is not null;

alter table public.session_bookings
  add column if not exists academy_id uuid references public.academies (id) on delete set null,
  add column if not exists recurring_enrolment_id uuid references public.player_recurring_enrolments (id) on delete set null;

update public.session_bookings sb
set academy_id = s.academy_id
from public.sessions s
where sb.session_id = s.id
  and sb.academy_id is null
  and s.academy_id is not null;

create index if not exists session_bookings_academy_id_idx
  on public.session_bookings (academy_id);

create index if not exists session_bookings_recurring_enrolment_id_idx
  on public.session_bookings (recurring_enrolment_id);

alter table public.parent_subscriptions
  add column if not exists subscription_kind text not null default 'manual'
    check (subscription_kind in ('manual', 'recurring_series')),
  add column if not exists recurring_series_id uuid references public.recurring_session_series (id) on delete set null,
  add column if not exists recurring_enrolment_id uuid references public.player_recurring_enrolments (id) on delete set null;

create index if not exists parent_subscriptions_recurring_series_id_idx
  on public.parent_subscriptions (recurring_series_id);

create index if not exists parent_subscriptions_recurring_enrolment_id_idx
  on public.parent_subscriptions (recurring_enrolment_id);

create or replace function public.get_public_portal_by_coach_slug(
  p_slug text
)
returns table (
  portal_kind text,
  coach_id uuid,
  academy_id uuid,
  coach_slug text,
  academy_slug text,
  display_name text,
  logo_url text,
  primary_color text,
  secondary_color text,
  support_email text,
  booking_enabled boolean
)
language sql
security definer
set search_path = public
as $$
  select
    'coach'::text as portal_kind,
    cpp.coach_id,
    cpp.academy_id,
    cpp.slug as coach_slug,
    a.slug as academy_slug,
    cpp.display_name,
    coalesce(cpp.logo_url, a.logo_url) as logo_url,
    coalesce(cpp.primary_color, a.primary_color, '#10B981') as primary_color,
    coalesce(cpp.secondary_color, a.secondary_color, '#0F172A') as secondary_color,
    coalesce(cpp.support_email, a.support_email) as support_email,
    cpp.booking_enabled
  from public.coach_public_profiles cpp
  left join public.academies a on a.id = cpp.academy_id
  where lower(cpp.slug) = lower(trim(p_slug))
  limit 1;
$$;

create or replace function public.get_public_portal_by_academy_slug(
  p_slug text
)
returns table (
  portal_kind text,
  coach_id uuid,
  academy_id uuid,
  coach_slug text,
  academy_slug text,
  display_name text,
  logo_url text,
  primary_color text,
  secondary_color text,
  support_email text,
  booking_enabled boolean
)
language sql
security definer
set search_path = public
as $$
  select
    'academy'::text as portal_kind,
    null::uuid as coach_id,
    a.id as academy_id,
    null::text as coach_slug,
    a.slug as academy_slug,
    a.name as display_name,
    a.logo_url,
    a.primary_color,
    a.secondary_color,
    a.support_email,
    true as booking_enabled
  from public.academies a
  where lower(a.slug) = lower(trim(p_slug))
  limit 1;
$$;

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
          and coalesce(sb.expires_at, now() + interval '1 minute') > now()
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
      count(*) filter (where pre.status = 'active') as active_count
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
    greatest(rss.capacity - coalesce(es.active_count, 0), 0) as remaining_spaces
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

create or replace function public.generate_recurring_series_sessions(
  p_series_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_series public.recurring_session_series%rowtype;
  v_inserted integer := 0;
begin
  select *
    into v_series
    from public.recurring_session_series rss
   where rss.id = p_series_id;

  if v_series.id is null or v_series.is_active = false then
    return 0;
  end if;

  insert into public.sessions (
    coach_id,
    academy_id,
    player_id,
    group_name,
    session_date,
    session_type,
    location,
    notes,
    attendance_status,
    duration_minutes,
    price,
    capacity,
    is_public,
    booking_enabled,
    source_availability_id,
    recurring_series_id
  )
  select
    v_series.coach_id,
    v_series.academy_id,
    null,
    v_series.title,
    ((occurrence_date::timestamp + v_series.start_time)::timestamptz),
    v_series.session_type,
    v_series.location,
    v_series.notes,
    'scheduled',
    v_series.duration_minutes,
    0,
    v_series.capacity,
    false,
    false,
    v_series.source_availability_id,
    v_series.id
  from (
    select gs::date as occurrence_date
    from generate_series(
      current_date,
      current_date + (v_series.rolling_weeks * 7),
      interval '1 day'
    ) gs
    where extract(dow from gs) = v_series.day_of_week
  ) dates
  where not exists (
    select 1
    from public.sessions s
    where s.recurring_series_id = v_series.id
      and s.session_date = ((dates.occurrence_date::timestamp + v_series.start_time)::timestamptz)
  );

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

create or replace function public.sync_recurring_enrolment_bookings(
  p_enrolment_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrolment public.player_recurring_enrolments%rowtype;
  v_inserted integer := 0;
begin
  select *
    into v_enrolment
    from public.player_recurring_enrolments pre
   where pre.id = p_enrolment_id;

  if v_enrolment.id is null then
    return 0;
  end if;

  perform public.generate_recurring_series_sessions(v_enrolment.recurring_series_id);

  if v_enrolment.status <> 'active' then
    update public.session_bookings sb
       set booking_status = 'cancelled'
     where sb.recurring_enrolment_id = v_enrolment.id
       and sb.booking_status in ('confirmed', 'pending')
       and exists (
         select 1
         from public.sessions s
         where s.id = sb.session_id
           and s.session_date >= now()
       );
    return 0;
  end if;

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
    recurring_enrolment_id
  )
  select
    v_enrolment.coach_id,
    v_enrolment.academy_id,
    s.id,
    v_enrolment.player_id,
    v_enrolment.parent_name,
    v_enrolment.parent_email,
    v_enrolment.parent_phone,
    0,
    'gbp',
    'not_required',
    'confirmed',
    v_enrolment.notes,
    v_enrolment.id
  from public.sessions s
  where s.recurring_series_id = v_enrolment.recurring_series_id
    and s.session_date >= now() - interval '15 minutes'
    and not exists (
      select 1
      from public.session_bookings existing
      where existing.session_id = s.id
        and existing.player_id = v_enrolment.player_id
        and existing.booking_status <> 'cancelled'
    );

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

create or replace function public.sync_active_recurring_series_for_coach(
  p_coach_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer := 0;
  v_series record;
  v_enrolment record;
begin
  if auth.uid() is not null and auth.uid() <> p_coach_id then
    raise exception 'not allowed';
  end if;

  for v_series in
    select rss.id
    from public.recurring_session_series rss
    where rss.coach_id = p_coach_id
      and rss.is_active = true
  loop
    v_total := v_total + public.generate_recurring_series_sessions(v_series.id);
  end loop;

  for v_enrolment in
    select pre.id
    from public.player_recurring_enrolments pre
    where pre.coach_id = p_coach_id
      and pre.status in ('active', 'paused', 'cancelled')
  loop
    v_total := v_total + public.sync_recurring_enrolment_bookings(v_enrolment.id);
  end loop;

  return v_total;
end;
$$;

create or replace function public.sync_recurring_subscription_state(
  p_stripe_subscription_id text,
  p_status text,
  p_current_period_end timestamptz
)
returns table (
  parent_subscription_id uuid,
  recurring_enrolment_id uuid,
  recurring_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription public.parent_subscriptions%rowtype;
  v_next_status text;
begin
  update public.parent_subscriptions
     set status = p_status,
         current_period_end = p_current_period_end
   where stripe_subscription_id = p_stripe_subscription_id
  returning * into v_subscription;

  if v_subscription.id is null then
    return;
  end if;

  if v_subscription.recurring_enrolment_id is not null then
    v_next_status := case
      when p_status in ('active', 'trialing') then 'active'
      when p_status in ('past_due', 'unpaid', 'incomplete', 'incomplete_expired') then 'paused'
      when p_status in ('canceled', 'cancelled') then 'cancelled'
      else 'paused'
    end;

    update public.player_recurring_enrolments
       set status = v_next_status
     where id = v_subscription.recurring_enrolment_id;

    perform public.sync_recurring_enrolment_bookings(v_subscription.recurring_enrolment_id);
  end if;

  return query
  select v_subscription.id, v_subscription.recurring_enrolment_id, coalesce(v_next_status, 'pending');
end;
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
        and coalesce(sb.expires_at, now() + interval '1 minute') > now()
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
    select v_booking_id, v_player_id, v_session.coach_id, 'waitlist'::text, 'not_required'::text, v_session.price;
    return;
  end if;

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
  currency text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_series public.recurring_session_series%rowtype;
  v_player_id uuid;
  v_enrolment_id uuid;
  v_active_count integer := 0;
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
    into v_active_count
    from public.player_recurring_enrolments pre
   where pre.recurring_series_id = v_series.id
     and pre.status in ('active', 'pending');

  if v_active_count >= v_series.capacity then
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
    monthly_price
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
    v_series.monthly_price
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
        end
  returning id into v_enrolment_id;

  return query
  select
    v_enrolment_id,
    v_player_id,
    v_series.coach_id,
    v_series.academy_id,
    v_series.title,
    v_series.monthly_price,
    v_series.currency;
end;
$$;

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
     set status = v_next_status
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

grant execute on function public.get_public_portal_by_coach_slug(text) to anon, authenticated;
grant execute on function public.get_public_portal_by_academy_slug(text) to anon, authenticated;
grant execute on function public.list_public_sessions_for_portal(text, text) to anon, authenticated;
grant execute on function public.list_public_recurring_series_for_portal(text, text) to anon, authenticated;
grant execute on function public.generate_recurring_series_sessions(uuid) to authenticated;
grant execute on function public.sync_recurring_enrolment_bookings(uuid) to authenticated;
grant execute on function public.sync_active_recurring_series_for_coach(uuid) to authenticated;
grant execute on function public.sync_recurring_subscription_state(text, text, timestamptz) to anon, authenticated;
grant execute on function public.create_public_recurring_enrolment(
  uuid,
  text,
  date,
  text,
  text,
  text,
  text
) to anon, authenticated;
grant execute on function public.confirm_public_recurring_enrolment(
  uuid,
  text,
  text,
  text,
  timestamptz
) to anon, authenticated;
