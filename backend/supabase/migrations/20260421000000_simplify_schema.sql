-- Schema simplification: 20 → 15 tables
-- Changes:
--   factories + logistics_accounts → org_accounts
--   material_point_rules → column on material_types
--   logistics_queue_distances + job distance cols → logistics_distances
--   drop farms (never used)
--   rename: material_submissions→submissions, rewards_catalog→rewards,
--            reward_delivery_jobs→delivery_jobs, factory_intakes→intakes

-- ─── 1. org_accounts (replaces factories + logistics_accounts) ───────────────

create table public.org_accounts (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid references public.profiles(id) on delete cascade,
  type           text not null check (type in ('factory', 'logistics')),
  name_th        text not null,
  location_text  text,
  lat            double precision,
  lng            double precision,
  active         boolean not null default true,
  is_focal_point boolean not null default false,
  created_at     timestamptz not null default now()
);

-- Allow null profile_id (CMU focal-point factory has no login account)
create unique index ux_org_accounts_profile_type
  on public.org_accounts (profile_id, type)
  where profile_id is not null;

alter table public.org_accounts enable row level security;

-- Migrate factories (preserve IDs so pickup_jobs FK stays valid)
insert into public.org_accounts
  (id, profile_id, type, name_th, location_text, lat, lng, active, is_focal_point, created_at)
select id, factory_profile_id, 'factory', name_th, location_text, lat, lng, active, is_focal_point, created_at
from public.factories;

-- Migrate logistics_accounts (preserve IDs)
insert into public.org_accounts
  (id, profile_id, type, name_th, location_text, lat, lng, active, is_focal_point, created_at)
select id, logistics_profile_id, 'logistics', name_th, location_text, lat, lng, active, false, created_at
from public.logistics_accounts;

-- Re-point pickup_jobs.destination_factory_id → org_accounts
alter table public.pickup_jobs
  drop constraint if exists pickup_jobs_destination_factory_id_fkey;

alter table public.pickup_jobs
  add constraint pickup_jobs_destination_factory_id_fkey
  foreign key (destination_factory_id)
  references public.org_accounts(id)
  on delete set null;

drop table public.factories;
drop table public.logistics_accounts;


-- ─── 2. Merge material_point_rules into material_types ───────────────────────

alter table public.material_types
  add column if not exists points_per_kg numeric(12,6);

update public.material_types mt
set points_per_kg = mpr.points_per_kg
from public.material_point_rules mpr
where mpr.material_type = mt.code;

drop table public.material_point_rules;


-- ─── 3. logistics_distances (replaces logistics_queue_distances + job cols) ──

create table public.logistics_distances (
  logistics_profile_id uuid not null references public.profiles(id) on delete cascade,
  reference_type       text not null check (reference_type in ('submission', 'reward_request')),
  reference_id         uuid not null,
  leg                  text not null check (leg in ('to_farmer', 'farmer_to_factory')),
  distance_km          double precision,
  updated_at           timestamptz not null default now(),
  primary key (logistics_profile_id, reference_type, reference_id, leg)
);

-- Migrate existing queue cache rows
insert into public.logistics_distances
  (logistics_profile_id, reference_type, reference_id, leg, distance_km, updated_at)
select logistics_profile_id, reference_type, reference_id, 'to_farmer', distance_km, updated_at
from public.logistics_queue_distances
on conflict do nothing;

drop table public.logistics_queue_distances;

alter table public.pickup_jobs
  drop column if exists distance_to_farmer_km,
  drop column if exists distance_farmer_to_factory_km;

alter table public.reward_delivery_jobs
  drop column if exists distance_to_farmer_km;


-- ─── 4. Drop farms ───────────────────────────────────────────────────────────

alter table public.material_submissions
  drop column if exists farm_id;

drop table if exists public.farms;


-- ─── 5. Rename tables ────────────────────────────────────────────────────────

alter table public.material_submissions  rename to submissions;
alter table public.rewards_catalog       rename to rewards;
alter table public.reward_delivery_jobs  rename to delivery_jobs;
alter table public.factory_intakes       rename to intakes;


-- ─── 6. Recreate stored procs with updated table names ───────────────────────

-- request_reward_trade: rewards_catalog → rewards
create or replace function request_reward_trade(
  p_farmer_profile_id uuid,
  p_reward_id uuid,
  p_quantity integer,
  p_delivery_location_text text default null,
  p_delivery_lat double precision default null,
  p_delivery_lng double precision default null
)
returns table (
  request_id uuid,
  request_status reward_request_status,
  reserved_points integer,
  available_points integer
)
language plpgsql as $$
declare
  v_points_cost integer;
  v_stock_qty integer;
  v_required_points integer;
  v_available_points integer;
  v_request_id uuid;
