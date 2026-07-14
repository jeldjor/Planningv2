-- Planning-GJsystems v11.1.0
-- Veilige, idempotente productiemigratie voor Live Locaties en 30 minuten live volgen.
-- Eén keer uitvoeren in Supabase > SQL Editor, ingelogd als projecteigenaar.

begin;

do $$
begin
  if to_regclass('public.profiles') is null or to_regprocedure('public.is_app_admin()') is null then
    raise exception 'De centrale Planning-GJsystems-baseline ontbreekt.';
  end if;
end
$$;

create extension if not exists pgcrypto;

create table if not exists public.location_system_settings (
  id smallint primary key default 1 check(id=1),
  enabled boolean not null default false,
  update_interval_minutes integer not null default 10 check(update_interval_minutes in(5,10,15,30,60)),
  history_retention_hours integer not null default 24 check(history_retention_hours between 1 and 168),
  enabled_at timestamptz,
  enabled_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.location_system_settings(id) values(1) on conflict(id) do nothing;

create table if not exists public.user_location_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  admin_enabled boolean not null default false,
  route_location_enabled boolean not null default false,
  app_prompt_state text not null default 'not_asked' check(app_prompt_state in('not_asked','deferred','accepted')),
  permission_state text not null default 'unknown' check(permission_state in('unknown','prompt','granted','denied','blocked','services_off','unavailable','timeout','revoked','error')),
  prompted_at timestamptz,
  enabled_at timestamptz,
  disabled_at timestamptz,
  last_error text,
  tracking_until timestamptz,
  tracking_requested_at timestamptz,
  tracking_requested_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.user_location_settings add column if not exists admin_enabled boolean not null default false;
alter table public.user_location_settings add column if not exists tracking_until timestamptz;
alter table public.user_location_settings add column if not exists tracking_requested_at timestamptz;
alter table public.user_location_settings add column if not exists tracking_requested_by uuid references auth.users(id) on delete set null;

create table if not exists public.user_live_locations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  latitude double precision not null check(latitude between -90 and 90),
  longitude double precision not null check(longitude between -180 and 180),
  accuracy double precision not null check(accuracy between 0 and 100000),
  speed_mps double precision check(speed_mps is null or speed_mps between 0 and 400),
  heading_degrees double precision check(heading_degrees is null or heading_degrees>=0 and heading_degrees<360),
  captured_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_location_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  latitude double precision not null check(latitude between -90 and 90),
  longitude double precision not null check(longitude between -180 and 180),
  accuracy double precision not null check(accuracy between 0 and 100000),
  speed_mps double precision,
  heading_degrees double precision,
  captured_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(user_id,captured_at)
);
create index if not exists user_location_history_user_captured_idx on public.user_location_history(user_id,captured_at desc);

alter table public.location_system_settings enable row level security;
alter table public.user_location_settings enable row level security;
alter table public.user_live_locations enable row level security;
alter table public.user_location_history enable row level security;

drop policy if exists location_system_settings_read on public.location_system_settings;
create policy location_system_settings_read on public.location_system_settings for select to authenticated using(true);
drop policy if exists user_location_settings_read on public.user_location_settings;
create policy user_location_settings_read on public.user_location_settings for select to authenticated
using(user_id=(select auth.uid()) or (select public.is_app_admin()));
drop policy if exists user_live_locations_read on public.user_live_locations;
create policy user_live_locations_read on public.user_live_locations for select to authenticated
using(user_id=(select auth.uid()) or (select public.is_app_admin()));
drop policy if exists user_location_history_admin_read on public.user_location_history;
create policy user_location_history_admin_read on public.user_location_history for select to authenticated
using((select public.is_app_admin()));

revoke all on public.location_system_settings,public.user_location_settings,public.user_live_locations,public.user_location_history from public,anon,authenticated;
grant select on public.location_system_settings,public.user_location_settings,public.user_live_locations,public.user_location_history to authenticated;

