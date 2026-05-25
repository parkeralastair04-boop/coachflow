-- Per-player attendance tracking for sessions.

create table if not exists public.session_attendance (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  status text not null
    check (status in ('present', 'absent', 'late', 'injured', 'excused')),
  notes text,
  recorded_at timestamptz not null default now(),
  unique (session_id, player_id)
);

create index if not exists session_attendance_coach_id_idx
  on public.session_attendance (coach_id, recorded_at desc);

create index if not exists session_attendance_session_id_idx
  on public.session_attendance (session_id);

create index if not exists session_attendance_player_id_idx
  on public.session_attendance (player_id, recorded_at desc);

create index if not exists session_attendance_status_idx
  on public.session_attendance (status);

alter table public.session_attendance enable row level security;

create policy "session_attendance_select_own" on public.session_attendance
  for select using (
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

create policy "session_attendance_insert_own" on public.session_attendance
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

create policy "session_attendance_update_own" on public.session_attendance
  for update using (auth.uid() = coach_id)
  with check (
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

create policy "session_attendance_delete_own" on public.session_attendance
  for delete using (auth.uid() = coach_id);

insert into public.session_attendance (
  coach_id,
  session_id,
  player_id,
  status,
  recorded_at
)
select
  s.coach_id,
  s.id,
  roster.player_id,
  case
    when s.attendance_status = 'attended' then 'present'
    when s.attendance_status = 'missed' then 'absent'
    else null
  end,
  coalesce(s.session_date, now())
from public.sessions s
join lateral (
  select sp.player_id
  from public.session_players sp
  where sp.session_id = s.id

  union

  select sb.player_id
  from public.session_bookings sb
  where sb.session_id = s.id
    and sb.booking_status = 'confirmed'

  union

  select s.player_id
  where s.player_id is not null
) roster on true
where s.attendance_status in ('attended', 'missed')
on conflict (session_id, player_id) do nothing;
