-- V2-D9 Academy Contact: lightweight public enquiries

create table if not exists public.academy_enquiries (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  subject text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists academy_enquiries_academy_created_idx
  on public.academy_enquiries (academy_id, created_at desc);

alter table public.academy_enquiries enable row level security;

-- Public website submissions (no auth required)
create policy "Anyone can submit academy enquiries"
  on public.academy_enquiries
  for insert
  with check (true);

-- Academy coaches can read their academy enquiries
create policy "Academy coaches can read enquiries"
  on public.academy_enquiries
  for select
  using (
    exists (
      select 1
      from public.academy_members am
      where am.academy_id = academy_enquiries.academy_id
        and am.user_id = auth.uid()
    )
  );

-- Academy owners/admins can delete enquiries (no updates)
create policy "Academy owners can delete enquiries"
  on public.academy_enquiries
  for delete
  using (
    exists (
      select 1
      from public.academy_members am
      where am.academy_id = academy_enquiries.academy_id
        and am.user_id = auth.uid()
        and am.role in ('owner', 'admin')
    )
  );

grant insert on table public.academy_enquiries to anon, authenticated;
grant select, delete on table public.academy_enquiries to authenticated;
