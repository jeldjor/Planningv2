-- Planning-GJsystems v11.0 complete baseline voor een nieuw, leeg Supabase-project.
-- De historische bestandsnaam blijft behouden zodat bestaande deployscripts niet breken.
-- UITSLUITEND voor een NIEUW, LEEG Supabase development/testproject.
-- Bevat geen productiegebruikers en maakt geen Auth-gebruikers aan.
-- Voer hierna SUPABASE_V10_8_LIVE_LOCATIONS_DEV.sql uit.

begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  first_name text not null default '',
  last_name text not null default '',
  full_name text not null default '',
  role text not null default 'user' check (role in ('user', 'admin')),
  is_active boolean not null default true,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles(id, email, first_name, last_name, full_name, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), new.email, ''),
    'user',
    true
  )
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end
$$;
drop trigger if exists on_auth_user_created_gj on auth.users;
create trigger on_auth_user_created_gj after insert or update of email on auth.users
for each row execute function public.handle_new_auth_user();

insert into public.profiles(id, email, first_name, last_name, full_name, role, is_active)
select id, email, coalesce(raw_user_meta_data ->> 'first_name', ''),
       coalesce(raw_user_meta_data ->> 'last_name', ''),
       coalesce(nullif(raw_user_meta_data ->> 'full_name', ''), email, ''),
       'user', true
from auth.users
on conflict (id) do nothing;

create or replace function public.is_app_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists(
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and coalesce(is_active, true)
  )
$$;
revoke all on function public.is_app_admin() from public, anon;
grant execute on function public.is_app_admin() to authenticated;

create or replace function public.protect_profile_security_fields()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Een gewone browsergebruiker mag het eigen profiel bijwerken, maar nooit
  -- de centrale rol of accountstatus verhogen. Server-side beheer blijft werken.
  if (select auth.uid()) is not null and not public.is_app_admin() then
    new.role := old.role;
    new.is_active := old.is_active;
  end if;
  return new;
end
$$;
drop trigger if exists protect_profile_security_fields on public.profiles;
create trigger protect_profile_security_fields before update on public.profiles
for each row execute function public.protect_profile_security_fields();

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  klantnummer text,
  keten text,
  naam text not null default 'Onbekende klant',
  adres text,
  straat text,
  huisnr text,
  postcode text,
  plaats text,
  land text,
  regio text,
  prio integer,
  bezoeken integer,
  periode text,
  bezoektijd integer,
  bezoekdagen text,
  telefoon text,
  telefoon_winkel text,
  email text,
  actief boolean not null default true,
  meenemen_in_planning boolean not null default true,
  frequentie_weken integer,
  openingstijden jsonb,
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  contactpersoon text,
  google_maps text,
  kaart_selectie text,
  kaart_info text,
  notities text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists customers_user_klantnummer_unique
  on public.customers(user_id, klantnummer) where klantnummer is not null;
create index if not exists customers_user_name_idx on public.customers(user_id, naam);

create table if not exists public.planning (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  datum date,
  starttijd time,
  eindtijd time,
  status text not null default 'Gepland',
  vast boolean not null default false,
  uitgevoerd boolean not null default false,
  route_volgorde integer,
  reistijd_min integer,
  parking_min integer not null default 0,
  afstand_km double precision,
  route_mode text,
  route_live boolean not null default false,
  fixed_starttijd time,
  route_revision bigint not null default 0,
  bezoekduur_min integer,
  notities text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists planning_user_date_idx on public.planning(user_id, datum, route_volgorde);
create index if not exists planning_customer_idx on public.planning(customer_id);

create table if not exists public.app_day_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  datum date not null,
  vertrektijd time,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key(user_id, datum)
);

create table if not exists public.app_absences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'Overig',
  start_date date not null,
  end_date date not null,
  start_time time,
  end_time time,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists app_absences_user_date_idx on public.app_absences(user_id, start_date, end_date);

create table if not exists public.fixed_appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  datum date,
  starttijd time,
  eindtijd time,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.visit_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  planning_id uuid references public.planning(id) on delete set null,
  bezoekdatum date not null,
  starttijd time,
  eindtijd time,
  activiteit text,
  samenvatting text,
  opmerkingen text,
  status text,
  reden text,
  vervolgactie text,
  uitgevoerde_werkzaamheden text,
  aandachtspunten text,
  afstand_km double precision,
  reistijd_min integer,
  duur_min integer,
  afgerond boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists visit_history_user_date_idx on public.visit_history(user_id, bezoekdatum desc);

