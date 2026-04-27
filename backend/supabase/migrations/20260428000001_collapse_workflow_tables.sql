-- AREX Platform: collapse workflow tables into single-record-per-entity design
--
-- material submissions: submissions + pickup_jobs + intakes → material_submissions
-- reward requests:      reward_requests + delivery_jobs  → reward_requests (expanded)
--
-- New status enums:
--   material_submission_status: submitted, pickup_scheduled, received, delivered, done, cancelled
--   reward_request_status:      requested, approved, rejected, cancelled,
--                               delivery_scheduled, out_for_delivery, done

-- ─── 1. New nullable columns on submissions ───────────────────────────────────

alter table submissions
  add column if not exists logistics_profile_id    uuid references profiles(id) on delete set null,
  add column if not exists destination_factory_id  uuid references org_accounts(id) on delete set null,
  add column if not exists scheduled_pickup_at     timestamptz,
  add column if not exists pickup_window_end_at    timestamptz,
  add column if not exists cancellation_reason     text,
  add column if not exists received_at             timestamptz,
  add column if not exists delivered_at            timestamptz,
  add column if not exists factory_profile_id      uuid references profiles(id) on delete set null,
  add column if not exists measured_weight_kg      numeric(12,3) check (measured_weight_kg is null or measured_weight_kg > 0),
  add column if not exists discrepancy_note        text,
  add column if not exists factory_confirmed_at    timestamptz,
  add column if not exists credited_points         integer;

-- ─── 2. New nullable columns on reward_requests ──────────────────────────────

alter table reward_requests
  add column if not exists logistics_profile_id    uuid references profiles(id) on delete set null,
  add column if not exists scheduled_delivery_at   timestamptz,
  add column if not exists delivery_window_end_at  timestamptz,
  add column if not exists out_for_delivery_at     timestamptz,
  add column if not exists delivered_at            timestamptz;

-- ─── 3. Backfill submissions from pickup_jobs and intakes ────────────────────

-- Active (non-cancelled) pickup jobs → logistics/schedule fields
update submissions s set
  logistics_profile_id   = pj.logistics_profile_id,
  destination_factory_id = pj.destination_factory_id,
  scheduled_pickup_at    = pj.planned_pickup_at,
  pickup_window_end_at   = pj.pickup_window_end_at,
  received_at            = pj.picked_up_at,
  delivered_at           = pj.delivered_factory_at,
  factory_confirmed_at   = pj.factory_confirmed_at
from pickup_jobs pj
where pj.submission_id = s.id
  and pj.status <> 'cancelled';

-- Cancelled pickup jobs → preserve logistics_profile_id on cancelled submissions
update submissions s set
  logistics_profile_id   = pj.logistics_profile_id,
  destination_factory_id = pj.destination_factory_id,
  scheduled_pickup_at    = pj.planned_pickup_at,
  pickup_window_end_at   = pj.pickup_window_end_at
from pickup_jobs pj
where pj.submission_id = s.id
  and pj.status = 'cancelled'
  and s.logistics_profile_id is null;

-- Factory intake fields
update submissions s set
  factory_profile_id = i.factory_profile_id,
  measured_weight_kg = i.measured_weight_kg,
  discrepancy_note   = i.discrepancy_note
from intakes i
join pickup_jobs pj on pj.id = i.pickup_job_id
where pj.submission_id = s.id;

-- Credited points (from points_ledger via intake → pickup_job → submission)
update submissions s set
  credited_points = pl.points_amount
from points_ledger pl
join intakes i       on i.id = pl.reference_id and pl.reference_type = 'factory_intake'
join pickup_jobs pj  on pj.id = i.pickup_job_id
where pj.submission_id = s.id
  and pl.entry_type = 'intake_credit';

-- ─── 4. Backfill reward_requests from delivery_jobs ──────────────────────────

