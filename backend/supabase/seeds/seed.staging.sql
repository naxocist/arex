-- Staging seed for AREX — WIPES all data then reseeds from scratch.
--
-- WARNING: This truncates ALL public tables and removes ALL auth users.
-- Only use on staging. Never run on production.
--
-- What this includes after wipe:
--   ✓ 7 role accounts (one per role + farmer2, password: 123456, email: @gmail.com)
--   ✓ Reference data  (material types, units, point rules, rewards catalog, value chain)
--   ✓ Storage bucket + RLS policies for reward images
--   ✓ Factories + logistics accounts
--   ✓ Pending approval accounts (to test admin approval flow)
--   ✓ Full workflow stress data covering ALL possible states:
--       material_submissions: submitted → pickup_scheduled → picked_up →
--                             delivered_to_factory → factory_confirmed →
--                             points_credited → cancelled
--       reward_requests:      requested → warehouse_approved → warehouse_rejected → cancelled
--       reward_delivery_jobs: reward_delivery_scheduled → out_for_delivery →
--                             reward_delivered → cancelled
--       points_ledger:        intake_credit, reward_reserve, reward_release,
--                             reward_spend, adjustment
--       factory_intakes:      confirmed, flagged
--       profiles.approval_status: approved, pending, rejected

begin;

-- -----------------------------------------------------------------------
-- WIPE: public tables (FK order — children before parents)
-- -----------------------------------------------------------------------
truncate table
  public.points_ledger,
  public.reward_delivery_jobs,
  public.reward_requests,
  public.factory_intakes,
  public.pickup_jobs,
  public.material_submissions,
  public.logistics_accounts,
  public.factories,
  public.profiles,
  public.value_chain_mappings,
  public.rewards_catalog,
  public.material_point_rules,
  public.measurement_units,
  public.material_types,
  public.admin_settings
cascade;

-- WIPE: auth users (all non-system users)
delete from auth.identities;
delete from auth.sessions;
delete from auth.refresh_tokens;
delete from auth.mfa_factors;
delete from auth.users;

-- -----------------------------------------------------------------------
-- Staging accounts — password: 123456
-- -----------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select *
    from (values
      -- Core role accounts
      ('bbbbbbbb-0000-4000-8000-000000000001'::uuid, 'farmer@gmail.com',    'farmer',    'เกษตรกร Staging',      'approved'),
      ('bbbbbbbb-0000-4000-8000-000000000002'::uuid, 'logistics@gmail.com', 'logistics', 'ขนส่ง Staging',        'approved'),
      ('bbbbbbbb-0000-4000-8000-000000000003'::uuid, 'factory@gmail.com',   'factory',   'โรงงาน Staging',       'approved'),
      ('bbbbbbbb-0000-4000-8000-000000000004'::uuid, 'warehouse@gmail.com', 'warehouse', 'คลังสินค้า Staging',   'approved'),
      ('bbbbbbbb-0000-4000-8000-000000000005'::uuid, 'executive@gmail.com', 'executive', 'ผู้บริหาร Staging',    'approved'),
      ('bbbbbbbb-0000-4000-8000-000000000006'::uuid, 'admin@gmail.com',     'admin',     'ผู้ดูแลระบบ Staging',  'approved'),
      ('bbbbbbbb-0000-4000-8000-000000000007'::uuid, 'farmer2@gmail.com',   'farmer',    'เกษตรกร 2 Staging',    'approved'),
      -- Extra farmers for volume
      ('bbbbbbbb-0000-4000-8000-000000000008'::uuid, 'farmer3@gmail.com',   'farmer',    'เกษตรกร 3 Staging',    'approved'),
      ('bbbbbbbb-0000-4000-8000-000000000009'::uuid, 'farmer4@gmail.com',   'farmer',    'เกษตรกร 4 Staging',    'approved'),
      -- Pending approval accounts (for admin approval flow)
      ('bbbbbbbb-0000-4000-8000-00000000000a'::uuid, 'farmer.pending@gmail.com',   'farmer',    'เกษตรกร รอการอนุมัติ',   'pending'),
      ('bbbbbbbb-0000-4000-8000-00000000000b'::uuid, 'logistics.pending@gmail.com','logistics', 'ขนส่ง รอการอนุมัติ',     'pending'),
      ('bbbbbbbb-0000-4000-8000-00000000000c'::uuid, 'factory.pending@gmail.com',  'factory',   'โรงงาน รอการอนุมัติ',    'pending'),
      -- Rejected account
      ('bbbbbbbb-0000-4000-8000-00000000000d'::uuid, 'farmer.rejected@gmail.com',  'farmer',    'เกษตรกร ถูกปฏิเสธ',      'rejected')
    ) as t(id, email, role, display_name, approval_status)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, confirmation_token, recovery_token,
      email_change_token_new, email_change, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      r.id, 'authenticated', 'authenticated', r.email,
      crypt('123456', gen_salt('bf')), now(),
      '', '', '', '', '', '', '', '',
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', r.role),
      jsonb_build_object('display_name', r.display_name, 'role', r.role),
      false, now(), now()
    );

    insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), r.id,
      jsonb_build_object('sub', r.id::text, 'email', r.email),
      'email', r.email, now(), now(), now()
    );

    insert into public.profiles (id, role, display_name, phone, province, approval_status)
    values (r.id, r.role, r.display_name, '0812345678', 'กรุงเทพมหานคร', r.approval_status);
  end loop;
