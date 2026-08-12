-- Planyx v11.4.6 koerierscorrectie R2
-- Eenmalig uitvoeren na SUPABASE_V11_4_6_COURIER.sql.

begin;

update public.profiles set app_mode='field_service',updated_at=now()
where id='7b870312-0fd3-4d7c-add6-5bb25588f2de'::uuid;

update public.profiles set app_mode='courier',updated_at=now()
where id='28ccccdc-b7ef-4397-a01f-f1218f5303b7'::uuid
  and lower(email)='info@routerunner-direct.com';

alter table public.courier_orders
  add column if not exists route_lock text;
alter table public.courier_orders drop constraint if exists courier_orders_route_lock_check;
alter table public.courier_orders add constraint courier_orders_route_lock_check
  check (route_lock is null or route_lock in ('first','last'));

create unique index if not exists courier_orders_one_route_lock_idx
  on public.courier_orders(user_id,delivery_date,route_lock)
  where route_lock is not null and delivery_status='pending';

commit;
