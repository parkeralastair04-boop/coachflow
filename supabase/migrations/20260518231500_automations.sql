-- CRM automations and smart notifications.

create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  is_enabled boolean not null default false,
  subject text not null,
  template text not null,
  timing_offset integer not null default 0,
  created_at timestamptz not null default now(),
  unique (coach_id, type)
);

create index if not exists automations_coach_id_idx on public.automations (coach_id);
create index if not exists automations_type_idx on public.automations (type);
create index if not exists automations_enabled_idx on public.automations (is_enabled);

alter table public.automations enable row level security;

create policy "automations_select_own" on public.automations
  for select using (auth.uid() = coach_id);

create policy "automations_insert_own" on public.automations
  for insert with check (auth.uid() = coach_id);

create policy "automations_update_own" on public.automations
  for update using (auth.uid() = coach_id);

create policy "automations_delete_own" on public.automations
  for delete using (auth.uid() = coach_id);