create or replace function public.set_my_location_preference(
  p_route_location_enabled boolean,p_app_prompt_state text,p_permission_state text,p_last_error text default null
) returns public.user_location_settings language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=(select auth.uid()); result public.user_location_settings;
begin
  if uid is null then raise exception 'Niet ingelogd'; end if;
  if p_app_prompt_state not in('not_asked','deferred','accepted') then raise exception 'Ongeldige toestemmingsstatus'; end if;
  if p_permission_state not in('unknown','prompt','granted','denied','blocked','services_off','unavailable','timeout','revoked','error') then raise exception 'Ongeldige browserstatus'; end if;
  insert into public.user_location_settings as s(user_id,route_location_enabled,app_prompt_state,permission_state,prompted_at,enabled_at,disabled_at,last_error,updated_at)
  values(uid,coalesce(p_route_location_enabled,false),p_app_prompt_state,p_permission_state,case when p_app_prompt_state<>'not_asked' then now() end,case when p_route_location_enabled then now() end,case when not p_route_location_enabled then now() end,nullif(left(coalesce(p_last_error,''),1000),''),now())
  on conflict(user_id) do update set route_location_enabled=excluded.route_location_enabled,app_prompt_state=excluded.app_prompt_state,permission_state=excluded.permission_state,prompted_at=coalesce(s.prompted_at,excluded.prompted_at),enabled_at=case when excluded.route_location_enabled then coalesce(s.enabled_at,now()) else s.enabled_at end,disabled_at=case when not excluded.route_location_enabled then now() else s.disabled_at end,last_error=excluded.last_error,updated_at=now()
  returning * into result; return result;
end $$;