begin
  if p_quantity <= 0 then
    raise exception 'Quantity must be greater than 0';
  end if;

  select points_cost, stock_qty
    into v_points_cost, v_stock_qty
  from rewards
  where id = p_reward_id and active = true
  limit 1;

  if v_points_cost is null then
    raise exception 'Reward not found or inactive';
  end if;

  if v_stock_qty < p_quantity then
    raise exception 'Insufficient reward stock';
  end if;

  v_required_points := v_points_cost * p_quantity;
  v_available_points := calculate_available_points(p_farmer_profile_id);

  if v_available_points < v_required_points then
    raise exception 'Insufficient available points';
  end if;

  insert into reward_requests (
    farmer_profile_id, reward_id, quantity, requested_points, status,
    delivery_location_text, delivery_lat, delivery_lng
  ) values (
    p_farmer_profile_id, p_reward_id, p_quantity, v_required_points, 'requested',
    p_delivery_location_text, p_delivery_lat, p_delivery_lng
  ) returning id into v_request_id;

  insert into points_ledger (
    farmer_profile_id, entry_type, points_amount, reference_type, reference_id, note
  ) values (
    p_farmer_profile_id, 'reward_reserve', v_required_points,
    'reward_request', v_request_id, 'Reserve points for reward request'
  );

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values ('reward_request', v_request_id, null, 'requested', 'farmer', p_farmer_profile_id, 'Farmer created reward request');

  return query select v_request_id, 'requested'::reward_request_status, v_required_points, calculate_available_points(p_farmer_profile_id);
end;
$$;


-- schedule_pickup_job: factories → org_accounts, material_submissions → submissions
drop function if exists schedule_pickup_job(uuid, uuid, timestamptz, text);
drop function if exists schedule_pickup_job(uuid, uuid, timestamptz, timestamptz, text);
drop function if exists schedule_pickup_job(uuid, uuid, timestamptz, timestamptz, uuid, text);

create or replace function schedule_pickup_job(
  p_submission_id uuid,
  p_logistics_profile_id uuid,
  p_planned_pickup_at timestamptz,
  p_pickup_window_end_at timestamptz,
  p_destination_factory_id uuid,
  p_notes text default null
)
returns table (pickup_job_id uuid, submission_status material_submission_status, pickup_status pickup_job_status)
language plpgsql as $$
declare
  v_submission_status material_submission_status;
  v_job_id uuid;
  v_factory_active boolean;
begin
  if p_pickup_window_end_at < p_planned_pickup_at then
    raise exception 'Pickup window end must be >= pickup window start';
  end if;

  if p_destination_factory_id is null then
    raise exception 'Destination factory is required';
  end if;

  select active into v_factory_active
  from org_accounts
  where id = p_destination_factory_id and type = 'factory'
  limit 1;

  if v_factory_active is null then
    raise exception 'Destination factory not found';
  end if;

  if v_factory_active is not true then
    raise exception 'Destination factory is inactive';
  end if;

  select status into v_submission_status
  from submissions
  where id = p_submission_id
  limit 1;

  if v_submission_status is null then
    raise exception 'Submission not found';
  end if;

  if v_submission_status <> 'submitted' then
    raise exception 'Submission is not in submitted state';
  end if;

  insert into pickup_jobs (
    submission_id, logistics_profile_id, destination_factory_id,
    planned_pickup_at, pickup_window_end_at, status, notes
  ) values (
    p_submission_id, p_logistics_profile_id, p_destination_factory_id,
    p_planned_pickup_at, p_pickup_window_end_at, 'pickup_scheduled', p_notes
  ) returning id into v_job_id;

  update submissions set status = 'pickup_scheduled' where id = p_submission_id;

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values
    ('submission', p_submission_id, 'submitted', 'pickup_scheduled', 'logistics', p_logistics_profile_id, 'Pickup scheduled by logistics'),
    ('pickup_job', v_job_id, null, 'pickup_scheduled', 'logistics', p_logistics_profile_id, 'Pickup job created');

  return query select v_job_id, 'pickup_scheduled'::material_submission_status, 'pickup_scheduled'::pickup_job_status;
end;
$$;


-- mark_pickup_picked_up: material_submissions → submissions
create or replace function mark_pickup_picked_up(
  p_pickup_job_id uuid,
  p_logistics_profile_id uuid
)
returns table (submission_id uuid, pickup_job_id uuid, submission_status material_submission_status, pickup_status pickup_job_status)
language plpgsql as $$
declare
  v_submission_id uuid;
  v_current_status pickup_job_status;
