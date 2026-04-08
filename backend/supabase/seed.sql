-- AREX demo seed for Logistics + Executive flows
-- Prerequisite: run migrations/0001_init_arex.sql first.
-- This script does NOT create auth users or profiles.
-- It only uses existing rows in profiles.

begin;

do $$
declare
  -- Fixed profile IDs from your Supabase `profiles` table.
  v_factory_profile uuid := '0e252cd8-faaf-4396-b37e-64e8d841c69c';
  v_executive uuid := '23a28b56-2dcd-4388-ad15-415bd32150ec';
  v_logistics uuid := '9860d98c-94dd-40af-a8ae-a90bfcd5c1d0';
  v_warehouse uuid := '9eaf4ed3-cd66-4f48-8b0b-d5d905fd9370';
  v_farmer_1 uuid := 'f4ef8667-e708-4a4c-bda5-3454c141748e';
  -- Only one farmer exists currently, so fallback target is the same profile.
  v_farmer_2 uuid := 'f4ef8667-e708-4a4c-bda5-3454c141748e';

  v_factory_site uuid := '00000000-0000-4000-8000-00000000f001';
  v_reward_1 uuid := '00000000-0000-4000-8000-00000000a001';
  v_reward_2 uuid := '00000000-0000-4000-8000-00000000a002';