end $$;

-- -----------------------------------------------------------------------
-- Admin settings
-- -----------------------------------------------------------------------
insert into public.admin_settings (key, approval_required_roles)
values ('global', '["farmer"]'::jsonb);

-- -----------------------------------------------------------------------
-- Material types
-- -----------------------------------------------------------------------
insert into public.material_types (code, name_th, active)
values
  ('rice_straw',        'ฟางข้าว',              true),
  ('cassava_root',      'เหง้ามันสำปะหลัง',     true),
  ('sugarcane_bagasse', 'ชานอ้อย',               true),
  ('corn_stover',       'ตอซังข้าวโพด',          true),
  ('orchard_residue',   'เศษเหลือทิ้งจากสวน',   true),
  ('plastic_waste',     'ขยะพลาสติก',            true);

-- -----------------------------------------------------------------------
-- Measurement units
-- -----------------------------------------------------------------------
insert into public.measurement_units (code, name_th, to_kg_factor, active)
values
  ('กิโลกรัม', 'กิโลกรัม',    1.000000,    true),
  ('ตัน',      'ตัน',         1000.000000, true),
  ('ก้อน',     'ก้อน (ฟาง)',  12.500000,   true);

-- -----------------------------------------------------------------------
-- Point rules (coins per kg)
-- -----------------------------------------------------------------------
insert into public.material_point_rules (material_type, points_per_kg)
values
  ('rice_straw',        1.000000),
  ('cassava_root',      1.100000),
  ('sugarcane_bagasse', 0.950000),
  ('corn_stover',       1.000000),
  ('orchard_residue',   3.125000),
  ('plastic_waste',    12.500000);

-- -----------------------------------------------------------------------
-- Rewards catalog
-- -----------------------------------------------------------------------
insert into public.rewards_catalog (id, name_th, description_th, points_cost, stock_qty, active)
values
  ('00000000-0000-4000-8000-00000000a001',
   'ไบโอดีเซล 10 ลิตร',
   'น้ำมันไบโอดีเซล จาก GTR / น้ำมันพืชปทุม',
   125, 10000, true),
  ('00000000-0000-4000-8000-00000000a002',
   'โซลาร์เซลล์มือสอง 1 แผง',
   'แผงโซลาร์เซลล์มือสอง ตรวจสอบคุณภาพโดย มพช.',
   625, 100, true),
  ('00000000-0000-4000-8000-00000000a003',
   'แผ่นคลุมดินชีวมวล',
   'เยื่อธรรมชาติจากชีวมวล ไม่ใช่พลาสติก',
   25, 999, true),
  ('00000000-0000-4000-8000-00000000a004',
   'น้ำมันไพโรไลซิส 10 ลิตร',
   'น้ำมันไพโรไลซิส จาก มช. / วว.',
   50, 5000, true);

