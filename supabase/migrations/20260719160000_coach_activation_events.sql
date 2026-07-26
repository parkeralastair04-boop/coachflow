-- Activation funnel events for coach first-run analytics.
create table if not exists public.coach_activation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists coach_activation_events_user_id_created_at_idx
  on public.coach_activation_events (user_id, created_at desc);

create index if not exists coach_activation_events_event_created_at_idx
  on public.coach_activation_events (event, created_at desc);

alter table public.coach_activation_events enable row level security;

drop policy if exists "Users can insert own activation events" on public.coach_activation_events;
create policy "Users can insert own activation events"
  on public.coach_activation_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own activation events" on public.coach_activation_events;
create policy "Users can read own activation events"
  on public.coach_activation_events
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke all on public.coach_activation_events from anon;
grant select, insert on public.coach_activation_events to authenticated;
grant all on public.coach_activation_events to service_role;

comment on table public.coach_activation_events is
  'Coach activation funnel events (signup, academy, session, booking link, first booking).';
