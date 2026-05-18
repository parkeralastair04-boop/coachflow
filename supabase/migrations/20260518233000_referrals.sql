-- Referral program and viral growth tracking.

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users (id) on delete cascade,
  referred_user_id uuid references auth.users (id) on delete set null,
  referral_code text not null,
  status text not null default 'invited' check (status in ('invited', 'signed_up', 'converted')),
  reward_type text,
  reward_value integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists referrals_referrer_id_idx on public.referrals (referrer_id);
create index if not exists referrals_referred_user_id_idx on public.referrals (referred_user_id);
create index if not exists referrals_code_idx on public.referrals (referral_code);
create index if not exists referrals_status_idx on public.referrals (status);

create unique index if not exists referrals_unique_referred_user_idx
  on public.referrals (referred_user_id)
  where referred_user_id is not null;

alter table public.referrals enable row level security;

create policy "referrals_select_own" on public.referrals
  for select using (auth.uid() = referrer_id or auth.uid() = referred_user_id);

create policy "referrals_insert_own_invites" on public.referrals
  for insert with check (auth.uid() = referrer_id);

create policy "referrals_update_own" on public.referrals
  for update using (auth.uid() = referrer_id or auth.uid() = referred_user_id);

create or replace function public.attribute_referral(
  p_referral_code text,
  p_referred_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;
begin
  if nullif(trim(p_referral_code), '') is null or p_referred_user_id is null then
    return;
  end if;

  select r.referrer_id
    into v_referrer_id
    from public.referrals r
   where upper(r.referral_code) = upper(trim(p_referral_code))
   order by r.created_at asc
   limit 1;

  if v_referrer_id is null and upper(trim(p_referral_code)) like 'CF-%' then
    select u.id
      into v_referrer_id
      from auth.users u
     where upper(replace(u.id::text, '-', '')) = replace(upper(trim(p_referral_code)), 'CF-', '')
     limit 1;
  end if;

  if v_referrer_id is null or v_referrer_id = p_referred_user_id then
    return;
  end if;

  insert into public.referrals (
    referrer_id,
    referred_user_id,
    referral_code,
    status,
    reward_type,
    reward_value
  )
  values (
    v_referrer_id,
    p_referred_user_id,
    upper(trim(p_referral_code)),
    'signed_up',
    null,
    0
  )
  on conflict (referred_user_id) where referred_user_id is not null
  do update set
    status = case
      when public.referrals.status = 'converted' then 'converted'
      else 'signed_up'
    end,
    referral_code = excluded.referral_code;
end;
$$;

grant execute on function public.attribute_referral(text, uuid) to anon, authenticated;
