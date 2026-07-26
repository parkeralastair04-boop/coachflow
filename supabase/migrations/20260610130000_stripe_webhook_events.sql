-- Stripe webhook idempotency and delivery audit (Phase 0.3).
-- Written by service role only; no client access.

create table if not exists public.stripe_webhook_events (
  id text primary key,
  type text not null,
  livemode boolean not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text
);

create index if not exists stripe_webhook_events_received_at_idx
  on public.stripe_webhook_events (received_at desc);

create index if not exists stripe_webhook_events_type_idx
  on public.stripe_webhook_events (type, received_at desc);

create index if not exists stripe_webhook_events_unprocessed_idx
  on public.stripe_webhook_events (received_at desc)
  where processed_at is null;

alter table public.stripe_webhook_events enable row level security;

revoke all on table public.stripe_webhook_events from anon, authenticated;

comment on table public.stripe_webhook_events is
  'Stripe webhook idempotency ledger. Inserts via service role only; no client policies.';
