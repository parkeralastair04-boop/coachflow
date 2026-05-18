-- Camps (Academy feature). Run in Supabase SQL editor or via CLI.
-- Enrolments table powers "current enrolments" and "waiting list" counts on each camp.

create table if not exists public.camps (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  start_date date not null,
  end_date date not null,
  start_time time not null,
  end_time time not null,
  age_group text,
  capacity integer not null check (capacity >= 0),
  price numeric(10, 2) not null default 0 check (price >= 0),
  location text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists camps_coach_id_idx on public.camps (coach_id);
create index if not exists camps_start_date_idx on public.camps (start_date desc);

alter table public.camps enable row level security;

create policy "camps_select_own" on public.camps
  for select using (auth.uid() = coach_id);

create policy "camps_insert_own" on public.camps
  for insert with check (auth.uid() = coach_id);

create policy "camps_update_own" on public.camps
  for update using (auth.uid() = coach_id);

create policy "camps_delete_own" on public.camps
  for delete using (auth.uid() = coach_id);

-- One row per signup; status distinguishes confirmed place vs waitlist.
create table if not exists public.camp_enrolments (
  id uuid primary key default gen_random_uuid(),
  camp_id uuid not null references public.camps (id) on delete cascade,
  coach_id uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('enrolled', 'waitlist')),
  created_at timestamptz not null default now()
);

create index if not exists camp_enrolments_camp_id_idx on public.camp_enrolments (camp_id);
create index if not exists camp_enrolments_coach_id_idx on public.camp_enrolments (coach_id);

alter table public.camp_enrolments enable row level security;

create policy "camp_enrolments_select_own" on public.camp_enrolments
  for select using (auth.uid() = coach_id);

create policy "camp_enrolments_insert_own" on public.camp_enrolments
  for insert with check (
    auth.uid() = coach_id
    and exists (
      select 1 from public.camps c
      where c.id = camp_id and c.coach_id = auth.uid()
    )
  );

create policy "camp_enrolments_delete_own" on public.camp_enrolments
  for delete using (auth.uid() = coach_id);