update reward_requests rr set
  logistics_profile_id   = dj.logistics_profile_id,
  scheduled_delivery_at  = dj.planned_delivery_at,
  delivery_window_end_at = dj.delivery_window_end_at,
  out_for_delivery_at    = dj.out_for_delivery_at,
  delivered_at           = dj.delivered_at
from delivery_jobs dj
where dj.reward_request_id = rr.id
  and dj.status <> 'cancelled';

-- ─── 5. Update points_ledger: factory_intake → material_submission ────────────

update points_ledger pl set
  reference_type = 'material_submission',
  reference_id   = pj.submission_id
from intakes i
join pickup_jobs pj on pj.id = i.pickup_job_id
where pl.reference_id  = i.id
  and pl.reference_type = 'factory_intake'
  and pl.entry_type     = 'intake_credit';

-- ─── 6. Update status_events ─────────────────────────────────────────────────

-- Merge pickup_job and reward_delivery_job events into parent entity events
-- (submission/reward_request events carry the same state change info)
delete from status_events
where entity_type in ('pickup_job', 'reward_delivery_job');

-- Rename submission entity type
update status_events
set entity_type = 'material_submission'
where entity_type = 'submission';

-- Update status value names for material_submission
update status_events set
  from_status = case from_status
    when 'picked_up'            then 'received'
    when 'delivered_to_factory' then 'delivered'
    when 'factory_confirmed'    then 'done'
    when 'points_credited'      then 'done'
    else from_status
  end,
  to_status = case to_status
    when 'picked_up'            then 'received'
    when 'delivered_to_factory' then 'delivered'
    when 'factory_confirmed'    then 'done'
    when 'points_credited'      then 'done'
    else to_status
  end
where entity_type = 'material_submission';

-- Update status value names for reward_request
update status_events set
  from_status = case from_status
    when 'warehouse_approved'        then 'approved'
    when 'warehouse_rejected'        then 'rejected'
    when 'reward_delivery_scheduled' then 'delivery_scheduled'
    when 'out_for_delivery'          then 'out_for_delivery'
    when 'reward_delivered'          then 'done'
    else from_status
  end,
  to_status = case to_status
    when 'warehouse_approved'        then 'approved'
    when 'warehouse_rejected'        then 'rejected'
    when 'reward_delivery_scheduled' then 'delivery_scheduled'
    when 'out_for_delivery'          then 'out_for_delivery'
    when 'reward_delivered'          then 'done'
    else to_status
  end
where entity_type = 'reward_request';

-- ─── 7. Drop old RPC functions (free enum dependencies before type changes) ───

drop function if exists schedule_pickup_job(uuid, uuid, timestamptz, timestamptz, uuid, text);
drop function if exists mark_pickup_picked_up(uuid, uuid);
drop function if exists mark_pickup_delivered_to_factory(uuid, uuid);
drop function if exists confirm_factory_intake(uuid, uuid, numeric, text);
drop function if exists cancel_pickup_job_by_logistics(uuid, uuid, text);
drop function if exists cancel_submitted_submission_by_logistics(uuid, uuid, text);
drop function if exists schedule_reward_delivery_job(uuid, uuid, timestamptz, text);
drop function if exists schedule_reward_delivery_job(uuid, uuid, timestamptz, timestamptz, text);
drop function if exists mark_reward_out_for_delivery(uuid, uuid);
drop function if exists mark_reward_delivered(uuid, uuid);
drop function if exists approve_reward_request(uuid, uuid);
drop function if exists reject_reward_request(uuid, uuid, text);
drop function if exists cancel_reward_request_by_farmer(uuid, uuid, text);
drop function if exists request_reward_trade(uuid, uuid, integer, text, double precision, double precision);

-- ─── 8. Recreate material_submission_status enum ─────────────────────────────

create type material_submission_status_new as enum (
  'submitted', 'pickup_scheduled', 'received', 'delivered', 'done', 'cancelled'
);

alter table submissions alter column status drop default;

