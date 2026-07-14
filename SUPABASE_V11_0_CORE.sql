-- Planning-GJsystems v11.0
-- Centrale route/tijd-engine, onveranderlijke historie en private bezoekfoto's.
-- Herhaalbaar uit te voeren op een bestaande v10.11-database.
-- Nieuwe lege projecten gebruiken alleen de complete SUPABASE_V10_7_DEV_BASELINE.sql.

begin;

alter table public.planning
  add column if not exists parking_min integer not null default 0,
  add column if not exists fixed_starttijd time,
  add column if not exists rescheduled_from_history_id uuid references public.visit_history(id) on delete set null,
  add column if not exists route_revision bigint not null default 0;

alter table public.visit_history
  add column if not exists reden text,
  add column if not exists vervolgactie text,
  add column if not exists uitgevoerde_werkzaamheden text,
  add column if not exists aandachtspunten text,
  add column if not exists afstand_km double precision,
  add column if not exists reistijd_min integer;

create index if not exists planning_user_status_date_idx
  on public.planning(user_id,status,datum,route_volgorde);
create index if not exists planning_rescheduled_history_idx
  on public.planning(rescheduled_from_history_id)
  where rescheduled_from_history_id is not null;
delete from public.visit_photos older using public.visit_photos newer
where older.history_id=newer.history_id and older.file_path=newer.file_path and older.id>newer.id;
create unique index if not exists visit_photos_history_path_unique
  on public.visit_photos(history_id,file_path);

create or replace function public.save_user_app_settings(
  p_workspace_id uuid,
  p_language text,
  p_settings jsonb
) returns public.user_app_settings
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  target uuid:=coalesce(p_workspace_id,(select auth.uid()));
  saved public.user_app_settings;
begin
  if (select auth.uid()) is null then raise exception 'Niet ingelogd.'; end if;
  if target<>(select auth.uid()) and not (select public.is_app_admin()) then
    raise exception 'Geen toegang tot deze werkruimte.';
  end if;
  if p_language not in ('nl','en','de') then raise exception 'Ongeldige taal.'; end if;

  insert into public.user_app_settings(user_id,language,settings,updated_at)
  values(target,p_language,coalesce(p_settings,'{}'::jsonb),now())
  on conflict(user_id) do update set
    language=excluded.language,
    settings=excluded.settings,
    updated_at=now()
  returning * into saved;
  return saved;
end
$$;

create or replace function public.save_day_route(
  p_workspace_id uuid,
  p_date date,
  p_departure time,
  p_rows jsonb,
  p_summary jsonb,
  p_pause_enabled boolean default true
) returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  target uuid:=coalesce(p_workspace_id,(select auth.uid()));
  item jsonb;
  expected integer;
  changed integer:=0;
  current_settings jsonb:='{}'::jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Niet ingelogd.'; end if;
  if target<>(select auth.uid()) and not (select public.is_app_admin()) then
    raise exception 'Geen toegang tot deze werkruimte.';
  end if;
  if p_date is null or p_departure is null then raise exception 'Datum of vertrektijd ontbreekt.'; end if;
  if jsonb_typeof(coalesce(p_rows,'[]'::jsonb))<>'array' then raise exception 'Ongeldige routeregels.'; end if;

  select count(*) into expected
  from public.planning
  where user_id=target and datum=p_date and status<>'Uit planning';

  if expected<>jsonb_array_length(coalesce(p_rows,'[]'::jsonb)) then
    raise exception 'De dagplanning is intussen gewijzigd. Synchroniseer en probeer opnieuw.';
  end if;

  update public.planning
  set route_live=false,updated_at=now()
  where user_id=target and datum=p_date and status<>'Uit planning';

  for item in select value from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) loop
    update public.planning set
      route_volgorde=(item->>'route_volgorde')::integer,
      starttijd=nullif(item->>'starttijd','')::time,
      eindtijd=nullif(item->>'eindtijd','')::time,
      reistijd_min=greatest(0,coalesce((item->>'reistijd_min')::integer,0)),
      parking_min=greatest(0,coalesce((item->>'parking_min')::integer,0)),
      afstand_km=greatest(0,coalesce((item->>'afstand_km')::double precision,0)),
      route_mode=case when item->>'route_mode'='walk' then 'walk' else 'car' end,
      route_live=coalesce((item->>'route_live')::boolean,false),
      route_revision=route_revision+1,
      updated_at=now()
    where id=(item->>'id')::uuid and user_id=target and datum=p_date and status<>'Uit planning';
    if not found then raise exception 'Een routebezoek bestaat niet meer.'; end if;
    changed:=changed+1;
  end loop;

  select coalesce(settings,'{}'::jsonb) into current_settings
  from public.app_day_settings where user_id=target and datum=p_date;

  insert into public.app_day_settings(user_id,datum,vertrektijd,settings,updated_at)
  values(
    target,p_date,p_departure,
    coalesce(current_settings,'{}'::jsonb)||jsonb_build_object(
      'day_route',coalesce(p_summary,'{}'::jsonb),
      'pause_enabled',coalesce(p_pause_enabled,true)
    ),now()
  )
  on conflict(user_id,datum) do update set
    vertrektijd=excluded.vertrektijd,
    settings=excluded.settings,
    updated_at=now();

  return jsonb_build_object('changed',changed,'summary',p_summary);
