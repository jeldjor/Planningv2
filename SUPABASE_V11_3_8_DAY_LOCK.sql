-- Planyx veiligheidsupdate: hele dag uit planning + definitieve datumvergrendeling.
-- Eenmalig uitvoeren in Supabase SQL Editor na de bestaande v11.3.2-release.

begin;

do $$
begin
  if to_regclass('public.planning') is null
     or to_regprocedure('public.clear_workspace_data(uuid,text)') is null then
    raise exception 'Voer eerst SUPABASE_V11_3_2_RELEASE.sql uit.';
  end if;
end
$$;

create or replace function public.planyx_planning_is_completed(p_status text,p_executed boolean)
returns boolean language sql immutable parallel safe set search_path=public,pg_temp as $$
  select coalesce(p_executed,false)
      or lower(trim(coalesce(p_status,''))) in ('uitgevoerd','niet uitgevoerd','bezocht')
$$;
revoke all on function public.planyx_planning_is_completed(text,boolean) from public,anon;
grant execute on function public.planyx_planning_is_completed(text,boolean) to authenticated;

create or replace function public.protect_completed_planning()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  allow_clear boolean:=coalesce(current_setting('planyx.allow_terminal_clear',true),'')='on';
begin
  if not public.planyx_planning_is_completed(old.status,old.uitgevoerd) or allow_clear then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  if tg_op='DELETE' then
    raise exception 'Uitgevoerde opdrachten blijven staan tot Planning leegmaken of Alles resetten wordt gebruikt.';
  end if;
  if new.datum is distinct from old.datum then
    raise exception 'Een uitgevoerde opdracht kan niet naar een andere datum worden verplaatst.';
  end if;
  if not public.planyx_planning_is_completed(new.status,new.uitgevoerd) then
    raise exception 'Een uitgevoerde opdracht kan niet opnieuw open of uit planning worden gezet.';
  end if;
  return new;
end
$$;

drop trigger if exists planning_completed_is_immutable on public.planning;
create trigger planning_completed_is_immutable
before update of datum,status,uitgevoerd or delete on public.planning
for each row execute function public.protect_completed_planning();
revoke all on function public.protect_completed_planning() from public,anon,authenticated;

