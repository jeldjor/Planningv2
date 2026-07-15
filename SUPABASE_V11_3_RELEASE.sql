-- Planning-GJsystems v11.3.0
-- Atomaire bezoekafronding en eenduidige historie-opslag.
-- Idempotent: veilig opnieuw uit te voeren via Supabase SQL Editor.

begin;

do $$
begin
  if to_regclass('public.planning') is null
     or to_regclass('public.visit_history') is null
     or to_regprocedure('public.is_app_admin()') is null then
    raise exception 'Voer eerst de bestaande Planning-GJsystems-baseline uit.';
  end if;
end
$$;

-- Eén planningregel heeft maximaal één gezaghebbende historierij.
create unique index if not exists visit_history_one_per_planning_idx
  on public.visit_history(user_id,planning_id)
  where planning_id is not null;

create or replace function public.complete_visit(
  p_workspace_id uuid,
  p_planning_id uuid,
  p_status text,
  p_activity text default '',
  p_summary text default '',
  p_start time default null,
  p_end time default null,
  p_duration integer default null,
  p_distance double precision default null,
  p_travel integer default null
) returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  target uuid:=coalesce(p_workspace_id,(select auth.uid()));
  planned public.planning%rowtype;
  history_id uuid;
  normalized_status text:=trim(coalesce(p_status,''));
begin
  if (select auth.uid()) is null then raise exception 'Niet ingelogd.'; end if;
  if target<>(select auth.uid()) and not (select public.is_app_admin()) then
    raise exception 'Geen toegang tot deze werkruimte.';
  end if;
  if p_planning_id is null then raise exception 'De planningkoppeling ontbreekt.'; end if;
  if normalized_status not in ('Uitgevoerd','Niet uitgevoerd') then
    raise exception 'Kies Uitgevoerd of Niet uitgevoerd.';
  end if;

  select * into planned
  from public.planning
  where id=p_planning_id and user_id=target
  for update;
  if not found then raise exception 'De opdracht bestaat niet meer in deze werkruimte.'; end if;
  if planned.customer_id is null then raise exception 'De opdracht heeft geen geldige klantkoppeling.'; end if;

  update public.planning set
    status=normalized_status,
    uitgevoerd=(normalized_status='Uitgevoerd'),
    updated_at=now()
  where id=planned.id and user_id=target;

  select id into history_id
  from public.visit_history
  where user_id=target and planning_id=planned.id
  order by created_at desc
  limit 1
  for update;

  if history_id is null then
    insert into public.visit_history(
      user_id,customer_id,planning_id,bezoekdatum,starttijd,eindtijd,
      activiteit,samenvatting,opmerkingen,reden,status,duur_min,
      afstand_km,reistijd_min,afgerond,updated_at
    ) values (
      target,planned.customer_id,planned.id,planned.datum,
      coalesce(p_start,planned.starttijd),coalesce(p_end,planned.eindtijd),
      nullif(trim(coalesce(p_activity,'')),''),nullif(trim(coalesce(p_summary,'')),''),'',
      case when normalized_status='Niet uitgevoerd' then nullif(trim(coalesce(p_summary,'')),'') else null end,
      normalized_status,coalesce(p_duration,planned.bezoekduur_min),
      coalesce(p_distance,planned.afstand_km),coalesce(p_travel,planned.reistijd_min),true,now()
    ) returning id into history_id;
  else
    update public.visit_history set
      customer_id=planned.customer_id,
      bezoekdatum=planned.datum,
      starttijd=coalesce(p_start,planned.starttijd),
      eindtijd=coalesce(p_end,planned.eindtijd),
      activiteit=nullif(trim(coalesce(p_activity,'')),''),
      samenvatting=nullif(trim(coalesce(p_summary,'')),''),
      opmerkingen='',
      reden=case when normalized_status='Niet uitgevoerd' then nullif(trim(coalesce(p_summary,'')),'') else null end,
      status=normalized_status,
      duur_min=coalesce(p_duration,planned.bezoekduur_min),
      afstand_km=coalesce(p_distance,planned.afstand_km),
      reistijd_min=coalesce(p_travel,planned.reistijd_min),
      afgerond=true,
      updated_at=now()
    where id=history_id and user_id=target;
  end if;

  return jsonb_build_object(
    'history_id',history_id,
    'planning_id',planned.id,
    'customer_id',planned.customer_id,
    'status',normalized_status
  );
end
$$;

revoke all on function public.complete_visit(uuid,uuid,text,text,text,time,time,integer,double precision,integer) from public,anon;
grant execute on function public.complete_visit(uuid,uuid,text,text,text,time,time,integer,double precision,integer) to authenticated;

commit;
