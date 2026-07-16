-- Planning-GJsystems v11.3.2
-- Cumulatieve release na SUPABASE_V11_3_RELEASE.sql.
-- Bevat v11.3.1 (betrouwbare uitvoerstatus en historie bewerken) plus volledig leegmaken.

begin;

do $$
begin
  if to_regclass('public.planning') is null
     or to_regclass('public.visit_history') is null
     or to_regclass('public.visit_photos') is null
     or to_regprocedure('public.complete_visit(uuid,uuid,text,text,text,time without time zone,time without time zone,integer,double precision,integer)') is null then
    raise exception 'Voer eerst SUPABASE_V11_3_RELEASE.sql uit.';
  end if;
end
$$;

-- DELETE-events bevatten hierdoor ook user_id, zodat de gefilterde Realtime-stream
-- de verwijdering direct op het andere apparaat kan verwerken.
alter table public.app_absences replica identity full;

-- Een uitvoerstatus zonder historie is ongeldig en wordt veilig teruggezet.
update public.planning p set status='Gepland',uitgevoerd=false,updated_at=now()
where (p.status in ('Uitgevoerd','Niet uitgevoerd') or p.uitgevoerd=true)
  and not exists(
    select 1 from public.visit_history h
    where h.user_id=p.user_id and h.planning_id=p.id
  );

create or replace function public.guard_completed_planning_history()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if (new.status in ('Uitgevoerd','Niet uitgevoerd') or new.uitgevoerd=true)
     and not exists(select 1 from public.visit_history h where h.user_id=new.user_id and h.planning_id=new.id) then
    raise exception 'Een opdracht kan alleen via Bezoek afronden op uitgevoerd worden gezet.';
  end if;
  return new;
end
$$;

drop trigger if exists planning_completed_requires_history on public.planning;
create constraint trigger planning_completed_requires_history
after insert or update of status,uitgevoerd on public.planning
deferrable initially deferred for each row execute function public.guard_completed_planning_history();
revoke all on function public.guard_completed_planning_history() from public,anon,authenticated;

create or replace function public.reset_planning_after_history_delete()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if old.planning_id is not null then
    update public.planning set status='Gepland',uitgevoerd=false,updated_at=now()
    where id=old.planning_id and user_id=old.user_id
      and not exists(select 1 from public.visit_history h where h.user_id=old.user_id and h.planning_id=old.planning_id);
  end if;
  return old;
end
$$;

drop trigger if exists visit_history_resets_planning on public.visit_history;
create trigger visit_history_resets_planning after delete on public.visit_history
for each row execute function public.reset_planning_after_history_delete();
revoke all on function public.reset_planning_after_history_delete() from public,anon,authenticated;

