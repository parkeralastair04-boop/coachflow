-- Core CoachFlow CRM tables (players, sessions, progress reports).
-- Sessions use session_date (timestamptz) for the scheduled date and time.

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  player_name text not null,
  date_of_birth date,
  parent_name text,
  parent_email text,
  parent_phone text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists players_coach_id_idx on public.players (coach_id);

alter table public.players enable row level security;

create policy "players_select_own" on public.players
  for select using (auth.uid() = coach_id);

create policy "players_insert_own" on public.players
  for insert with check (auth.uid() = coach_id);

create policy "players_update_own" on public.players
  for update using (auth.uid() = coach_id);

create policy "players_delete_own" on public.players
  for delete using (auth.uid() = coach_id);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  session_date timestamptz not null,
  session_type text,
  location text,
  notes text,
  attendance_status text not null default 'scheduled'
    check (attendance_status in ('scheduled', 'attended', 'missed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists sessions_coach_id_idx on public.sessions (coach_id);
create index if not exists sessions_player_id_idx on public.sessions (player_id);
create index if not exists sessions_session_date_idx on public.sessions (session_date desc);

alter table public.sessions enable row level security;

create policy "sessions_select_own" on public.sessions
  for select using (auth.uid() = coach_id);

create policy "sessions_insert_own" on public.sessions
  for insert with check (
    auth.uid() = coach_id
    and exists (
      select 1 from public.players p
      where p.id = player_id and p.coach_id = auth.uid()
    )
  );

create policy "sessions_update_own" on public.sessions
  for update using (auth.uid() = coach_id);

create policy "sessions_delete_own" on public.sessions
  for delete using (auth.uid() = coach_id);

create table if not exists public.progress_reports (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  raw_notes text not null default '',
  report text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists progress_reports_coach_id_idx on public.progress_reports (coach_id);
create index if not exists progress_reports_player_id_idx on public.progress_reports (player_id);

alter table public.progress_reports enable row level security;

create policy "progress_reports_select_own" on public.progress_reports
  for select using (auth.uid() = coach_id);

create policy "progress_reports_insert_own" on public.progress_reports
  for insert with check (
    auth.uid() = coach_id
    and exists (
      select 1 from public.players p
      where p.id = player_id and p.coach_id = auth.uid()
    )
  );

create policy "progress_reports_update_own" on public.progress_reports
  for update using (auth.uid() = coach_id);

create policy "progress_reports_delete_own" on public.progress_reports
  for delete using (auth.uid() = coach_id);