alter table submissions
  alter column status type material_submission_status_new
  using (case status::text
    when 'submitted'            then 'submitted'
    when 'pickup_scheduled'     then 'pickup_scheduled'
    when 'picked_up'            then 'received'
    when 'delivered_to_factory' then 'delivered'
    when 'factory_confirmed'    then 'done'
    when 'points_credited'      then 'done'
    when 'cancelled'            then 'cancelled'
    else 'cancelled'
  end::material_submission_status_new);

alter table submissions
  alter column status set default 'submitted'::material_submission_status_new;

drop type material_submission_status;
alter type material_submission_status_new rename to material_submission_status;

-- ─── 9. Recreate reward_request_status enum ──────────────────────────────────

-- Compute new status values using delivery_jobs while old tables still exist
alter table reward_requests add column status_new text;

update reward_requests rr set status_new =
  case rr.status::text
    when 'requested'          then 'requested'
    when 'warehouse_rejected' then 'rejected'
    when 'cancelled'          then 'cancelled'
    when 'warehouse_approved' then
      coalesce(
        (select case dj.status::text
           when 'reward_delivered'          then 'done'
           when 'out_for_delivery'          then 'out_for_delivery'
           when 'reward_delivery_scheduled' then 'delivery_scheduled'
           else 'approved'
         end
         from delivery_jobs dj
         where dj.reward_request_id = rr.id
           and dj.status <> 'cancelled'
         limit 1),
        'approved'
      )
    else rr.status::text
  end;

create type reward_request_status_new as enum (
  'requested', 'approved', 'rejected', 'cancelled',
  'delivery_scheduled', 'out_for_delivery', 'done'
);

alter table reward_requests alter column status drop default;

alter table reward_requests
  alter column status type reward_request_status_new
  using status_new::reward_request_status_new;

alter table reward_requests
  alter column status set default 'requested'::reward_request_status_new;

alter table reward_requests drop column status_new;

drop type reward_request_status;
alter type reward_request_status_new rename to reward_request_status;

-- ─── 10. Update logistics_to_farmer_distances ────────────────────────────────

update logistics_to_farmer_distances
set reference_type = 'material_submission'
where reference_type = 'submission';

alter table logistics_to_farmer_distances
  drop constraint logistics_to_farmer_distances_reference_type_check;

alter table logistics_to_farmer_distances
  add constraint logistics_to_farmer_distances_reference_type_check
  check (reference_type in ('material_submission', 'reward_request'));

-- ─── 11. Rename submissions → material_submissions ───────────────────────────

alter table submissions rename to material_submissions;

alter index if exists ix_submissions_farmer_status_created
  rename to ix_material_submissions_farmer_status_created;

drop trigger if exists trg_submissions_updated_at on material_submissions;
create trigger trg_material_submissions_updated_at
  before update on material_submissions
  for each row execute function set_updated_at();

create index if not exists ix_material_submissions_logistics_status
  on material_submissions (logistics_profile_id, status)
  where logistics_profile_id is not null;

-- ─── 12. Rename submission_factory_distances ─────────────────────────────────

alter table submission_factory_distances
  rename to material_submission_factory_distances;

-- ─── 13. Reward requests: add logistics index ────────────────────────────────

create index if not exists ix_reward_requests_logistics_status
  on reward_requests (logistics_profile_id, status)
  where logistics_profile_id is not null;

-- ─── 14. Drop old tables ─────────────────────────────────────────────────────

drop table if exists delivery_jobs;
drop table if exists intakes;
drop table if exists pickup_jobs;

-- ─── 15. Drop obsolete enum types ────────────────────────────────────────────

drop type if exists pickup_job_status;
drop type if exists factory_intake_status;
drop type if exists reward_delivery_status;

-- ─── 16. New RPC functions ───────────────────────────────────────────────────