begin
  select pj.submission_id, pj.status
    into v_submission_id, v_current_status
  from pickup_jobs pj
  where pj.id = p_pickup_job_id and pj.logistics_profile_id = p_logistics_profile_id
  limit 1;

  if v_submission_id is null then
    raise exception 'Pickup job not found for logistics actor';
  end if;

  if v_current_status <> 'pickup_scheduled' then
    raise exception 'Pickup job must be pickup_scheduled before picked_up';
  end if;

  update pickup_jobs set status = 'picked_up', picked_up_at = now() where id = p_pickup_job_id;
  update submissions set status = 'picked_up' where id = v_submission_id;

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values
    ('pickup_job', p_pickup_job_id, 'pickup_scheduled', 'picked_up', 'logistics', p_logistics_profile_id, 'Logistics picked up material'),
    ('submission', v_submission_id, 'pickup_scheduled', 'picked_up', 'logistics', p_logistics_profile_id, 'Submission moved to picked_up');

  return query select v_submission_id, p_pickup_job_id, 'picked_up'::material_submission_status, 'picked_up'::pickup_job_status;
end;
$$;


-- mark_pickup_delivered_to_factory: material_submissions → submissions
create or replace function mark_pickup_delivered_to_factory(
  p_pickup_job_id uuid,
  p_logistics_profile_id uuid
)
returns table (submission_id uuid, pickup_job_id uuid, submission_status material_submission_status, pickup_status pickup_job_status)
language plpgsql as $$
declare
  v_submission_id uuid;
  v_current_status pickup_job_status;
begin
  select pj.submission_id, pj.status
    into v_submission_id, v_current_status
  from pickup_jobs pj
  where pj.id = p_pickup_job_id and pj.logistics_profile_id = p_logistics_profile_id
  limit 1;

  if v_submission_id is null then
    raise exception 'Pickup job not found for logistics actor';
  end if;

  if v_current_status not in ('pickup_scheduled', 'picked_up') then
    raise exception 'Pickup job is not in a deliverable state';
  end if;

  update pickup_jobs set status = 'delivered_to_factory', delivered_factory_at = now() where id = p_pickup_job_id;
  update submissions set status = 'delivered_to_factory' where id = v_submission_id;

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values
    ('pickup_job', p_pickup_job_id, v_current_status::text, 'delivered_to_factory', 'logistics', p_logistics_profile_id, 'Material delivered to factory'),
    ('submission', v_submission_id, null, 'delivered_to_factory', 'logistics', p_logistics_profile_id, 'Submission moved to delivered_to_factory');

  return query select v_submission_id, p_pickup_job_id, 'delivered_to_factory'::material_submission_status, 'delivered_to_factory'::pickup_job_status;
end;
$$;


-- confirm_factory_intake: material_submissions→submissions, factory_intakes→intakes, material_point_rules→material_types
create or replace function confirm_factory_intake(
  p_pickup_job_id uuid,
  p_factory_profile_id uuid,
  p_measured_weight_kg numeric,
  p_discrepancy_note text default null
)
returns table (intake_id uuid, credited_points integer, submission_status material_submission_status)
language plpgsql as $$
declare
  v_submission_id uuid;
  v_farmer_profile_id uuid;
  v_material_type text;
  v_pickup_status pickup_job_status;
  v_points_per_kg numeric := 0.010000;
  v_points integer;
  v_intake_id uuid;
begin
  select pj.submission_id, pj.status, ms.farmer_profile_id, ms.material_type
    into v_submission_id, v_pickup_status, v_farmer_profile_id, v_material_type
  from pickup_jobs pj
  join submissions ms on ms.id = pj.submission_id
  where pj.id = p_pickup_job_id
  limit 1;

  if v_submission_id is null then
    raise exception 'Pickup job not found';
  end if;

  if v_pickup_status <> 'delivered_to_factory' then
    raise exception 'Pickup job must be delivered_to_factory before confirmation';
  end if;

  select points_per_kg into v_points_per_kg
  from material_types
  where code = v_material_type
  limit 1;

  v_points := greatest(floor(p_measured_weight_kg * coalesce(v_points_per_kg, 0.010000)), 1);

  insert into intakes (
    pickup_job_id, factory_profile_id, measured_weight_kg, discrepancy_note, status, confirmed_at
  ) values (
    p_pickup_job_id, p_factory_profile_id, p_measured_weight_kg, p_discrepancy_note, 'confirmed', now()
  ) returning id into v_intake_id;

  update pickup_jobs set status = 'factory_confirmed', factory_confirmed_at = now() where id = p_pickup_job_id;
  update submissions set status = 'factory_confirmed' where id = v_submission_id;

  insert into points_ledger (farmer_profile_id, entry_type, points_amount, reference_type, reference_id, note)
  values (v_farmer_profile_id, 'intake_credit', v_points, 'factory_intake', v_intake_id, 'Factory confirmed intake and credited points');

  update submissions set status = 'points_credited' where id = v_submission_id;

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values
    ('pickup_job', p_pickup_job_id, 'delivered_to_factory', 'factory_confirmed', 'factory', p_factory_profile_id, 'Factory confirmed intake'),
    ('submission', v_submission_id, 'delivered_to_factory', 'factory_confirmed', 'factory', p_factory_profile_id, 'Submission confirmed by factory'),
    ('submission', v_submission_id, 'factory_confirmed', 'points_credited', 'system', p_factory_profile_id, 'Points credited after confirmation');

  return query select v_intake_id, v_points, 'points_credited'::material_submission_status;
