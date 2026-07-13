-- Planning-GJsystems v10.8.1 correctie: Live Locaties per gebruiker
-- UITSLUITEND uitvoeren in het afzonderlijke v10.8 development/testproject.
-- NIET uitvoeren op productie.
-- Vereist dat SUPABASE_V10_8_LIVE_LOCATIONS_DEV.sql eerder is uitgevoerd.

begin;

do $$
begin
  if to_regclass('public.user_location_settings') is null then
    raise exception 'Voer eerst SUPABASE_V10_8_LIVE_LOCATIONS_DEV.sql uit in het developmentproject.';
  end if;
end
$$;

alter table public.user_location_settings
  add column if not exists admin_enabled boolean not null default false;

create or replace function public.save_my_live_location(
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy double precision,
  p_captured_at timestamptz,
  p_speed_mps double precision default null,
  p_heading_degrees double precision default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_system public.location_system_settings;
  v_preference public.user_location_settings;
  v_history_id uuid;
begin
  if v_user_id is null then raise exception 'Niet ingelogd'; end if;
  select * into v_system from public.location_system_settings where id = 1;
  if not coalesce(v_system.enabled, false) then
    raise exception 'Live Locaties staat centraal uit';
  end if;
  select * into v_preference from public.user_location_settings where user_id = v_user_id;
  if not found or not v_preference.admin_enabled then
    raise exception 'Live Locaties staat voor deze gebruiker uit';
  end if;
  if not v_preference.route_location_enabled or v_preference.app_prompt_state <> 'accepted' then
    raise exception 'Routefunctionaliteit is niet door de gebruiker toegestaan';
  end if;
  if p_latitude is null or p_latitude not between -90 and 90
     or p_longitude is null or p_longitude not between -180 and 180 then
    raise exception 'Ongeldige coördinaten';
  end if;
  if p_accuracy is null or p_accuracy < 0 or p_accuracy > 100000 then
    raise exception 'Ongeldige nauwkeurigheid';
  end if;
  if p_captured_at is null or p_captured_at < now() - interval '24 hours'
     or p_captured_at > now() + interval '5 minutes' then
    raise exception 'Ongeldig meettijdstip';
  end if;
  if p_speed_mps is not null and (p_speed_mps < 0 or p_speed_mps > 400) then
    raise exception 'Ongeldige snelheid';
  end if;
  if p_heading_degrees is not null and (p_heading_degrees < 0 or p_heading_degrees >= 360) then
    raise exception 'Ongeldige richting';
  end if;

  insert into public.user_live_locations as live (
    user_id, latitude, longitude, accuracy, speed_mps, heading_degrees,
    captured_at, updated_at
  ) values (
    v_user_id, p_latitude, p_longitude, p_accuracy, p_speed_mps,
    p_heading_degrees, p_captured_at, now()
  )
  on conflict (user_id) do update set
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    accuracy = excluded.accuracy,
    speed_mps = excluded.speed_mps,
    heading_degrees = excluded.heading_degrees,
    captured_at = excluded.captured_at,
    updated_at = now()
  where excluded.captured_at >= live.captured_at;

  insert into public.user_location_history (
    user_id, latitude, longitude, accuracy, speed_mps, heading_degrees,
    captured_at, created_at
  ) values (
    v_user_id, p_latitude, p_longitude, p_accuracy, p_speed_mps,
    p_heading_degrees, p_captured_at, now()
  )
  on conflict (user_id, captured_at) do nothing
  returning id into v_history_id;

  update public.user_location_settings set
    permission_state = 'granted', last_error = null, updated_at = now()
  where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'user_id', v_user_id,
    'captured_at', p_captured_at,
    'received_at', now(),
    'history_id', v_history_id
  );
end
$$;

create or replace function public.set_user_location_enabled(
  p_user_id uuid,
  p_enabled boolean
)
returns public.user_location_settings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.user_location_settings;
begin
  if (select auth.uid()) is null or not public.is_app_admin() then
    raise exception 'Alleen beheerders mogen Live Locaties per gebruiker wijzigen';
  end if;
  if p_user_id is null or not exists(
    select 1 from public.profiles where id=p_user_id and coalesce(is_active,true)
  ) then
    raise exception 'Gebruiker bestaat niet of is uitgeschakeld';
  end if;

  insert into public.user_location_settings as settings (
    user_id, admin_enabled, route_location_enabled, app_prompt_state,
    permission_state, disabled_at, updated_at
  ) values (
    p_user_id, coalesce(p_enabled,false), false, 'not_asked',
    'unknown', case when not coalesce(p_enabled,false) then now() else null end, now()
  )
  on conflict(user_id) do update set
    admin_enabled = excluded.admin_enabled,
    route_location_enabled = case when excluded.admin_enabled then settings.route_location_enabled else false end,
    app_prompt_state = case
      when excluded.admin_enabled and not settings.admin_enabled then 'not_asked'
      else settings.app_prompt_state
    end,
    permission_state = case
      when excluded.admin_enabled and not settings.admin_enabled then 'unknown'
      else settings.permission_state
    end,
    disabled_at = case when not excluded.admin_enabled then now() else settings.disabled_at end,
    last_error = null,
    updated_at = now()
  returning * into v_row;
  return v_row;
end
$$;

drop function if exists public.get_admin_live_locations();
create function public.get_admin_live_locations()
returns table (
  user_id uuid,
  full_name text,
  email text,
  avatar_url text,
  is_active boolean,
  admin_enabled boolean,
  route_location_enabled boolean,
  app_prompt_state text,
  permission_state text,
  prompted_at timestamptz,
  last_error text,
  latitude double precision,
  longitude double precision,
  accuracy double precision,
  speed_mps double precision,
  heading_degrees double precision,
  captured_at timestamptz,
  received_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select auth.uid()) is null or not public.is_app_admin() then
    raise exception 'Alleen beheerders mogen locatiegegevens bekijken';
  end if;
  return query
  select
    p.id,
    coalesce(nullif(p.full_name, ''), nullif(concat_ws(' ', p.first_name, p.last_name), ''), p.email),
    p.email,
    p.avatar_url,
    coalesce(p.is_active, true),
    coalesce(s.admin_enabled, false),
    coalesce(s.route_location_enabled, false),
    coalesce(s.app_prompt_state, 'not_asked'),
    coalesce(s.permission_state, 'unknown'),
    s.prompted_at,
    s.last_error,
    l.latitude,
    l.longitude,
    l.accuracy,
    l.speed_mps,
    l.heading_degrees,
    l.captured_at,
    l.updated_at
  from public.profiles p
  left join public.user_location_settings s on s.user_id = p.id
  left join public.user_live_locations l on l.user_id = p.id
  order by coalesce(l.updated_at, '-infinity'::timestamptz) desc,
           coalesce(nullif(p.full_name, ''), p.email);
end
$$;

revoke all on function public.save_my_live_location(double precision, double precision, double precision, timestamptz, double precision, double precision) from public, anon;
revoke all on function public.set_user_location_enabled(uuid, boolean) from public, anon;
revoke all on function public.get_admin_live_locations() from public, anon;

grant execute on function public.save_my_live_location(double precision, double precision, double precision, timestamptz, double precision, double precision) to authenticated;
grant execute on function public.set_user_location_enabled(uuid, boolean) to authenticated;
grant execute on function public.get_admin_live_locations() to authenticated;

commit;
