-- AREX Platform: consolidated schema (replaces all prior migrations)
-- Tables: profiles, org_accounts, material_types, measurement_units, submissions,
--         pickup_jobs, intakes, points_ledger, rewards, reward_requests,
--         delivery_jobs, status_events, impact_baselines, value_chain_mappings,
--         logistics_distances, admin_settings
-- RLS: enabled on all public tables (service-role bypasses)

create extension if not exists pgcrypto;

-- ─── Enums ───────────────────────────────────────────────────────────────────

create type material_submission_status as enum (
  'submitted', 'pickup_scheduled', 'picked_up',
  'delivered_to_factory', 'factory_confirmed', 'points_credited', 'cancelled'
);

create type pickup_job_status as enum (
  'pickup_scheduled', 'picked_up', 'delivered_to_factory', 'factory_confirmed', 'cancelled'
);

create type factory_intake_status as enum ('confirmed', 'flagged');

create type reward_request_status as enum (
  'requested', 'warehouse_approved', 'warehouse_rejected', 'cancelled'
);

create type reward_delivery_status as enum (
  'reward_delivery_scheduled', 'out_for_delivery', 'reward_delivered', 'cancelled'
);

create type points_entry_type as enum (
  'intake_credit', 'reward_reserve', 'reward_release', 'reward_spend', 'adjustment'
);

-- ─── Helper trigger function ──────────────────────────────────────────────────

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ─── Tables ───────────────────────────────────────────────────────────────────

create table if not exists profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  role            text not null check (role in ('farmer','logistics','factory','warehouse','executive','admin')),
  display_name    text,
  phone           text,
  province        text,
  approval_status text not null default 'approved' check (approval_status in ('pending','approved','rejected')),
  approval_note   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists org_accounts (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid references profiles(id) on delete cascade,
  type           text not null check (type in ('factory','logistics')),
  name_th        text not null,
  location_text  text,
  lat            double precision,
  lng            double precision,
  active         boolean not null default true,
  is_focal_point boolean not null default false,
  created_at     timestamptz not null default now()
);

create unique index if not exists ux_org_accounts_profile_type
  on org_accounts (profile_id, type)
  where profile_id is not null;

