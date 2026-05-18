-- Public booking portal. The RPC safely creates or reuses a player and creates
-- a pending booking for the configured coach.

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  service_type text not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists bookings_coach_id_idx on public.bookings (coach_id);
create index if not exists bookings_player_id_idx on public.bookings (player_id);
create index if not exists bookings_status_idx on public.bookings (status);

alter table public.bookings enable row level security;

create policy "bookings_select_own" on public.bookings
  for select using (auth.uid() = coach_id);

create policy "bookings_update_own" on public.bookings
  for update using (auth.uid() = coach_id);

create policy "bookings_delete_own" on public.bookings
  for delete using (auth.uid() = coach_id);

create or replace function public.create_public_booking(
  p_coach_id uuid,
  p_child_name text,
  p_child_date_of_birth date,
  p_parent_name text,
  p_parent_email text,
  p_parent_phone text,
  p_service_type text,
  p_notes text
)
returns table (booking_id uuid, player_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
  v_booking_id uuid;
begin
  if p_coach_id is null then
    raise exception 'coach_id is required';
  end if;
  if nullif(trim(p_child_name), '') is null then
    raise exception 'child_name is required';
  end if;
  if nullif(trim(p_parent_email), '') is null then
    raise exception 'parent_email is required';
  end if;
  if nullif(trim(p_service_type), '') is null then
    raise exception 'service_type is required';
  end if;

  select p.id
    into v_player_id
    from public.players p
   where p.coach_id = p_coach_id
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
      p_coach_id,
      trim(p_child_name),
      p_child_date_of_birth,
      nullif(trim(coalesce(p_parent_name, '')), ''),
      trim(p_parent_email),
      nullif(trim(coalesce(p_parent_phone, '')), ''),
      'Created from public booking portal'
    )
    returning id into v_player_id;
  end if;

  insert into public.bookings (
    coach_id,
    player_id,
    service_type,
    status,
    notes
  )
  values (
    p_coach_id,
    v_player_id,
    trim(p_service_type),
    'pending',
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning id into v_booking_id;

  return query select v_booking_id, v_player_id;
end;
$$;

grant execute on function public.create_public_booking(
  uuid,
  text,
  date,
  text,
  text,
  text,
  text,
  text
) to anon, authenticated;