-- -----------------------------------------------------------------------
-- Value chain mappings
-- -----------------------------------------------------------------------
insert into public.value_chain_mappings (product_name_th, producer_org, buyer_org, buyer_use_th, active)
values
  ('เยื่อชีวมวล (Bio-pulp)',  'มช. / มก.',       'บริษัท Precise', 'ทำไม้เทียม',   true),
  ('ถ่านชีวภาพ / ไบโอชาร์',  'มช. / วว. / มก.', 'กลุ่มโรงงาน',   'ใช้ใน Boiler', true),
  ('น้ำมันไพโรไลซิส',          'มช. / วว.',       'วิสาหกิจชุมชน', 'พลังงานชุมชน', true);

-- -----------------------------------------------------------------------
-- Factories
-- -----------------------------------------------------------------------
insert into public.factories (id, name_th, location_text, lat, lng, active, is_focal_point, factory_profile_id)
values
  ('eeeeeeee-0000-4000-8000-000000000001'::uuid,
   'มหาวิทยาลัยเชียงใหม่ (มช.)', 'เชียงใหม่', 18.7953, 98.9522, true, true,
   'bbbbbbbb-0000-4000-8000-000000000003'),
  ('eeeeeeee-0000-4000-8000-000000000002'::uuid,
   'โรงงานนครปฐม', 'นครปฐม', 13.8199, 100.0424, true, false, null);

-- -----------------------------------------------------------------------
-- Logistics accounts
-- -----------------------------------------------------------------------
insert into public.logistics_accounts (id, logistics_profile_id, name_th, location_text, lat, lng, active)
values
  ('ffffffff-0000-4000-8000-000000000001'::uuid,
   'bbbbbbbb-0000-4000-8000-000000000002',
   'บริษัทขนส่ง Staging', 'กรุงเทพมหานคร', 13.7563, 100.5018, true);

-- -----------------------------------------------------------------------
-- Material submissions — all 7 statuses
-- -----------------------------------------------------------------------
insert into public.material_submissions
  (id, farmer_profile_id, material_type, quantity_value, quantity_unit,
   pickup_location_text, pickup_lat, pickup_lng, notes, status, created_at)
