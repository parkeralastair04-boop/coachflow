-- Atomic coach academy bootstrap + safe multi-row replacements.
-- Prevents orphan academies (create without membership) and empty roster races.

create or replace function public.create_or_update_coach_academy(
  p_name text,
  p_support_email text default null,
  p_primary_color text default '#10B981',
  p_secondary_color text default '#0F172A'
)
returns table (
  academy_id uuid,
  academy_slug text,
  coach_slug text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_academy_id uuid;
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_support_email text := nullif(trim(coalesce(p_support_email, '')), '');
  v_primary text := coalesce(nullif(trim(coalesce(p_primary_color, '')), ''), '#10B981');
  v_secondary text := coalesce(nullif(trim(coalesce(p_secondary_color, '')), ''), '#0F172A');
  v_display_name text;
  v_academy_slug text;
  v_coach_slug text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_name is null then
    raise exception 'Academy or business name is required.';
  end if;

  select am.academy_id
    into v_academy_id
    from public.academy_members am
   where am.user_id = v_user_id
   order by am.created_at asc
   limit 1;

  if v_academy_id is null then
    insert into public.academies (
      name,
      logo_url,
      primary_color,
      secondary_color,
      support_email
    )
    values (
      v_name,
      null,
      v_primary,
      v_secondary,
      v_support_email
    )
    returning id into v_academy_id;

    insert into public.academy_members (academy_id, user_id, role)
    values (v_academy_id, v_user_id, 'owner');
  else
    update public.academies
       set name = v_name,
           support_email = coalesce(v_support_email, support_email),
           primary_color = v_primary,
           secondary_color = v_secondary,
           updated_at = now()
     where id = v_academy_id;
  end if;

  v_academy_slug := concat(
    coalesce(nullif(public.slugify_text(v_name), ''), 'academy'),
    '-',
    substr(v_academy_id::text, 1, 6)
  );

  update public.academies
     set slug = v_academy_slug,
         updated_at = now()
   where id = v_academy_id;

  v_display_name := v_name;
  v_coach_slug := concat(
    coalesce(nullif(public.slugify_text(v_display_name), ''), 'coach'),
    '-',
    substr(v_user_id::text, 1, 6)
  );

  insert into public.coach_public_profiles (
    coach_id,
    academy_id,
    slug,
    display_name,
    primary_color,
    secondary_color,
    support_email,
    booking_enabled,
    updated_at
  )
  values (
    v_user_id,
    v_academy_id,
    v_coach_slug,
    v_display_name,
    v_primary,
    v_secondary,
    v_support_email,
    true,
    now()
  )
  on conflict (coach_id) do update
    set academy_id = excluded.academy_id,
        slug = excluded.slug,
        display_name = excluded.display_name,
        primary_color = excluded.primary_color,
        secondary_color = excluded.secondary_color,
        support_email = coalesce(excluded.support_email, public.coach_public_profiles.support_email),
        booking_enabled = true,
        updated_at = now();

  return query
    select v_academy_id, v_academy_slug, v_coach_slug;
end;
$$;

revoke all on function public.create_or_update_coach_academy(text, text, text, text) from public;
grant execute on function public.create_or_update_coach_academy(text, text, text, text) to authenticated;

-- Atomic replace for session rosters (delete + insert in one transaction).
create or replace function public.replace_session_players(
  p_session_id uuid,
  p_player_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_coach_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select s.coach_id into v_coach_id
    from public.sessions s
   where s.id = p_session_id;

  if v_coach_id is null then
    raise exception 'Session not found';
  end if;

  if v_coach_id <> v_user_id then
    raise exception 'Not authorised';
  end if;

  delete from public.session_players
   where session_id = p_session_id;

  if p_player_ids is null or cardinality(p_player_ids) = 0 then
    return;
  end if;

  insert into public.session_players (session_id, player_id)
  select p_session_id, player_id
    from unnest(p_player_ids) as player_id;
end;
$$;

revoke all on function public.replace_session_players(uuid, uuid[]) from public;
grant execute on function public.replace_session_players(uuid, uuid[]) to authenticated;

-- Atomic replace for match squads (delete + insert in one transaction).
create or replace function public.replace_match_squad_players(
  p_match_id uuid,
  p_rows jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_coach_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select m.coach_id into v_coach_id
    from public.matches m
   where m.id = p_match_id;

  if v_coach_id is null then
    raise exception 'Match not found';
  end if;

  if v_coach_id <> v_user_id then
    raise exception 'Not authorised';
  end if;

  delete from public.match_squad_players
   where match_id = p_match_id;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    return;
  end if;

  insert into public.match_squad_players (
    match_id,
    player_id,
    squad_order,
    role,
    is_goalkeeper,
    is_starter,
    parent_availability,
    minutes_played
  )
  select
    p_match_id,
    (row_item ->> 'player_id')::uuid,
    coalesce((row_item ->> 'squad_order')::integer, 0),
    nullif(row_item ->> 'role', ''),
    coalesce((row_item ->> 'is_goalkeeper')::boolean, false),
    coalesce((row_item ->> 'is_starter')::boolean, true),
    coalesce(nullif(row_item ->> 'parent_availability', ''), 'no_response'),
    coalesce((row_item ->> 'minutes_played')::integer, 0)
  from jsonb_array_elements(p_rows) as row_item;
end;
$$;

revoke all on function public.replace_match_squad_players(uuid, jsonb) from public;
grant execute on function public.replace_match_squad_players(uuid, jsonb) to authenticated;

-- Expire a pending paid booking hold (capacity release) when Stripe attach fails.
create or replace function public.expire_pending_session_booking(
  p_booking_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.session_bookings
     set booking_status = 'cancelled',
         expires_at = now()
   where id = p_booking_id
     and booking_status = 'pending';
end;
$$;

revoke all on function public.expire_pending_session_booking(uuid) from public;
grant execute on function public.expire_pending_session_booking(uuid) to service_role;

create or replace function public.expire_pending_recurring_enrolment(
  p_enrolment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.player_recurring_enrolments
     set status = 'cancelled',
         expires_at = now()
   where id = p_enrolment_id
     and status = 'pending';
end;
$$;

revoke all on function public.expire_pending_recurring_enrolment(uuid) from public;
grant execute on function public.expire_pending_recurring_enrolment(uuid) to service_role;