-- calculate_available_points: unchanged
create or replace function calculate_available_points(p_farmer_profile_id uuid)
returns integer language sql stable as $$
  select
    coalesce(sum(case when entry_type in ('intake_credit','adjustment') then points_amount else 0 end), 0)
    - coalesce(sum(case when entry_type = 'reward_reserve'  then points_amount else 0 end), 0)
    + coalesce(sum(case when entry_type = 'reward_release'  then points_amount else 0 end), 0)
    - coalesce(sum(case when entry_type = 'reward_spend'    then points_amount else 0 end), 0)
  from points_ledger
  where farmer_profile_id = p_farmer_profile_id;
$$;

-- request_reward_trade: create reward request and reserve points
create or replace function request_reward_trade(
  p_farmer_profile_id      uuid,
  p_reward_id              uuid,
  p_quantity               integer,
  p_delivery_location_text text    default null,
  p_delivery_lat           double precision default null,
  p_delivery_lng           double precision default null
)
returns table (request_id uuid, request_status reward_request_status, reserved_points integer, available_points integer)
language plpgsql as $$
declare
  v_points_cost      integer;
  v_stock_qty        integer;
  v_required_points  integer;
  v_available_points integer;
  v_request_id       uuid;
begin
  if p_quantity <= 0 then raise exception 'Quantity must be greater than 0'; end if;

  select points_cost, stock_qty into v_points_cost, v_stock_qty
  from rewards where id = p_reward_id and active = true limit 1;

  if v_points_cost is null then raise exception 'Reward not found or inactive'; end if;
  if v_stock_qty < p_quantity then raise exception 'Insufficient reward stock'; end if;

  v_required_points  := v_points_cost * p_quantity;
  v_available_points := calculate_available_points(p_farmer_profile_id);

  if v_available_points < v_required_points then raise exception 'Insufficient available points'; end if;

  insert into reward_requests (
    farmer_profile_id, reward_id, quantity, requested_points, status,
    delivery_location_text, delivery_lat, delivery_lng
  ) values (
    p_farmer_profile_id, p_reward_id, p_quantity, v_required_points, 'requested',
    p_delivery_location_text, p_delivery_lat, p_delivery_lng
  ) returning id into v_request_id;

  insert into points_ledger (farmer_profile_id, entry_type, points_amount, reference_type, reference_id, note)
  values (p_farmer_profile_id, 'reward_reserve', v_required_points, 'reward_request', v_request_id, 'Reserve points for reward request');

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values ('reward_request', v_request_id, null, 'requested', 'farmer', p_farmer_profile_id, 'Farmer created reward request');

  return query select v_request_id, 'requested'::reward_request_status, v_required_points, calculate_available_points(p_farmer_profile_id);
end; $$;

-- schedule_pickup: logistics accepts a submitted submission
create or replace function schedule_pickup(
  p_submission_id          uuid,
  p_logistics_profile_id   uuid,
  p_planned_pickup_at      timestamptz,
  p_pickup_window_end_at   timestamptz,
  p_destination_factory_id uuid,
  p_notes                  text default null
)
returns table (submission_id uuid, new_status material_submission_status)
language plpgsql as $$
declare
  v_current_status material_submission_status;
  v_factory_active boolean;
begin
  if p_pickup_window_end_at < p_planned_pickup_at then
    raise exception 'Pickup window end must be >= pickup window start';
  end if;
  if p_destination_factory_id is null then
    raise exception 'Destination factory is required';
  end if;

  select active into v_factory_active
  from org_accounts where id = p_destination_factory_id and type = 'factory' limit 1;
  if v_factory_active is null then raise exception 'Destination factory not found'; end if;
  if v_factory_active is not true then raise exception 'Destination factory is inactive'; end if;

  select status into v_current_status
  from material_submissions where id = p_submission_id limit 1;
  if v_current_status is null then raise exception 'Submission not found'; end if;
  if v_current_status <> 'submitted' then raise exception 'Submission is not in submitted state'; end if;

  update material_submissions set
    status                 = 'pickup_scheduled',
    logistics_profile_id   = p_logistics_profile_id,
    destination_factory_id = p_destination_factory_id,
    scheduled_pickup_at    = p_planned_pickup_at,
    pickup_window_end_at   = p_pickup_window_end_at
  where id = p_submission_id;

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values ('material_submission', p_submission_id, 'submitted', 'pickup_scheduled', 'logistics', p_logistics_profile_id,
    coalesce(p_notes, 'Pickup scheduled by logistics'));

  return query select p_submission_id, 'pickup_scheduled'::material_submission_status;