values
  -- 1. submitted (fresh, waiting for logistics)
  ('cccccccc-0000-4000-8000-000000000101'::uuid,
   'bbbbbbbb-0000-4000-8000-000000000001',
   'rice_straw', 500, 'กิโลกรัม','ไร่นา อ.บางปะอิน อยุธยา', 14.2333, 100.5667,
   'ฟางข้าวหลังเก็บเกี่ยว', 'submitted', now() - interval '1 day'),

  -- 2. pickup_scheduled
  ('cccccccc-0000-4000-8000-000000000102'::uuid,
   'bbbbbbbb-0000-4000-8000-000000000001',
   'cassava_root', 2000, 'กิโลกรัม', 'แปลงมันสำปะหลัง สระแก้ว', 13.8241, 102.0645,
   null, 'pickup_scheduled', now() - interval '2 days'),

  -- 3. picked_up
  ('cccccccc-0000-4000-8000-000000000103'::uuid,
   'bbbbbbbb-0000-4000-8000-000000000007',
   'sugarcane_bagasse', 1000, 'กิโลกรัม', 'โรงน้ำตาล สุพรรณบุรี', 14.4744, 100.1177,
   null, 'picked_up', now() - interval '3 days'),

  -- 4. delivered_to_factory
  ('cccccccc-0000-4000-8000-000000000104'::uuid,
   'bbbbbbbb-0000-4000-8000-000000000008',
   'corn_stover', 800, 'กิโลกรัม', 'ไร่ข้าวโพด นครราชสีมา', 14.9799, 102.0978,
   null, 'delivered_to_factory', now() - interval '5 days'),

  -- 5. factory_confirmed
  ('cccccccc-0000-4000-8000-000000000105'::uuid,
   'bbbbbbbb-0000-4000-8000-000000000009',
   'orchard_residue', 320, 'กิโลกรัม', 'สวนผลไม้ จันทบุรี', 12.6113, 102.1034,
   null, 'factory_confirmed', now() - interval '7 days'),

  -- 6. points_credited
  ('cccccccc-0000-4000-8000-000000000106'::uuid,
   'bbbbbbbb-0000-4000-8000-000000000001',
   'plastic_waste', 80, 'กิโลกรัม', 'ชุมชน ลาดพร้าว กรุงเทพฯ', 13.8175, 100.6161,
   'ขยะพลาสติกคัดแยกแล้ว', 'points_credited', now() - interval '10 days'),

  -- 7. points_credited (farmer2 — for multi-farmer dashboard)
  ('cccccccc-0000-4000-8000-000000000107'::uuid,
   'bbbbbbbb-0000-4000-8000-000000000007',
   'rice_straw', 1000, 'กิโลกรัม', 'นาข้าว อยุธยา', 14.3532, 100.5876,
   null, 'points_credited', now() - interval '12 days'),

  -- 8. cancelled
  ('cccccccc-0000-4000-8000-000000000108'::uuid,
   'bbbbbbbb-0000-4000-8000-000000000001',
   'rice_straw', 200, 'กิโลกรัม', 'ไร่นา ปทุมธานี', 14.0208, 100.5253,
   'ยกเลิกเนื่องจากสภาพอากาศ', 'cancelled', now() - interval '15 days');

-- -----------------------------------------------------------------------
-- Pickup jobs — all statuses
-- -----------------------------------------------------------------------
insert into public.pickup_jobs
  (id, submission_id, logistics_profile_id, destination_factory_id,
   planned_pickup_at, pickup_window_end_at,
   picked_up_at, delivered_factory_at, factory_confirmed_at,
   status, notes)
values
  -- pickup_scheduled (matches submission 102)
  ('dddddddd-0000-4000-8000-000000000201'::uuid,
   'cccccccc-0000-4000-8000-000000000102',
   'bbbbbbbb-0000-4000-8000-000000000002',
   'eeeeeeee-0000-4000-8000-000000000001',
   now() + interval '1 day', now() + interval '2 days',
   null, null, null,
   'pickup_scheduled', null),

  -- picked_up (matches submission 103)
  ('dddddddd-0000-4000-8000-000000000202'::uuid,
   'cccccccc-0000-4000-8000-000000000103',
   'bbbbbbbb-0000-4000-8000-000000000002',
   'eeeeeeee-0000-4000-8000-000000000001',
   now() - interval '3 days', now() - interval '2 days',
   now() - interval '2 days', null, null,
   'picked_up', null),

  -- delivered_to_factory (matches submission 104)
  ('dddddddd-0000-4000-8000-000000000203'::uuid,
   'cccccccc-0000-4000-8000-000000000104',
   'bbbbbbbb-0000-4000-8000-000000000002',
   'eeeeeeee-0000-4000-8000-000000000001',
   now() - interval '6 days', now() - interval '5 days',
   now() - interval '5 days', now() - interval '4 days', null,
   'delivered_to_factory', null),

  -- factory_confirmed (matches submission 105)
  ('dddddddd-0000-4000-8000-000000000204'::uuid,
   'cccccccc-0000-4000-8000-000000000105',
   'bbbbbbbb-0000-4000-8000-000000000002',
   'eeeeeeee-0000-4000-8000-000000000001',
   now() - interval '8 days', now() - interval '7 days',
   now() - interval '7 days', now() - interval '7 days', now() - interval '6 days',
   'factory_confirmed', null),

  -- factory_confirmed — completed (matches submission 106, points_credited)
  ('dddddddd-0000-4000-8000-000000000205'::uuid,
   'cccccccc-0000-4000-8000-000000000106',
   'bbbbbbbb-0000-4000-8000-000000000002',
   'eeeeeeee-0000-4000-8000-000000000001',
   now() - interval '11 days', now() - interval '10 days',
   now() - interval '10 days', now() - interval '10 days', now() - interval '9 days',
   'factory_confirmed', null),

  -- factory_confirmed — completed (matches submission 107, farmer2)
  ('dddddddd-0000-4000-8000-000000000206'::uuid,
   'cccccccc-0000-4000-8000-000000000107',
   'bbbbbbbb-0000-4000-8000-000000000002',
   'eeeeeeee-0000-4000-8000-000000000001',
   now() - interval '13 days', now() - interval '12 days',
   now() - interval '12 days', now() - interval '12 days', now() - interval '11 days',
   'factory_confirmed', null),

  -- cancelled
  ('dddddddd-0000-4000-8000-000000000207'::uuid,
   'cccccccc-0000-4000-8000-000000000108',
   'bbbbbbbb-0000-4000-8000-000000000002',
   'eeeeeeee-0000-4000-8000-000000000001',
   now() - interval '16 days', now() - interval '15 days',
   null, null, null,
   'cancelled', 'เกษตรกรยกเลิก');