begin
  -- Validate required profiles and roles exist exactly as expected.
  if not exists (
    select 1 from profiles where id = v_factory_profile and role = 'factory'
  ) then
    raise exception 'Missing/mismatched factory profile: %', v_factory_profile;
  end if;

  if not exists (
    select 1 from profiles where id = v_executive and role = 'executive'
  ) then
    raise exception 'Missing/mismatched executive profile: %', v_executive;
  end if;

  if not exists (
    select 1 from profiles where id = v_logistics and role = 'logistics'
  ) then
    raise exception 'Missing/mismatched logistics profile: %', v_logistics;
  end if;

  if not exists (
    select 1 from profiles where id = v_warehouse and role = 'warehouse'
  ) then
    raise exception 'Missing/mismatched warehouse profile: %', v_warehouse;
  end if;

  if not exists (
    select 1 from profiles where id = v_farmer_1 and role = 'farmer'
  ) then
    raise exception 'Missing/mismatched farmer profile: %', v_farmer_1;
  end if;

  -- Factory destination used by pickup jobs.
  insert into factories (id, name_th, location_text, active)
  values (v_factory_site, 'โรงงานชีวมวล Seed - สระบุรี', 'จ.สระบุรี', true)
  on conflict (id) do update
  set name_th = excluded.name_th,
      location_text = excluded.location_text,
      active = excluded.active;

  -- Reward catalog rows used by reward_requests.
  insert into rewards_catalog (id, name_th, description_th, points_cost, stock_qty, active)
  values
    (v_reward_1, 'ปุ๋ยอินทรีย์ Seed', 'ขนาด 25 กก.', 1200, 500, true),
    (v_reward_2, 'เมล็ดพันธุ์ข้าว Seed', 'เมล็ดพันธุ์คัดเกรด', 600, 800, true)
  on conflict (id) do update
  set name_th = excluded.name_th,
      description_th = excluded.description_th,
      points_cost = excluded.points_cost,
      stock_qty = excluded.stock_qty,
      active = excluded.active;

  -- Material submissions (for logistics queue + executive overview).
  insert into material_submissions (
    id,
    farmer_profile_id,
    material_type,
    quantity_value,
    quantity_unit,
    pickup_location_text,
    notes,
    status,
    created_at,
    updated_at
  )
  values
    (
      '10000000-0000-4000-8000-000000000001',
      v_farmer_1,
      'rice_straw',
      10.000,
      'ton',
      'ต.นาเฉลียง อ.หนองไผ่ จ.เพชรบูรณ์',
      'seed: submitted #1',
      'submitted',
      now() - interval '2 day',
      now() - interval '2 day'
    ),
    (
      '10000000-0000-4000-8000-000000000002',
      v_farmer_1,
      'cassava_root',
      7.500,
      'ton',
      'อ.เมือง จ.นครราชสีมา',
      'seed: submitted #2',
      'submitted',
      now() - interval '36 hour',
      now() - interval '36 hour'
    ),
    (
      '10000000-0000-4000-8000-000000000003',
      v_farmer_2,
      'sugarcane_bagasse',
      12.000,
      'ton',
      'อ.พานทอง จ.ชลบุรี',
      'seed: submitted #3',
      'submitted',
      now() - interval '30 hour',
      now() - interval '30 hour'
    ),
    (
      '10000000-0000-4000-8000-000000000004',
      v_farmer_2,
      'corn_stover',
      9.000,
      'ton',
      'อ.แม่แจ่ม จ.เชียงใหม่',
      'seed: pickup_scheduled',
      'pickup_scheduled',
      now() - interval '18 hour',
      now() - interval '18 hour'
    ),
    (
      '10000000-0000-4000-8000-000000000005',
      v_farmer_1,
      'rice_straw',
      6.000,
      'ton',
      'อ.ดอยสะเก็ด จ.เชียงใหม่',
      'seed: picked_up',
      'picked_up',
      now() - interval '14 hour',
      now() - interval '14 hour'
    ),
    (
      '10000000-0000-4000-8000-000000000006',
      v_farmer_2,
      'cassava_root',
      11.000,
      'ton',
      'อ.หางดง จ.เชียงใหม่',
      'seed: delivered_to_factory',
      'delivered_to_factory',
      now() - interval '28 hour',
      now() - interval '28 hour'
    )
    on conflict (id) do update
    set farmer_profile_id = excluded.farmer_profile_id,
        material_type = excluded.material_type,
        quantity_value = excluded.quantity_value,
        quantity_unit = excluded.quantity_unit,
        pickup_location_text = excluded.pickup_location_text,
        notes = excluded.notes,
        status = excluded.status,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at;

  -- Pickup jobs for active logistics states counted by executive dashboard.
  insert into pickup_jobs (
    id,
    submission_id,
    logistics_profile_id,
    destination_factory_id,
    planned_pickup_at,
    picked_up_at,
    delivered_factory_at,
    status,
    notes,
    created_at,
    updated_at
  )
  values
    (
      '20000000-0000-4000-8000-000000000004',
      '10000000-0000-4000-8000-000000000004',
      v_logistics,
      v_factory_site,
      now() + interval '2 hour',
      null,
      null,
      'pickup_scheduled',
      'seed: pickup job scheduled',
      now() - interval '12 hour',
      now() - interval '12 hour'
    ),
    (
      '20000000-0000-4000-8000-000000000005',
      '10000000-0000-4000-8000-000000000005',
      v_logistics,
      v_factory_site,
      now() - interval '8 hour',
      now() - interval '6 hour',
      null,
      'picked_up',
      'seed: pickup job picked up',
      now() - interval '10 hour',
      now() - interval '6 hour'
    ),
    (
      '20000000-0000-4000-8000-000000000006',
      '10000000-0000-4000-8000-000000000006',
      v_logistics,
      v_factory_site,
      now() - interval '26 hour',
      now() - interval '24 hour',
      now() - interval '20 hour',
      'delivered_to_factory',
      'seed: pickup job delivered to factory',
      now() - interval '26 hour',
      now() - interval '20 hour'
    )
    on conflict (id) do update
    set submission_id = excluded.submission_id,
        logistics_profile_id = excluded.logistics_profile_id,
        destination_factory_id = excluded.destination_factory_id,
        planned_pickup_at = excluded.planned_pickup_at,
        picked_up_at = excluded.picked_up_at,
        delivered_factory_at = excluded.delivered_factory_at,
        status = excluded.status,
        notes = excluded.notes,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at;

  -- Pending reward requests for warehouse queue metric in executive dashboard.
  insert into reward_requests (
    id,
    farmer_profile_id,
    reward_id,
    quantity,
    requested_points,
    status,
    requested_at,
    updated_at
  )
  values
    (
      '30000000-0000-4000-8000-000000000001',
      v_farmer_1,
      v_reward_1,
      1,
      (select points_cost * 1 from rewards_catalog where id = v_reward_1),
      'requested',
      now() - interval '9 hour',
      now() - interval '9 hour'
    ),
    (
      '30000000-0000-4000-8000-000000000002',
      v_farmer_1,
      v_reward_2,
      2,
      (select points_cost * 2 from rewards_catalog where id = v_reward_2),
      'requested',
      now() - interval '7 hour',
      now() - interval '7 hour'
    ),
    (
      '30000000-0000-4000-8000-000000000003',
      v_farmer_2,
      v_reward_2,
      1,
      (select points_cost * 1 from rewards_catalog where id = v_reward_2),
      'requested',
      now() - interval '5 hour',
      now() - interval '5 hour'
    )
    on conflict (id) do update
    set farmer_profile_id = excluded.farmer_profile_id,
        reward_id = excluded.reward_id,
        quantity = excluded.quantity,
        requested_points = excluded.requested_points,
        status = excluded.status,
        requested_at = excluded.requested_at,
        updated_at = excluded.updated_at,
        warehouse_profile_id = null,
        warehouse_decision_at = null,
        rejection_reason = null;

  -- Optional status events for timeline readability.
  insert into status_events (id, entity_type, entity_id, from_status, to_status, actor_role, actor_profile_id, note, event_at)
  values
    ('40000000-0000-4000-8000-000000000001', 'submission', '10000000-0000-4000-8000-000000000001', null, 'submitted', 'farmer', v_farmer_1, 'seed event', now() - interval '2 day'),
    ('40000000-0000-4000-8000-000000000002', 'submission', '10000000-0000-4000-8000-000000000002', null, 'submitted', 'farmer', v_farmer_1, 'seed event', now() - interval '36 hour'),
    ('40000000-0000-4000-8000-000000000003', 'submission', '10000000-0000-4000-8000-000000000003', null, 'submitted', 'farmer', v_farmer_2, 'seed event', now() - interval '30 hour'),
    ('40000000-0000-4000-8000-000000000004', 'submission', '10000000-0000-4000-8000-000000000004', 'submitted', 'pickup_scheduled', 'logistics', v_logistics, 'seed event', now() - interval '18 hour'),
    ('40000000-0000-4000-8000-000000000005', 'submission', '10000000-0000-4000-8000-000000000005', 'pickup_scheduled', 'picked_up', 'logistics', v_logistics, 'seed event', now() - interval '14 hour'),
    ('40000000-0000-4000-8000-000000000006', 'submission', '10000000-0000-4000-8000-000000000006', 'picked_up', 'delivered_to_factory', 'logistics', v_logistics, 'seed event', now() - interval '28 hour')
  on conflict (id) do nothing;
end $$;

commit;

-- Expected result after running:
-- 1) Logistics page has actionable rows in submitted status (can click "รับงาน").
-- 2) Executive KPI endpoint has non-zero values for:
--    - submissions_total
--    - submissions_pending_pickup
--    - pickup_jobs_active
--    - reward_requests_pending_warehouse