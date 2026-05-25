-- Group session support: session group names and many-to-many player assignment.

alter table public.sessions
  add column if not exists group_name text;

create table if not exists public.session_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (session_id, player_id)
);

create index if not exists session_players_session_id_idx
  on public.session_players (session_id);

create index if not exists session_players_player_id_idx
  on public.session_players (player_id);

alter table public.session_players enable row level security;

create policy "session_players_select_own" on public.session_players
  for select using (
    exists (
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

create policy "session_players_insert_own" on public.session_players
  for insert with check (
    exists (
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

create policy "session_players_delete_own" on public.session_players
  for delete using (
    exists (
      select 1
      from public.sessions s
      where s.id = session_id
        and s.coach_id = auth.uid()
    )
  );

insert into public.session_players (session_id, player_id)
select s.id, s.player_id
from public.sessions s
on conflict (session_id, player_id) do nothing;
