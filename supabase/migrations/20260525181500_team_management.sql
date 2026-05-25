-- Football team and squad management.

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  academy_id uuid references public.academies (id) on delete set null,
  team_name text not null,
  age_group text,
  notes text,
  team_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teams_team_color_check
    check (team_color is null or team_color ~ '^#[0-9A-Fa-f]{6}$')
);

create index if not exists teams_coach_id_idx on public.teams (coach_id, created_at desc);
create index if not exists teams_academy_id_idx on public.teams (academy_id);

alter table public.teams enable row level security;

create policy "teams_select_own" on public.teams
  for select using (auth.uid() = coach_id);

create policy "teams_insert_own" on public.teams
  for insert with check (auth.uid() = coach_id);

create policy "teams_update_own" on public.teams
  for update using (auth.uid() = coach_id)
  with check (auth.uid() = coach_id);

create policy "teams_delete_own" on public.teams
  for delete using (auth.uid() = coach_id);

create table if not exists public.team_players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  role text
    check (role in ('captain', 'vice_captain')),
  squad_order integer not null default 1 check (squad_order >= 1),
  created_at timestamptz not null default now(),
  unique (team_id, player_id)
);

create index if not exists team_players_team_id_idx
  on public.team_players (team_id, squad_order, created_at);

create index if not exists team_players_player_id_idx
  on public.team_players (player_id);

create unique index if not exists team_players_unique_role_idx
  on public.team_players (team_id, role)
  where role is not null;

alter table public.team_players enable row level security;

create policy "team_players_select_own" on public.team_players
  for select using (
    exists (
      select 1
      from public.teams t
      where t.id = team_id
        and t.coach_id = auth.uid()
    )
    and exists (
      select 1
      from public.players p
      where p.id = player_id
        and p.coach_id = auth.uid()
    )
  );

create policy "team_players_insert_own" on public.team_players
  for insert with check (
    exists (
      select 1
      from public.teams t
      where t.id = team_id
        and t.coach_id = auth.uid()
    )
    and exists (
      select 1
      from public.players p
      where p.id = player_id
        and p.coach_id = auth.uid()
    )
  );

create policy "team_players_update_own" on public.team_players
  for update using (
    exists (
      select 1
      from public.teams t
      where t.id = team_id
        and t.coach_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.teams t
      where t.id = team_id
        and t.coach_id = auth.uid()
    )
    and exists (
      select 1
      from public.players p
      where p.id = player_id
        and p.coach_id = auth.uid()
    )
  );

create policy "team_players_delete_own" on public.team_players
  for delete using (
    exists (
      select 1
      from public.teams t
      where t.id = team_id
        and t.coach_id = auth.uid()
    )
  );

alter table public.sessions
  add column if not exists team_id uuid references public.teams (id) on delete set null;

create index if not exists sessions_team_id_idx on public.sessions (team_id);

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
    and (
      team_id is null
      or exists (
        select 1 from public.teams t
        where t.id = team_id and t.coach_id = auth.uid()
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
    and (
      team_id is null
      or exists (
        select 1 from public.teams t
        where t.id = team_id and t.coach_id = auth.uid()
      )
    )
  );
