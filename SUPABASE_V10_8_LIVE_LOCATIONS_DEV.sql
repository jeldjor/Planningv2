-- Planning-GJsystems v10.8 Live Locaties
-- UITSLUITEND voor het afzonderlijke Supabase development/testproject.
-- NIET automatisch en NIET ongewijzigd uitvoeren op productie.
-- Vereist vooraf in een leeg testproject: SUPABASE_V10_7_DEV_BASELINE.sql.

begin;

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'V10.8 vereist eerst SUPABASE_V10_7_DEV_BASELINE.sql in het developmentproject.';
  end if;
  if to_regprocedure('public.is_app_admin()') is null then
    raise exception 'V10.8 vereist de bestaande centrale functie public.is_app_admin().';
  end if;
end
$$;

create extension if not exists pgcrypto;

create table if not exists public.location_system_settings (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default false,
  update_interval_minutes integer not null default 10
    check (update_interval_minutes in (5, 10, 15, 30, 60)),
  history_retention_hours integer not null default 24
    check (history_retention_hours between 1 and 168),
  enabled_at timestamptz,
  enabled_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.location_system_settings
  (id, enabled, update_interval_minutes, history_retention_hours)
values (1, false, 10, 24)
on conflict (id) do nothing;

create table if not exists public.user_location_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  admin_enabled boolean not null default false,
  route_location_enabled boolean not null default false,
  app_prompt_state text not null default 'not_asked'
    check (app_prompt_state in ('not_asked', 'deferred', 'accepted')),
  permission_state text not null default 'unknown'
    check (permission_state in (
      'unknown', 'prompt', 'granted', 'denied', 'blocked',
      'services_off', 'unavailable', 'timeout', 'revoked', 'error'
    )),
  prompted_at timestamptz,
  enabled_at timestamptz,
  disabled_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

alter table public.user_location_settings
  add column if not exists admin_enabled boolean not null default false;

create table if not exists public.user_live_locations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy double precision not null check (accuracy >= 0 and accuracy <= 100000),
  speed_mps double precision check (speed_mps is null or (speed_mps >= 0 and speed_mps <= 400)),
  heading_degrees double precision check (heading_degrees is null or (heading_degrees >= 0 and heading_degrees < 360)),
  captured_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_location_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy double precision not null check (accuracy >= 0 and accuracy <= 100000),
  speed_mps double precision check (speed_mps is null or (speed_mps >= 0 and speed_mps <= 400)),
  heading_degrees double precision check (heading_degrees is null or (heading_degrees >= 0 and heading_degrees < 360)),
  captured_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists user_location_history_user_idx
  on public.user_location_history(user_id);
create index if not exists user_location_history_captured_idx
  on public.user_location_history(captured_at desc);
create index if not exists user_location_history_user_captured_idx
  on public.user_location_history(user_id, captured_at desc);
create unique index if not exists user_location_history_point_unique_idx
  on public.user_location_history(user_id, captured_at);
create index if not exists user_live_locations_captured_idx
  on public.user_live_locations(captured_at desc);

alter table public.location_system_settings enable row level security;
alter table public.location_system_settings force row level security;
alter table public.user_location_settings enable row level security;
alter table public.user_location_settings force row level security;
alter table public.user_live_locations enable row level security;
alter table public.user_live_locations force row level security;
alter table public.user_location_history enable row level security;
alter table public.user_location_history force row level security;

alter table public.location_system_settings replica identity full;
alter table public.user_location_settings replica identity full;
alter table public.user_live_locations replica identity full;

drop policy if exists location_system_settings_read on public.location_system_settings;
create policy location_system_settings_read
  on public.location_system_settings for select to authenticated
  using (true);

drop policy if exists user_location_settings_read on public.user_location_settings;
create policy user_location_settings_read
  on public.user_location_settings for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_app_admin()));

drop policy if exists user_live_locations_read on public.user_live_locations;
create policy user_live_locations_read
  on public.user_live_locations for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_app_admin()));

drop policy if exists user_location_history_admin_read on public.user_location_history;
create policy user_location_history_admin_read
  on public.user_location_history for select to authenticated
  using ((select public.is_app_admin()));

revoke all on public.location_system_settings from public, anon, authenticated;
revoke all on public.user_location_settings from public, anon, authenticated;
revoke all on public.user_live_locations from public, anon, authenticated;
revoke all on public.user_location_history from public, anon, authenticated;
grant select on public.location_system_settings to authenticated;
grant select on public.user_location_settings to authenticated;
grant select on public.user_live_locations to authenticated;
grant select on public.user_location_history to authenticated;