-- -----------------------------------------------------------------------
-- Factory intakes — confirmed + flagged
-- -----------------------------------------------------------------------
insert into public.factory_intakes
  (id, pickup_job_id, factory_profile_id, measured_weight_kg, discrepancy_note, status, confirmed_at)
values
  -- confirmed (submission 105 — factory_confirmed)
  ('aaaaaaaa-0000-4000-8000-000000000301'::uuid,
   'dddddddd-0000-4000-8000-000000000204',
   'bbbbbbbb-0000-4000-8000-000000000003',
   318.5, null, 'confirmed', now() - interval '6 days'),

  -- confirmed (submission 106 — points_credited, farmer1)
  ('aaaaaaaa-0000-4000-8000-000000000302'::uuid,
   'dddddddd-0000-4000-8000-000000000205',
   'bbbbbbbb-0000-4000-8000-000000000003',
   79.2, null, 'confirmed', now() - interval '9 days'),

  -- confirmed (submission 107 — points_credited, farmer2)
  ('aaaaaaaa-0000-4000-8000-000000000303'::uuid,
   'dddddddd-0000-4000-8000-000000000206',
   'bbbbbbbb-0000-4000-8000-000000000003',
   998.0, null, 'confirmed', now() - interval '11 days'),

  -- flagged (submission 103 — picked_up, discrepancy)
  ('aaaaaaaa-0000-4000-8000-000000000304'::uuid,
   'dddddddd-0000-4000-8000-000000000202',
   'bbbbbbbb-0000-4000-8000-000000000003',
   850.0, 'น้ำหนักต่างจากที่แจ้งไว้ 150 kg', 'flagged', now() - interval '2 days');

-- -----------------------------------------------------------------------
-- Points ledger — all entry types
-- -----------------------------------------------------------------------
insert into public.points_ledger
  (id, farmer_profile_id, entry_type, points_amount, reference_type, reference_id, note)
