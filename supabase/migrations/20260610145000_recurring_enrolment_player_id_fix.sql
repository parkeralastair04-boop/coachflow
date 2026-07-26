-- Hotfix: resolve player_id ambiguity in create_public_recurring_enrolment return columns.

drop function if exists public.create_public_recurring_enrolment(
  uuid, text, date, text, text, text, text
);

create or replace function public.create_public_recurring_enrolment(
  p_series_id uuid,
  p_child_name text,
  p_child_date_of_birth date,
  p_parent_name text,
  p_parent_email text,
  p_parent_phone text,
  p_notes text
)
returns table (
  enrolment_id uuid,
  player_id uuid,
  coach_id uuid,
  academy_id uuid,
  title text,
  monthly_price integer,
  currency text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_series public.recurring_session_series%rowtype;
  v_player_id uuid;
  v_enrolment_id uuid;
  v_expires_at timestamptz;
  v_reserved_count integer := 0;
begin
  if p_series_id is null then
    raise exception 'series_id is required';
  end if;
  if nullif(trim(p_child_name), '') is null then
    raise exception 'child_name is required';
  end if;
  if nullif(trim(p_parent_email), '') is null then
    raise exception 'parent_email is required';
  end if;

  select *
    into v_series
    from public.recurring_session_series rss
   where rss.id = p_series_id
     and rss.is_public = true
     and rss.booking_enabled = true
     and rss.is_active = true
   for update;

  if v_series.id is null then
    raise exception 'recurring series is not available';
  end if;

  select count(*)
    into v_reserved_count
    from public.player_recurring_enrolments pre
   where pre.recurring_series_id = v_series.id
     and (
       pre.status = 'active'
       or (
         pre.status = 'pending'
         and pre.expires_at is not null
         and pre.expires_at > now()
       )
     );

  if v_reserved_count >= v_series.capacity then
    raise exception 'recurring series is full';
  end if;

  select p.id
    into v_player_id
    from public.players p
   where p.coach_id = v_series.coach_id
     and lower(p.player_name) = lower(trim(p_child_name))
     and lower(coalesce(p.parent_email, '')) = lower(trim(p_parent_email))
   order by p.created_at asc
   limit 1;

  if v_player_id is null then
    insert into public.players (
      coach_id,
      academy_id,
      player_name,
      date_of_birth,
      parent_name,
      parent_email,
      parent_phone,
      notes
    )
    values (
      v_series.coach_id,
      v_series.academy_id,
      trim(p_child_name),
      p_child_date_of_birth,
      nullif(trim(coalesce(p_parent_name, '')), ''),
      trim(p_parent_email),
      nullif(trim(coalesce(p_parent_phone, '')), ''),
      'Created from public recurring subscription'
    )
    returning id into v_player_id;
  end if;

  insert into public.player_recurring_enrolments (
    coach_id,
    academy_id,
    recurring_series_id,
    player_id,
    parent_name,
    parent_email,
    parent_phone,
    notes,
    status,
    monthly_price,
    expires_at
  )
  values (
    v_series.coach_id,
    v_series.academy_id,
    v_series.id,
    v_player_id,
    nullif(trim(coalesce(p_parent_name, '')), ''),
    trim(p_parent_email),
    nullif(trim(coalesce(p_parent_phone, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    'pending',
    v_series.monthly_price,
    now() + interval '30 minutes'
  )
  on conflict (recurring_series_id, player_id) do update
    set parent_name = excluded.parent_name,
        parent_email = excluded.parent_email,
        parent_phone = excluded.parent_phone,
        notes = excluded.notes,
        monthly_price = excluded.monthly_price,
        status = case
          when public.player_recurring_enrolments.status = 'cancelled' then 'pending'
          else public.player_recurring_enrolments.status
        end,
        expires_at = case
          when public.player_recurring_enrolments.status in ('cancelled', 'pending')
            then now() + interval '30 minutes'
          else public.player_recurring_enrolments.expires_at
        end
  returning id, expires_at into v_enrolment_id, v_expires_at;

  return query
  select
    v_enrolment_id,
    v_player_id,
    v_series.coach_id,
    v_series.academy_id,
    v_series.title,
    v_series.monthly_price,
    v_series.currency,
    v_expires_at;
end;
$$;

grant execute on function public.create_public_recurring_enrolment(
  uuid, text, date, text, text, text, text
) to anon, authenticated;