create or replace function public.set_my_location_preference(
  p_route_location_enabled boolean,
  p_app_prompt_state text,
  p_permission_state text,
  p_last_error text default null
)
returns public.user_location_settings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.user_location_settings;
begin
  if v_user_id is null then raise exception 'Niet ingelogd'; end if;
  if p_app_prompt_state not in ('not_asked', 'deferred', 'accepted') then
    raise exception 'Ongeldige app-toestemmingsstatus';
  end if;
  if p_permission_state not in (
    'unknown', 'prompt', 'granted', 'denied', 'blocked',
    'services_off', 'unavailable', 'timeout', 'revoked', 'error'
  ) then raise exception 'Ongeldige browsertoestemmingsstatus'; end if;

  insert into public.user_location_settings as settings (
    user_id, route_location_enabled, app_prompt_state, permission_state,
    prompted_at, enabled_at, disabled_at, last_error, updated_at
  ) values (
    v_user_id, coalesce(p_route_location_enabled, false), p_app_prompt_state,
    p_permission_state,
    case when p_app_prompt_state <> 'not_asked' then now() else null end,
    case when coalesce(p_route_location_enabled, false) then now() else null end,
    case when not coalesce(p_route_location_enabled, false) then now() else null end,
    nullif(left(coalesce(p_last_error, ''), 1000), ''), now()
  )
  on conflict (user_id) do update set
    route_location_enabled = excluded.route_location_enabled,
    app_prompt_state = excluded.app_prompt_state,
    permission_state = excluded.permission_state,
    prompted_at = case
      when excluded.app_prompt_state <> 'not_asked'
        then coalesce(settings.prompted_at, excluded.prompted_at)
      else settings.prompted_at
    end,
    enabled_at = case
      when excluded.route_location_enabled
        then coalesce(settings.enabled_at, excluded.enabled_at)
      else settings.enabled_at
    end,
    disabled_at = case
      when not excluded.route_location_enabled then now()
      else settings.disabled_at
    end,
    last_error = excluded.last_error,
    updated_at = now()
  returning * into v_row;
  return v_row;
end
$$;

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
  if not found or not v_preference.route_location_enabled or v_preference.app_prompt_state <> 'accepted' then
    raise exception 'Routefunctionaliteit is niet ingeschakeld';
  end if;
  if not v_preference.admin_enabled then
    raise exception 'Live Locaties staat voor deze gebruiker uit';
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

create or replace function public.set_location_system_config(
  p_enabled boolean,
  p_update_interval_minutes integer
)
returns public.location_system_settings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_old_enabled boolean;
  v_row public.location_system_settings;
begin
  if v_user_id is null or not public.is_app_admin() then
    raise exception 'Alleen beheerders mogen Live Locaties wijzigen';
  end if;
  if p_update_interval_minutes not in (5, 10, 15, 30, 60) then
    raise exception 'Ongeldige updatefrequentie';
  end if;
  select enabled into v_old_enabled from public.location_system_settings where id = 1 for update;
  update public.location_system_settings set
    enabled = coalesce(p_enabled, false),
    update_interval_minutes = p_update_interval_minutes,
    history_retention_hours = 24,
    enabled_at = case
      when coalesce(p_enabled, false) and not coalesce(v_old_enabled, false) then now()
      when coalesce(p_enabled, false) then enabled_at
      else null
    end,
    enabled_by = case
      when coalesce(p_enabled, false) and not coalesce(v_old_enabled, false) then v_user_id
      when coalesce(p_enabled, false) then enabled_by
      else null
    end,
    updated_at = now(),
    updated_by = v_user_id
  where id = 1
  returning * into v_row;
  return v_row;
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
  if p_user_id is null or not exists(select 1 from public.profiles where id=p_user_id and coalesce(is_active,true)) then
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

create or replace function public.get_admin_location_history(
  p_user_id uuid,
  p_hours integer default 24
)
returns table (
  id uuid,
  user_id uuid,
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
    raise exception 'Alleen beheerders mogen locatiehistorie bekijken';
  end if;
  if p_hours not in (1, 4, 8, 24) then raise exception 'Ongeldig historiefilter'; end if;
  return query
  select h.id, h.user_id, h.latitude, h.longitude, h.accuracy,
         h.speed_mps, h.heading_degrees, h.captured_at, h.created_at
  from public.user_location_history h
  where h.user_id = p_user_id
    and h.captured_at >= now() - make_interval(hours => p_hours)
  order by h.captured_at asc, h.created_at asc;
end
$$;

create or replace function public.cleanup_location_history()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_retention integer;
  v_deleted integer;
begin
  select history_retention_hours into v_retention
  from public.location_system_settings where id = 1;
  delete from public.user_location_history
  where captured_at < now() - make_interval(hours => coalesce(v_retention, 24));
  get diagnostics v_deleted = row_count;
  return v_deleted;
end
$$;

revoke all on function public.set_my_location_preference(boolean, text, text, text) from public, anon;
revoke all on function public.save_my_live_location(double precision, double precision, double precision, timestamptz, double precision, double precision) from public, anon;
revoke all on function public.set_location_system_config(boolean, integer) from public, anon;
revoke all on function public.set_user_location_enabled(uuid, boolean) from public, anon;
revoke all on function public.get_admin_live_locations() from public, anon;
revoke all on function public.get_admin_location_history(uuid, integer) from public, anon;
revoke all on function public.cleanup_location_history() from public, anon, authenticated;

grant execute on function public.set_my_location_preference(boolean, text, text, text) to authenticated;
grant execute on function public.save_my_live_location(double precision, double precision, double precision, timestamptz, double precision, double precision) to authenticated;
grant execute on function public.set_location_system_config(boolean, integer) to authenticated;
grant execute on function public.set_user_location_enabled(uuid, boolean) to authenticated;
grant execute on function public.get_admin_live_locations() to authenticated;
grant execute on function public.get_admin_location_history(uuid, integer) to authenticated;
grant execute on function public.cleanup_location_history() to service_role;

do $$
begin
  alter publication supabase_realtime add table public.location_system_settings;
exception when duplicate_object then null;
end
$$;
do $$
begin
  alter publication supabase_realtime add table public.user_location_settings;
exception when duplicate_object then null;
end
$$;
do $$
begin
  alter publication supabase_realtime add table public.user_live_locations;
exception when duplicate_object then null;
end
$$;

commit;