alter table public.planning
  add column if not exists rescheduled_from_history_id uuid references public.visit_history(id) on delete set null;

create table if not exists public.visit_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  history_id uuid not null references public.visit_history(id) on delete cascade,
  file_path text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists visit_photos_history_idx on public.visit_photos(history_id, created_at);

create table if not exists public.user_app_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  language text not null default 'nl' check (language in ('nl', 'en', 'de')),
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sender_name text,
  sender_email text,
  subject text not null,
  status text not null default 'nieuw' check (status in ('nieuw','in_behandeling','beantwoord','gesloten')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.contact_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('user','admin')),
  message text not null,
  body text,
  created_at timestamptz not null default now()
);
create table if not exists public.contact_thread_reads (
  thread_id uuid references public.contact_threads(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  reader_role text not null check (reader_role in ('user','admin')),
  last_read_at timestamptz not null default now(),
  primary key(thread_id, user_id, reader_role)
);
create table if not exists public.contact_attachments (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.contact_threads(id) on delete cascade,
  message_id uuid references public.contact_messages(id) on delete cascade,
  uploader_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  file_size bigint not null default 0 check (file_size between 0 and 10485760),
  created_at timestamptz not null default now()
);
create index if not exists contact_threads_user_idx on public.contact_threads(user_id, updated_at desc);
create index if not exists contact_messages_thread_idx on public.contact_messages(thread_id, created_at);
create index if not exists contact_attachments_thread_idx on public.contact_attachments(thread_id, created_at);

create table if not exists public.app_server_settings (
  id smallint primary key default 1 check (id = 1),
  tomtom_enabled boolean not null default false,
  tomtom_api_key text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.app_server_settings(id, tomtom_enabled) values(1, false) on conflict(id) do nothing;

create or replace function public.set_workspace_owner()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.user_id is null then new.user_id := (select auth.uid()); end if;
  if new.user_id <> (select auth.uid()) and not public.is_app_admin() then
    raise exception 'Geen toegang tot deze werkruimte';
  end if;
  return new;
end
$$;

do $$
declare t text;
begin
  foreach t in array array['customers','planning','app_day_settings','app_absences','fixed_appointments','visit_history','visit_photos'] loop
    execute format('drop trigger if exists set_workspace_owner on public.%I', t);
    execute format('create trigger set_workspace_owner before insert or update on public.%I for each row execute function public.set_workspace_owner()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('drop policy if exists workspace_select on public.%I', t);
    execute format('create policy workspace_select on public.%I for select to authenticated using(user_id=(select auth.uid()) or (select public.is_app_admin()))', t);
    execute format('drop policy if exists workspace_insert on public.%I', t);
    execute format('create policy workspace_insert on public.%I for insert to authenticated with check(user_id=(select auth.uid()) or (select public.is_app_admin()))', t);
    execute format('drop policy if exists workspace_update on public.%I', t);
    execute format('create policy workspace_update on public.%I for update to authenticated using(user_id=(select auth.uid()) or (select public.is_app_admin())) with check(user_id=(select auth.uid()) or (select public.is_app_admin()))', t);
    execute format('drop policy if exists workspace_delete on public.%I', t);
    execute format('create policy workspace_delete on public.%I for delete to authenticated using(user_id=(select auth.uid()) or (select public.is_app_admin()))', t);
    execute format('grant select,insert,update,delete on public.%I to authenticated', t);
  end loop;
end
$$;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_app_admin()));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
using (id = (select auth.uid()) or (select public.is_app_admin()))
with check (id = (select auth.uid()) or (select public.is_app_admin()));
grant select, update on public.profiles to authenticated;

alter table public.user_app_settings enable row level security;
alter table public.user_app_settings force row level security;
drop policy if exists user_app_settings_select on public.user_app_settings;
create policy user_app_settings_select on public.user_app_settings for select to authenticated
using(user_id=(select auth.uid()) or (select public.is_app_admin()));
drop policy if exists user_app_settings_write on public.user_app_settings;
create policy user_app_settings_write on public.user_app_settings for all to authenticated
using(user_id=(select auth.uid()) or (select public.is_app_admin()))
with check(user_id=(select auth.uid()) or (select public.is_app_admin()));
grant select, insert, update on public.user_app_settings to authenticated;

alter table public.contact_threads enable row level security;
alter table public.contact_messages enable row level security;
alter table public.contact_thread_reads enable row level security;
alter table public.contact_attachments enable row level security;
drop policy if exists contact_threads_access on public.contact_threads;
create policy contact_threads_access on public.contact_threads for all to authenticated
using(user_id=(select auth.uid()) or (select public.is_app_admin()))
with check(user_id=(select auth.uid()) or (select public.is_app_admin()));
drop policy if exists contact_messages_read on public.contact_messages;
create policy contact_messages_read on public.contact_messages for select to authenticated
using(exists(select 1 from public.contact_threads t where t.id=thread_id and (t.user_id=(select auth.uid()) or (select public.is_app_admin()))));
drop policy if exists contact_messages_insert on public.contact_messages;
create policy contact_messages_insert on public.contact_messages for insert to authenticated
with check(sender_id=(select auth.uid()) and exists(select 1 from public.contact_threads t where t.id=thread_id and (t.user_id=(select auth.uid()) or (select public.is_app_admin()))));
drop policy if exists contact_reads_access on public.contact_thread_reads;
create policy contact_reads_access on public.contact_thread_reads for all to authenticated
using(user_id=(select auth.uid()) or (select public.is_app_admin()))
with check(user_id=(select auth.uid()) or (select public.is_app_admin()));
drop policy if exists contact_attachments_select on public.contact_attachments;
create policy contact_attachments_select on public.contact_attachments for select to authenticated
using(exists(select 1 from public.contact_threads t where t.id=thread_id and (t.user_id=(select auth.uid()) or (select public.is_app_admin()))));
drop policy if exists contact_attachments_insert on public.contact_attachments;
create policy contact_attachments_insert on public.contact_attachments for insert to authenticated
with check(uploader_id=(select auth.uid()) and exists(select 1 from public.contact_threads t where t.id=thread_id and (t.user_id=(select auth.uid()) or (select public.is_app_admin()))));
grant select, insert, update, delete on public.contact_threads, public.contact_messages, public.contact_thread_reads to authenticated;
grant select, insert, delete on public.contact_attachments to authenticated;

alter table public.app_server_settings enable row level security;
alter table public.app_server_settings force row level security;
revoke all on public.app_server_settings from public, anon, authenticated;

create or replace function public.create_contact_thread(p_subject text, p_message text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid := gen_random_uuid(); p public.profiles%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Niet ingelogd'; end if;
  if char_length(trim(coalesce(p_message,''))) < 3 then raise exception 'Bericht is te kort'; end if;
  select * into p from public.profiles where id = (select auth.uid());
  insert into public.contact_threads(id,user_id,sender_name,sender_email,subject)
  values(v_id,(select auth.uid()),coalesce(nullif(p.full_name,''),p.email),p.email,coalesce(nullif(trim(p_subject),''),'Overig'));
  insert into public.contact_messages(thread_id,sender_id,sender_role,message,body)
  values(v_id,(select auth.uid()),'user',trim(p_message),trim(p_message));
  return v_id;
end
$$;

create or replace function public.clear_workspace_data(p_workspace_id uuid, p_action text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare caller uuid := (select auth.uid()); target uuid := coalesce(p_workspace_id, caller); n bigint := 0; total bigint := 0;
begin
  if caller is null then raise exception 'Niet ingelogd'; end if;
  if target <> caller and not public.is_app_admin() then raise exception 'Geen toegang tot deze werkruimte'; end if;
  if p_action not in ('planning','fixed','unplanned','history','routes','database','all') then raise exception 'Ongeldige actie'; end if;
  if p_action in ('planning','database','all') then delete from public.planning where user_id=target; get diagnostics n=row_count; total:=total+n; end if;
  if p_action in ('fixed','database','all') then delete from public.fixed_appointments where user_id=target; get diagnostics n=row_count; total:=total+n; end if;
  if p_action='fixed' then delete from public.planning where user_id=target and coalesce(vast,false); get diagnostics n=row_count; total:=total+n; end if;
  if p_action='unplanned' then delete from public.planning where user_id=target and status in ('Uit planning','Niet ingepland'); get diagnostics n=row_count; total:=total+n; end if;
  if p_action in ('history','database','all') then delete from public.visit_photos where user_id=target; get diagnostics n=row_count; total:=total+n; delete from public.visit_history where user_id=target; get diagnostics n=row_count; total:=total+n; end if;
  if p_action in ('database','all') then delete from public.customers where user_id=target; get diagnostics n=row_count; total:=total+n; end if;
  if p_action='all' then delete from public.app_absences where user_id=target; get diagnostics n=row_count; total:=total+n; delete from public.app_day_settings where user_id=target; get diagnostics n=row_count; total:=total+n; end if;
  return jsonb_build_object('ok',true,'deleted',total,'workspace_id',target,'action',p_action);
end
$$;

create or replace function public.set_tomtom_secret(p_key text, p_enabled boolean)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (select auth.uid()) is null or not public.is_app_admin() then raise exception 'Alleen beheerders'; end if;
  if coalesce(p_enabled,false) and char_length(trim(coalesce(p_key,''))) < 8 then raise exception 'Ongeldige TomTom API-sleutel'; end if;
  update public.app_server_settings set tomtom_enabled=coalesce(p_enabled,false),
    tomtom_api_key=case when coalesce(p_enabled,false) then trim(p_key) else null end,
    updated_at=now(), updated_by=(select auth.uid()) where id=1;
  return coalesce(p_enabled,false);
end
$$;
create or replace function public.get_tomtom_status()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(tomtom_enabled,false) from public.app_server_settings where id=1
$$;

-- v11.0: alle planningsrelevante instellingen en dagmutaties centraal en atomair.
create or replace function public.save_user_app_settings(p_workspace_id uuid,p_language text,p_settings jsonb)
returns public.user_app_settings language plpgsql security invoker set search_path=public,pg_temp as $$
declare target uuid:=coalesce(p_workspace_id,(select auth.uid())); saved public.user_app_settings;
begin
  if (select auth.uid()) is null then raise exception 'Niet ingelogd.'; end if;
  if target<>(select auth.uid()) and not (select public.is_app_admin()) then raise exception 'Geen toegang tot deze werkruimte.'; end if;
  if p_language not in ('nl','en','de') then raise exception 'Ongeldige taal.'; end if;
  insert into public.user_app_settings(user_id,language,settings,updated_at) values(target,p_language,coalesce(p_settings,'{}'::jsonb),now())
  on conflict(user_id) do update set language=excluded.language,settings=excluded.settings,updated_at=now() returning * into saved;
  return saved;
end $$;

create or replace function public.save_day_route(p_workspace_id uuid,p_date date,p_departure time,p_rows jsonb,p_summary jsonb,p_pause_enabled boolean default true)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare target uuid:=coalesce(p_workspace_id,(select auth.uid())); item jsonb; expected integer; changed integer:=0; current_settings jsonb:='{}'::jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Niet ingelogd.'; end if;
  if target<>(select auth.uid()) and not (select public.is_app_admin()) then raise exception 'Geen toegang tot deze werkruimte.'; end if;
  if p_date is null or p_departure is null then raise exception 'Datum of vertrektijd ontbreekt.'; end if;
  if jsonb_typeof(coalesce(p_rows,'[]'::jsonb))<>'array' then raise exception 'Ongeldige routeregels.'; end if;
  select count(*) into expected from public.planning where user_id=target and datum=p_date and status<>'Uit planning';
  if expected<>jsonb_array_length(coalesce(p_rows,'[]'::jsonb)) then raise exception 'De dagplanning is intussen gewijzigd. Synchroniseer en probeer opnieuw.'; end if;
  update public.planning set route_live=false,updated_at=now() where user_id=target and datum=p_date and status<>'Uit planning';
  for item in select value from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) loop
    update public.planning set route_volgorde=(item->>'route_volgorde')::integer,starttijd=nullif(item->>'starttijd','')::time,eindtijd=nullif(item->>'eindtijd','')::time,
      reistijd_min=greatest(0,coalesce((item->>'reistijd_min')::integer,0)),parking_min=greatest(0,coalesce((item->>'parking_min')::integer,0)),
      afstand_km=greatest(0,coalesce((item->>'afstand_km')::double precision,0)),route_mode=case when item->>'route_mode'='walk' then 'walk' else 'car' end,
      route_live=coalesce((item->>'route_live')::boolean,false),route_revision=route_revision+1,updated_at=now()
    where id=(item->>'id')::uuid and user_id=target and datum=p_date and status<>'Uit planning';
    if not found then raise exception 'Een routebezoek bestaat niet meer.'; end if; changed:=changed+1;
  end loop;
  select coalesce(settings,'{}'::jsonb) into current_settings from public.app_day_settings where user_id=target and datum=p_date;
  insert into public.app_day_settings(user_id,datum,vertrektijd,settings,updated_at)
  values(target,p_date,p_departure,coalesce(current_settings,'{}'::jsonb)||jsonb_build_object('day_route',coalesce(p_summary,'{}'::jsonb),'pause_enabled',coalesce(p_pause_enabled,true)),now())
  on conflict(user_id,datum) do update set vertrektijd=excluded.vertrektijd,settings=excluded.settings,updated_at=now();
  return jsonb_build_object('changed',changed,'summary',p_summary);
end $$;

create or replace function public.replan_history_visit(p_workspace_id uuid,p_history_id uuid,p_date date)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare target uuid:=coalesce(p_workspace_id,(select auth.uid())); source public.visit_history; new_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Niet ingelogd.'; end if;
  if target<>(select auth.uid()) and not (select public.is_app_admin()) then raise exception 'Geen toegang tot deze werkruimte.'; end if;
  if p_date is null or p_date<current_date then raise exception 'Kies vandaag of een toekomstige datum.'; end if;
  select * into source from public.visit_history where id=p_history_id and user_id=target;
  if not found then raise exception 'Historisch bezoek niet gevonden.'; end if;
  if lower(coalesce(source.status,'')) not in ('niet uitgevoerd','not executed','nicht ausgeführt') then raise exception 'Alleen een niet-uitgevoerd bezoek kan opnieuw worden gepland.'; end if;
  if source.customer_id is null then raise exception 'De oorspronkelijke klant ontbreekt.'; end if;
  insert into public.planning(user_id,customer_id,datum,status,vast,uitgevoerd,route_volgorde,bezoekduur_min,notities,rescheduled_from_history_id,created_at,updated_at)
  values(target,source.customer_id,p_date,'Gepland',false,false,999,greatest(5,coalesce(source.duur_min,30)),source.vervolgactie,p_history_id,now(),now()) returning id into new_id;
  return new_id;
end $$;

create or replace function public.move_planning_day(p_workspace_id uuid,p_old_date date,p_new_date date)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare target uuid:=coalesce(p_workspace_id,(select auth.uid())); source_count integer:=0; destination_count integer:=0;
begin
  if (select auth.uid()) is null then raise exception 'Niet ingelogd.'; end if;
  if target<>(select auth.uid()) and not (select public.is_app_admin()) then raise exception 'Geen toegang tot deze werkruimte.'; end if;
  if p_old_date is null or p_new_date is null or p_old_date=p_new_date then raise exception 'Ongeldige dagverplaatsing.'; end if;
  perform 1 from public.planning where user_id=target and datum in (p_old_date,p_new_date) for update;
  select count(*) into source_count from public.planning where user_id=target and datum=p_old_date and status<>'Uit planning';
  select count(*) into destination_count from public.planning where user_id=target and datum=p_new_date and status<>'Uit planning';
  if source_count=0 then raise exception 'De te verplaatsen dag is leeg.'; end if;
  if destination_count>0 then raise exception 'De nieuwe dag bevat al geplande bezoeken.'; end if;
  update public.planning set datum=p_new_date,starttijd=null,eindtijd=null,reistijd_min=0,parking_min=0,afstand_km=0,route_live=false,route_revision=route_revision+1,updated_at=now()
  where user_id=target and datum=p_old_date and status<>'Uit planning';
  delete from public.app_day_settings where user_id=target and datum=p_new_date;
  update public.app_day_settings set datum=p_new_date,updated_at=now() where user_id=target and datum=p_old_date;
  update public.fixed_appointments set datum=p_new_date,updated_at=now() where user_id=target and datum=p_old_date;
  return jsonb_build_object('moved',source_count,'old_date',p_old_date,'new_date',p_new_date);
end $$;

revoke all on function public.create_contact_thread(text,text) from public,anon;
revoke all on function public.clear_workspace_data(uuid,text) from public,anon;
revoke all on function public.set_tomtom_secret(text,boolean) from public,anon;
revoke all on function public.get_tomtom_status() from public,anon;
revoke all on function public.save_user_app_settings(uuid,text,jsonb) from public,anon;
revoke all on function public.save_day_route(uuid,date,time,jsonb,jsonb,boolean) from public,anon;
revoke all on function public.replan_history_visit(uuid,uuid,date) from public,anon;
revoke all on function public.move_planning_day(uuid,date,date) from public,anon;
grant execute on function public.create_contact_thread(text,text) to authenticated;
grant execute on function public.clear_workspace_data(uuid,text) to authenticated;
grant execute on function public.set_tomtom_secret(text,boolean) to authenticated;
grant execute on function public.get_tomtom_status() to authenticated;
grant execute on function public.save_user_app_settings(uuid,text,jsonb) to authenticated;
grant execute on function public.save_day_route(uuid,date,time,jsonb,jsonb,boolean) to authenticated;
grant execute on function public.replan_history_visit(uuid,uuid,date) to authenticated;
grant execute on function public.move_planning_day(uuid,date,date) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
 ('profile-photos','profile-photos',false,5242880,array['image/jpeg','image/png','image/webp']),
 ('visit-photos','visit-photos',false,10485760,array['image/jpeg','image/png','image/webp']),
 ('contact-attachments','contact-attachments',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "profile photos authenticated read" on storage.objects;
create policy "profile photos authenticated read" on storage.objects for select to authenticated
using(bucket_id='profile-photos' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select public.is_app_admin())));
drop policy if exists "profile photos own write" on storage.objects;
create policy "profile photos own write" on storage.objects for all to authenticated
using(bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check(bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "visit photos authenticated read" on storage.objects;
create policy "visit photos authenticated read" on storage.objects for select to authenticated using(bucket_id='visit-photos' and exists(
  select 1 from public.visit_photos vp join public.visit_history vh on vh.id=vp.history_id
  where vp.file_path=name and (vh.user_id=(select auth.uid()) or (select public.is_app_admin()))
));
drop policy if exists "visit photos own insert" on storage.objects;
create policy "visit photos own insert" on storage.objects for insert to authenticated
with check(bucket_id='visit-photos' and exists(select 1 from public.planning p where p.id::text=(storage.foldername(name))[1] and (p.user_id=(select auth.uid()) or (select public.is_app_admin()))));
drop policy if exists "contact attachment read" on storage.objects;
create policy "contact attachment read" on storage.objects for select to authenticated
using(bucket_id='contact-attachments' and exists(select 1 from public.contact_threads t where t.id::text=(storage.foldername(name))[1] and (t.user_id=(select auth.uid()) or (select public.is_app_admin()))));
drop policy if exists "contact attachment insert" on storage.objects;
create policy "contact attachment insert" on storage.objects for insert to authenticated
with check(bucket_id='contact-attachments' and exists(select 1 from public.contact_threads t where t.id::text=(storage.foldername(name))[1] and (t.user_id=(select auth.uid()) or (select public.is_app_admin()))));
drop policy if exists "contact attachment update" on storage.objects;
create policy "contact attachment update" on storage.objects for update to authenticated
using(bucket_id='contact-attachments' and owner_id=(select auth.uid())::text)
with check(bucket_id='contact-attachments' and owner_id=(select auth.uid())::text);
drop policy if exists "contact attachment delete" on storage.objects;
create policy "contact attachment delete" on storage.objects for delete to authenticated
using(bucket_id='contact-attachments' and (owner_id=(select auth.uid())::text or (select public.is_app_admin())));

do $$
declare t text;
begin
  foreach t in array array['customers','planning','app_day_settings','app_absences','visit_history','visit_photos','user_app_settings','contact_threads','contact_messages','contact_attachments'] loop
    begin execute format('alter publication supabase_realtime add table public.%I',t); exception when duplicate_object then null; end;
  end loop;
end
$$;

commit;