end
$$;

create or replace function public.replan_history_visit(
  p_workspace_id uuid,
  p_history_id uuid,
  p_date date
) returns uuid
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  target uuid:=coalesce(p_workspace_id,(select auth.uid()));
  source public.visit_history;
  new_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Niet ingelogd.'; end if;
  if target<>(select auth.uid()) and not (select public.is_app_admin()) then
    raise exception 'Geen toegang tot deze werkruimte.';
  end if;
  if p_date is null or p_date<current_date then raise exception 'Kies vandaag of een toekomstige datum.'; end if;

  select * into source from public.visit_history
  where id=p_history_id and user_id=target;
  if not found then raise exception 'Historisch bezoek niet gevonden.'; end if;
  if lower(coalesce(source.status,'')) not in ('niet uitgevoerd','not executed','nicht ausgeführt') then
    raise exception 'Alleen een niet-uitgevoerd bezoek kan opnieuw worden gepland.';
  end if;
  if source.customer_id is null then raise exception 'De oorspronkelijke klant ontbreekt.'; end if;

  insert into public.planning(
    user_id,customer_id,datum,status,vast,uitgevoerd,route_volgorde,
    bezoekduur_min,notities,rescheduled_from_history_id,created_at,updated_at
  ) values(
    target,source.customer_id,p_date,'Gepland',false,false,999,
    greatest(5,coalesce(source.duur_min,30)),source.vervolgactie,p_history_id,now(),now()
  ) returning id into new_id;
  return new_id;
end
$$;

create or replace function public.move_planning_day(
  p_workspace_id uuid,
  p_old_date date,
  p_new_date date
) returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  target uuid:=coalesce(p_workspace_id,(select auth.uid()));
  source_count integer:=0;
  destination_count integer:=0;
begin
  if (select auth.uid()) is null then raise exception 'Niet ingelogd.'; end if;
  if target<>(select auth.uid()) and not (select public.is_app_admin()) then
    raise exception 'Geen toegang tot deze werkruimte.';
  end if;
  if p_old_date is null or p_new_date is null or p_old_date=p_new_date then
    raise exception 'Ongeldige dagverplaatsing.';
  end if;

  perform 1 from public.planning
  where user_id=target and datum in (p_old_date,p_new_date)
  for update;

  select count(*) into source_count from public.planning
  where user_id=target and datum=p_old_date and status<>'Uit planning';
  select count(*) into destination_count from public.planning
  where user_id=target and datum=p_new_date and status<>'Uit planning';
  if source_count=0 then raise exception 'De te verplaatsen dag is leeg.'; end if;
  if destination_count>0 then raise exception 'De nieuwe dag bevat al geplande bezoeken.'; end if;

  update public.planning set
    datum=p_new_date,
    starttijd=null,
    eindtijd=null,
    reistijd_min=0,
    parking_min=0,
    afstand_km=0,
    route_live=false,
    route_revision=route_revision+1,
    updated_at=now()
  where user_id=target and datum=p_old_date and status<>'Uit planning';

  delete from public.app_day_settings where user_id=target and datum=p_new_date;
  update public.app_day_settings set datum=p_new_date,updated_at=now()
  where user_id=target and datum=p_old_date;

  update public.fixed_appointments set datum=p_new_date,updated_at=now()
  where user_id=target and datum=p_old_date;

  return jsonb_build_object('moved',source_count,'old_date',p_old_date,'new_date',p_new_date);
