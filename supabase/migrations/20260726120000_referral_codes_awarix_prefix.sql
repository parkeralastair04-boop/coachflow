-- Accept Awarix referral codes (AX-*) while keeping legacy CF-* resolution.
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
  v_code text := upper(trim(p_referral_code));
  v_user_key text;
begin
  if nullif(v_code, '') is null or p_referred_user_id is null then
    return;
  end if;

  select r.referrer_id
    into v_referrer_id
    from public.referrals r
   where upper(r.referral_code) = v_code
   order by r.created_at asc
   limit 1;

  if v_referrer_id is null and (v_code like 'AX-%' or v_code like 'CF-%') then
    v_user_key := replace(replace(v_code, 'AX-', ''), 'CF-', '');
    select u.id
      into v_referrer_id
      from auth.users u
     where upper(replace(u.id::text, '-', '')) = v_user_key
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
    v_code,
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
