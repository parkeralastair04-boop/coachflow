-- Beta tester complimentary access (Awarix coach accounts).
-- Flag lives on auth.users.raw_user_meta_data.is_beta_tester (boolean).
-- Revoking beta access only removes the metadata flag; player/session data is untouched.

create or replace function public.grant_beta_tester_access(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update auth.users
  set
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('is_beta_tester', true),
    updated_at = now()
  where lower(email) = lower(trim(p_email));

  if not found then
    raise exception 'No user found with email %', p_email;
  end if;
end;
$$;

create or replace function public.revoke_beta_tester_access(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update auth.users
  set
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'is_beta_tester',
    updated_at = now()
  where lower(email) = lower(trim(p_email));

  if not found then
    raise exception 'No user found with email %', p_email;
  end if;
end;
$$;

revoke all on function public.grant_beta_tester_access(text) from public;
revoke all on function public.revoke_beta_tester_access(text) from public;
grant execute on function public.grant_beta_tester_access(text) to service_role;
grant execute on function public.revoke_beta_tester_access(text) to service_role;

comment on function public.grant_beta_tester_access(text) is
  'Marks a coach account as a beta tester (complimentary Academy access). Run via Supabase SQL editor or service role.';

comment on function public.revoke_beta_tester_access(text) is
  'Removes beta tester flag without deleting account data. User reverts to normal subscription metadata.';
