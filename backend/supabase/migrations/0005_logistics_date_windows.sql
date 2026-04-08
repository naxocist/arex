-- Hotfix: enforce logistics date windows (start/end) for pickup and reward delivery jobs.
-- Apply this after 0001-0004.

alter table if exists pickup_jobs
  add column if not exists pickup_window_end_at timestamptz;

update pickup_jobs
set pickup_window_end_at = planned_pickup_at
where pickup_window_end_at is null;

alter table if exists pickup_jobs
  alter column pickup_window_end_at set not null;

alter table if exists reward_delivery_jobs
  add column if not exists delivery_window_end_at timestamptz;

update reward_delivery_jobs
set delivery_window_end_at = planned_delivery_at
where delivery_window_end_at is null;

alter table if exists reward_delivery_jobs
  alter column delivery_window_end_at set not null;

drop function if exists schedule_pickup_job(uuid, uuid, timestamptz, text);
create or replace function schedule_pickup_job(
  p_submission_id uuid,
  p_logistics_profile_id uuid,
  p_planned_pickup_at timestamptz,
  p_pickup_window_end_at timestamptz,
  p_notes text default null
)
returns table (
  pickup_job_id uuid,
  submission_status material_submission_status,
  pickup_status pickup_job_status
)
language plpgsql
as $$
declare
  v_submission_status material_submission_status;
  v_job_id uuid;
begin
  if p_pickup_window_end_at < p_planned_pickup_at then
    raise exception 'Pickup window end must be greater than or equal to pickup window start';
  end if;

  select status into v_submission_status
  from material_submissions
  where id = p_submission_id
  limit 1;

  if v_submission_status is null then
    raise exception 'Submission not found';
  end if;

  if v_submission_status <> 'submitted' then
    raise exception 'Submission is not in submitted state';
  end if;

  insert into pickup_jobs (
    submission_id,
    logistics_profile_id,
    planned_pickup_at,
    pickup_window_end_at,
    status,
    notes
  ) values (
    p_submission_id,
    p_logistics_profile_id,
    p_planned_pickup_at,
    p_pickup_window_end_at,
    'pickup_scheduled',
    p_notes
  ) returning id into v_job_id;

  update material_submissions
  set status = 'pickup_scheduled'
  where id = p_submission_id;

  insert into status_events (
    entity_type,
    entity_id,
    from_status,
    to_status,
    actor_role,
    actor_profile_id,
    note
  ) values
  (
    'submission',
    p_submission_id,
    'submitted',
    'pickup_scheduled',
    'logistics',
    p_logistics_profile_id,
    'Pickup scheduled by logistics'
  ),
  (
    'pickup_job',
    v_job_id,
    null,
    'pickup_scheduled',
    'logistics',
    p_logistics_profile_id,
    'Pickup job created'
  );

  return query
  select
    v_job_id,
    'pickup_scheduled'::material_submission_status,
    'pickup_scheduled'::pickup_job_status;
end;
$$;

drop function if exists schedule_reward_delivery_job(uuid, uuid, timestamptz, text);
create or replace function schedule_reward_delivery_job(
  p_reward_request_id uuid,
  p_logistics_profile_id uuid,
  p_planned_delivery_at timestamptz,
  p_delivery_window_end_at timestamptz,
  p_notes text default null
)
returns table (
  delivery_job_id uuid,
  delivery_status reward_delivery_status
)
language plpgsql
as $$
declare
  v_status reward_request_status;
  v_job_id uuid;
  v_existing_delivery_status reward_delivery_status;
begin
  if p_delivery_window_end_at < p_planned_delivery_at then
    raise exception 'Delivery window end must be greater than or equal to delivery window start';
  end if;

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

  select rdj.status
    into v_existing_delivery_status
  from reward_delivery_jobs rdj
  where rdj.reward_request_id = p_reward_request_id
    and rdj.status <> 'cancelled'
  order by rdj.created_at desc
  limit 1;

  if v_existing_delivery_status is not null then
    raise exception
      'Reward request already has a delivery job in status: %',
      v_existing_delivery_status;
  end if;

  insert into reward_delivery_jobs (
    reward_request_id,
    logistics_profile_id,
    planned_delivery_at,
    delivery_window_end_at,
    status,
    notes
  ) values (
    p_reward_request_id,
    p_logistics_profile_id,
    p_planned_delivery_at,
    p_delivery_window_end_at,
    'reward_delivery_scheduled',
    p_notes
  ) returning id into v_job_id;

  insert into status_events (
    entity_type,
    entity_id,
    from_status,
    to_status,
    actor_role,
    actor_profile_id,
    note
  ) values (
    'reward_delivery_job',
    v_job_id,
    null,
    'reward_delivery_scheduled',
    'logistics',
    p_logistics_profile_id,
    'Reward delivery job scheduled'
  );

  return query
  select v_job_id, 'reward_delivery_scheduled'::reward_delivery_status;
end;
$$;
