-- V2-D8 Academy News: lightweight coach-managed website posts

create table if not exists public.academy_news (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  coach_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  slug text not null,
  summary text not null default '',
  content text not null default '',
  cover_image_url text,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academy_id, slug)
);

create index if not exists academy_news_coach_idx
  on public.academy_news (coach_id, updated_at desc);

create index if not exists academy_news_public_idx
  on public.academy_news (academy_id, published, published_at desc)
  where published = true;

alter table public.academy_news enable row level security;

create policy "Coaches manage own academy news"
  on public.academy_news for all
  using (auth.uid() = coach_id)
  with check (auth.uid() = coach_id);
