-- Parent payments (Academy feature). Amount is stored in minor units (pence).

create table if not exists public.parent_subscriptions (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text unique,
  amount integer not null default 0 check (amount >= 0),
  currency text not null default 'gbp',
  interval text check (interval in ('monthly', 'weekly')),
  status text not null default 'customer_created',
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists parent_subscriptions_coach_id_idx
  on public.parent_subscriptions (coach_id);

create index if not exists parent_subscriptions_player_id_idx
  on public.parent_subscriptions (player_id);

create index if not exists parent_subscriptions_status_idx
  on public.parent_subscriptions (status);

alter table public.parent_subscriptions enable row level security;

create policy "parent_subscriptions_select_own" on public.parent_subscriptions
  for select using (auth.uid() = coach_id);

create policy "parent_subscriptions_insert_own" on public.parent_subscriptions
  for insert with check (
    auth.uid() = coach_id
    and exists (
      select 1 from public.players p
      where p.id = player_id and p.coach_id = auth.uid()
    )
  );

create policy "parent_subscriptions_update_own" on public.parent_subscriptions
  for update using (auth.uid() = coach_id);

create policy "parent_subscriptions_delete_own" on public.parent_subscriptions
  for delete using (auth.uid() = coach_id);
