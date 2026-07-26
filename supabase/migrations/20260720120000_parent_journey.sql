-- Launch Sprint 9: parent claim tokens, report visibility, journey analytics

-- ---------------------------------------------------------------------------
-- Progress reports: intentional parent sharing
-- Existing rows stay visible so current families are not blanked overnight.
-- New reports default to hidden until the coach shares or emails them.
-- ---------------------------------------------------------------------------
alter table if exists public.progress_reports
  add column if not exists parent_visible boolean not null default false;

update public.progress_reports
set parent_visible = true
where parent_visible = false;

alter table if exists public.progress_reports
  alter column parent_visible set default false;

create index if not exists progress_reports_parent_visible_idx
  on public.progress_reports (player_id, parent_visible)
  where parent_visible = true;

comment on column public.progress_reports.parent_visible is
  'When true, the linked parent may view this report in the family portal.';

-- ---------------------------------------------------------------------------
-- Secure account claim invites (email ownership via one-time token)
-- ---------------------------------------------------------------------------
create table if not exists public.parent_account_claims (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by_user_id uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  player_id uuid references public.players (id) on delete set null,
  booking_id uuid,
  enrolment_id uuid,
  child_name text,
  academy_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists parent_account_claims_email_created_at_idx
  on public.parent_account_claims (email, created_at desc);

create index if not exists parent_account_claims_expires_at_idx
  on public.parent_account_claims (expires_at)
  where used_at is null and revoked_at is null;

alter table public.parent_account_claims enable row level security;

revoke all on public.parent_account_claims from anon, authenticated;
grant all on public.parent_account_claims to service_role;

comment on table public.parent_account_claims is
  'One-time parent account claim tokens. Service role only; never expose raw tokens in DB.';

-- ---------------------------------------------------------------------------
-- Parent journey analytics (family funnel)
-- ---------------------------------------------------------------------------
create table if not exists public.parent_journey_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text,
  event text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists parent_journey_events_user_id_created_at_idx
  on public.parent_journey_events (user_id, created_at desc);

create index if not exists parent_journey_events_event_created_at_idx
  on public.parent_journey_events (event, created_at desc);

create index if not exists parent_journey_events_email_created_at_idx
  on public.parent_journey_events (email, created_at desc);

alter table public.parent_journey_events enable row level security;

drop policy if exists "Parents can insert own journey events" on public.parent_journey_events;
create policy "Parents can insert own journey events"
  on public.parent_journey_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Parents can read own journey events" on public.parent_journey_events;
create policy "Parents can read own journey events"
  on public.parent_journey_events
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke all on public.parent_journey_events from anon;
grant select, insert on public.parent_journey_events to authenticated;
grant all on public.parent_journey_events to service_role;

comment on table public.parent_journey_events is
  'Parent funnel events: claim, login, report opened, booking/payment completed, etc.';