create table if not exists material_types (
  code         text primary key,
  name_th      text not null,
  points_per_kg numeric(12,6),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

insert into material_types (code, name_th, points_per_kg, active) values
  ('rice_straw',         'ฟางข้าว',            1.000000,  true),
  ('orchard_residue',    'เศษไม้ผล',            3.125000,  true),
  ('plastic_waste',      'ขยะพลาสติก',          12.500000, true),
  ('cassava_root',       'เหง้ามันสำปะหลัง',    1.200000,  true),
  ('sugarcane_bagasse',  'ชานอ้อย',             1.100000,  true),
  ('corn_stover',        'ตอซังข้าวโพด',        1.050000,  true)
on conflict (code) do update
  set name_th = excluded.name_th, points_per_kg = excluded.points_per_kg, updated_at = now();

create table if not exists measurement_units (
  code          text primary key,
  name_th       text not null,
  to_kg_factor  numeric(14,6) check (to_kg_factor is null or to_kg_factor > 0),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

insert into measurement_units (code, name_th, to_kg_factor, active) values
  ('กิโลกรัม', 'กิโลกรัม', 1.000000,    true),
  ('ตัน',      'ตัน',      1000.000000, true)
on conflict (code) do update
  set name_th = excluded.name_th, to_kg_factor = excluded.to_kg_factor, updated_at = now();

create table if not exists submissions (
  id                    uuid primary key default gen_random_uuid(),
  farmer_profile_id     uuid not null references profiles(id) on delete cascade,
  material_type         text not null references material_types(code) on update cascade on delete restrict,
  quantity_value        numeric(12,3) not null check (quantity_value > 0),
  quantity_unit         text not null references measurement_units(code) on update cascade on delete restrict,
  pickup_location_text  text not null,
  pickup_lat            double precision,
  pickup_lng            double precision,
  notes                 text,
  status                material_submission_status not null default 'submitted',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists ix_submissions_farmer_status_created
  on submissions (farmer_profile_id, status, created_at desc);

create table if not exists pickup_jobs (
  id                       uuid primary key default gen_random_uuid(),
  submission_id            uuid not null references submissions(id) on delete cascade,
  logistics_profile_id     uuid not null references profiles(id) on delete restrict,
  destination_factory_id   uuid references org_accounts(id) on delete set null,
  planned_pickup_at        timestamptz not null,
  pickup_window_end_at     timestamptz not null,
  picked_up_at             timestamptz,
  delivered_factory_at     timestamptz,
  factory_confirmed_at     timestamptz,
  status                   pickup_job_status not null default 'pickup_scheduled',
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create unique index if not exists ux_pickup_jobs_submission_active
  on pickup_jobs (submission_id)
  where status <> 'cancelled';

create index if not exists ix_pickup_jobs_logistics_status_planned
  on pickup_jobs (logistics_profile_id, status, planned_pickup_at);

create table if not exists intakes (
  id                  uuid primary key default gen_random_uuid(),
  pickup_job_id       uuid not null unique references pickup_jobs(id) on delete cascade,
  factory_profile_id  uuid not null references profiles(id) on delete restrict,
  measured_weight_kg  numeric(12,3) not null check (measured_weight_kg > 0),
  discrepancy_note    text,
  status              factory_intake_status not null default 'confirmed',
  confirmed_at        timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

create table if not exists points_ledger (
  id                uuid primary key default gen_random_uuid(),
  farmer_profile_id uuid not null references profiles(id) on delete cascade,
  entry_type        points_entry_type not null,
  points_amount     integer not null check (points_amount > 0),
  reference_type    text,
  reference_id      uuid,
  note              text,
  created_at        timestamptz not null default now()
);

create index if not exists ix_points_ledger_farmer_created
  on points_ledger (farmer_profile_id, created_at desc);

create table if not exists rewards (
  id             uuid primary key default gen_random_uuid(),
  name_th        text not null,
  description_th text,
  points_cost    integer not null check (points_cost > 0),
  stock_qty      integer not null default 0 check (stock_qty >= 0),
  active         boolean not null default true,
  image_url      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists reward_requests (
  id                      uuid primary key default gen_random_uuid(),
  farmer_profile_id       uuid not null references profiles(id) on delete cascade,
  reward_id               uuid not null references rewards(id) on delete restrict,
  quantity                integer not null check (quantity > 0),
  requested_points        integer not null check (requested_points > 0),
  status                  reward_request_status not null default 'requested',
  warehouse_profile_id    uuid references profiles(id) on delete set null,
  warehouse_decision_at   timestamptz,
  rejection_reason        text,
  delivery_location_text  text,
  delivery_lat            double precision,
  delivery_lng            double precision,
  requested_at            timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists ix_reward_requests_status_requested
  on reward_requests (status, requested_at desc);

create table if not exists delivery_jobs (
  id                       uuid primary key default gen_random_uuid(),
  reward_request_id        uuid not null references reward_requests(id) on delete cascade,
  logistics_profile_id     uuid not null references profiles(id) on delete restrict,
  planned_delivery_at      timestamptz not null,
  delivery_window_end_at   timestamptz not null,
  out_for_delivery_at      timestamptz,
  delivered_at             timestamptz,
  status                   reward_delivery_status not null default 'reward_delivery_scheduled',
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create unique index if not exists ux_delivery_jobs_request_active
  on delivery_jobs (reward_request_id)
  where status <> 'cancelled';

create index if not exists ix_delivery_jobs_logistics_status_planned
  on delivery_jobs (logistics_profile_id, status, planned_delivery_at);

create table if not exists status_events (
  id               uuid primary key default gen_random_uuid(),
  entity_type      text not null,
  entity_id        uuid not null,
  from_status      text,
  to_status        text not null,
  actor_role       text not null,
  actor_profile_id uuid references profiles(id) on delete set null,
  note             text,
  event_at         timestamptz not null default now()
);

create index if not exists ix_status_events_entity_event
  on status_events (entity_type, entity_id, event_at desc);

create table if not exists impact_baselines (
  id                           uuid primary key default gen_random_uuid(),
  pilot_area                   text not null,
  hotspot_count_baseline       integer,
  co2_kg_baseline              numeric(15,3),
  avg_income_baht_per_household numeric(12,2),
  recorded_by                  text,
  recorded_at                  timestamptz not null default now(),
  created_at                   timestamptz not null default now()
);

create table if not exists value_chain_mappings (
  id             uuid primary key default gen_random_uuid(),
  product_name_th text not null,
  producer_org   text,
  buyer_org      text,
  buyer_use_th   text,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists logistics_distances (
  logistics_profile_id uuid not null references profiles(id) on delete cascade,
  reference_type       text not null check (reference_type in ('submission','reward_request')),
  reference_id         uuid not null,
  leg                  text not null check (leg in ('to_farmer','farmer_to_factory')),
  distance_km          double precision,
  updated_at           timestamptz not null default now(),
  primary key (logistics_profile_id, reference_type, reference_id, leg)
);

create table if not exists admin_settings (
  key                    text primary key,
  approval_required_roles jsonb not null default '[]'::jsonb,
  updated_at             timestamptz not null default now()
);

insert into admin_settings (key, approval_required_roles)
values ('global', '["farmer"]'::jsonb)
on conflict (key) do nothing;

-- ─── Updated-at triggers ─────────────────────────────────────────────────────

do $$ declare t text; begin
  foreach t in array array[
    'profiles','material_types','measurement_units','submissions',
    'pickup_jobs','rewards','reward_requests','delivery_jobs',
    'value_chain_mappings','admin_settings'
  ] loop
    execute format(
      'drop trigger if exists trg_%1$s_updated_at on %1$s;
       create trigger trg_%1$s_updated_at before update on %1$s
       for each row execute function set_updated_at();', t);
  end loop;
end; $$;

-- ─── RLS: enabled on all public tables ───────────────────────────────────────
-- Backend uses service-role key (bypasses RLS). No client-side policies needed.

alter table profiles                enable row level security;
alter table org_accounts            enable row level security;
alter table material_types          enable row level security;
alter table measurement_units       enable row level security;
alter table submissions             enable row level security;
alter table pickup_jobs             enable row level security;
alter table intakes                 enable row level security;
alter table points_ledger           enable row level security;
alter table rewards                 enable row level security;
alter table reward_requests         enable row level security;
alter table delivery_jobs           enable row level security;
alter table status_events           enable row level security;
alter table impact_baselines        enable row level security;
alter table value_chain_mappings    enable row level security;
alter table logistics_distances     enable row level security;
alter table admin_settings          enable row level security;

create policy "service_role_only_admin_settings"
  on admin_settings for all using (false);

-- ─── Workflow functions ───────────────────────────────────────────────────────

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

create or replace function request_reward_trade(
  p_farmer_profile_id     uuid,
  p_reward_id             uuid,
  p_quantity              integer,
  p_delivery_location_text text default null,
  p_delivery_lat          double precision default null,
  p_delivery_lng          double precision default null
)
returns table (request_id uuid, request_status reward_request_status, reserved_points integer, available_points integer)
language plpgsql as $$
declare
  v_points_cost       integer;
  v_stock_qty         integer;
  v_required_points   integer;
  v_available_points  integer;
  v_request_id        uuid;
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

create or replace function schedule_pickup_job(
  p_submission_id          uuid,
  p_logistics_profile_id   uuid,
  p_planned_pickup_at      timestamptz,
  p_pickup_window_end_at   timestamptz,
  p_destination_factory_id uuid,
  p_notes                  text default null
)
returns table (pickup_job_id uuid, submission_status material_submission_status, pickup_status pickup_job_status)
language plpgsql as $$
declare
  v_submission_status material_submission_status;
  v_job_id            uuid;
  v_factory_active    boolean;
begin
  if p_pickup_window_end_at < p_planned_pickup_at then
    raise exception 'Pickup window end must be >= pickup window start';
  end if;
  if p_destination_factory_id is null then raise exception 'Destination factory is required'; end if;

  select active into v_factory_active
  from org_accounts where id = p_destination_factory_id and type = 'factory' limit 1;

  if v_factory_active is null then raise exception 'Destination factory not found'; end if;
  if v_factory_active is not true then raise exception 'Destination factory is inactive'; end if;

  select status into v_submission_status from submissions where id = p_submission_id limit 1;
  if v_submission_status is null then raise exception 'Submission not found'; end if;
  if v_submission_status <> 'submitted' then raise exception 'Submission is not in submitted state'; end if;

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
    ('submission',  p_submission_id, 'submitted',       'pickup_scheduled', 'logistics', p_logistics_profile_id, 'Pickup scheduled by logistics'),
    ('pickup_job',  v_job_id,        null,              'pickup_scheduled', 'logistics', p_logistics_profile_id, 'Pickup job created');

  return query select v_job_id, 'pickup_scheduled'::material_submission_status, 'pickup_scheduled'::pickup_job_status;
end; $$;

create or replace function mark_pickup_picked_up(
  p_pickup_job_id        uuid,
  p_logistics_profile_id uuid
)
returns table (submission_id uuid, pickup_job_id uuid, submission_status material_submission_status, pickup_status pickup_job_status)
language plpgsql as $$
declare
  v_submission_id  uuid;
  v_current_status pickup_job_status;
begin
  select pj.submission_id, pj.status into v_submission_id, v_current_status
  from pickup_jobs pj where pj.id = p_pickup_job_id and pj.logistics_profile_id = p_logistics_profile_id limit 1;

  if v_submission_id is null then raise exception 'Pickup job not found for logistics actor'; end if;
  if v_current_status <> 'pickup_scheduled' then raise exception 'Pickup job must be pickup_scheduled before picked_up'; end if;

  update pickup_jobs set status = 'picked_up', picked_up_at = now() where id = p_pickup_job_id;
  update submissions  set status = 'picked_up' where id = v_submission_id;

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values
    ('pickup_job', p_pickup_job_id, 'pickup_scheduled', 'picked_up', 'logistics', p_logistics_profile_id, 'Logistics picked up material'),
    ('submission', v_submission_id, 'pickup_scheduled', 'picked_up', 'logistics', p_logistics_profile_id, 'Submission moved to picked_up');

  return query select v_submission_id, p_pickup_job_id, 'picked_up'::material_submission_status, 'picked_up'::pickup_job_status;
end; $$;

create or replace function mark_pickup_delivered_to_factory(
  p_pickup_job_id        uuid,
  p_logistics_profile_id uuid
)
returns table (submission_id uuid, pickup_job_id uuid, submission_status material_submission_status, pickup_status pickup_job_status)
language plpgsql as $$
declare
  v_submission_id  uuid;
  v_current_status pickup_job_status;
begin
  select pj.submission_id, pj.status into v_submission_id, v_current_status
  from pickup_jobs pj where pj.id = p_pickup_job_id and pj.logistics_profile_id = p_logistics_profile_id limit 1;

  if v_submission_id is null then raise exception 'Pickup job not found for logistics actor'; end if;
  if v_current_status not in ('pickup_scheduled','picked_up') then raise exception 'Pickup job is not in a deliverable state'; end if;

  update pickup_jobs set status = 'delivered_to_factory', delivered_factory_at = now() where id = p_pickup_job_id;
  update submissions  set status = 'delivered_to_factory' where id = v_submission_id;

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values
    ('pickup_job', p_pickup_job_id, v_current_status::text, 'delivered_to_factory', 'logistics', p_logistics_profile_id, 'Material delivered to factory'),
    ('submission', v_submission_id, null,                   'delivered_to_factory', 'logistics', p_logistics_profile_id, 'Submission moved to delivered_to_factory');

  return query select v_submission_id, p_pickup_job_id, 'delivered_to_factory'::material_submission_status, 'delivered_to_factory'::pickup_job_status;
end; $$;

create or replace function confirm_factory_intake(
  p_pickup_job_id      uuid,
  p_factory_profile_id uuid,
  p_measured_weight_kg numeric,
  p_discrepancy_note   text default null
)
returns table (intake_id uuid, credited_points integer, submission_status material_submission_status)
language plpgsql as $$
declare
  v_submission_id    uuid;
  v_farmer_profile_id uuid;
  v_material_type    text;
  v_pickup_status    pickup_job_status;
  v_points_per_kg    numeric := 0.010000;
  v_points           integer;
  v_intake_id        uuid;
begin
  select pj.submission_id, pj.status, ms.farmer_profile_id, ms.material_type
    into v_submission_id, v_pickup_status, v_farmer_profile_id, v_material_type
  from pickup_jobs pj join submissions ms on ms.id = pj.submission_id
  where pj.id = p_pickup_job_id limit 1;

  if v_submission_id is null then raise exception 'Pickup job not found'; end if;
  if v_pickup_status <> 'delivered_to_factory' then raise exception 'Pickup job must be delivered_to_factory before confirmation'; end if;

  select points_per_kg into v_points_per_kg from material_types where code = v_material_type limit 1;
  v_points := greatest(floor(p_measured_weight_kg * coalesce(v_points_per_kg, 0.010000)), 1);

  insert into intakes (pickup_job_id, factory_profile_id, measured_weight_kg, discrepancy_note, status, confirmed_at)
  values (p_pickup_job_id, p_factory_profile_id, p_measured_weight_kg, p_discrepancy_note, 'confirmed', now())
  returning id into v_intake_id;

  update pickup_jobs set status = 'factory_confirmed', factory_confirmed_at = now() where id = p_pickup_job_id;
  update submissions  set status = 'factory_confirmed' where id = v_submission_id;

  insert into points_ledger (farmer_profile_id, entry_type, points_amount, reference_type, reference_id, note)
  values (v_farmer_profile_id, 'intake_credit', v_points, 'factory_intake', v_intake_id, 'Factory confirmed intake and credited points');

  update submissions set status = 'points_credited' where id = v_submission_id;

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values
    ('pickup_job', p_pickup_job_id, 'delivered_to_factory', 'factory_confirmed', 'factory', p_factory_profile_id, 'Factory confirmed intake'),
    ('submission', v_submission_id, 'delivered_to_factory', 'factory_confirmed', 'factory', p_factory_profile_id, 'Submission confirmed by factory'),
    ('submission', v_submission_id, 'factory_confirmed',    'points_credited',   'system',  p_factory_profile_id, 'Points credited after confirmation');

  return query select v_intake_id, v_points, 'points_credited'::material_submission_status;
end; $$;

create or replace function approve_reward_request(
  p_request_id          uuid,
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

  update reward_requests
  set status = 'warehouse_approved', warehouse_profile_id = p_warehouse_profile_id,
      warehouse_decision_at = now(), rejection_reason = null
  where id = p_request_id;

  insert into points_ledger (farmer_profile_id, entry_type, points_amount, reference_type, reference_id, note)
  values
    (v_farmer_profile_id, 'reward_release', v_requested_points, 'reward_request', p_request_id, 'Release reserve on approval'),
    (v_farmer_profile_id, 'reward_spend',   v_requested_points, 'reward_request', p_request_id, 'Spend points on approved request');

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values ('reward_request', p_request_id, 'requested', 'warehouse_approved', 'warehouse', p_warehouse_profile_id, 'Warehouse approved reward request');

  return query select p_request_id, 'warehouse_approved'::reward_request_status, calculate_available_points(v_farmer_profile_id);
end; $$;

create or replace function reject_reward_request(
  p_request_id          uuid,
  p_warehouse_profile_id uuid,
  p_reason              text
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

  update reward_requests
  set status = 'warehouse_rejected', warehouse_profile_id = p_warehouse_profile_id,
      warehouse_decision_at = now(), rejection_reason = p_reason
  where id = p_request_id;

  insert into points_ledger (farmer_profile_id, entry_type, points_amount, reference_type, reference_id, note)
  values (v_farmer_profile_id, 'reward_release', v_requested_points, 'reward_request', p_request_id, 'Release reserve on rejection');

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values ('reward_request', p_request_id, 'requested', 'warehouse_rejected', 'warehouse', p_warehouse_profile_id, p_reason);

  return query select p_request_id, 'warehouse_rejected'::reward_request_status, calculate_available_points(v_farmer_profile_id);
end; $$;

create or replace function cancel_reward_request_by_farmer(
  p_request_id        uuid,
  p_farmer_profile_id uuid,
  p_reason            text default 'Cancelled by farmer'
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

  update reward_requests
  set status = 'cancelled', warehouse_decision_at = now(), rejection_reason = p_reason
  where id = p_request_id;

  insert into points_ledger (farmer_profile_id, entry_type, points_amount, reference_type, reference_id, note)
  values (p_farmer_profile_id, 'reward_release', v_requested_points, 'reward_request', p_request_id, 'Release reserve on farmer cancellation');

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values ('reward_request', p_request_id, 'requested', 'cancelled', 'farmer', p_farmer_profile_id, p_reason);

  return query select p_request_id, 'cancelled'::reward_request_status, calculate_available_points(p_farmer_profile_id);
end; $$;

-- schedule_reward_delivery_job: 4-param (no window) overload
create or replace function schedule_reward_delivery_job(
  p_reward_request_id    uuid,
  p_logistics_profile_id uuid,
  p_planned_delivery_at  timestamptz,
  p_notes                text default null
)
returns table (delivery_job_id uuid, delivery_status reward_delivery_status)
language plpgsql as $$
declare
  v_status                    reward_request_status;
  v_job_id                    uuid;
  v_existing_delivery_status  reward_delivery_status;
begin
  select status into v_status from reward_requests where id = p_reward_request_id limit 1;
  if v_status is null then raise exception 'Reward request not found'; end if;
  if v_status <> 'warehouse_approved' then raise exception 'Reward request must be warehouse_approved before delivery scheduling'; end if;

  select rdj.status into v_existing_delivery_status
  from delivery_jobs rdj
  where rdj.reward_request_id = p_reward_request_id and rdj.status <> 'cancelled'
  order by rdj.created_at desc limit 1;

  if v_existing_delivery_status is not null then
    raise exception 'Reward request already has a delivery job in status: %', v_existing_delivery_status;
  end if;

  insert into delivery_jobs (reward_request_id, logistics_profile_id, planned_delivery_at, delivery_window_end_at, status, notes)
  values (p_reward_request_id, p_logistics_profile_id, p_planned_delivery_at, p_planned_delivery_at, 'reward_delivery_scheduled', p_notes)
  returning id into v_job_id;

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values ('reward_delivery_job', v_job_id, null, 'reward_delivery_scheduled', 'logistics', p_logistics_profile_id, 'Reward delivery job scheduled');

  return query select v_job_id, 'reward_delivery_scheduled'::reward_delivery_status;
end; $$;

-- schedule_reward_delivery_job: 5-param (with window) overload
create or replace function schedule_reward_delivery_job(
  p_reward_request_id      uuid,
  p_logistics_profile_id   uuid,
  p_planned_delivery_at    timestamptz,
  p_delivery_window_end_at timestamptz,
  p_notes                  text default null
)
returns table (delivery_job_id uuid, delivery_status reward_delivery_status)
language plpgsql as $$
declare
  v_status                   reward_request_status;
  v_job_id                   uuid;
  v_existing_delivery_status reward_delivery_status;
begin
  if p_delivery_window_end_at < p_planned_delivery_at then
    raise exception 'Delivery window end must be >= delivery window start';
  end if;

  select status into v_status from reward_requests where id = p_reward_request_id limit 1;
  if v_status is null then raise exception 'Reward request not found'; end if;
  if v_status <> 'warehouse_approved' then raise exception 'Reward request must be warehouse_approved before delivery scheduling'; end if;

  select rdj.status into v_existing_delivery_status
  from delivery_jobs rdj
  where rdj.reward_request_id = p_reward_request_id and rdj.status <> 'cancelled'
  order by rdj.created_at desc limit 1;

  if v_existing_delivery_status is not null then
    raise exception 'Reward request already has a delivery job in status: %', v_existing_delivery_status;
  end if;

  insert into delivery_jobs (reward_request_id, logistics_profile_id, planned_delivery_at, delivery_window_end_at, status, notes)
  values (p_reward_request_id, p_logistics_profile_id, p_planned_delivery_at, p_delivery_window_end_at, 'reward_delivery_scheduled', p_notes)
  returning id into v_job_id;

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values ('reward_delivery_job', v_job_id, null, 'reward_delivery_scheduled', 'logistics', p_logistics_profile_id, 'Reward delivery job scheduled');

  return query select v_job_id, 'reward_delivery_scheduled'::reward_delivery_status;
end; $$;

create or replace function mark_reward_out_for_delivery(
  p_delivery_job_id      uuid,
  p_logistics_profile_id uuid
)
returns table (reward_request_id uuid, delivery_job_id uuid, delivery_status reward_delivery_status)
language plpgsql as $$
declare
  v_request_id uuid;
  v_status     reward_delivery_status;
begin
  select rdj.reward_request_id, rdj.status into v_request_id, v_status
  from delivery_jobs rdj
  where rdj.id = p_delivery_job_id and rdj.logistics_profile_id = p_logistics_profile_id limit 1;

  if v_request_id is null then raise exception 'Reward delivery job not found for logistics actor'; end if;
  if v_status <> 'reward_delivery_scheduled' then raise exception 'Reward delivery job must be reward_delivery_scheduled first'; end if;

  update delivery_jobs set status = 'out_for_delivery', out_for_delivery_at = now() where id = p_delivery_job_id;

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values ('reward_delivery_job', p_delivery_job_id, 'reward_delivery_scheduled', 'out_for_delivery', 'logistics', p_logistics_profile_id, 'Reward out for delivery');

  return query select v_request_id, p_delivery_job_id, 'out_for_delivery'::reward_delivery_status;
end; $$;

create or replace function mark_reward_delivered(
  p_delivery_job_id      uuid,
  p_logistics_profile_id uuid
)
returns table (reward_request_id uuid, delivery_job_id uuid, delivery_status reward_delivery_status)
language plpgsql as $$
declare
  v_request_id uuid;
  v_status     reward_delivery_status;
begin
  select rdj.reward_request_id, rdj.status into v_request_id, v_status
  from delivery_jobs rdj
  where rdj.id = p_delivery_job_id and rdj.logistics_profile_id = p_logistics_profile_id limit 1;

  if v_request_id is null then raise exception 'Reward delivery job not found for logistics actor'; end if;
  if v_status not in ('reward_delivery_scheduled','out_for_delivery') then
    raise exception 'Reward delivery job must be scheduled or out_for_delivery';
  end if;

  update delivery_jobs set status = 'reward_delivered', delivered_at = now() where id = p_delivery_job_id;

  insert into status_events (entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note)
  values ('reward_delivery_job', p_delivery_job_id, v_status::text, 'reward_delivered', 'logistics', p_logistics_profile_id, 'Reward delivered to farmer');

  return query select v_request_id, p_delivery_job_id, 'reward_delivered'::reward_delivery_status;
end; $$;