create or replace function public.remove_planning_day(
  p_workspace_id uuid,
  p_date date
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  target uuid:=coalesce(p_workspace_id,(select auth.uid()));
  removed_count integer:=0;
  protected_count integer:=0;
  removed_customer_ids uuid[]:=array[]::uuid[];
begin
  if (select auth.uid()) is null then raise exception 'Niet ingelogd.'; end if;
  if target<>(select auth.uid()) and not (select public.is_app_admin()) then raise exception 'Geen toegang tot deze werkruimte.'; end if;
  if p_date is null then raise exception 'Kies een geldige dag.'; end if;

  perform 1 from public.planning where user_id=target and datum=p_date for update;
  select count(*) into protected_count from public.planning
  where user_id=target and datum=p_date
    and public.planyx_planning_is_completed(status,uitgevoerd);
  select coalesce(array_agg(distinct customer_id),array[]::uuid[]) into removed_customer_ids
  from public.planning
  where user_id=target and datum=p_date
    and coalesce(status,'Gepland')<>'Uit planning'
    and not public.planyx_planning_is_completed(status,uitgevoerd);

  update public.planning set
    status='Uit planning',vast=false,starttijd=null,eindtijd=null,fixed_starttijd=null,
    route_volgorde=999,reistijd_min=0,parking_min=0,afstand_km=0,
    route_live=false,route_revision=route_revision+1,updated_at=now()
  where user_id=target and datum=p_date
    and coalesce(status,'Gepland')<>'Uit planning'
    and not public.planyx_planning_is_completed(status,uitgevoerd);
  get diagnostics removed_count=row_count;

  delete from public.fixed_appointments
  where user_id=target and datum=p_date and customer_id=any(removed_customer_ids);

  if protected_count=0 then
    delete from public.app_day_settings where user_id=target and datum=p_date;
  else
    update public.app_day_settings
    set settings=coalesce(settings,'{}'::jsonb)-'day_route',updated_at=now()
    where user_id=target and datum=p_date;
  end if;

  return jsonb_build_object('removed',removed_count,'protected',protected_count,'date',p_date);
end
$$;
revoke all on function public.remove_planning_day(uuid,date) from public,anon;
grant execute on function public.remove_planning_day(uuid,date) to authenticated;

create or replace function public.move_planning_day(
  p_workspace_id uuid,
  p_old_date date,
  p_new_date date
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  target uuid:=coalesce(p_workspace_id,(select auth.uid()));
  source_count integer:=0;
  protected_count integer:=0;
  destination_count integer:=0;
  moved_customer_ids uuid[]:=array[]::uuid[];
begin
  if (select auth.uid()) is null then raise exception 'Niet ingelogd.'; end if;
  if target<>(select auth.uid()) and not (select public.is_app_admin()) then raise exception 'Geen toegang tot deze werkruimte.'; end if;
  if p_old_date is null or p_new_date is null or p_old_date=p_new_date then raise exception 'Ongeldige dagverplaatsing.'; end if;

  perform 1 from public.planning where user_id=target and datum in (p_old_date,p_new_date) for update;
  select count(*) into source_count from public.planning
  where user_id=target and datum=p_old_date and coalesce(status,'Gepland')<>'Uit planning'
    and not public.planyx_planning_is_completed(status,uitgevoerd);
  select count(*) into protected_count from public.planning
  where user_id=target and datum=p_old_date and public.planyx_planning_is_completed(status,uitgevoerd);
  select count(*) into destination_count from public.planning
  where user_id=target and datum=p_new_date and coalesce(status,'Gepland')<>'Uit planning';
  if source_count=0 then raise exception 'De dag bevat geen verplaatsbare opdrachten.'; end if;
  if destination_count>0 then raise exception 'De nieuwe dag bevat al geplande bezoeken.'; end if;

  select coalesce(array_agg(distinct customer_id),array[]::uuid[]) into moved_customer_ids
  from public.planning where user_id=target and datum=p_old_date
    and coalesce(status,'Gepland')<>'Uit planning'
    and not public.planyx_planning_is_completed(status,uitgevoerd);

  update public.planning set datum=p_new_date,starttijd=null,eindtijd=null,
    reistijd_min=0,parking_min=0,afstand_km=0,route_live=false,
    route_revision=route_revision+1,updated_at=now()
  where user_id=target and datum=p_old_date and coalesce(status,'Gepland')<>'Uit planning'
    and not public.planyx_planning_is_completed(status,uitgevoerd);

  insert into public.app_day_settings(user_id,datum,vertrektijd,settings,updated_at)
  select user_id,p_new_date,vertrektijd,settings,now() from public.app_day_settings
  where user_id=target and datum=p_old_date
  on conflict(user_id,datum) do update set vertrektijd=excluded.vertrektijd,settings=excluded.settings,updated_at=now();
  if protected_count=0 then delete from public.app_day_settings where user_id=target and datum=p_old_date; end if;

  update public.fixed_appointments set datum=p_new_date,updated_at=now()
  where user_id=target and datum=p_old_date and customer_id=any(moved_customer_ids);

  return jsonb_build_object('moved',source_count,'protected',protected_count,'old_date',p_old_date,'new_date',p_new_date);
end
$$;
revoke all on function public.move_planning_day(uuid,date,date) from public,anon;
grant execute on function public.move_planning_day(uuid,date,date) to authenticated;

-- De bestaande, expliciete beheeracties mogen de vergrendelde regels wel wissen.
create or replace function public.clear_workspace_data(p_workspace_id uuid,p_action text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  caller uuid:=(select auth.uid());target uuid:=coalesce(p_workspace_id,caller);
  action text:=lower(trim(coalesce(p_action,'')));affected bigint:=0;amount bigint:=0;
begin
  if caller is null then raise exception 'Niet ingelogd'; end if;
  if target<>caller and not public.is_app_admin() then raise exception 'Geen toegang tot deze werkruimte'; end if;
  if action not in ('planning','fixed','unplanned','history','routes','database','all') then raise exception 'Ongeldige actie'; end if;
  if action in ('planning','fixed','history','database','all') then perform set_config('planyx.allow_terminal_clear','on',true); end if;

  if action in ('history','database','all') then
    delete from public.visit_photos where user_id=target;get diagnostics amount=row_count;affected:=affected+amount;
    delete from public.visit_history where user_id=target;get diagnostics amount=row_count;affected:=affected+amount;
  end if;
  if action='planning' then
    update public.visit_history set planning_id=null,updated_at=now() where user_id=target and planning_id is not null;
    delete from public.planning where user_id=target;get diagnostics amount=row_count;affected:=affected+amount;
  elsif action in ('database','all') then
    delete from public.planning where user_id=target;get diagnostics amount=row_count;affected:=affected+amount;
  end if;
  if action='fixed' then
    update public.visit_history h set planning_id=null,updated_at=now() where h.user_id=target and exists(select 1 from public.planning p where p.id=h.planning_id and p.user_id=target and coalesce(p.vast,false));
    delete from public.planning where user_id=target and coalesce(vast,false);get diagnostics amount=row_count;affected:=affected+amount;
    delete from public.fixed_appointments where user_id=target;get diagnostics amount=row_count;affected:=affected+amount;
  elsif action in ('database','all') then
    delete from public.fixed_appointments where user_id=target;get diagnostics amount=row_count;affected:=affected+amount;
  end if;
  if action='unplanned' then
    update public.visit_history h set planning_id=null,updated_at=now() where h.user_id=target and exists(select 1 from public.planning p where p.id=h.planning_id and p.user_id=target and p.status in ('Uit planning','Niet ingepland'));
    delete from public.planning where user_id=target and status in ('Uit planning','Niet ingepland');get diagnostics amount=row_count;affected:=affected+amount;
  end if;
  if action in ('database','all') then delete from public.customers where user_id=target;get diagnostics amount=row_count;affected:=affected+amount;end if;
  if action='all' then
    delete from public.app_absences where user_id=target;get diagnostics amount=row_count;affected:=affected+amount;
    delete from public.app_day_settings where user_id=target;get diagnostics amount=row_count;affected:=affected+amount;
  end if;
  return jsonb_build_object('ok',true,'deleted',affected,'workspace_id',target,'action',action);
end
$$;
revoke all on function public.clear_workspace_data(uuid,text) from public,anon;
grant execute on function public.clear_workspace_data(uuid,text) to authenticated;

-- Installatiecontrole: breek de transactie af als de bescherming of rechten ontbreken.
do $$
begin
  if not public.planyx_planning_is_completed('Uitgevoerd',false)
     or not public.planyx_planning_is_completed('Niet uitgevoerd',false)
     or public.planyx_planning_is_completed('Gepland',false) then
    raise exception 'Controle van definitieve statussen is mislukt.';
  end if;
  if not exists(
    select 1 from pg_trigger
    where tgrelid='public.planning'::regclass and tgname='planning_completed_is_immutable' and tgenabled<>'D'
  ) then raise exception 'De datumvergrendeling is niet actief.'; end if;
  if has_function_privilege('anon','public.remove_planning_day(uuid,date)','EXECUTE')
     or not has_function_privilege('authenticated','public.remove_planning_day(uuid,date)','EXECUTE') then
    raise exception 'De RPC-rechten voor de dagactie zijn niet veilig ingesteld.';
  end if;
end
$$;

commit;
