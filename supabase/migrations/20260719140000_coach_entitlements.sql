-- Server-owned Awarix SaaS entitlements.
-- Clients may SELECT their own row; only service_role may write (RLS: no write policies).

create table if not exists public.coach_entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan_id text not null
    check (plan_id in ('starter', 'pro', 'academy')),
  status text not null
    check (status in ('trialing', 'active', 'inactive', 'past_due', 'canceled')),
  trial_ends_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  source text not null default 'stripe'
    check (source in ('stripe', 'complimentary')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists coach_entitlements_stripe_customer_id_idx
  on public.coach_entitlements (stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists coach_entitlements_stripe_subscription_id_idx
  on public.coach_entitlements (stripe_subscription_id)
  where stripe_subscription_id is not null;

alter table public.coach_entitlements enable row level security;

drop policy if exists "Users can read own coach entitlements" on public.coach_entitlements;
create policy "Users can read own coach entitlements"
  on public.coach_entitlements
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke all on public.coach_entitlements from anon;
grant select on public.coach_entitlements to authenticated;
grant all on public.coach_entitlements to service_role;

comment on table public.coach_entitlements is
  'Trusted Awarix SaaS entitlements. Written only by Stripe webhooks / admin service role. Never trust user_metadata for plan access.';
