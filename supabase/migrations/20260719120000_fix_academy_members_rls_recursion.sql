-- Launch Sprint 1: fix infinite recursion in academy_members RLS policies.
--
-- Root cause:
-- Policies on public.academy_members queried academy_members via EXISTS,
-- which re-entered RLS on the same relation (PostgreSQL error 42P17).
-- Policies on academies that queried academy_members then also hit the loop.
--
-- Fix:
-- SECURITY DEFINER helpers read membership without RLS recursion.
-- Policies call those helpers instead of self-referencing EXISTS.

create or replace function public.is_academy_member(p_academy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.academy_members
    where academy_id = p_academy_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_academy_admin(p_academy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.academy_members
    where academy_id = p_academy_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

revoke all on function public.is_academy_member(uuid) from public;
revoke all on function public.is_academy_admin(uuid) from public;
grant execute on function public.is_academy_member(uuid) to authenticated;
grant execute on function public.is_academy_admin(uuid) to authenticated;

-- Recreate academies policies to use helpers (avoid cascading into broken member RLS)
drop policy if exists "academies_select_members" on public.academies;
create policy "academies_select_members" on public.academies
  for select using (public.is_academy_member(id));

drop policy if exists "academies_update_admins" on public.academies;
create policy "academies_update_admins" on public.academies
  for update using (public.is_academy_admin(id));

-- Keep insert as-is (authenticated users may create an academy during onboarding)
-- academies_insert_authenticated already allows auth.uid() is not null

-- Recreate academy_members policies without self-referencing EXISTS
drop policy if exists "academy_members_select_academy" on public.academy_members;
create policy "academy_members_select_academy" on public.academy_members
  for select using (
    user_id = auth.uid()
    or public.is_academy_member(academy_id)
  );

drop policy if exists "academy_members_insert_owner_self" on public.academy_members;
create policy "academy_members_insert_owner_self" on public.academy_members
  for insert with check (
    -- First owner (and any self-membership) during onboarding
    user_id = auth.uid()
    -- Existing owners/admins inviting others
    or public.is_academy_admin(academy_id)
  );

drop policy if exists "academy_members_update_admins" on public.academy_members;
create policy "academy_members_update_admins" on public.academy_members
  for update using (public.is_academy_admin(academy_id));

-- Optional delete for owners/admins (settings UI may remove members later)
drop policy if exists "academy_members_delete_admins" on public.academy_members;
create policy "academy_members_delete_admins" on public.academy_members
  for delete using (public.is_academy_admin(academy_id));

-- Align enquiry policies with the same helpers (no direct academy_members EXISTS)
drop policy if exists "Academy coaches can read enquiries" on public.academy_enquiries;
create policy "Academy coaches can read enquiries"
  on public.academy_enquiries
  for select
  using (public.is_academy_member(academy_id));

drop policy if exists "Academy owners can delete enquiries" on public.academy_enquiries;
create policy "Academy owners can delete enquiries"
  on public.academy_enquiries
  for delete
  using (public.is_academy_admin(academy_id));
