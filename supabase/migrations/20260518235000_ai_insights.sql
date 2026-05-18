-- Saved AI business insight snapshots.

create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  academy_id uuid references public.academies (id) on delete set null,
  insights jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_insights_coach_id_idx on public.ai_insights (coach_id);
create index if not exists ai_insights_academy_id_idx on public.ai_insights (academy_id);
create index if not exists ai_insights_created_at_idx on public.ai_insights (created_at desc);

alter table public.ai_insights enable row level security;

create policy "ai_insights_select_own" on public.ai_insights
  for select using (auth.uid() = coach_id);

create policy "ai_insights_insert_own" on public.ai_insights
  for insert with check (auth.uid() = coach_id);

create policy "ai_insights_delete_own" on public.ai_insights
  for delete using (auth.uid() = coach_id);