create or replace function public.save_my_live_location(
 p_latitude double precision,p_longitude double precision,p_accuracy double precision,p_captured_at timestamptz,
 p_speed_mps double precision default null,p_heading_degrees double precision default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=(select auth.uid()); config public.location_system_settings; preference public.user_location_settings; history_id uuid;
begin
 if uid is null then raise exception 'Niet ingelogd'; end if;
 if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 or p_accuracy not between 0 and 100000 then raise exception 'Ongeldige locatie'; end if;
 if p_captured_at is null or p_captured_at>now()+interval '5 minutes' or p_captured_at<now()-interval '24 hours' then raise exception 'Ongeldig meetmoment'; end if;
 select * into config from public.location_system_settings where id=1;
 select * into preference from public.user_location_settings where user_id=uid;
 if not coalesce(config.enabled,false) or not coalesce(preference.admin_enabled,false) or not coalesce(preference.route_location_enabled,false) or preference.app_prompt_state<>'accepted' then raise exception 'Live Locaties is niet actief'; end if;
 insert into public.user_live_locations as live(user_id,latitude,longitude,accuracy,speed_mps,heading_degrees,captured_at,updated_at)
 values(uid,p_latitude,p_longitude,p_accuracy,p_speed_mps,p_heading_degrees,p_captured_at,now())
 on conflict(user_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,accuracy=excluded.accuracy,speed_mps=excluded.speed_mps,heading_degrees=excluded.heading_degrees,captured_at=excluded.captured_at,updated_at=now()
 where excluded.captured_at>=live.captured_at;
 insert into public.user_location_history(user_id,latitude,longitude,accuracy,speed_mps,heading_degrees,captured_at)
 values(uid,p_latitude,p_longitude,p_accuracy,p_speed_mps,p_heading_degrees,p_captured_at)
 on conflict(user_id,captured_at) do nothing returning id into history_id;
 update public.user_location_settings set permission_state='granted',last_error=null,updated_at=now() where user_id=uid;
 return jsonb_build_object('saved',true,'history_id',history_id,'received_at',now());
end $$;

create or replace function public.set_location_system_config(p_enabled boolean,p_update_interval_minutes integer)
returns public.location_system_settings language plpgsql security definer set search_path=public,pg_temp as $$
declare result public.location_system_settings;
begin
 if (select auth.uid()) is null or not (select public.is_app_admin()) then raise exception 'Alleen beheerders'; end if;
 if p_update_interval_minutes not in(5,10,15,30,60) then raise exception 'Ongeldig interval'; end if;
 update public.location_system_settings set enabled=coalesce(p_enabled,false),update_interval_minutes=p_update_interval_minutes,enabled_at=case when p_enabled then coalesce(enabled_at,now()) else enabled_at end,enabled_by=case when p_enabled then (select auth.uid()) else enabled_by end,updated_at=now(),updated_by=(select auth.uid()) where id=1 returning * into result;
 return result;
end $$;

create or replace function public.set_user_location_enabled(p_user_id uuid,p_enabled boolean)
returns public.user_location_settings language plpgsql security definer set search_path=public,pg_temp as $$
declare result public.user_location_settings;
begin
 if (select auth.uid()) is null or not (select public.is_app_admin()) then raise exception 'Alleen beheerders'; end if;
 if not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'Gebruiker niet gevonden'; end if;
 insert into public.user_location_settings as s(user_id,admin_enabled,updated_at) values(p_user_id,coalesce(p_enabled,false),now())
 on conflict(user_id) do update set admin_enabled=excluded.admin_enabled,route_location_enabled=case when excluded.admin_enabled then s.route_location_enabled else false end,tracking_until=case when excluded.admin_enabled then s.tracking_until else null end,last_error=null,updated_at=now()
 returning * into result; return result;
end $$;

create or replace function public.set_user_live_tracking(p_user_id uuid,p_enabled boolean,p_minutes integer default 30)
returns public.user_location_settings language plpgsql security definer set search_path=public,pg_temp as $$
declare result public.user_location_settings;
begin
 if (select auth.uid()) is null or not (select public.is_app_admin()) then raise exception 'Alleen beheerders'; end if;
 if p_minutes not between 1 and 30 then raise exception 'Live volgen duurt maximaal 30 minuten'; end if;
 update public.user_location_settings set tracking_until=case when p_enabled then now()+make_interval(mins=>p_minutes) else null end,tracking_requested_at=now(),tracking_requested_by=(select auth.uid()),updated_at=now()
 where user_id=p_user_id and admin_enabled=true returning * into result;
 if result.user_id is null then raise exception 'Zet Live Locaties eerst aan voor deze gebruiker'; end if;
 return result;
end $$;

drop function if exists public.get_admin_live_locations();
create function public.get_admin_live_locations() returns table(
 user_id uuid,full_name text,email text,avatar_url text,is_active boolean,admin_enabled boolean,route_location_enabled boolean,
 app_prompt_state text,permission_state text,prompted_at timestamptz,last_error text,tracking_until timestamptz,
 latitude double precision,longitude double precision,accuracy double precision,speed_mps double precision,heading_degrees double precision,captured_at timestamptz,received_at timestamptz
) language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if (select auth.uid()) is null or not (select public.is_app_admin()) then raise exception 'Alleen beheerders'; end if;
 return query select p.id,coalesce(nullif(p.full_name,''),nullif(concat_ws(' ',p.first_name,p.last_name),''),p.email),p.email,p.avatar_url,coalesce(p.is_active,true),
 coalesce(s.admin_enabled,false),coalesce(s.route_location_enabled,false),coalesce(s.app_prompt_state,'not_asked'),coalesce(s.permission_state,'unknown'),s.prompted_at,s.last_error,s.tracking_until,
 l.latitude,l.longitude,l.accuracy,l.speed_mps,l.heading_degrees,l.captured_at,l.updated_at
 from public.profiles p left join public.user_location_settings s on s.user_id=p.id left join public.user_live_locations l on l.user_id=p.id
 order by coalesce(l.updated_at,'-infinity'::timestamptz) desc,coalesce(nullif(p.full_name,''),p.email);
end $$;

create or replace function public.get_admin_location_history(p_user_id uuid,p_hours integer default 24)
returns table(id uuid,user_id uuid,latitude double precision,longitude double precision,accuracy double precision,speed_mps double precision,heading_degrees double precision,captured_at timestamptz,received_at timestamptz)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if (select auth.uid()) is null or not (select public.is_app_admin()) then raise exception 'Alleen beheerders'; end if;
 if p_hours not in(1,4,8,24) then raise exception 'Ongeldig historiefilter'; end if;
 return query select h.id,h.user_id,h.latitude,h.longitude,h.accuracy,h.speed_mps,h.heading_degrees,h.captured_at,h.created_at
 from public.user_location_history h where h.user_id=p_user_id and h.captured_at>=now()-make_interval(hours=>p_hours)
 order by h.captured_at,h.created_at;
end $$;

create or replace function public.replace_planning_period(
 p_workspace_id uuid,p_from date,p_to date,p_rows jsonb,p_replace boolean default true
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare target uuid:=coalesce(p_workspace_id,(select auth.uid())); inserted_count integer:=0; deleted_count integer:=0;
begin
 if (select auth.uid()) is null then raise exception 'Niet ingelogd'; end if;
 if target<>(select auth.uid()) and not (select public.is_app_admin()) then raise exception 'Geen toegang tot deze werkruimte'; end if;
 if p_from is null or p_to is null or p_to<p_from then raise exception 'Ongeldige planningsperiode'; end if;
 if jsonb_typeof(coalesce(p_rows,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_rows,'[]'::jsonb))>5000 then raise exception 'Ongeldige hoeveelheid planningregels'; end if;
 if exists(select 1 from jsonb_to_recordset(coalesce(p_rows,'[]'::jsonb)) as r(customer_id uuid) left join public.customers c on c.id=r.customer_id where c.id is null or c.user_id<>target) then raise exception 'Een planningregel verwijst naar een ongeldige klant'; end if;
 if coalesce(p_replace,true) then delete from public.planning where user_id=target and datum between p_from and p_to and vast=false and status not in('Uitgevoerd','Niet uitgevoerd','Bezocht'); get diagnostics deleted_count=row_count; end if;
 insert into public.planning(user_id,customer_id,datum,starttijd,eindtijd,status,vast,uitgevoerd,route_volgorde,reistijd_min,afstand_km,route_mode,route_live,bezoekduur_min,notities,updated_at)
 select target,r.customer_id,r.datum,r.starttijd,r.eindtijd,coalesce(r.status,'Gepland'),coalesce(r.vast,false),coalesce(r.uitgevoerd,false),coalesce(r.route_volgorde,999),r.reistijd_min,r.afstand_km,coalesce(r.route_mode,'car'),coalesce(r.route_live,false),coalesce(r.bezoekduur_min,60),coalesce(r.notities,''),now()
 from jsonb_to_recordset(coalesce(p_rows,'[]'::jsonb)) as r(customer_id uuid,datum date,starttijd time,eindtijd time,status text,vast boolean,uitgevoerd boolean,route_volgorde integer,reistijd_min integer,afstand_km double precision,route_mode text,route_live boolean,bezoekduur_min integer,notities text);
 get diagnostics inserted_count=row_count;
 return jsonb_build_object('inserted',inserted_count,'deleted',deleted_count);
end $$;

revoke all on function public.set_my_location_preference(boolean,text,text,text) from public,anon;
revoke all on function public.save_my_live_location(double precision,double precision,double precision,timestamptz,double precision,double precision) from public,anon;
revoke all on function public.set_location_system_config(boolean,integer) from public,anon;
revoke all on function public.set_user_location_enabled(uuid,boolean) from public,anon;
revoke all on function public.set_user_live_tracking(uuid,boolean,integer) from public,anon;
revoke all on function public.get_admin_live_locations() from public,anon;
revoke all on function public.get_admin_location_history(uuid,integer) from public,anon;
revoke all on function public.replace_planning_period(uuid,date,date,jsonb,boolean) from public,anon;
grant execute on function public.set_my_location_preference(boolean,text,text,text),public.save_my_live_location(double precision,double precision,double precision,timestamptz,double precision,double precision),public.set_location_system_config(boolean,integer),public.set_user_location_enabled(uuid,boolean),public.set_user_live_tracking(uuid,boolean,integer),public.get_admin_live_locations(),public.get_admin_location_history(uuid,integer) to authenticated;
grant execute on function public.replace_planning_period(uuid,date,date,jsonb,boolean) to authenticated;

alter table public.location_system_settings replica identity full;
alter table public.user_location_settings replica identity full;
alter table public.user_live_locations replica identity full;
do $$
begin
 begin alter publication supabase_realtime add table public.location_system_settings; exception when duplicate_object then null; end;
 begin alter publication supabase_realtime add table public.user_location_settings; exception when duplicate_object then null; end;
 begin alter publication supabase_realtime add table public.user_live_locations; exception when duplicate_object then null; end;
end $$;

commit;
