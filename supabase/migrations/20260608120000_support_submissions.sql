-- Help & Support Centre submissions (admin-reviewable).

create table if not exists public.support_bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  user_email text,
  title text not null,
  description text not null,
  page_feature text not null,
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'critical')),
  status text not null default 'submitted'
    check (status in ('submitted', 'triaged', 'in_progress', 'resolved', 'closed')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists support_bug_reports_user_id_idx
  on public.support_bug_reports (user_id);

create index if not exists support_bug_reports_status_idx
  on public.support_bug_reports (status);

create index if not exists support_bug_reports_priority_idx
  on public.support_bug_reports (priority);

create index if not exists support_bug_reports_created_at_idx
  on public.support_bug_reports (created_at desc);

alter table public.support_bug_reports enable row level security;

create policy "support_bug_reports_select_own" on public.support_bug_reports
  for select using (auth.uid() = user_id);

create policy "support_bug_reports_insert_own" on public.support_bug_reports
  for insert with check (auth.uid() = user_id);

create table if not exists public.support_feature_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  user_email text,
  feature_name text not null,
  description text not null,
  benefit text not null,
  status text not null default 'submitted'
    check (status in ('submitted', 'reviewing', 'planned', 'shipped', 'declined')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists support_feature_requests_user_id_idx
  on public.support_feature_requests (user_id);

create index if not exists support_feature_requests_status_idx
  on public.support_feature_requests (status);

create index if not exists support_feature_requests_created_at_idx
  on public.support_feature_requests (created_at desc);

alter table public.support_feature_requests enable row level security;

create policy "support_feature_requests_select_own" on public.support_feature_requests
  for select using (auth.uid() = user_id);

create policy "support_feature_requests_insert_own" on public.support_feature_requests
  for insert with check (auth.uid() = user_id);

comment on table public.support_bug_reports is
  'Coach-submitted bug reports for future admin triage dashboards.';

comment on table public.support_feature_requests is
  'Coach-submitted feature requests for future admin review dashboards.';