create or replace function public.update_visit_history(
  p_workspace_id uuid,
  p_history_id uuid,
  p_visit_date date,
  p_status text,
  p_activity text default '',
  p_summary text default ''
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  target uuid:=coalesce(p_workspace_id,(select auth.uid()));
  history_row public.visit_history%rowtype;
  normalized_status text:=trim(coalesce(p_status,''));
begin
  if (select auth.uid()) is null then raise exception 'Niet ingelogd.'; end if;
  if target<>(select auth.uid()) and not (select public.is_app_admin()) then raise exception 'Geen toegang tot deze werkruimte.'; end if;
  if p_history_id is null then raise exception 'De historiekoppeling ontbreekt.'; end if;
  if p_visit_date is null then raise exception 'Kies een geldige datum van uitvoering.'; end if;
  if normalized_status not in ('Uitgevoerd','Niet uitgevoerd') then raise exception 'Kies Uitgevoerd of Niet uitgevoerd.'; end if;

  select * into history_row from public.visit_history
  where id=p_history_id and user_id=target for update;
  if not found then raise exception 'Het uitgevoerde bezoek bestaat niet meer in deze werkruimte.'; end if;

  update public.visit_history set
    bezoekdatum=p_visit_date,status=normalized_status,
    activiteit=nullif(trim(coalesce(p_activity,'')),''),
    samenvatting=nullif(trim(coalesce(p_summary,'')),''),
    reden=case when normalized_status='Niet uitgevoerd' then nullif(trim(coalesce(p_summary,'')),'') else null end,
    afgerond=true,updated_at=now()
  where id=history_row.id and user_id=target;

  if history_row.planning_id is not null then
    update public.planning set status=normalized_status,
      uitgevoerd=(normalized_status='Uitgevoerd'),updated_at=now()
    where id=history_row.planning_id and user_id=target;
  end if;

  return jsonb_build_object('history_id',history_row.id,'planning_id',history_row.planning_id,'visit_date',p_visit_date,'status',normalized_status);
end
$$;
revoke all on function public.update_visit_history(uuid,uuid,date,text,text,text) from public,anon;
grant execute on function public.update_visit_history(uuid,uuid,date,text,text,text) to authenticated;

-- Werkruimte volledig en in de juiste afhankelijkheidsvolgorde leegmaken.
-- Storage-bestanden zelf worden vooraf via de officiële Storage API door de app verwijderd.
create or replace function public.clear_workspace_data(p_workspace_id uuid,p_action text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  caller uuid:=(select auth.uid());
  target uuid:=coalesce(p_workspace_id,caller);
  action text:=lower(trim(coalesce(p_action,'')));
  affected bigint:=0;
  amount bigint:=0;
begin
  if caller is null then raise exception 'Niet ingelogd'; end if;
  if target<>caller and not public.is_app_admin() then raise exception 'Geen toegang tot deze werkruimte'; end if;
  if action not in ('planning','fixed','unplanned','history','routes','database','all') then raise exception 'Ongeldige actie'; end if;

  if action in ('history','database','all') then
    delete from public.visit_photos where user_id=target;
    get diagnostics amount=row_count;affected:=affected+amount;
    delete from public.visit_history where user_id=target;
    get diagnostics amount=row_count;affected:=affected+amount;
  end if;

  if action='planning' then
    update public.visit_history set planning_id=null,updated_at=now() where user_id=target and planning_id is not null;
    delete from public.planning where user_id=target;
    get diagnostics amount=row_count;affected:=affected+amount;
  elsif action in ('database','all') then
    delete from public.planning where user_id=target;
    get diagnostics amount=row_count;affected:=affected+amount;
  end if;

  if action='fixed' then
    update public.visit_history h set planning_id=null,updated_at=now()
    where h.user_id=target and exists(select 1 from public.planning p where p.id=h.planning_id and p.user_id=target and coalesce(p.vast,false));
    delete from public.planning where user_id=target and coalesce(vast,false);
    get diagnostics amount=row_count;affected:=affected+amount;
    delete from public.fixed_appointments where user_id=target;
    get diagnostics amount=row_count;affected:=affected+amount;
  elsif action in ('database','all') then
    delete from public.fixed_appointments where user_id=target;
    get diagnostics amount=row_count;affected:=affected+amount;
  end if;

  if action='unplanned' then
    update public.visit_history h set planning_id=null,updated_at=now()
    where h.user_id=target and exists(select 1 from public.planning p where p.id=h.planning_id and p.user_id=target and p.status in ('Uit planning','Niet ingepland'));
    delete from public.planning where user_id=target and status in ('Uit planning','Niet ingepland');
    get diagnostics amount=row_count;affected:=affected+amount;
  end if;

  if action in ('database','all') then
    delete from public.customers where user_id=target;
    get diagnostics amount=row_count;affected:=affected+amount;
  end if;

  if action='all' then
    delete from public.app_absences where user_id=target;
    get diagnostics amount=row_count;affected:=affected+amount;
    delete from public.app_day_settings where user_id=target;
    get diagnostics amount=row_count;affected:=affected+amount;
  end if;

  return jsonb_build_object('ok',true,'deleted',affected,'workspace_id',target,'action',action);
end
$$;

revoke all on function public.clear_workspace_data(uuid,text) from public,anon;
grant execute on function public.clear_workspace_data(uuid,text) to authenticated;

create or replace function public.gj_clear_data(p_action text)
returns jsonb language sql security invoker set search_path=public,pg_temp as $$
  select public.clear_workspace_data((select auth.uid()),p_action)
$$;
revoke all on function public.gj_clear_data(text) from public,anon;
grant execute on function public.gj_clear_data(text) to authenticated;

commit;
