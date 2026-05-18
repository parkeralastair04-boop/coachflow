-- Native push notification device tokens and coach preferences.

create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  token text not null,
  created_at timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists device_tokens_user_id_idx on public.device_tokens (user_id);
create index if not exists device_tokens_platform_idx on public.device_tokens (platform);

alter table public.device_tokens enable row level security;

create policy "device_tokens_select_own" on public.device_tokens
  for select using (auth.uid() = user_id);

create policy "device_tokens_insert_own" on public.device_tokens
  for insert with check (auth.uid() = user_id);

create policy "device_tokens_update_own" on public.device_tokens
  for update using (auth.uid() = user_id);

create policy "device_tokens_delete_own" on public.device_tokens
  for delete using (auth.uid() = user_id);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  upcoming_sessions boolean not null default true,
  new_bookings boolean not null default true,
  payment_failures boolean not null default true,
  camp_enrolments boolean not null default true,
  ai_report_completed boolean not null default true,
  referral_conversions boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.notification_preferences enable row level security;

create policy "notification_preferences_select_own" on public.notification_preferences
  for select using (auth.uid() = user_id);

create policy "notification_preferences_insert_own" on public.notification_preferences
  for insert with check (auth.uid() = user_id);

create policy "notification_preferences_update_own" on public.notification_preferences
  for update using (auth.uid() = user_id);
