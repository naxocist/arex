-- Minimal schema cleanup: drop unused farm structures and enforce pickup RPC signature.

alter table if exists public.material_submissions
  drop column if exists farm_id;

drop table if exists public.farms cascade;

-- Keep only canonical pickup scheduling RPC with destination factory support.
drop function if exists public.schedule_pickup_job(uuid, uuid, timestamptz, text);
drop function if exists public.schedule_pickup_job(uuid, uuid, timestamptz, timestamptz, text);

do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'schedule_pickup_job'
      and oidvectortypes(p.proargtypes) = 'uuid, uuid, timestamp with time zone, timestamp with time zone, uuid, text'
  ) then
    raise exception 'Expected canonical public.schedule_pickup_job(uuid, uuid, timestamptz, timestamptz, uuid, text) is missing. Apply the previous pickup-destination migration first.';
  end if;
end
$$;