end
$$;

revoke all on function public.save_user_app_settings(uuid,text,jsonb) from public;
revoke all on function public.save_day_route(uuid,date,time,jsonb,jsonb,boolean) from public;
revoke all on function public.replan_history_visit(uuid,uuid,date) from public;
revoke all on function public.move_planning_day(uuid,date,date) from public;
grant execute on function public.save_user_app_settings(uuid,text,jsonb) to authenticated;
grant execute on function public.save_day_route(uuid,date,time,jsonb,jsonb,boolean) to authenticated;
grant execute on function public.replan_history_visit(uuid,uuid,date) to authenticated;
grant execute on function public.move_planning_day(uuid,date,date) to authenticated;

update public.profiles
set avatar_url=regexp_replace(avatar_url,'^.*?/storage/v1/object/public/profile-photos/','')
where avatar_url like '%/storage/v1/object/public/profile-photos/%';

update storage.buckets set public=false where id in ('profile-photos','visit-photos');

drop policy if exists "profile photos authenticated read" on storage.objects;
drop policy if exists "profile photos own write" on storage.objects;
drop policy if exists "profile photos private read" on storage.objects;
drop policy if exists "profile photos own insert" on storage.objects;
drop policy if exists "profile photos own update" on storage.objects;
drop policy if exists "profile photos own delete" on storage.objects;

create policy "profile photos private read" on storage.objects for select to authenticated
using(bucket_id='profile-photos' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select public.is_app_admin())));
create policy "profile photos own insert" on storage.objects for insert to authenticated
with check(bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "profile photos own update" on storage.objects for update to authenticated
using(bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check(bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "profile photos own delete" on storage.objects for delete to authenticated
using(bucket_id='profile-photos' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select public.is_app_admin())));

drop policy if exists "visit photos authenticated read" on storage.objects;
drop policy if exists "visit photos own insert" on storage.objects;
drop policy if exists "visit photos private read" on storage.objects;
drop policy if exists "visit photos own update" on storage.objects;
drop policy if exists "visit photos own delete" on storage.objects;

create policy "visit photos private read" on storage.objects for select to authenticated
using(bucket_id='visit-photos' and exists(
  select 1 from public.visit_photos vp
  join public.visit_history vh on vh.id=vp.history_id
  where vp.file_path=name and (vh.user_id=(select auth.uid()) or (select public.is_app_admin()))
));
create policy "visit photos own insert" on storage.objects for insert to authenticated
with check(bucket_id='visit-photos' and exists(
  select 1 from public.planning p
  where p.id::text=(storage.foldername(name))[1]
    and (p.user_id=(select auth.uid()) or (select public.is_app_admin()))
));
create policy "visit photos own update" on storage.objects for update to authenticated
using(bucket_id='visit-photos' and exists(
  select 1 from public.visit_photos vp
  join public.visit_history vh on vh.id=vp.history_id
  where vp.file_path=name and (vh.user_id=(select auth.uid()) or (select public.is_app_admin()))
))
with check(bucket_id='visit-photos');
create policy "visit photos own delete" on storage.objects for delete to authenticated
using(bucket_id='visit-photos' and exists(
  select 1 from public.visit_photos vp
  join public.visit_history vh on vh.id=vp.history_id
  where vp.file_path=name and (vh.user_id=(select auth.uid()) or (select public.is_app_admin()))
));

grant select,insert,update,delete on public.planning,public.visit_history,public.visit_photos,public.app_day_settings,public.user_app_settings to authenticated;

do $$
begin
  begin alter publication supabase_realtime add table public.planning; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.app_day_settings; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.app_absences; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.visit_history; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.visit_photos; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.user_app_settings; exception when duplicate_object then null; end;
end
$$;

commit;
