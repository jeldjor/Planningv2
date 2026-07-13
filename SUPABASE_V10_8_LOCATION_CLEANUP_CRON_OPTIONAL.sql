-- OPTIONEEL en uitsluitend voor het afzonderlijke development/testproject.
-- Voer dit pas handmatig uit nadat pg_cron in dat testproject is geactiveerd.
-- Dit bestand is bewust GEEN onderdeel van de hoofdmigratie.

create extension if not exists pg_cron;

do $$
declare existing_job record;
begin
  for existing_job in
    select jobid from cron.job
    where jobname = 'planning-gjsystems-v108-location-cleanup'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
end
$$;

select cron.schedule(
  'planning-gjsystems-v108-location-cleanup',
  '15 * * * *',
  $$select public.cleanup_location_history();$$
);

-- Controle:
-- select jobid, jobname, schedule, command from cron.job
-- where jobname = 'planning-gjsystems-v108-location-cleanup';

-- Uitschakelen/rollback van alleen de planning:
-- select cron.unschedule('planning-gjsystems-v108-location-cleanup');
