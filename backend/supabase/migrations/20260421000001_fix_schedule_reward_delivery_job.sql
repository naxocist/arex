-- Fix 5-param overload of schedule_reward_delivery_job: reward_delivery_jobs → delivery_jobs
create or replace function schedule_reward_delivery_job(
  p_reward_request_id uuid,
  p_logistics_profile_id uuid,
  p_planned_delivery_at timestamptz,
  p_delivery_window_end_at timestamptz,
  p_notes text default null
)
returns table (delivery_job_id uuid, delivery_status reward_delivery_status)
language plpgsql as $$
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
  from delivery_jobs rdj
  where rdj.reward_request_id = p_reward_request_id
    and rdj.status <> 'cancelled'
  order by rdj.created_at desc
  limit 1;

  if v_existing_delivery_status is not null then
    raise exception
      'Reward request already has a delivery job in status: %',
      v_existing_delivery_status;
  end if;

  insert into delivery_jobs (
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
