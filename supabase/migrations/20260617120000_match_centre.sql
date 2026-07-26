-- V2-A1 Match Centre: fixtures, squads, linked register sessions

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  academy_id uuid references public.academies (id) on delete set null,
  team_id uuid not null references public.teams (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete set null,
  opposition text not null,
  competition_type text not null check (competition_type in ('league', 'cup', 'friendly')),
  competition_name text,
  venue text,
  is_home boolean not null default true,
  kickoff_date date not null,
  kickoff_time time,
  meet_time time,
  pitch text,
  notes text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'completed', 'postponed', 'cancelled')),
  squad_published boolean not null default false,
  max_squad_size integer,
  match_data jsonb not null default '{}'::jsonb,
  report_id uuid references public.progress_reports (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.match_squad_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  squad_order integer not null default 0,
  role text check (role is null or role in ('captain', 'vice_captain')),
  is_goalkeeper boolean not null default false,
  is_starter boolean not null default true,
  parent_availability text not null default 'no_response'
    check (parent_availability in ('available', 'unavailable', 'running_late', 'no_response')),
  minutes_played integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, player_id)
);

create index if not exists matches_coach_kickoff_idx
  on public.matches (coach_id, kickoff_date desc);

create index if not exists matches_team_idx on public.matches (team_id);

create index if not exists match_squad_players_match_idx
  on public.match_squad_players (match_id, squad_order);

alter table public.matches enable row level security;
alter table public.match_squad_players enable row level security;

create policy "Coaches manage own matches"
  on public.matches
  for all
  using (auth.uid() = coach_id)
  with check (auth.uid() = coach_id);

create policy "Coaches manage match squads via matches"
  on public.match_squad_players
  for all
  using (
    exists (
      select 1
      from public.matches m
      where m.id = match_squad_players.match_id
        and m.coach_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.matches m
      where m.id = match_squad_players.match_id
        and m.coach_id = auth.uid()
    )
  );