end; $$;

-- cancel_submission_by_logistics: cancel from submitted or pickup_scheduled
create or replace function cancel_submission_by_logistics(
  p_submission_id        uuid,
  p_logistics_profile_id uuid,
  p_reason               text default null
)
returns table (submission_id uuid, new_status material_submission_status)
language plpgsql security definer as $$
declare
  v_current_status material_submission_status;
begin
  select status into v_current_status
  from material_submissions
  where id = p_submission_id
    and (logistics_profile_id = p_logistics_profile_id or status = 'submitted')
  limit 1;

  if v_current_status is null then
    raise exception 'Submission not found or not accessible by this logistics actor';
  end if;
  if v_current_status not in ('submitted', 'pickup_scheduled') then
    raise exception 'Submission is not in a cancellable state';
  end if;

  update material_submissions set
    status              = 'cancelled',
    cancellation_reason = p_reason
  where id = p_submission_id;

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values ('material_submission', p_submission_id, v_current_status::text, 'cancelled', 'logistics', p_logistics_profile_id, p_reason);

  return query select p_submission_id, 'cancelled'::material_submission_status;
end; $$;

-- mark_received: logistics picked up material from farmer
create or replace function mark_received(
  p_submission_id        uuid,
  p_logistics_profile_id uuid
)
returns table (submission_id uuid, new_status material_submission_status)
language plpgsql as $$
declare
  v_current_status material_submission_status;
begin
  select status into v_current_status
  from material_submissions
  where id = p_submission_id and logistics_profile_id = p_logistics_profile_id limit 1;

  if v_current_status is null then raise exception 'Submission not found for logistics actor'; end if;
  if v_current_status <> 'pickup_scheduled' then
    raise exception 'Submission must be pickup_scheduled before marking received';
  end if;

  update material_submissions set
    status      = 'received',
    received_at = now()
  where id = p_submission_id;

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values ('material_submission', p_submission_id, 'pickup_scheduled', 'received', 'logistics', p_logistics_profile_id, 'Logistics picked up material from farmer');

  return query select p_submission_id, 'received'::material_submission_status;
end; $$;

-- mark_delivered_to_factory: logistics delivered to factory
create or replace function mark_delivered_to_factory(
  p_submission_id        uuid,
  p_logistics_profile_id uuid
)
returns table (submission_id uuid, new_status material_submission_status)
language plpgsql as $$
declare
  v_current_status material_submission_status;
begin
  select status into v_current_status
  from material_submissions
  where id = p_submission_id and logistics_profile_id = p_logistics_profile_id limit 1;

  if v_current_status is null then raise exception 'Submission not found for logistics actor'; end if;
  if v_current_status not in ('pickup_scheduled', 'received') then
    raise exception 'Submission is not in a deliverable state';
  end if;

  update material_submissions set
    status       = 'delivered',
    delivered_at = now()
  where id = p_submission_id;

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values ('material_submission', p_submission_id, v_current_status::text, 'delivered', 'logistics', p_logistics_profile_id, 'Material delivered to factory');

  return query select p_submission_id, 'delivered'::material_submission_status;
end; $$;

-- confirm_intake: factory confirms weight and issues points
create or replace function confirm_intake(
  p_submission_id      uuid,
  p_factory_profile_id uuid,
  p_measured_weight_kg numeric,
  p_discrepancy_note   text default null
)
returns table (submission_id uuid, credited_points integer, new_status material_submission_status)
language plpgsql as $$
declare
  v_farmer_profile_id uuid;
  v_material_type     text;
  v_current_status    material_submission_status;
  v_points_per_kg     numeric := 0.010000;
  v_points            integer;