end;
$$;


-- schedule_reward_delivery_job: reward_delivery_jobs → delivery_jobs
create or replace function schedule_reward_delivery_job(
  p_reward_request_id uuid,
  p_logistics_profile_id uuid,
  p_planned_delivery_at timestamptz,
  p_notes text default null
)
returns table (delivery_job_id uuid, delivery_status reward_delivery_status)
language plpgsql as $$
declare
  v_status reward_request_status;
  v_job_id uuid;
  v_existing_delivery_status reward_delivery_status;
begin
  select status into v_status
  from reward_requests
  where id = p_reward_request_id
  limit 1;

  if v_status is null then
    raise exception 'Reward request not found';
  end if;

  if v_status <> 'warehouse_approved' then
    raise exception 'Reward request must be warehouse_approved before delivery scheduling';
  end if;

  select rdj.status into v_existing_delivery_status
  from delivery_jobs rdj
  where rdj.reward_request_id = p_reward_request_id and rdj.status <> 'cancelled'
  order by rdj.created_at desc
  limit 1;

  if v_existing_delivery_status is not null then
    raise exception 'Reward request already has a delivery job in status: %', v_existing_delivery_status;
  end if;

  insert into delivery_jobs (reward_request_id, logistics_profile_id, planned_delivery_at, status, notes)
  values (p_reward_request_id, p_logistics_profile_id, p_planned_delivery_at, 'reward_delivery_scheduled', p_notes)
  returning id into v_job_id;

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values ('reward_delivery_job', v_job_id, null, 'reward_delivery_scheduled', 'logistics', p_logistics_profile_id, 'Reward delivery job scheduled');

  return query select v_job_id, 'reward_delivery_scheduled'::reward_delivery_status;
end;
$$;


-- mark_reward_out_for_delivery: reward_delivery_jobs → delivery_jobs
create or replace function mark_reward_out_for_delivery(
  p_delivery_job_id uuid,
  p_logistics_profile_id uuid
)
returns table (reward_request_id uuid, delivery_job_id uuid, delivery_status reward_delivery_status)
language plpgsql as $$
declare
  v_request_id uuid;
  v_status reward_delivery_status;
begin
  select rdj.reward_request_id, rdj.status
    into v_request_id, v_status
  from delivery_jobs rdj
  where rdj.id = p_delivery_job_id and rdj.logistics_profile_id = p_logistics_profile_id
  limit 1;

  if v_request_id is null then
    raise exception 'Reward delivery job not found for logistics actor';
  end if;

  if v_status <> 'reward_delivery_scheduled' then
    raise exception 'Reward delivery job must be reward_delivery_scheduled first';
  end if;

  update delivery_jobs set status = 'out_for_delivery', out_for_delivery_at = now() where id = p_delivery_job_id;

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values ('reward_delivery_job', p_delivery_job_id, 'reward_delivery_scheduled', 'out_for_delivery', 'logistics', p_logistics_profile_id, 'Reward out for delivery');

  return query select v_request_id, p_delivery_job_id, 'out_for_delivery'::reward_delivery_status;
end;
$$;


-- mark_reward_delivered: reward_delivery_jobs → delivery_jobs
create or replace function mark_reward_delivered(
  p_delivery_job_id uuid,
  p_logistics_profile_id uuid
)
returns table (reward_request_id uuid, delivery_job_id uuid, delivery_status reward_delivery_status)
language plpgsql as $$
declare
  v_request_id uuid;
  v_status reward_delivery_status;
begin
  select rdj.reward_request_id, rdj.status
    into v_request_id, v_status
  from delivery_jobs rdj
  where rdj.id = p_delivery_job_id and rdj.logistics_profile_id = p_logistics_profile_id
  limit 1;

  if v_request_id is null then
    raise exception 'Reward delivery job not found for logistics actor';
  end if;

  if v_status not in ('reward_delivery_scheduled', 'out_for_delivery') then
    raise exception 'Reward delivery job must be scheduled or out_for_delivery';
  end if;

  update delivery_jobs set status = 'reward_delivered', delivered_at = now() where id = p_delivery_job_id;

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values ('reward_delivery_job', p_delivery_job_id, v_status::text, 'reward_delivered', 'logistics', p_logistics_profile_id, 'Reward delivered to farmer');

  return query select v_request_id, p_delivery_job_id, 'reward_delivered'::reward_delivery_status;
end;
$$;
