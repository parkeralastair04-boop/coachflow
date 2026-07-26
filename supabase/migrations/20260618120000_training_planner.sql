-- V2-A2 Training Planner: plans, drill library, session linking

create table if not exists public.training_drills (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  academy_id uuid references public.academies (id) on delete set null,
  name text not null,
  description text,
  objectives text,
  organisation text,
  coaching_points text,
  progressions text,
  regressions text,
  equipment text[] not null default '{}',
  duration_minutes integer,
  player_numbers text,
  difficulty text not null default 'intermediate'
    check (difficulty in ('beginner', 'intermediate', 'advanced')),
  category text,
  tags text[] not null default '{}',
  development_tags text[] not null default '{}',
  is_favourite boolean not null default false,
  archived_at timestamptz,
  drill_data jsonb not null default '{}'::jsonb,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_plans (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  academy_id uuid references public.academies (id) on delete set null,
  session_id uuid references public.sessions (id) on delete set null,
  team_id uuid references public.teams (id) on delete set null,
  title text not null,
  age_group text,
  theme text,
  objectives text,
  duration_minutes integer,
  difficulty text not null default 'intermediate'
    check (difficulty in ('beginner', 'intermediate', 'advanced')),
  equipment text[] not null default '{}',
  coach_notes text,
  expected_outcomes text,
  tags text[] not null default '{}',
  development_focus text[] not null default '{}',
  match_objective text,
  is_favourite boolean not null default false,
  archived_at timestamptz,
  parent_visible boolean not null default false,
  parent_message text,
  parent_equipment_note text,
  parent_preparation_note text,
  plan_data jsonb not null default '{}'::jsonb,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sessions
  add column if not exists training_plan_id uuid references public.training_plans (id) on delete set null;

create index if not exists training_drills_coach_idx
  on public.training_drills (coach_id, archived_at nulls first);

create index if not exists training_plans_coach_idx
  on public.training_plans (coach_id, archived_at nulls first);

create index if not exists training_plans_session_idx on public.training_plans (session_id);

create index if not exists sessions_training_plan_idx on public.sessions (training_plan_id);

alter table public.training_drills enable row level security;
alter table public.training_plans enable row level security;

create policy "Coaches manage own training drills"
  on public.training_drills
  for all
  using (auth.uid() = coach_id)
  with check (auth.uid() = coach_id);

create policy "Coaches manage own training plans"
  on public.training_plans
  for all
  using (auth.uid() = coach_id)
  with check (auth.uid() = coach_id);
