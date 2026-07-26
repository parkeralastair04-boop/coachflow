-- Parent self-service payload stored per player (family data synced across siblings by parent email in app layer).

alter table public.players
  add column if not exists parent_self_service jsonb not null default '{}'::jsonb;

create index if not exists players_parent_self_service_idx
  on public.players using gin (parent_self_service);
