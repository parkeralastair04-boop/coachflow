-- Product feedback submissions (separate from bug reports and feature requests).

create table if not exists public.support_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  user_email text,
  category text not null
    check (category in (
      'general_feedback',
      'user_experience',
      'positive_feedback',
      'improvement_suggestion'
    )),
  rating smallint not null
    check (rating between 1 and 5),
  title text not null,
  feedback text not null,
  page text not null,
  status text not null default 'new'
    check (status in ('new', 'reviewed', 'actioned', 'archived')),
  admin_notes text
);

create index if not exists support_feedback_user_id_idx
  on public.support_feedback (user_id);

create index if not exists support_feedback_status_idx
  on public.support_feedback (status);

create index if not exists support_feedback_category_idx
  on public.support_feedback (category);

create index if not exists support_feedback_rating_idx
  on public.support_feedback (rating);

create index if not exists support_feedback_created_at_idx
  on public.support_feedback (created_at desc);

create index if not exists support_feedback_search_idx
  on public.support_feedback
  using gin (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(feedback, '')));

alter table public.support_feedback enable row level security;

create policy "support_feedback_select_own" on public.support_feedback
  for select using (auth.uid() = user_id);

create policy "support_feedback_insert_own" on public.support_feedback
  for insert with check (auth.uid() = user_id);

comment on table public.support_feedback is
  'Coach-submitted product feedback for UX, usability, and improvement insights.';
