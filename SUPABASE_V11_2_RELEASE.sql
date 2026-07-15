-- Planning-GJsystems v11.2.0
-- Consolideert live routes, dagtotalen, rechten en ontbrekende indexen.
-- Idempotent: veilig opnieuw uit te voeren via Supabase SQL Editor.

begin;

do $$
begin
  if to_regclass('public.planning') is null
     or to_regclass('public.app_day_settings') is null
     or to_regprocedure('public.is_app_admin()') is null then
    raise exception 'De centrale Planning-GJsystems-baseline ontbreekt.';
  end if;
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
  safe_summary jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Niet ingelogd.'; end if;
  if target<>(select auth.uid()) and not (select public.is_app_admin()) then
    raise exception 'Geen toegang tot deze werkruimte.';
  end if;
  if p_date is null or p_departure is null then raise exception 'Datum of vertrektijd ontbreekt.'; end if;
  if jsonb_typeof(coalesce(p_rows,'[]'::jsonb))<>'array' then raise exception 'Ongeldige routeregels.'; end if;

  select count(*) into expected from public.planning
  where user_id=target and datum=p_date and status<>'Uit planning';
  if expected=0 then raise exception 'Deze dag bevat geen geplande bezoeken.'; end if;
  if expected<>jsonb_array_length(coalesce(p_rows,'[]'::jsonb)) then
    raise exception 'De dagplanning is intussen gewijzigd. Synchroniseer en probeer opnieuw.';
  end if;
  if (select count(distinct value->>'id') from jsonb_array_elements(p_rows))<>expected then
    raise exception 'De route bevat dubbele of ontbrekende bezoeken.';
  end if;
  if exists(select 1 from jsonb_array_elements(p_rows) row where coalesce((row->>'route_live')::boolean,false)=false) then
    raise exception 'Niet alle TomTom-trajecten zijn live berekend.';
  end if;
  if coalesce((p_summary->>'live')::boolean,false)=false
     or jsonb_typeof(p_summary->'returnLeg')<>'object'
     or coalesce((p_summary->'returnLeg'->>'routeLive')::boolean,false)=false then
    raise exception 'De complete terugroute ontbreekt.';
  end if;

  update public.planning set route_live=false,updated_at=now()
  where user_id=target and datum=p_date and status<>'Uit planning';

  for item in select value from jsonb_array_elements(p_rows) loop
    update public.planning set
      route_volgorde=(item->>'route_volgorde')::integer,
      starttijd=nullif(item->>'starttijd','')::time,
      eindtijd=nullif(item->>'eindtijd','')::time,
      reistijd_min=greatest(0,coalesce((item->>'reistijd_min')::integer,0)),
      parking_min=greatest(0,coalesce((item->>'parking_min')::integer,0)),
      afstand_km=greatest(0,coalesce((item->>'afstand_km')::double precision,0)),
      route_mode=case when item->>'route_mode'='walk' then 'walk' else 'car' end,
      route_live=true,
      route_revision=route_revision+1,
      updated_at=now()
    where id=(item->>'id')::uuid and user_id=target and datum=p_date and status<>'Uit planning';
    if not found then raise exception 'Een routebezoek bestaat niet meer.'; end if;
    changed:=changed+1;
  end loop;

  safe_summary:=coalesce(p_summary,'{}'::jsonb)||jsonb_build_object('live',true,'includesReturn',true);
  select coalesce(settings,'{}'::jsonb) into current_settings
  from public.app_day_settings where user_id=target and datum=p_date;
  insert into public.app_day_settings(user_id,datum,vertrektijd,settings,updated_at)
  values(target,p_date,p_departure,coalesce(current_settings,'{}'::jsonb)||jsonb_build_object(
    'day_route',safe_summary,'pause_enabled',coalesce(p_pause_enabled,true)
  ),now())
  on conflict(user_id,datum) do update set
    vertrektijd=excluded.vertrektijd,settings=excluded.settings,updated_at=now();

  return jsonb_build_object('changed',changed,'summary',safe_summary);
end
$$;

revoke all on function public.save_day_route(uuid,date,time,jsonb,jsonb,boolean) from public,anon;
grant execute on function public.save_day_route(uuid,date,time,jsonb,jsonb,boolean) to authenticated;

-- Herstel eerder tegenstrijdige dagstatussen zonder afstanden of bezoeken te wijzigen.
with route_state as (
  select user_id,datum,bool_and(route_live) as all_live
  from public.planning where datum is not null and status<>'Uit planning'
  group by user_id,datum
)
update public.app_day_settings d set
  settings=jsonb_set(
    jsonb_set(d.settings,'{day_route,live}',to_jsonb(s.all_live),true),
    '{day_route,includesReturn}',
    to_jsonb(s.all_live and coalesce(jsonb_typeof(d.settings->'day_route'->'returnLeg')='object',false)),true
  ),
  updated_at=now()
from route_state s
where d.user_id=s.user_id and d.datum=s.datum and d.settings ? 'day_route';

-- Triggerfuncties mogen uitsluitend door hun trigger worden uitgevoerd.
revoke all on function public.handle_new_auth_user() from public,anon,authenticated;
revoke all on function public.protect_profile_security_fields() from public,anon,authenticated;
revoke all on function public.set_workspace_owner() from public,anon,authenticated;
grant execute on function public.handle_new_auth_user() to service_role;
grant execute on function public.protect_profile_security_fields() to service_role;
grant execute on function public.set_workspace_owner() to service_role;

-- Voorkom een dubbele SELECT-policy op user_app_settings.
drop policy if exists user_app_settings_write on public.user_app_settings;
drop policy if exists user_app_settings_insert on public.user_app_settings;
drop policy if exists user_app_settings_update on public.user_app_settings;
drop policy if exists user_app_settings_delete on public.user_app_settings;
create policy user_app_settings_insert on public.user_app_settings for insert to authenticated
with check(user_id=(select auth.uid()) or (select public.is_app_admin()));
create policy user_app_settings_update on public.user_app_settings for update to authenticated
using(user_id=(select auth.uid()) or (select public.is_app_admin()))
with check(user_id=(select auth.uid()) or (select public.is_app_admin()));
create policy user_app_settings_delete on public.user_app_settings for delete to authenticated
using(user_id=(select auth.uid()) or (select public.is_app_admin()));

-- Ontbrekende indexen uit de live Supabase Performance Advisor.
create index if not exists app_server_settings_updated_by_idx on public.app_server_settings(updated_by);
create index if not exists contact_attachments_message_idx on public.contact_attachments(message_id);
create index if not exists contact_attachments_uploader_idx on public.contact_attachments(uploader_id);
create index if not exists contact_messages_sender_idx on public.contact_messages(sender_id);
create index if not exists contact_thread_reads_user_idx on public.contact_thread_reads(user_id);
create index if not exists fixed_appointments_customer_idx on public.fixed_appointments(customer_id);
create index if not exists fixed_appointments_user_idx on public.fixed_appointments(user_id);
create index if not exists location_system_settings_enabled_by_idx on public.location_system_settings(enabled_by);
create index if not exists location_system_settings_updated_by_idx on public.location_system_settings(updated_by);
create index if not exists user_location_settings_requested_by_idx on public.user_location_settings(tracking_requested_by);
create index if not exists visit_history_customer_idx on public.visit_history(customer_id);
create index if not exists visit_history_planning_idx on public.visit_history(planning_id);
create index if not exists visit_photos_user_idx on public.visit_photos(user_id);

commit;
