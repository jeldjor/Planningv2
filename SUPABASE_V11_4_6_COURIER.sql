-- Planyx v11.4.6 - accountgebonden koeriersmodus.
-- Herhaalbaar uit te voeren nadat de bestaande v11.3.8 migraties zijn geinstalleerd.

begin;

alter table public.profiles
  add column if not exists app_mode text not null default 'field_service';

alter table public.profiles drop constraint if exists profiles_app_mode_check;
alter table public.profiles add constraint profiles_app_mode_check
  check (app_mode in ('field_service','courier'));

-- Alleen dit vooraf aangemaakte account krijgt de compacte koeriersweergave.
update public.profiles
set app_mode='courier',updated_at=now()
where id='7b870312-0fd3-4d7c-add6-5bb25588f2de'::uuid;

create or replace function public.protect_profile_security_fields()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (select auth.uid()) is not null and not public.is_app_admin() then
    new.role := old.role;
    new.is_active := old.is_active;
    new.app_mode := old.app_mode;
  end if;
  return new;
end
$$;

create table if not exists public.courier_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_id text not null,
  cargo_id text,
  source_c_id text,
  source_status text,
  reference text,
  delivery_date date not null,
  delivery_time_from time,
  delivery_time_to time,
  recipient_company text,
  recipient_name text not null default 'Klant',
  recipient_phone text,
  address1 text,
  address2 text,
  postcode text,
  city text,
  country text,
  country_code text,
  original_address text not null,
  source_address_key text not null,
  route_address text,
  validation_status text not null default 'unchecked'
    check (validation_status in ('unchecked','valid','needs_review','not_found','excluded')),
  validation_message text,
  tomtom_suggestion jsonb,
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending','delivered','excluded')),
  delivered_at timestamptz,
  route_order integer,
  arrival_label text,
  departure_label text,
  travel_minutes integer,
  distance_km double precision,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,external_id)
);

create index if not exists courier_orders_user_date_idx
  on public.courier_orders(user_id,delivery_date,delivery_status,route_order);
create index if not exists courier_orders_address_idx
  on public.courier_orders(user_id,source_address_key);

create table if not exists public.courier_address_corrections (
  user_id uuid not null references auth.users(id) on delete cascade,
  source_address_key text not null,
  original_address text not null,
  route_address text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  approved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id,source_address_key)
);

create table if not exists public.courier_route_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  delivery_date date not null,
  summary jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key(user_id,delivery_date)
);

alter table public.courier_orders enable row level security;
alter table public.courier_address_corrections enable row level security;
alter table public.courier_route_days enable row level security;

drop policy if exists courier_orders_workspace on public.courier_orders;
create policy courier_orders_workspace on public.courier_orders for all to authenticated
  using(user_id=(select auth.uid()) or (select public.is_app_admin()))
  with check(user_id=(select auth.uid()) or (select public.is_app_admin()));

drop policy if exists courier_address_corrections_workspace on public.courier_address_corrections;
create policy courier_address_corrections_workspace on public.courier_address_corrections for all to authenticated
  using(user_id=(select auth.uid()) or (select public.is_app_admin()))
  with check(user_id=(select auth.uid()) or (select public.is_app_admin()));

drop policy if exists courier_route_days_workspace on public.courier_route_days;
create policy courier_route_days_workspace on public.courier_route_days for all to authenticated
  using(user_id=(select auth.uid()) or (select public.is_app_admin()))
  with check(user_id=(select auth.uid()) or (select public.is_app_admin()));

create or replace function public.save_courier_route(
  p_workspace_id uuid,
  p_date date,
  p_rows jsonb,
  p_summary jsonb
) returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  target uuid:=coalesce(p_workspace_id,(select auth.uid()));
  item jsonb;
  expected integer:=0;
  changed integer:=0;
begin
  if (select auth.uid()) is null then raise exception 'Niet ingelogd.'; end if;
  if target<>(select auth.uid()) and not (select public.is_app_admin()) then
    raise exception 'Geen toegang tot deze werkruimte.';
  end if;
  if p_date is null or jsonb_typeof(coalesce(p_rows,'[]'::jsonb))<>'array' then
    raise exception 'Ongeldige koeriersroute.';
  end if;

  select count(*) into expected from public.courier_orders
  where user_id=target and delivery_date=p_date and delivery_status='pending'
    and validation_status='valid';
  if expected<>jsonb_array_length(coalesce(p_rows,'[]'::jsonb)) then
    raise exception 'De bezorglijst is intussen gewijzigd. Vernieuw en probeer opnieuw.';
  end if;

  update public.courier_orders set
    route_order=null,arrival_label=null,departure_label=null,
    travel_minutes=null,distance_km=null,updated_at=now()
  where user_id=target and delivery_date=p_date and delivery_status='pending';

  for item in select value from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) loop
    update public.courier_orders set
      route_order=(item->>'route_order')::integer,
      arrival_label=nullif(item->>'arrival_label',''),
      departure_label=nullif(item->>'departure_label',''),
      travel_minutes=greatest(0,coalesce((item->>'travel_minutes')::integer,0)),
      distance_km=greatest(0,coalesce((item->>'distance_km')::double precision,0)),
      updated_at=now()
    where id=(item->>'id')::uuid and user_id=target and delivery_date=p_date
      and delivery_status='pending' and validation_status='valid';
    if not found then raise exception 'Een bezorgopdracht bestaat niet meer.'; end if;
    changed:=changed+1;
  end loop;

  insert into public.courier_route_days(user_id,delivery_date,summary,updated_at)
  values(target,p_date,coalesce(p_summary,'{}'::jsonb),now())
  on conflict(user_id,delivery_date) do update set
    summary=excluded.summary,updated_at=now();

  return jsonb_build_object('changed',changed,'summary',coalesce(p_summary,'{}'::jsonb));
end
$$;

revoke all on function public.save_courier_route(uuid,date,jsonb,jsonb) from public,anon;
grant execute on function public.save_courier_route(uuid,date,jsonb,jsonb) to authenticated;
grant select,insert,update,delete on public.courier_orders,public.courier_address_corrections,public.courier_route_days to authenticated;

do $$ begin
  begin alter publication supabase_realtime add table public.courier_orders; exception when duplicate_object then null; end;
end $$;

commit;

