-- Add delivery location fields to reward_requests so farmer specifies where to receive reward
-- Logistics uses this as the drop-off destination instead of the last pickup location

alter table reward_requests
  add column if not exists delivery_location_text text,
  add column if not exists delivery_lat double precision,
  add column if not exists delivery_lng double precision;

-- Replace request_reward_trade to accept delivery location params
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
language plpgsql
as $$
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
  from rewards_catalog
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
    farmer_profile_id,
    reward_id,
    quantity,
    requested_points,
    status,
    delivery_location_text,
    delivery_lat,
    delivery_lng
  ) values (
    p_farmer_profile_id,
    p_reward_id,
    p_quantity,
    v_required_points,
    'requested',
    p_delivery_location_text,
    p_delivery_lat,
    p_delivery_lng
  ) returning id into v_request_id;

  insert into points_ledger (
    farmer_profile_id,
    entry_type,
    points_amount,
    reference_type,
    reference_id,
    note
  ) values (
    p_farmer_profile_id,
    'reward_reserve',
    v_required_points,
    'reward_request',
    v_request_id,
    'Reserve points for reward request'
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
    v_request_id,
    null,
    'requested',
    'farmer',
    p_farmer_profile_id,
    'Farmer created reward request'
  );

  return query
  select
    v_request_id,
    'requested'::reward_request_status,
    v_required_points,
    calculate_available_points(p_farmer_profile_id);
end;
$$;
