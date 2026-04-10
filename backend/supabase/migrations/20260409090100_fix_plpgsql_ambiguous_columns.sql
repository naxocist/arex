-- Hotfix for ambiguous PL/pgSQL references in pickup/reward delivery transitions.
-- Apply this on environments already created from the initial schema migration.

create or replace function mark_pickup_delivered_to_factory(
  p_pickup_job_id uuid,
  p_logistics_profile_id uuid
)
returns table (
  submission_id uuid,
  pickup_job_id uuid,
  submission_status material_submission_status,
  pickup_status pickup_job_status
)
language plpgsql
as $$
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

  update pickup_jobs
  set status = 'delivered_to_factory',
      delivered_factory_at = now()
  where id = p_pickup_job_id;

  update material_submissions
  set status = 'delivered_to_factory'
  where id = v_submission_id;

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
    'pickup_job',
    p_pickup_job_id,
    v_current_status::text,
    'delivered_to_factory',
    'logistics',
    p_logistics_profile_id,
    'Material delivered to factory'
  ),
  (
    'submission',
    v_submission_id,
    null,
    'delivered_to_factory',
    'logistics',
    p_logistics_profile_id,
    'Submission moved to delivered_to_factory'
  );

  return query
  select
    v_submission_id,
    p_pickup_job_id,
    'delivered_to_factory'::material_submission_status,
    'delivered_to_factory'::pickup_job_status;
end;
$$;

create or replace function mark_pickup_picked_up(
  p_pickup_job_id uuid,
  p_logistics_profile_id uuid
)
returns table (
  submission_id uuid,
  pickup_job_id uuid,
  submission_status material_submission_status,
  pickup_status pickup_job_status
)
language plpgsql
as $$
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

  update pickup_jobs
  set status = 'picked_up',
      picked_up_at = now()
  where id = p_pickup_job_id;

  update material_submissions
  set status = 'picked_up'
  where id = v_submission_id;

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
    'pickup_job',
    p_pickup_job_id,
    'pickup_scheduled',
    'picked_up',
    'logistics',
    p_logistics_profile_id,
    'Logistics picked up material'
  ),
  (
    'submission',
    v_submission_id,
    'pickup_scheduled',
    'picked_up',
    'logistics',
    p_logistics_profile_id,
    'Submission moved to picked_up'
  );

  return query
  select
    v_submission_id,
    p_pickup_job_id,
    'picked_up'::material_submission_status,
    'picked_up'::pickup_job_status;
end;
$$;

create or replace function mark_reward_out_for_delivery(
  p_delivery_job_id uuid,
  p_logistics_profile_id uuid
)
returns table (
  reward_request_id uuid,
  delivery_job_id uuid,
  delivery_status reward_delivery_status
)
language plpgsql
as $$
declare
  v_request_id uuid;
  v_status reward_delivery_status;
begin
  select rdj.reward_request_id, rdj.status
    into v_request_id, v_status
  from reward_delivery_jobs rdj
  where rdj.id = p_delivery_job_id and rdj.logistics_profile_id = p_logistics_profile_id
  limit 1;

  if v_request_id is null then
    raise exception 'Reward delivery job not found for logistics actor';
  end if;

  if v_status <> 'reward_delivery_scheduled' then
    raise exception 'Reward delivery job must be reward_delivery_scheduled first';
  end if;

  update reward_delivery_jobs
  set status = 'out_for_delivery',
      out_for_delivery_at = now()
  where id = p_delivery_job_id;

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
    p_delivery_job_id,
    'reward_delivery_scheduled',
    'out_for_delivery',
    'logistics',
    p_logistics_profile_id,
    'Reward out for delivery'
  );

  return query
  select
    v_request_id,
    p_delivery_job_id,
    'out_for_delivery'::reward_delivery_status;
end;
$$;

create or replace function mark_reward_delivered(
  p_delivery_job_id uuid,
  p_logistics_profile_id uuid
)
returns table (
  reward_request_id uuid,
  delivery_job_id uuid,
  delivery_status reward_delivery_status
)
language plpgsql
as $$
declare
  v_request_id uuid;
  v_status reward_delivery_status;
begin
  select rdj.reward_request_id, rdj.status
    into v_request_id, v_status
  from reward_delivery_jobs rdj
  where rdj.id = p_delivery_job_id and rdj.logistics_profile_id = p_logistics_profile_id
  limit 1;

  if v_request_id is null then
    raise exception 'Reward delivery job not found for logistics actor';
  end if;

  if v_status not in ('reward_delivery_scheduled', 'out_for_delivery') then
    raise exception 'Reward delivery job must be scheduled or out_for_delivery';
  end if;

  update reward_delivery_jobs
  set status = 'reward_delivered',
      delivered_at = now()
  where id = p_delivery_job_id;

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
    p_delivery_job_id,
    v_status::text,
    'reward_delivered',
    'logistics',
    p_logistics_profile_id,
    'Reward delivered to farmer'
  );

  return query
  select
    v_request_id,
    p_delivery_job_id,
    'reward_delivered'::reward_delivery_status;
end;
$$;
