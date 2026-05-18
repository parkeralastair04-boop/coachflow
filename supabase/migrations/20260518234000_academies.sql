-- White label and multi-academy support.

create table if not exists public.academies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  primary_color text not null default '#10B981',
  secondary_color text not null default '#0F172A',
  custom_domain text unique,
  support_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_members (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'coach', 'assistant')),
  created_at timestamptz not null default now(),
  unique (academy_id, user_id)
);

create index if not exists academy_members_user_id_idx on public.academy_members (user_id);
create index if not exists academy_members_academy_id_idx on public.academy_members (academy_id);

alter table public.academies enable row level security;
alter table public.academy_members enable row level security;

create policy "academies_select_members" on public.academies
  for select using (
    exists (
      select 1 from public.academy_members am
      where am.academy_id = id and am.user_id = auth.uid()
    )
  );

create policy "academies_insert_authenticated" on public.academies
  for insert with check (auth.uid() is not null);

create policy "academies_update_admins" on public.academies
  for update using (
    exists (
      select 1 from public.academy_members am
      where am.academy_id = id
        and am.user_id = auth.uid()
        and am.role in ('owner', 'admin')
    )
  );

create policy "academy_members_select_academy" on public.academy_members
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.academy_members am
      where am.academy_id = academy_members.academy_id
        and am.user_id = auth.uid()
    )
  );

create policy "academy_members_insert_owner_self" on public.academy_members
  for insert with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.academy_members am
      where am.academy_id = academy_members.academy_id
        and am.user_id = auth.uid()
        and am.role in ('owner', 'admin')
    )
  );

create policy "academy_members_update_admins" on public.academy_members
  for update using (
    exists (
      select 1 from public.academy_members am
      where am.academy_id = academy_members.academy_id
        and am.user_id = auth.uid()
        and am.role in ('owner', 'admin')
    )
  );

alter table if exists public.players add column if not exists academy_id uuid references public.academies (id) on delete set null;
alter table if exists public.sessions add column if not exists academy_id uuid references public.academies (id) on delete set null;
alter table if exists public.progress_reports add column if not exists academy_id uuid references public.academies (id) on delete set null;
alter table if exists public.parent_subscriptions add column if not exists academy_id uuid references public.academies (id) on delete set null;
alter table if exists public.camps add column if not exists academy_id uuid references public.academies (id) on delete set null;
alter table if exists public.camp_enrolments add column if not exists academy_id uuid references public.academies (id) on delete set null;
alter table if exists public.bookings add column if not exists academy_id uuid references public.academies (id) on delete set null;
alter table if exists public.automations add column if not exists academy_id uuid references public.academies (id) on delete set null;

create index if not exists players_academy_id_idx on public.players (academy_id);
create index if not exists sessions_academy_id_idx on public.sessions (academy_id);
create index if not exists progress_reports_academy_id_idx on public.progress_reports (academy_id);
create index if not exists parent_subscriptions_academy_id_idx on public.parent_subscriptions (academy_id);
create index if not exists camps_academy_id_idx on public.camps (academy_id);
create index if not exists camp_enrolments_academy_id_idx on public.camp_enrolments (academy_id);
create index if not exists bookings_academy_id_idx on public.bookings (academy_id);
create index if not exists automations_academy_id_idx on public.automations (academy_id);

create or replace function public.get_public_academy_by_coach(p_coach_id uuid)
returns table (
  id uuid,
  name text,
  logo_url text,
  primary_color text,
  secondary_color text,
  custom_domain text,
  support_email text
)
language sql
security definer
set search_path = public
as $$
  select a.id, a.name, a.logo_url, a.primary_color, a.secondary_color, a.custom_domain, a.support_email
    from public.academies a
    join public.academy_members am on am.academy_id = a.id
   where am.user_id = p_coach_id
   order by am.created_at asc
   limit 1;
$$;

grant execute on function public.get_public_academy_by_coach(uuid) to anon, authenticated;
