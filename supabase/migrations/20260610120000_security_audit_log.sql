-- Cross-cutting privileged action audit log (Phase 0.3A).
-- Written by service role only; no client access.

create table if not exists public.security_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_type text not null
    check (actor_type in ('user', 'webhook', 'cron', 'admin_api', 'system', 'migration')),
  actor_id text,
  action text not null,
  resource_type text not null,
  resource_id text,
  outcome text not null
    check (outcome in ('success', 'failure', 'denied')),
  metadata jsonb not null default '{}'::jsonb,
  request_id text
);

create index if not exists security_audit_log_created_at_idx
  on public.security_audit_log (created_at desc);

create index if not exists security_audit_log_actor_type_idx
  on public.security_audit_log (actor_type, created_at desc);

create index if not exists security_audit_log_action_idx
  on public.security_audit_log (action, created_at desc);

create index if not exists security_audit_log_resource_idx
  on public.security_audit_log (resource_type, resource_id);

alter table public.security_audit_log enable row level security;

revoke all on table public.security_audit_log from anon, authenticated;

comment on table public.security_audit_log is
  'Privileged action audit trail. Inserts via service role only; no client policies.';