values
  -- intake_credit: plastic_waste 79.2 kg × 12.5 = 990 pts (farmer1)
  ('11111111-0000-4000-8000-000000000001'::uuid,
   'bbbbbbbb-0000-4000-8000-000000000001',
   'intake_credit', 990,
   'factory_intake', 'aaaaaaaa-0000-4000-8000-000000000302',
   'รับขยะพลาสติก 79.2 kg'),

  -- intake_credit: rice_straw 998 kg × 1.0 = 998 pts (farmer2)
  ('11111111-0000-4000-8000-000000000002'::uuid,
   'bbbbbbbb-0000-4000-8000-000000000007',
   'intake_credit', 998,
   'factory_intake', 'aaaaaaaa-0000-4000-8000-000000000303',
   'รับฟางข้าว 998 kg'),

  -- reward_reserve: farmer1 redeems biodiesel (125 pts reserved)
  ('11111111-0000-4000-8000-000000000003'::uuid,
   'bbbbbbbb-0000-4000-8000-000000000001',
   'reward_reserve', 125,
   'reward_request', '22222222-0000-4000-8000-000000000001',
   'จองแต้มสำหรับไบโอดีเซล'),

  -- reward_spend: after warehouse approved (125 pts spent)
  ('11111111-0000-4000-8000-000000000004'::uuid,
   'bbbbbbbb-0000-4000-8000-000000000001',
   'reward_spend', 125,
   'reward_request', '22222222-0000-4000-8000-000000000002',
   'แลกรับโซลาร์เซลล์'),

  -- reward_release: warehouse rejected, points released back
  ('11111111-0000-4000-8000-000000000005'::uuid,
   'bbbbbbbb-0000-4000-8000-000000000001',
   'reward_release', 50,
   'reward_request', '22222222-0000-4000-8000-000000000003',
   'คืนแต้มจากคำขอที่ถูกปฏิเสธ'),

  -- adjustment: manual correction by admin
  ('11111111-0000-4000-8000-000000000006'::uuid,
   'bbbbbbbb-0000-4000-8000-000000000001',
   'adjustment', 100,
   null, null,
   'ปรับแต้มโดยผู้ดูแลระบบ'),

  -- intake_credit: orchard_residue 318.5 kg × 3.125 = 995 pts (farmer3)
  ('11111111-0000-4000-8000-000000000007'::uuid,
   'bbbbbbbb-0000-4000-8000-000000000009',
   'intake_credit', 995,
   'factory_intake', 'aaaaaaaa-0000-4000-8000-000000000301',
   'รับเศษสวน 318.5 kg');

-- -----------------------------------------------------------------------
-- Reward requests — all 4 statuses
-- -----------------------------------------------------------------------
insert into public.reward_requests
  (id, farmer_profile_id, reward_id, quantity, requested_points,
   status, warehouse_profile_id, warehouse_decision_at, rejection_reason, requested_at)
values
  -- requested (pending warehouse action)
  ('22222222-0000-4000-8000-000000000001'::uuid,
   'bbbbbbbb-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000a001', 1, 125,
   'requested', null, null, null,
   now() - interval '1 day'),

  -- warehouse_approved
  ('22222222-0000-4000-8000-000000000002'::uuid,
   'bbbbbbbb-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000a002', 1, 625,
   'warehouse_approved',
   'bbbbbbbb-0000-4000-8000-000000000004',
   now() - interval '3 days', null,
   now() - interval '5 days'),

  -- warehouse_rejected
  ('22222222-0000-4000-8000-000000000003'::uuid,
   'bbbbbbbb-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000a004', 1, 50,
   'warehouse_rejected',
   'bbbbbbbb-0000-4000-8000-000000000004',
   now() - interval '6 days', 'สินค้าหมดสต๊อกชั่วคราว',
   now() - interval '8 days'),

  -- cancelled (by farmer)
  ('22222222-0000-4000-8000-000000000004'::uuid,
   'bbbbbbbb-0000-4000-8000-000000000007',
   '00000000-0000-4000-8000-00000000a003', 2, 50,
   'cancelled', null, null, null,
   now() - interval '4 days'),

  -- requested (farmer2, for warehouse queue volume)
  ('22222222-0000-4000-8000-000000000005'::uuid,
   'bbbbbbbb-0000-4000-8000-000000000007',
   '00000000-0000-4000-8000-00000000a001', 1, 125,
   'requested', null, null, null,
   now() - interval '2 days'),

  -- for out_for_delivery job (farmer3)
  ('22222222-0000-4000-8000-000000000006'::uuid,
   'bbbbbbbb-0000-4000-8000-000000000008',
   '00000000-0000-4000-8000-00000000a003', 1, 25,
   'warehouse_approved',
   'bbbbbbbb-0000-4000-8000-000000000004',
   now() - interval '2 days', null,
   now() - interval '3 days'),

  -- for reward_delivered job (farmer4)
  ('22222222-0000-4000-8000-000000000007'::uuid,
   'bbbbbbbb-0000-4000-8000-000000000009',
   '00000000-0000-4000-8000-00000000a004', 1, 50,
   'warehouse_approved',
   'bbbbbbbb-0000-4000-8000-000000000004',
   now() - interval '6 days', null,
   now() - interval '7 days'),

  -- for cancelled delivery job
  ('22222222-0000-4000-8000-000000000008'::uuid,
   'bbbbbbbb-0000-4000-8000-000000000008',
   '00000000-0000-4000-8000-00000000a001', 1, 125,
   'warehouse_approved',
   'bbbbbbbb-0000-4000-8000-000000000004',
   now() - interval '9 days', null,
   now() - interval '10 days');