begin
  select ms.farmer_profile_id, ms.material_type, ms.status
    into v_farmer_profile_id, v_material_type, v_current_status
  from material_submissions ms where ms.id = p_submission_id limit 1;

  if v_farmer_profile_id is null then raise exception 'Submission not found'; end if;
  if v_current_status <> 'delivered' then
    raise exception 'Submission must be delivered before confirmation';
  end if;

  select points_per_kg into v_points_per_kg
  from material_types where code = v_material_type limit 1;

  v_points := greatest(floor(p_measured_weight_kg * coalesce(v_points_per_kg, 0.010000))::integer, 1);

  update material_submissions set
    status               = 'done',
    factory_profile_id   = p_factory_profile_id,
    measured_weight_kg   = p_measured_weight_kg,
    discrepancy_note     = p_discrepancy_note,
    factory_confirmed_at = now(),
    credited_points      = v_points
  where id = p_submission_id;

  insert into points_ledger (farmer_profile_id, entry_type, points_amount, reference_type, reference_id, note)
  values (v_farmer_profile_id, 'intake_credit', v_points, 'material_submission', p_submission_id, 'Factory confirmed intake and credited points');

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values ('material_submission', p_submission_id, 'delivered', 'done', 'factory', p_factory_profile_id, 'Factory confirmed intake, points credited');

  return query select p_submission_id, v_points, 'done'::material_submission_status;
end; $$;

-- reschedule_pickup: update scheduled pickup window
create or replace function reschedule_pickup(
  p_submission_id        uuid,
  p_logistics_profile_id uuid,
  p_new_pickup_at        timestamptz,
  p_new_window_end_at    timestamptz
)
returns table (submission_id uuid, new_status material_submission_status)
language plpgsql as $$
declare
  v_current_status material_submission_status;
begin
  if p_new_window_end_at < p_new_pickup_at then
    raise exception 'Pickup window end must be >= pickup window start';
  end if;

  select status into v_current_status
  from material_submissions
  where id = p_submission_id and logistics_profile_id = p_logistics_profile_id limit 1;

  if v_current_status is null then raise exception 'Submission not found for logistics actor'; end if;
  if v_current_status <> 'pickup_scheduled' then
    raise exception 'Can only reschedule pickup_scheduled submissions';
  end if;

  update material_submissions set
    scheduled_pickup_at  = p_new_pickup_at,
    pickup_window_end_at = p_new_window_end_at
  where id = p_submission_id;

  return query select p_submission_id, 'pickup_scheduled'::material_submission_status;
end; $$;

-- approve_reward_request
create or replace function approve_reward_request(
  p_request_id           uuid,
  p_warehouse_profile_id uuid
)
returns table (request_id uuid, request_status reward_request_status, available_points integer)
language plpgsql as $$
declare
  v_farmer_profile_id uuid;
  v_requested_points  integer;
  v_status            reward_request_status;
begin
  select farmer_profile_id, requested_points, status
    into v_farmer_profile_id, v_requested_points, v_status
  from reward_requests where id = p_request_id limit 1;

  if v_farmer_profile_id is null then raise exception 'Reward request not found'; end if;
  if v_status <> 'requested' then raise exception 'Reward request is not in requested state'; end if;

  update reward_requests set
    status                = 'approved',
    warehouse_profile_id  = p_warehouse_profile_id,
    warehouse_decision_at = now(),
    rejection_reason      = null
  where id = p_request_id;

  insert into points_ledger (farmer_profile_id, entry_type, points_amount, reference_type, reference_id, note)
  values
    (v_farmer_profile_id, 'reward_release', v_requested_points, 'reward_request', p_request_id, 'Release reserve on approval'),
    (v_farmer_profile_id, 'reward_spend',   v_requested_points, 'reward_request', p_request_id, 'Spend points on approved request');

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values ('reward_request', p_request_id, 'requested', 'approved', 'warehouse', p_warehouse_profile_id, 'Warehouse approved reward request');

  return query select p_request_id, 'approved'::reward_request_status, calculate_available_points(v_farmer_profile_id);
