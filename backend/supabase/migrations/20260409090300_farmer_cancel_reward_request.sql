-- Hotfix: allow farmer to cancel reward request while it is still in requested status.

create or replace function cancel_reward_request_by_farmer(
  p_request_id uuid,
  p_farmer_profile_id uuid,
  p_reason text default 'Cancelled by farmer'
)
returns table (
  request_id uuid,
  request_status reward_request_status,
  available_points integer
)
language plpgsql
as $$
declare
  v_owner_farmer_profile_id uuid;
  v_requested_points integer;
  v_status reward_request_status;
begin
  select rr.farmer_profile_id, rr.requested_points, rr.status
    into v_owner_farmer_profile_id, v_requested_points, v_status
  from reward_requests rr
  where rr.id = p_request_id
  limit 1;

  if v_owner_farmer_profile_id is null then
    raise exception 'Reward request not found';
  end if;

  if v_owner_farmer_profile_id <> p_farmer_profile_id then
    raise exception 'You can only cancel your own reward request';
  end if;

  if v_status <> 'requested' then
    raise exception 'Only requested reward requests can be cancelled by farmer';
  end if;

  update reward_requests
  set status = 'cancelled',
      warehouse_decision_at = now(),
      rejection_reason = p_reason
  where id = p_request_id;

  insert into points_ledger (
    farmer_profile_id,
    entry_type,
    points_amount,
    reference_type,
    reference_id,
    note
  ) values (
    p_farmer_profile_id,
    'reward_release',
    v_requested_points,
    'reward_request',
    p_request_id,
    'Release reserve on farmer cancellation'
  );

  insert into status_events (
    entity_type,
    entity_id,
    from_status,
    to_status,
    actor_role,
    actor_profile_id,
    note
  ) values (
    'reward_request',
    p_request_id,
    'requested',
    'cancelled',
    'farmer',
    p_farmer_profile_id,
    p_reason
  );

  return query
  select
    p_request_id,
    'cancelled'::reward_request_status,
    calculate_available_points(p_farmer_profile_id);
end;
$$;
