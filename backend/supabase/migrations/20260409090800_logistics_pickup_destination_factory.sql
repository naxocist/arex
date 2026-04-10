-- Add destination factory support to logistics pickup scheduling.

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
  v_factory_active boolean;
begin
  if p_pickup_window_end_at < p_planned_pickup_at then
    raise exception 'Pickup window end must be greater than or equal to pickup window start';
  end if;

  if p_destination_factory_id is null then
    raise exception 'Destination factory is required';
  end if;

  select active
    into v_factory_active
  from factories
  where id = p_destination_factory_id
  limit 1;

  if v_factory_active is null then
    raise exception 'Destination factory not found';
  end if;

  if v_factory_active is not true then
    raise exception 'Destination factory is inactive';
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
    destination_factory_id,
    planned_pickup_at,
    pickup_window_end_at,
    status,
    notes
  ) values (
    p_submission_id,
    p_logistics_profile_id,
    p_destination_factory_id,
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