end; $$;

-- reject_reward_request
create or replace function reject_reward_request(
  p_request_id           uuid,
  p_warehouse_profile_id uuid,
  p_reason               text
)
returns table (request_id uuid, request_status reward_request_status, available_points integer)
language plpgsql as $$
declare
  v_farmer_profile_id uuid;
  v_requested_points  integer;
  v_status            reward_request_status;
begin
  select farmer_profile_id, requested_points, status
    into v_farmer_profile_id, v_requested_points, v_status
  from reward_requests where id = p_request_id limit 1;

  if v_farmer_profile_id is null then raise exception 'Reward request not found'; end if;
  if v_status <> 'requested' then raise exception 'Reward request is not in requested state'; end if;

  update reward_requests set
    status                = 'rejected',
    warehouse_profile_id  = p_warehouse_profile_id,
    warehouse_decision_at = now(),
    rejection_reason      = p_reason
  where id = p_request_id;

  insert into points_ledger (farmer_profile_id, entry_type, points_amount, reference_type, reference_id, note)
  values (v_farmer_profile_id, 'reward_release', v_requested_points, 'reward_request', p_request_id, 'Release reserve on rejection');

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values ('reward_request', p_request_id, 'requested', 'rejected', 'warehouse', p_warehouse_profile_id, p_reason);

  return query select p_request_id, 'rejected'::reward_request_status, calculate_available_points(v_farmer_profile_id);
end; $$;

-- cancel_reward_request_by_farmer: no reason required
create or replace function cancel_reward_request_by_farmer(
  p_request_id        uuid,
  p_farmer_profile_id uuid
)
returns table (request_id uuid, request_status reward_request_status, available_points integer)
language plpgsql as $$
declare
  v_owner_farmer_profile_id uuid;
  v_requested_points        integer;
  v_status                  reward_request_status;
begin
  select rr.farmer_profile_id, rr.requested_points, rr.status
    into v_owner_farmer_profile_id, v_requested_points, v_status
  from reward_requests rr where rr.id = p_request_id limit 1;

  if v_owner_farmer_profile_id is null then raise exception 'Reward request not found'; end if;
  if v_owner_farmer_profile_id <> p_farmer_profile_id then raise exception 'You can only cancel your own reward request'; end if;
  if v_status <> 'requested' then raise exception 'Only requested reward requests can be cancelled by farmer'; end if;

  update reward_requests set status = 'cancelled' where id = p_request_id;

  insert into points_ledger (farmer_profile_id, entry_type, points_amount, reference_type, reference_id, note)
  values (p_farmer_profile_id, 'reward_release', v_requested_points, 'reward_request', p_request_id, 'Release reserve on farmer cancellation');

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values ('reward_request', p_request_id, 'requested', 'cancelled', 'farmer', p_farmer_profile_id, 'Cancelled by farmer');

  return query select p_request_id, 'cancelled'::reward_request_status, calculate_available_points(p_farmer_profile_id);
end; $$;

-- schedule_reward_delivery: logistics schedules delivery directly on reward_request
create or replace function schedule_reward_delivery(
  p_request_id             uuid,
  p_logistics_profile_id   uuid,
  p_planned_delivery_at    timestamptz,
  p_delivery_window_end_at timestamptz,
  p_notes                  text default null
)
returns table (request_id uuid, new_status reward_request_status)
language plpgsql as $$
declare
  v_status reward_request_status;
