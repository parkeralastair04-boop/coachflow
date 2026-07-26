-- V2-C1 Video Analysis: video library, clips, player linking

create table if not exists public.video_assets (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  academy_id uuid references public.academies (id) on delete set null,
  title text not null,
  video_date date not null default current_date,
  source_url text,
  storage_path text,
  duration_seconds integer,
  match_id uuid references public.matches (id) on delete set null,
  session_id uuid references public.sessions (id) on delete set null,
  training_plan_id uuid references public.training_plans (id) on delete set null,
  team_id uuid references public.teams (id) on delete set null,
  tags text[] not null default '{}',
  notes text,
  is_favourite boolean not null default false,
  archived_at timestamptz,
  asset_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.video_clips (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  academy_id uuid references public.academies (id) on delete set null,
  video_asset_id uuid references public.video_assets (id) on delete cascade,
  title text not null,
  start_seconds integer not null default 0 check (start_seconds >= 0),
  end_seconds integer check (end_seconds is null or end_seconds >= start_seconds),
  category text not null default 'other'
    check (category in (
      'goal', 'assist', 'card', 'build_up', 'defensive',
      'set_piece', 'transition', 'training', 'other'
    )),
  description text,
  coaching_point text,
  development_tags text[] not null default '{}',
  match_id uuid references public.matches (id) on delete set null,
  session_id uuid references public.sessions (id) on delete set null,
  training_plan_id uuid references public.training_plans (id) on delete set null,
  drill_id uuid references public.training_drills (id) on delete set null,
  report_id uuid references public.progress_reports (id) on delete set null,
  team_tags text[] not null default '{}',
  notes text,
  is_favourite boolean not null default false,
  reviewed_at timestamptz,
  parent_visible boolean not null default false,
  parent_comment text,
  ai_summary text,
  archived_at timestamptz,
  clip_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.video_clip_players (
  id uuid primary key default gen_random_uuid(),
  clip_id uuid not null references public.video_clips (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  role text not null default 'subject'
    check (role in ('subject', 'mentioned')),
  created_at timestamptz not null default now(),
  unique (clip_id, player_id)
);

create index if not exists video_assets_coach_idx
  on public.video_assets (coach_id, archived_at nulls first);

create index if not exists video_clips_coach_idx
  on public.video_clips (coach_id, archived_at nulls first);

create index if not exists video_clips_asset_idx on public.video_clips (video_asset_id);
create index if not exists video_clips_match_idx on public.video_clips (match_id);
create index if not exists video_clips_plan_idx on public.video_clips (training_plan_id);
create index if not exists video_clip_players_player_idx on public.video_clip_players (player_id);
create index if not exists video_clip_players_clip_idx on public.video_clip_players (clip_id);

alter table public.video_assets enable row level security;
alter table public.video_clips enable row level security;
alter table public.video_clip_players enable row level security;

create policy "Coaches manage own video assets"
  on public.video_assets for all
  using (auth.uid() = coach_id) with check (auth.uid() = coach_id);

create policy "Coaches manage own video clips"
  on public.video_clips for all
  using (auth.uid() = coach_id) with check (auth.uid() = coach_id);

create policy "Coaches manage own video clip players"
  on public.video_clip_players for all
  using (
    exists (
      select 1 from public.video_clips c
      where c.id = clip_id and c.coach_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.video_clips c
      where c.id = clip_id and c.coach_id = auth.uid()
    )
  );