-- -----------------------------------------------------------------------
-- Reward delivery jobs — all 4 statuses
-- -----------------------------------------------------------------------
insert into public.reward_delivery_jobs
  (id, reward_request_id, logistics_profile_id,
   planned_delivery_at, delivery_window_end_at,
   out_for_delivery_at, delivered_at, status, notes)
values
  -- reward_delivery_scheduled (for approved request 002)
  ('33333333-0000-4000-8000-000000000001'::uuid,
   '22222222-0000-4000-8000-000000000002',
   'bbbbbbbb-0000-4000-8000-000000000002',
   now() + interval '2 days', now() + interval '3 days',
   null, null,
   'reward_delivery_scheduled', null),

  -- out_for_delivery (farmer3)
  ('33333333-0000-4000-8000-000000000002'::uuid,
   '22222222-0000-4000-8000-000000000006',
   'bbbbbbbb-0000-4000-8000-000000000002',
   now() - interval '1 day', now(),
   now(), null,
   'out_for_delivery', 'กำลังจัดส่ง'),

  -- reward_delivered
  ('33333333-0000-4000-8000-000000000003'::uuid,
   '22222222-0000-4000-8000-000000000007',
   'bbbbbbbb-0000-4000-8000-000000000002',
   now() - interval '5 days', now() - interval '4 days',
   now() - interval '4 days', now() - interval '3 days',
   'reward_delivered', 'ส่งสำเร็จ'),

  -- cancelled
  ('33333333-0000-4000-8000-000000000004'::uuid,
   '22222222-0000-4000-8000-000000000008',
   'bbbbbbbb-0000-4000-8000-000000000002',
   now() - interval '8 days', now() - interval '7 days',
   null, null,
   'cancelled', 'ยกเลิกเนื่องจากที่อยู่ไม่ถูกต้อง');

-- -----------------------------------------------------------------------
-- Storage: reward-images bucket + RLS policies
-- -----------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reward-images',
  'reward-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$ begin
  drop policy if exists "Public read reward images"             on storage.objects;
  drop policy if exists "Auth users can upload reward images"   on storage.objects;
  drop policy if exists "Auth users can update reward images"   on storage.objects;
  drop policy if exists "Auth users can delete reward images"   on storage.objects;
end $$;

create policy "Public read reward images"
  on storage.objects for select
  using (bucket_id = 'reward-images');

create policy "Auth users can upload reward images"
  on storage.objects for insert
  with check (bucket_id = 'reward-images' and auth.role() = 'authenticated');

create policy "Auth users can update reward images"
  on storage.objects for update
  using (bucket_id = 'reward-images' and auth.role() = 'authenticated');

create policy "Auth users can delete reward images"
  on storage.objects for delete
  using (bucket_id = 'reward-images' and auth.role() = 'authenticated');

commit;