begin
  if p_delivery_window_end_at < p_planned_delivery_at then
    raise exception 'Delivery window end must be >= delivery window start';
  end if;

  select status into v_status from reward_requests where id = p_request_id limit 1;
  if v_status is null then raise exception 'Reward request not found'; end if;
  if v_status <> 'approved' then
    raise exception 'Reward request must be approved before delivery scheduling';
  end if;

  update reward_requests set
    status                 = 'delivery_scheduled',
    logistics_profile_id   = p_logistics_profile_id,
    scheduled_delivery_at  = p_planned_delivery_at,
    delivery_window_end_at = p_delivery_window_end_at
  where id = p_request_id;

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values ('reward_request', p_request_id, 'approved', 'delivery_scheduled', 'logistics', p_logistics_profile_id,
    coalesce(p_notes, 'Reward delivery scheduled'));

  return query select p_request_id, 'delivery_scheduled'::reward_request_status;
end; $$;

-- mark_reward_out_for_delivery
create or replace function mark_reward_out_for_delivery(
  p_request_id           uuid,
  p_logistics_profile_id uuid
)
returns table (request_id uuid, new_status reward_request_status)
language plpgsql as $$
declare
  v_status reward_request_status;
begin
  select status into v_status
  from reward_requests
  where id = p_request_id and logistics_profile_id = p_logistics_profile_id limit 1;

  if v_status is null then raise exception 'Reward request not found for logistics actor'; end if;
  if v_status <> 'delivery_scheduled' then
    raise exception 'Reward request must be delivery_scheduled first';
  end if;

  update reward_requests set
    status              = 'out_for_delivery',
    out_for_delivery_at = now()
  where id = p_request_id;

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values ('reward_request', p_request_id, 'delivery_scheduled', 'out_for_delivery', 'logistics', p_logistics_profile_id, 'Reward out for delivery');

  return query select p_request_id, 'out_for_delivery'::reward_request_status;
end; $$;

-- mark_reward_delivered
create or replace function mark_reward_delivered(
  p_request_id           uuid,
  p_logistics_profile_id uuid
)
returns table (request_id uuid, new_status reward_request_status)
language plpgsql as $$
declare
  v_status reward_request_status;
begin
  select status into v_status
  from reward_requests
  where id = p_request_id and logistics_profile_id = p_logistics_profile_id limit 1;

  if v_status is null then raise exception 'Reward request not found for logistics actor'; end if;
  if v_status not in ('delivery_scheduled', 'out_for_delivery') then
    raise exception 'Reward request must be delivery_scheduled or out_for_delivery';
  end if;

  update reward_requests set
    status       = 'done',
    delivered_at = now()
  where id = p_request_id;

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values ('reward_request', p_request_id, v_status::text, 'done', 'logistics', p_logistics_profile_id, 'Reward delivered to farmer');

  return query select p_request_id, 'done'::reward_request_status;
end; $$;

-- reschedule_reward_delivery: update scheduled delivery window
create or replace function reschedule_reward_delivery(
  p_request_id           uuid,
  p_logistics_profile_id uuid,
  p_new_delivery_at      timestamptz,
  p_new_window_end_at    timestamptz
)
returns table (request_id uuid, new_status reward_request_status)
language plpgsql as $$
declare
  v_status reward_request_status;
begin
  if p_new_window_end_at < p_new_delivery_at then
    raise exception 'Delivery window end must be >= delivery window start';
  end if;

  select status into v_status
  from reward_requests
  where id = p_request_id and logistics_profile_id = p_logistics_profile_id limit 1;

  if v_status is null then raise exception 'Reward request not found for logistics actor'; end if;
  if v_status <> 'delivery_scheduled' then
    raise exception 'Can only reschedule delivery_scheduled requests';
  end if;

  update reward_requests set
    scheduled_delivery_at  = p_new_delivery_at,
    delivery_window_end_at = p_new_window_end_at
  where id = p_request_id;

  return query select p_request_id, 'delivery_scheduled'::reward_request_status;
end; $$;

-- ─── 17. Re-apply grants ─────────────────────────────────────────────────────

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;
