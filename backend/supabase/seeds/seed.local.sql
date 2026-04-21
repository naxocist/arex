-- Deterministic local seed for AREX.
-- Applied by `supabase seed` and by `supabase db reset`.
-- Accounts: all @gmail.com, all passwords = 123456
-- Farmer is the ONLY role requiring admin approval.
-- Coverage: every submission status, every reward_request status,
--           every delivery_job status, all 5 ledger entry types,
--           admin approval workflow (pending/approved/rejected).

begin;

-- -----------------------------------------------------------------------
-- Wipe previous seed data
-- -----------------------------------------------------------------------
truncate table
  public.delivery_jobs,
  public.intakes,
  public.pickup_jobs,
  public.reward_requests,
  public.points_ledger,
  public.status_events,
  public.submissions,
  public.org_accounts,
  public.rewards,
  public.logistics_to_farmer_distances,
  public.submission_factory_distances,
  public.measurement_units,
  public.material_types,
  public.value_chain_mappings,
  public.impact_baselines,
  public.profiles
restart identity cascade;

delete from auth.identities i
using auth.users u
where i.user_id = u.id
  and u.email like '%@gmail.com'
  and u.email in (
    'fac1@gmail.com','fac2@gmail.com',
    'logis1@gmail.com','logis2@gmail.com',
    'farmer1@gmail.com','farmer2@gmail.com','farmer3@gmail.com',
    'farmer4@gmail.com','farmer5@gmail.com',
    'farmerpending1@gmail.com','farmerpending2@gmail.com',
    'farmerrejected@gmail.com',
    'warehouse@gmail.com','executive@gmail.com','admin@gmail.com'
  );

delete from auth.users
where email in (
  'fac1@gmail.com','fac2@gmail.com',
  'logis1@gmail.com','logis2@gmail.com',
  'farmer1@gmail.com','farmer2@gmail.com','farmer3@gmail.com',
  'farmer4@gmail.com','farmer5@gmail.com',
  'farmerpending1@gmail.com','farmerpending2@gmail.com',
  'farmerrejected@gmail.com',
  'warehouse@gmail.com','executive@gmail.com','admin@gmail.com'
);

-- -----------------------------------------------------------------------
-- Auth users (password = 123456 for ALL)
-- UUID block layout:
--   c1xxxxxx = factory1 (profile)    c2 = factory2
--   c3xxxxxx = logistics1            c4 = logistics2
--   c5xxxxxx = farmer1               c6 = farmer_b
--   c7xxxxxx = farmer3               c8 = farmer_d
--   c9xxxxxx = farmer5
--   caxxxxxx = warehouse              cbxxxxxx = executive
--   ccxxxxxx = admin
--   cdxxxxxx = farmerpending1        cexxxxxx = farmerpending2
--   cfxxxxxx = farmerinactive
-- -----------------------------------------------------------------------
with seed_users(id, email, role, display_name, phone, province) as (
  values
    ('c1000000-0000-4000-8000-000000000001'::uuid, 'fac1@gmail.com',       'factory',   'โรงงาน 1',        '0810003001', 'สระบุรี'),
    ('c2000000-0000-4000-8000-000000000001'::uuid, 'fac2@gmail.com',       'factory',   'โรงงาน 2',        '0810003002', 'ชัยนาท'),
    ('c3000000-0000-4000-8000-000000000001'::uuid, 'logis1@gmail.com',     'logistics', 'ขนส่ง 1',         '0810002001', 'สระบุรี'),
    ('c4000000-0000-4000-8000-000000000001'::uuid, 'logis2@gmail.com',     'logistics', 'ขนส่ง 2',         '0810002002', 'เชียงใหม่'),
    ('c5000000-0000-4000-8000-000000000001'::uuid, 'farmer1@gmail.com',        'farmer',    'เกษตรกร 1',       '0810001001', 'เพชรบูรณ์'),
    ('c6000000-0000-4000-8000-000000000001'::uuid, 'farmer2@gmail.com',        'farmer',    'เกษตรกร 2',       '0810001002', 'นครราชสีมา'),
    ('c7000000-0000-4000-8000-000000000001'::uuid, 'farmer3@gmail.com',        'farmer',    'เกษตรกร 3',       '0810001003', 'เชียงใหม่'),
    ('c8000000-0000-4000-8000-000000000001'::uuid, 'farmer4@gmail.com',        'farmer',    'เกษตรกร 4',       '0810001004', 'ขอนแก่น'),
    ('c9000000-0000-4000-8000-000000000001'::uuid, 'farmer5@gmail.com',        'farmer',    'เกษตรกร 5',       '0810001005', 'ลพบุรี'),
    ('ca000000-0000-4000-8000-000000000001'::uuid, 'warehouse@gmail.com',       'warehouse', 'คลังสินค้า AREX',  '0810004001', 'ปทุมธานี'),
    ('cb000000-0000-4000-8000-000000000001'::uuid, 'executive@gmail.com',       'executive', 'ผู้บริหาร AREX',   '0810005001', 'กรุงเทพมหานคร'),
    ('cc000000-0000-4000-8000-000000000001'::uuid, 'admin@gmail.com',           'admin',     'ผู้ดูแลระบบ AREX', '0810006001', 'กรุงเทพมหานคร'),
    ('cd000000-0000-4000-8000-000000000001'::uuid, 'farmerpending1@gmail.com', 'farmer',    'ชาวนา รอดูแล',     '0819001001', 'อุดรธานี'),
    ('ce000000-0000-4000-8000-000000000001'::uuid, 'farmerpending2@gmail.com', 'farmer',    'ชาวไร่ รอดูแล',    '0819001002', 'กาฬสินธุ์'),
    ('cf000000-0000-4000-8000-000000000001'::uuid, 'farmerrejected@gmail.com', 'farmer',    'ชาวนา ถูกปฏิเสธ', '0819001003', 'นครพนม')
),
ins_users as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, confirmation_token, recovery_token,
    email_change_token_new, email_change, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at
  )
  select
    '00000000-0000-0000-0000-000000000000'::uuid,
    s.id, 'authenticated', 'authenticated', s.email,
    crypt('123456', gen_salt('bf')), now(),
    '','','','','','','','',
    jsonb_build_object('provider','email','providers',jsonb_build_array('email'),'role',s.role),
    jsonb_build_object('display_name',s.display_name,'role',s.role),
    false, now(), now()
  from seed_users s
  returning id, email
)
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(), u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', u.email, now(), now(), now()
from ins_users u;

-- -----------------------------------------------------------------------
-- Profiles
-- -----------------------------------------------------------------------
insert into public.profiles (id, role, display_name, phone, province, approval_status)
values
  ('c1000000-0000-4000-8000-000000000001', 'factory',   'โรงงาน 1',        '0810003001', 'สระบุรี',        'active'),
  ('c2000000-0000-4000-8000-000000000001', 'factory',   'โรงงาน 2',        '0810003002', 'ชัยนาท',         'active'),
  ('c3000000-0000-4000-8000-000000000001', 'logistics', 'ขนส่ง 1',         '0810002001', 'สระบุรี',        'active'),
  ('c4000000-0000-4000-8000-000000000001', 'logistics', 'ขนส่ง 2',         '0810002002', 'เชียงใหม่',      'active'),
  ('c5000000-0000-4000-8000-000000000001', 'farmer',    'เกษตรกร 1',       '0810001001', 'เพชรบูรณ์',      'active'),
  ('c6000000-0000-4000-8000-000000000001', 'farmer',    'เกษตรกร 2',       '0810001002', 'นครราชสีมา',     'active'),
  ('c7000000-0000-4000-8000-000000000001', 'farmer',    'เกษตรกร 3',       '0810001003', 'เชียงใหม่',      'active'),
  ('c8000000-0000-4000-8000-000000000001', 'farmer',    'เกษตรกร 4',       '0810001004', 'ขอนแก่น',        'active'),
  ('c9000000-0000-4000-8000-000000000001', 'farmer',    'เกษตรกร 5',       '0810001005', 'ลพบุรี',         'active'),
  ('ca000000-0000-4000-8000-000000000001', 'warehouse', 'คลังสินค้า AREX',  '0810004001', 'ปทุมธานี',       'active'),
  ('cb000000-0000-4000-8000-000000000001', 'executive', 'ผู้บริหาร AREX',   '0810005001', 'กรุงเทพมหานคร',  'active'),
  ('cc000000-0000-4000-8000-000000000001', 'admin',     'ผู้ดูแลระบบ AREX', '0810006001', 'กรุงเทพมหานคร',  'active'),
  -- Inactive — admin approval workflow demo
  ('cd000000-0000-4000-8000-000000000001', 'farmer',    'ชาวนา รอเปิดใช้งาน',  '0819001001', 'อุดรธานี',  'inactive'),
  ('ce000000-0000-4000-8000-000000000001', 'farmer',    'ชาวไร่ รอเปิดใช้งาน', '0819001002', 'กาฬสินธุ์', 'inactive'),
  ('cf000000-0000-4000-8000-000000000001', 'farmer',    'ชาวนา ปิดใช้งาน',     '0819001003', 'นครพนม',    'inactive');

-- -----------------------------------------------------------------------
-- Admin settings — farmer only requires approval
-- -----------------------------------------------------------------------
insert into public.admin_settings (key, approval_required_roles)
values ('global', '["farmer"]'::jsonb)
on conflict (key) do update
  set approval_required_roles = excluded.approval_required_roles,
      updated_at = now();

-- -----------------------------------------------------------------------
-- Material types
-- -----------------------------------------------------------------------
insert into public.material_types (code, name_th, active, points_per_kg)
values
  ('rice_straw',        'ฟางข้าว',              true,  1.000000),
  ('cassava_root',      'เหง้ามันสำปะหลัง',     true,  1.200000),
  ('sugarcane_bagasse', 'ชานอ้อย',               true,  1.100000),
  ('corn_stover',       'ตอซังข้าวโพด',          true,  1.050000),
  ('orchard_residue',   'เศษไม้ผล',              true,  3.125000),
  ('plastic_waste',     'ขยะพลาสติก',            true, 12.500000)
on conflict (code) do update
  set name_th = excluded.name_th, active = excluded.active,
      points_per_kg = excluded.points_per_kg, updated_at = now();

-- -----------------------------------------------------------------------
-- Measurement units
-- -----------------------------------------------------------------------
insert into public.measurement_units (code, name_th, to_kg_factor, active)
values
  ('กิโลกรัม', 'กิโลกรัม', 1.000000,    true),
  ('ตัน',      'ตัน',      1000.000000, true),
  ('ก้อน',     'ก้อน (ฟาง)', 12.500000, true)
on conflict (code) do update
  set name_th = excluded.name_th, to_kg_factor = excluded.to_kg_factor,
      active = excluded.active, updated_at = now();

-- -----------------------------------------------------------------------
-- Rewards catalog
-- -----------------------------------------------------------------------
insert into public.rewards (id, name_th, description_th, points_cost, stock_qty, active)
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
   50, 5000, true)
on conflict (id) do update
  set name_th = excluded.name_th, description_th = excluded.description_th,
      points_cost = excluded.points_cost, stock_qty = excluded.stock_qty,
      active = excluded.active, updated_at = now();

-- -----------------------------------------------------------------------
-- Org accounts (factories + logistics)
-- factory1 → สระบุรี   factory2 → ชัยนาท   CMU focal-point
-- logistics1 → สระบุรี  logistics2 → เชียงใหม่
-- -----------------------------------------------------------------------
insert into public.org_accounts (id, profile_id, type, name_th, location_text, lat, lng, active, is_focal_point)
values
  ('00000000-0000-4000-8000-00000000f001',
   'c1000000-0000-4000-8000-000000000001',
   'factory', 'โรงงานชีวมวล AREX - สระบุรี (โรงงาน 1)', 'จ.สระบุรี',
   14.528915, 100.910142, true, false),
  ('00000000-0000-4000-8000-00000000f002',
   'c2000000-0000-4000-8000-000000000001',
   'factory', 'โรงงานชีวมวล AREX - ชัยนาท (โรงงาน 2)', 'จ.ชัยนาท',
   15.186197, 100.125125, true, false),
  ('00000000-0000-4000-8000-00000000f003',
   null,
   'factory', 'มหาวิทยาลัยเชียงใหม่ (มช.)', 'เชียงใหม่',
   18.788300, 98.985300, true, true),
  ('00000000-0000-4000-8000-0000000c0001',
   'c3000000-0000-4000-8000-000000000001',
   'logistics', 'ทีมขนส่ง AREX - สระบุรี (ขนส่ง 1)', 'จ.สระบุรี',
   14.528915, 100.910142, true, false),
  ('00000000-0000-4000-8000-0000000c0002',
   'c4000000-0000-4000-8000-000000000001',
   'logistics', 'ทีมขนส่ง AREX - เชียงใหม่ (ขนส่ง 2)', 'จ.เชียงใหม่',
   18.788300, 98.985300, true, false)
on conflict (id) do update
  set name_th = excluded.name_th, location_text = excluded.location_text,
      lat = excluded.lat, lng = excluded.lng,
      active = excluded.active, is_focal_point = excluded.is_focal_point;

-- -----------------------------------------------------------------------
-- Value chain mappings
-- -----------------------------------------------------------------------
insert into public.value_chain_mappings (product_name_th, producer_org, buyer_org, buyer_use_th, active)
values
  ('เยื่อชีวมวล (Bio-pulp)',   'มช. / มก.',           'บริษัท Precise',   'ทำไม้เทียม',           true),
  ('ถ่านชีวภาพ / ไบโอชาร์',   'มช. / วว. / มก.',     'กลุ่มโรงงาน',      'ใช้ใน Boiler',         true),
  ('น้ำมันไพโรไลซิส',          'มช. / วว.',           'วิสาหกิจชุมชน',    'พลังงานชุมชน',         true),
  ('ไบโอดีเซล B100',           'GTR / น้ำมันพืชปทุม', 'สหกรณ์เกษตร',      'ใช้แทนน้ำมันดีเซล',   true),
  ('ฟางอัดก้อน',               'เกษตรกรภาคเหนือ',     'โรงงานกระดาษ',     'วัตถุดิบกระดาษรีไซเคิล', true)
on conflict do nothing;

-- -----------------------------------------------------------------------
-- Impact baselines
-- -----------------------------------------------------------------------
insert into public.impact_baselines
  (id, pilot_area, hotspot_count_baseline, co2_kg_baseline, avg_income_baht_per_household, recorded_by, recorded_at)
values
  ('00000000-0000-4000-8000-0000000b0001',
   'เชียงใหม่ — เขตนิคมสันทราย / สันป่าตอง',
   142, 284000.000, 18500.00,
   'ทีมวิจัย มช. (ดร.สมศักดิ์)', now() - interval '30 days')
on conflict (id) do nothing;

-- =========================================================================
-- DEMO DATA — every UI state across every flow
--
-- Farmer roles and their scenarios:
--   farmer1 (เพชรบูรณ์)   : Sub-01 submitted, Sub-02 pickup_scheduled,
--                             Sub-03 picked_up, Sub-06 points_credited (base for rewards)
--   farmer2 (นครราชสีมา) : Sub-04 delivered_to_factory, Sub-05 factory_confirmed,
--                             Sub-07 cancelled, Sub-08 points_credited (reward flow)
--   farmer3 (เชียงใหม่)  : Sub-11/12 points_credited via CMU, complete reward deliver
--   farmer4 (ขอนแก่น)    : Sub-13 points_credited, reward cancel + out_for_delivery
--   farmer5 (ลพบุรี)     : Sub-14 points_credited, reward requested + warehouse_rejected
--
-- logistics1 (สระบุรี)  handles farmer1 / farmer2 / farmer4 / farmer5 jobs
-- logistics2 (เชียงใหม่) handles farmer3 jobs
-- =========================================================================

-- -----------------------------------------------------------------------
-- Submissions — all 7 statuses
-- -----------------------------------------------------------------------
insert into public.submissions (
  id, farmer_profile_id, material_type, quantity_value, quantity_unit,
  pickup_location_text, pickup_lat, pickup_lng, notes, status, created_at, updated_at
)
values
  -- farmer1 Sub-01: submitted (brand new, awaiting scheduling)
  ('10000001-0000-4000-8000-000000000001',
   'c5000000-0000-4000-8000-000000000001',
   'rice_straw', 800.0, 'กิโลกรัม',
   'ต.นาเฉลียง อ.หนองไผ่ จ.เพชรบูรณ์', 16.04905, 101.14966,
   null, 'submitted',
   now() - interval '3 hours', now() - interval '3 hours'),

  -- farmer1 Sub-02: pickup_scheduled
  ('10000001-0000-4000-8000-000000000002',
   'c5000000-0000-4000-8000-000000000001',
   'cassava_root', 500.0, 'กิโลกรัม',
   'ต.นาเฉลียง อ.หนองไผ่ จ.เพชรบูรณ์', 16.04905, 101.14966,
   null, 'pickup_scheduled',
   now() - interval '2 days', now() - interval '1 day 20 hours'),

  -- farmer1 Sub-03: picked_up
  ('10000001-0000-4000-8000-000000000003',
   'c5000000-0000-4000-8000-000000000001',
   'corn_stover', 300.0, 'กิโลกรัม',
   'ต.นาเฉลียง อ.หนองไผ่ จ.เพชรบูรณ์', 16.04905, 101.14966,
   null, 'picked_up',
   now() - interval '4 days', now() - interval '3 days 18 hours'),

  -- farmer2 Sub-04: delivered_to_factory
  ('10000002-0000-4000-8000-000000000004',
   'c6000000-0000-4000-8000-000000000001',
   'orchard_residue', 200.0, 'กิโลกรัม',
   'อ.เมือง จ.นครราชสีมา', 14.97990, 102.09777,
   null, 'delivered_to_factory',
   now() - interval '5 days', now() - interval '4 days 12 hours'),

  -- farmer2 Sub-05: factory_confirmed (no points yet)
  ('10000002-0000-4000-8000-000000000005',
   'c6000000-0000-4000-8000-000000000001',
   'plastic_waste', 50.0, 'กิโลกรัม',
   'อ.เมือง จ.นครราชสีมา', 14.97990, 102.09777,
   null, 'factory_confirmed',
   now() - interval '7 days', now() - interval '6 days'),

  -- farmer1 Sub-06: points_credited (large rice straw batch — funds farmer1 rewards)
  ('10000001-0000-4000-8000-000000000006',
   'c5000000-0000-4000-8000-000000000001',
   'rice_straw', 1000.0, 'กิโลกรัม',
   'ต.นาเฉลียง อ.หนองไผ่ จ.เพชรบูรณ์', 16.04905, 101.14966,
   null, 'points_credited',
   now() - interval '14 days', now() - interval '12 days'),

  -- farmer2 Sub-07: cancelled
  ('10000002-0000-4000-8000-000000000007',
   'c6000000-0000-4000-8000-000000000001',
   'sugarcane_bagasse', 150.0, 'กิโลกรัม',
   'อ.เมือง จ.นครราชสีมา', 14.97990, 102.09777,
   null, 'cancelled',
   now() - interval '6 days', now() - interval '6 days'),

  -- farmer2 Sub-08: points_credited (funds farmer2 rewards)
  ('10000002-0000-4000-8000-000000000008',
   'c6000000-0000-4000-8000-000000000001',
   'rice_straw', 600.0, 'กิโลกรัม',
   'อ.เมือง จ.นครราชสีมา', 14.97990, 102.09777,
   null, 'points_credited',
   now() - interval '20 days', now() - interval '18 days'),

  -- farmer3 Sub-11: points_credited (rice_straw ก้อน) via CMU
  ('10000003-0000-4000-8000-000000000011',
   'c7000000-0000-4000-8000-000000000001',
   'rice_straw', 30.0, 'ก้อน',
   'ต.สันทราย อ.สันทราย จ.เชียงใหม่', 18.85100, 99.01800,
   null, 'points_credited',
   now() - interval '8 days', now() - interval '5 days'),

  -- farmer3 Sub-12: points_credited (orchard_residue) via CMU
  ('10000003-0000-4000-8000-000000000012',
   'c7000000-0000-4000-8000-000000000001',
   'orchard_residue', 80.0, 'กิโลกรัม',
   'ต.สันทราย อ.สันทราย จ.เชียงใหม่', 18.85100, 99.01800,
   null, 'points_credited',
   now() - interval '6 days', now() - interval '3 days'),

  -- farmer4 Sub-13: points_credited (funds farmer4 rewards)
  ('10000004-0000-4000-8000-000000000013',
   'c8000000-0000-4000-8000-000000000001',
   'rice_straw', 400.0, 'กิโลกรัม',
   'อ.เมือง จ.ขอนแก่น', 16.43278, 102.83445,
   null, 'points_credited',
   now() - interval '10 days', now() - interval '8 days'),

  -- farmer5 Sub-14: points_credited (funds farmer5 rewards)
  ('10000005-0000-4000-8000-000000000014',
   'c9000000-0000-4000-8000-000000000001',
   'orchard_residue', 60.0, 'กิโลกรัม',
   'อ.เมือง จ.ลพบุรี', 14.79936, 100.65334,
   null, 'points_credited',
   now() - interval '12 days', now() - interval '10 days')

on conflict (id) do nothing;

-- -----------------------------------------------------------------------
-- Pickup jobs
-- logistics1 base: สระบุรี (14.528915, 100.910142)
-- logistics2 base: เชียงใหม่ (18.788300, 98.985300)
-- -----------------------------------------------------------------------
insert into public.pickup_jobs (
  id, submission_id, logistics_profile_id, destination_factory_id,
  planned_pickup_at, pickup_window_end_at,
  picked_up_at, delivered_factory_at, factory_confirmed_at,
  status, notes, created_at, updated_at
)
values
  -- farmer1 Sub-02: pickup_scheduled
  ('20000001-0000-4000-8000-000000000002',
   '10000001-0000-4000-8000-000000000002',
   'c3000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000f001',
   now() + interval '4 hours', now() + interval '8 hours',
   null, null, null,
   'pickup_scheduled', null,
   now() - interval '1 day 20 hours', now() - interval '1 day 20 hours'),

  -- farmer1 Sub-03: picked_up
  ('20000001-0000-4000-8000-000000000003',
   '10000001-0000-4000-8000-000000000003',
   'c3000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000f001',
   now() - interval '3 days 20 hours', now() - interval '3 days 16 hours',
   now() - interval '3 days 18 hours', null, null,
   'picked_up', null,
   now() - interval '4 days', now() - interval '3 days 18 hours'),

  -- farmer2 Sub-04: delivered_to_factory
  ('20000002-0000-4000-8000-000000000004',
   '10000002-0000-4000-8000-000000000004',
   'c3000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000f001',
   now() - interval '5 days', now() - interval '4 days 20 hours',
   now() - interval '4 days 22 hours', now() - interval '4 days 12 hours', null,
   'delivered_to_factory', null,
   now() - interval '5 days', now() - interval '4 days 12 hours'),

  -- farmer2 Sub-05: factory_confirmed
  ('20000002-0000-4000-8000-000000000005',
   '10000002-0000-4000-8000-000000000005',
   'c3000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000f001',
   now() - interval '7 days', now() - interval '6 days 20 hours',
   now() - interval '6 days 22 hours', now() - interval '6 days 12 hours', now() - interval '6 days',
   'factory_confirmed', null,
   now() - interval '7 days', now() - interval '6 days'),

  -- farmer1 Sub-06: factory_confirmed (points_credited)
  ('20000001-0000-4000-8000-000000000006',
   '10000001-0000-4000-8000-000000000006',
   'c3000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000f001',
   now() - interval '14 days', now() - interval '13 days 20 hours',
   now() - interval '13 days 22 hours', now() - interval '13 days 12 hours', now() - interval '12 days',
   'factory_confirmed', null,
   now() - interval '14 days', now() - interval '12 days'),

  -- farmer2 Sub-08: factory_confirmed (points_credited)
  ('20000002-0000-4000-8000-000000000008',
   '10000002-0000-4000-8000-000000000008',
   'c3000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000f001',
   now() - interval '20 days', now() - interval '19 days 20 hours',
   now() - interval '19 days 22 hours', now() - interval '19 days 12 hours', now() - interval '18 days',
   'factory_confirmed', null,
   now() - interval '20 days', now() - interval '18 days'),

  -- farmer3 Sub-11: factory_confirmed → CMU (logistics2)
  ('20000003-0000-4000-8000-000000000011',
   '10000003-0000-4000-8000-000000000011',
   'c4000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000f003',
   now() - interval '8 days', now() - interval '7 days 20 hours',
   now() - interval '7 days 18 hours', now() - interval '6 days 12 hours', now() - interval '5 days',
   'factory_confirmed', null,
   now() - interval '8 days', now() - interval '5 days'),

  -- farmer3 Sub-12: factory_confirmed → CMU (logistics2)
  ('20000003-0000-4000-8000-000000000012',
   '10000003-0000-4000-8000-000000000012',
   'c4000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000f003',
   now() - interval '6 days', now() - interval '5 days 20 hours',
   now() - interval '5 days 18 hours', now() - interval '4 days 12 hours', now() - interval '3 days',
   'factory_confirmed', null,
   now() - interval '6 days', now() - interval '3 days'),

  -- farmer4 Sub-13: factory_confirmed → factory1 (logistics1)
  ('20000004-0000-4000-8000-000000000013',
   '10000004-0000-4000-8000-000000000013',
   'c3000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000f001',
   now() - interval '10 days', now() - interval '9 days 20 hours',
   now() - interval '9 days 22 hours', now() - interval '9 days 12 hours', now() - interval '8 days',
   'factory_confirmed', null,
   now() - interval '10 days', now() - interval '8 days'),

  -- farmer5 Sub-14: factory_confirmed → factory1 (logistics1)
  ('20000005-0000-4000-8000-000000000014',
   '10000005-0000-4000-8000-000000000014',
   'c3000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000f001',
   now() - interval '12 days', now() - interval '11 days 20 hours',
   now() - interval '11 days 22 hours', now() - interval '11 days 12 hours', now() - interval '10 days',
   'factory_confirmed', null,
   now() - interval '12 days', now() - interval '10 days')

on conflict (id) do nothing;

-- -----------------------------------------------------------------------
-- Factory intakes
-- -----------------------------------------------------------------------
insert into public.intakes (
  id, pickup_job_id, factory_profile_id, measured_weight_kg, status, confirmed_at, created_at
)
values
  -- plastic_waste 50 kg × 12.5 = 625 pts (factory_confirmed, no ledger yet)
  ('40000002-0000-4000-8000-000000000005',
   '20000002-0000-4000-8000-000000000005',
   'c1000000-0000-4000-8000-000000000001',
   50.0, 'confirmed', now() - interval '6 days', now() - interval '6 days'),

  -- rice_straw 1000 kg × 1.0 = 1000 pts (farmer1)
  ('40000001-0000-4000-8000-000000000006',
   '20000001-0000-4000-8000-000000000006',
   'c1000000-0000-4000-8000-000000000001',
   1000.0, 'confirmed', now() - interval '12 days', now() - interval '12 days'),

  -- rice_straw 600 kg × 1.0 = 600 pts (farmer2)
  ('40000002-0000-4000-8000-000000000008',
   '20000002-0000-4000-8000-000000000008',
   'c1000000-0000-4000-8000-000000000001',
   600.0, 'confirmed', now() - interval '18 days', now() - interval '18 days'),

  -- rice_straw 30×12.5=375 kg × 1.0 = 375 pts (farmer3)
  ('40000003-0000-4000-8000-000000000011',
   '20000003-0000-4000-8000-000000000011',
   'c1000000-0000-4000-8000-000000000001',
   375.0, 'confirmed', now() - interval '5 days', now() - interval '5 days'),

  -- orchard_residue 80 kg × 3.125 = 250 pts (farmer3)
  ('40000003-0000-4000-8000-000000000012',
   '20000003-0000-4000-8000-000000000012',
   'c1000000-0000-4000-8000-000000000001',
   80.0, 'confirmed', now() - interval '3 days', now() - interval '3 days'),

  -- rice_straw 400 kg × 1.0 = 400 pts (farmer4)
  ('40000004-0000-4000-8000-000000000013',
   '20000004-0000-4000-8000-000000000013',
   'c1000000-0000-4000-8000-000000000001',
   400.0, 'confirmed', now() - interval '8 days', now() - interval '8 days'),

  -- orchard_residue 60 kg × 3.125 = 187.5 ≈ 187 pts (farmer5)
  ('40000005-0000-4000-8000-000000000014',
   '20000005-0000-4000-8000-000000000014',
   'c1000000-0000-4000-8000-000000000001',
   60.0, 'confirmed', now() - interval '10 days', now() - interval '10 days')

on conflict (id) do nothing;

-- -----------------------------------------------------------------------
-- Reward requests — covering all statuses:
--   requested, warehouse_approved (with all delivery sub-statuses),
--   warehouse_rejected, cancelled
--
-- RR-A01: farmer1 — requested (pending warehouse)
-- RR-A02: farmer1 — warehouse_approved + delivery_scheduled
-- RR-A03: farmer1 — warehouse_approved + out_for_delivery
-- RR-A04: farmer1 — warehouse_rejected (solar, stock reason)
-- RR-B01: farmer2 — requested (pending warehouse)
-- RR-B02: farmer2 — warehouse_approved + reward_delivered (complete)
-- RR-B03: farmer2 — cancelled (by farmer before warehouse acted)
-- RR-C01: farmer3 — warehouse_approved + reward_delivered (complete end-to-end)
-- RR-C02: farmer3 — warehouse_approved + delivery_scheduled
-- RR-D01: farmer4 — warehouse_approved + out_for_delivery
-- RR-D02: farmer4 — cancelled (by farmer)
-- RR-E01: farmer5 — warehouse_rejected
-- RR-E02: farmer5 — requested
-- -----------------------------------------------------------------------
insert into public.reward_requests (
  id, farmer_profile_id, reward_id, quantity, requested_points,
  status, warehouse_profile_id, warehouse_decision_at, rejection_reason,
  delivery_location_text, delivery_lat, delivery_lng,
  requested_at, updated_at
)
values
  -- RR-A01: farmer1 requested
  ('30000001-0000-4000-8000-000000000001',
   'c5000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000a001', 1, 125,
   'requested', null, null, null,
   'ต.นาเฉลียง อ.หนองไผ่ จ.เพชรบูรณ์ 67220', 16.04905, 101.14966,
   now() - interval '2 hours', now() - interval '2 hours'),

  -- RR-A02: farmer1 approved + delivery_scheduled
  ('30000001-0000-4000-8000-000000000002',
   'c5000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000a003', 1, 25,
   'warehouse_approved',
   'ca000000-0000-4000-8000-000000000001', now() - interval '11 days', null,
   'ต.นาเฉลียง อ.หนองไผ่ จ.เพชรบูรณ์ 67220', 16.04905, 101.14966,
   now() - interval '12 days', now() - interval '11 days'),

  -- RR-A03: farmer1 approved + out_for_delivery
  ('30000001-0000-4000-8000-000000000003',
   'c5000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000a004', 1, 50,
   'warehouse_approved',
   'ca000000-0000-4000-8000-000000000001', now() - interval '4 days', null,
   'ต.นาเฉลียง อ.หนองไผ่ จ.เพชรบูรณ์ 67220', 16.04905, 101.14966,
   now() - interval '4 days 6 hours', now() - interval '4 days'),

  -- RR-A04: farmer1 warehouse_rejected (solar)
  ('30000001-0000-4000-8000-000000000004',
   'c5000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000a002', 1, 625,
   'warehouse_rejected',
   'ca000000-0000-4000-8000-000000000001', now() - interval '5 days 10 hours',
   'ของรางวัลชิ้นนี้หมดสต็อกชั่วคราว กรุณายื่นคำขอใหม่เมื่อมีสต็อก',
   null, null, null,
   now() - interval '6 days', now() - interval '5 days 10 hours'),

  -- RR-B01: farmer2 requested
  ('30000002-0000-4000-8000-000000000001',
   'c6000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000a004', 2, 100,
   'requested', null, null, null,
   '45 ถ.สุรนารี อ.เมือง จ.นครราชสีมา 30000', 14.97990, 102.09777,
   now() - interval '1 hour', now() - interval '1 hour'),

  -- RR-B02: farmer2 approved + reward_delivered (complete flow)
  ('30000002-0000-4000-8000-000000000002',
   'c6000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000a003', 1, 25,
   'warehouse_approved',
   'ca000000-0000-4000-8000-000000000001', now() - interval '5 days 22 hours', null,
   '45 ถ.สุรนารี อ.เมือง จ.นครราชสีมา 30000', 14.97990, 102.09777,
   now() - interval '6 days', now() - interval '5 days'),

  -- RR-B03: farmer2 cancelled
  ('30000002-0000-4000-8000-000000000003',
   'c6000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000a001', 1, 125,
   'cancelled', null, null, null,
   null, null, null,
   now() - interval '3 days', now() - interval '3 days'),

  -- RR-C01: farmer3 approved + reward_delivered (complete end-to-end)
  ('30000003-0000-4000-8000-000000000001',
   'c7000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000a001', 1, 125,
   'warehouse_approved',
   'ca000000-0000-4000-8000-000000000001', now() - interval '4 days 6 hours', null,
   'ต.สันทราย อ.สันทราย จ.เชียงใหม่ 50210', 18.85100, 99.01800,
   now() - interval '4 days 12 hours', now() - interval '3 days 12 hours'),

  -- RR-C02: farmer3 approved + delivery_scheduled
  ('30000003-0000-4000-8000-000000000002',
   'c7000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000a004', 1, 50,
   'warehouse_approved',
   'ca000000-0000-4000-8000-000000000001', now() - interval '22 hours', null,
   'ต.สันทราย อ.สันทราย จ.เชียงใหม่ 50210', 18.85100, 99.01800,
   now() - interval '1 day', now() - interval '22 hours'),

  -- RR-D01: farmer4 approved + out_for_delivery
  ('30000004-0000-4000-8000-000000000001',
   'c8000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000a001', 1, 125,
   'warehouse_approved',
   'ca000000-0000-4000-8000-000000000001', now() - interval '3 days', null,
   'อ.เมือง จ.ขอนแก่น 40000', 16.43278, 102.83445,
   now() - interval '3 days 6 hours', now() - interval '3 days'),

  -- RR-D02: farmer4 cancelled
  ('30000004-0000-4000-8000-000000000002',
   'c8000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000a003', 2, 50,
   'cancelled', null, null, null,
   null, null, null,
   now() - interval '5 days', now() - interval '5 days'),

  -- RR-E01: farmer5 warehouse_rejected
  ('30000005-0000-4000-8000-000000000001',
   'c9000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000a002', 1, 625,
   'warehouse_rejected',
   'ca000000-0000-4000-8000-000000000001', now() - interval '7 days',
   'ยอดแต้มไม่เพียงพอ กรุณาตรวจสอบยอดแต้มคงเหลือ',
   null, null, null,
   now() - interval '8 days', now() - interval '7 days'),

  -- RR-E02: farmer5 requested
  ('30000005-0000-4000-8000-000000000002',
   'c9000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000a001', 1, 125,
   'requested', null, null, null,
   'อ.เมือง จ.ลพบุรี 15000', 14.79936, 100.65334,
   now() - interval '30 minutes', now() - interval '30 minutes')

on conflict (id) do nothing;

-- -----------------------------------------------------------------------
-- Reward delivery jobs — all 3 statuses
-- -----------------------------------------------------------------------
insert into public.delivery_jobs (
  id, reward_request_id, logistics_profile_id,
  planned_delivery_at, delivery_window_end_at,
  out_for_delivery_at, delivered_at, status, created_at, updated_at
)
values
  -- RR-A02: delivery_scheduled (farmer1 แผ่นคลุมดิน)
  ('60000001-0000-4000-8000-000000000002',
   '30000001-0000-4000-8000-000000000002',
   'c3000000-0000-4000-8000-000000000001',
   now() + interval '2 days', now() + interval '2 days 4 hours',
   null, null, 'reward_delivery_scheduled',
   now() - interval '11 days', now() - interval '11 days'),

  -- RR-A03: out_for_delivery (farmer1 น้ำมันไพโรไลซิส)
  ('60000001-0000-4000-8000-000000000003',
   '30000001-0000-4000-8000-000000000003',
   'c3000000-0000-4000-8000-000000000001',
   now() - interval '4 days', now() - interval '3 days 20 hours',
   now() - interval '5 hours', null, 'out_for_delivery',
   now() - interval '4 days', now() - interval '5 hours'),

  -- RR-B02: reward_delivered (farmer2 แผ่นคลุมดิน — complete)
  ('60000002-0000-4000-8000-000000000002',
   '30000002-0000-4000-8000-000000000002',
   'c3000000-0000-4000-8000-000000000001',
   now() - interval '5 days', now() - interval '4 days 20 hours',
   now() - interval '5 days 2 hours', now() - interval '5 days',
   'reward_delivered',
   now() - interval '5 days', now() - interval '5 days'),

  -- RR-C01: reward_delivered (farmer3 biodiesel — complete end-to-end, logistics2)
  ('60000003-0000-4000-8000-000000000001',
   '30000003-0000-4000-8000-000000000001',
   'c4000000-0000-4000-8000-000000000001',
   now() - interval '3 days 18 hours', now() - interval '3 days 14 hours',
   now() - interval '3 days 16 hours', now() - interval '3 days 12 hours',
   'reward_delivered',
   now() - interval '4 days', now() - interval '3 days 12 hours'),

  -- RR-C02: delivery_scheduled (farmer3 น้ำมันไพโรไลซิส, logistics2)
  ('60000003-0000-4000-8000-000000000002',
   '30000003-0000-4000-8000-000000000002',
   'c4000000-0000-4000-8000-000000000001',
   now() + interval '1 day', now() + interval '1 day 4 hours',
   null, null, 'reward_delivery_scheduled',
   now() - interval '22 hours', now() - interval '22 hours'),

  -- RR-D01: out_for_delivery (farmer4 biodiesel, logistics1)
  ('60000004-0000-4000-8000-000000000001',
   '30000004-0000-4000-8000-000000000001',
   'c3000000-0000-4000-8000-000000000001',
   now() - interval '3 days', now() - interval '2 days 20 hours',
   now() - interval '4 hours', null, 'out_for_delivery',
   now() - interval '3 days', now() - interval '4 hours')

on conflict (id) do nothing;

-- -----------------------------------------------------------------------
-- Logistics distances
-- logistics1 base: สระบุรี (14.528915, 100.910142)
-- logistics2 base: เชียงใหม่ (18.788300, 98.985300)
-- farmer_a: เพชรบูรณ์ (16.04905, 101.14966)  ≈ 185 km from สระบุรี
-- farmer_b: นครราชสีมา (14.97990, 102.09777) ≈ 145 km from สระบุรี
-- farmer_c: เชียงใหม่ (18.85100, 99.01800)   ≈ 7 km from CMU
-- farmer_d: ขอนแก่น (16.43278, 102.83445)    ≈ 230 km from สระบุรี
-- farmer_e: ลพบุรี (14.79936, 100.65334)     ≈ 28 km from สระบุรี
-- factory_a: สระบุรี ≈185/145/230/28 km from farmer a/b/d/e
-- CMU: ≈7 km from farmer_c
-- -----------------------------------------------------------------------
insert into public.logistics_to_farmer_distances
  (logistics_profile_id, reference_type, reference_id, distance_km)
values
  -- logistics_a: queue (Sub-01 awaiting scheduling)
  ('c3000000-0000-4000-8000-000000000001','submission','10000001-0000-4000-8000-000000000001', 185.3),

  -- logistics_a: pickup job submissions
  ('c3000000-0000-4000-8000-000000000001','submission','10000001-0000-4000-8000-000000000002', 185.3),
  ('c3000000-0000-4000-8000-000000000001','submission','10000001-0000-4000-8000-000000000003', 185.3),
  ('c3000000-0000-4000-8000-000000000001','submission','10000002-0000-4000-8000-000000000004', 144.8),
  ('c3000000-0000-4000-8000-000000000001','submission','10000002-0000-4000-8000-000000000005', 144.8),
  ('c3000000-0000-4000-8000-000000000001','submission','10000001-0000-4000-8000-000000000006', 185.3),
  ('c3000000-0000-4000-8000-000000000001','submission','10000002-0000-4000-8000-000000000008', 144.8),
  ('c3000000-0000-4000-8000-000000000001','submission','10000004-0000-4000-8000-000000000013', 229.6),
  ('c3000000-0000-4000-8000-000000000001','submission','10000005-0000-4000-8000-000000000014',  28.4),

  -- logistics_b: pickup job submissions (เชียงใหม่ area)
  ('c4000000-0000-4000-8000-000000000001','submission','10000003-0000-4000-8000-000000000011', 6.8),
  ('c4000000-0000-4000-8000-000000000001','submission','10000003-0000-4000-8000-000000000012', 6.8),

  -- logistics_a: reward delivery jobs
  ('c3000000-0000-4000-8000-000000000001','reward_request','30000001-0000-4000-8000-000000000002', 185.3),
  ('c3000000-0000-4000-8000-000000000001','reward_request','30000001-0000-4000-8000-000000000003', 185.3),
  ('c3000000-0000-4000-8000-000000000001','reward_request','30000002-0000-4000-8000-000000000002', 144.8),
  ('c3000000-0000-4000-8000-000000000001','reward_request','30000004-0000-4000-8000-000000000001', 229.6),

  -- logistics_b: reward delivery jobs
  ('c4000000-0000-4000-8000-000000000001','reward_request','30000003-0000-4000-8000-000000000001', 6.8),
  ('c4000000-0000-4000-8000-000000000001','reward_request','30000003-0000-4000-8000-000000000002', 6.8)

on conflict (logistics_profile_id, reference_type, reference_id) do nothing;

-- farmer pickup → factory distances (provider-independent)
-- factory_a (สระบุรี): 00000000-0000-4000-8000-00000000f001
-- CMU (มช.):           00000000-0000-4000-8000-00000000f003
insert into public.submission_factory_distances
  (submission_id, factory_id, distance_km)
values
  -- farmer_a submissions → factory_a (สระบุรี)
  ('10000001-0000-4000-8000-000000000002','00000000-0000-4000-8000-00000000f001', 185.3),
  ('10000001-0000-4000-8000-000000000003','00000000-0000-4000-8000-00000000f001', 185.3),
  ('10000001-0000-4000-8000-000000000006','00000000-0000-4000-8000-00000000f001', 185.3),

  -- farmer_b submissions → factory_a (สระบุรี)
  ('10000002-0000-4000-8000-000000000004','00000000-0000-4000-8000-00000000f001', 144.8),
  ('10000002-0000-4000-8000-000000000005','00000000-0000-4000-8000-00000000f001', 144.8),
  ('10000002-0000-4000-8000-000000000008','00000000-0000-4000-8000-00000000f001', 144.8),

  -- farmer_c submissions → CMU (มช.)
  ('10000003-0000-4000-8000-000000000011','00000000-0000-4000-8000-00000000f003', 7.1),
  ('10000003-0000-4000-8000-000000000012','00000000-0000-4000-8000-00000000f003', 7.1),

  -- farmer_d submission → factory_a (สระบุรี)
  ('10000004-0000-4000-8000-000000000013','00000000-0000-4000-8000-00000000f001', 229.6),

  -- farmer_e submission → factory_a (สระบุรี)
  ('10000005-0000-4000-8000-000000000014','00000000-0000-4000-8000-00000000f001',  28.4)

on conflict (submission_id, factory_id) do nothing;

-- -----------------------------------------------------------------------
-- Points ledger — all 5 entry types
--
-- farmer_a: +1000 (intake) -25 (reserve RR-A02) -50 (reserve RR-A03)
--           +625 (release RR-A04 rejected) -625 (reserve RR-A04)
--           = 1000 - 25 - 50 - 625 + 625 = 925 available (125 pending RR-A01)
-- farmer_b: +600 (intake) -25 (reserve RR-B02) -25 (spend RR-B02)
--           = 600 - 25 = 575 (RR-B02 spend reduces, RR-B03 was cancelled before reserve)
-- farmer_c: +375 +250 (intake) -125 (reserve RR-C01) -125 (spend RR-C01)
--           -50 (reserve RR-C02) +50 (adjustment goodwill) = 375
-- farmer_d: +400 (intake) -125 (reserve RR-D01) -50 (reserve RR-D02) +50 (release RR-D02)
--           = 275 available
-- farmer_e: +187 (intake ≈60kg×3.125) -625 (reserve RR-E01) +625 (release RR-E01)
--           = 187 (RR-E02 requested, 125 not yet reserved)
-- -----------------------------------------------------------------------
insert into public.points_ledger (id, farmer_profile_id, entry_type, points_amount, reference_type, reference_id, note, created_at)
values
  -- farmer_a: intake
  ('50000001-0000-4000-8000-000000000001',
   'c5000000-0000-4000-8000-000000000001',
   'intake_credit', 1000, 'factory_intake', '40000001-0000-4000-8000-000000000006',
   'น้ำหนักจริง 1,000 กก. × 1.0 pt/kg', now() - interval '12 days'),

  -- farmer_a: RR-A02 reserve แผ่นคลุมดิน
  ('50000001-0000-4000-8000-000000000002',
   'c5000000-0000-4000-8000-000000000001',
   'reward_reserve', 25, 'reward_request', '30000001-0000-4000-8000-000000000002',
   'จองแต้มแลกแผ่นคลุมดิน', now() - interval '12 days'),

  -- farmer_a: RR-A03 reserve น้ำมันไพโรไลซิส
  ('50000001-0000-4000-8000-000000000003',
   'c5000000-0000-4000-8000-000000000001',
   'reward_reserve', 50, 'reward_request', '30000001-0000-4000-8000-000000000003',
   'จองแต้มแลกน้ำมันไพโรไลซิส', now() - interval '4 days 6 hours'),

  -- farmer_a: RR-A04 reserve solar (rejected → release)
  ('50000001-0000-4000-8000-000000000004',
   'c5000000-0000-4000-8000-000000000001',
   'reward_reserve', 625, 'reward_request', '30000001-0000-4000-8000-000000000004',
   'จองแต้มแลกโซลาร์เซลล์', now() - interval '6 days'),
  ('50000001-0000-4000-8000-000000000005',
   'c5000000-0000-4000-8000-000000000001',
   'reward_release', 625, 'reward_request', '30000001-0000-4000-8000-000000000004',
   'คืนแต้ม — คำขอโซลาร์ถูกปฏิเสธ', now() - interval '5 days 10 hours'),

  -- farmer_b: intake
  ('50000002-0000-4000-8000-000000000001',
   'c6000000-0000-4000-8000-000000000001',
   'intake_credit', 600, 'factory_intake', '40000002-0000-4000-8000-000000000008',
   'น้ำหนักจริง 600 กก. × 1.0 pt/kg', now() - interval '18 days'),

  -- farmer_b: RR-B02 reserve + spend (delivered)
  ('50000002-0000-4000-8000-000000000002',
   'c6000000-0000-4000-8000-000000000001',
   'reward_reserve', 25, 'reward_request', '30000002-0000-4000-8000-000000000002',
   'จองแต้มแลกแผ่นคลุมดิน', now() - interval '6 days'),
  ('50000002-0000-4000-8000-000000000003',
   'c6000000-0000-4000-8000-000000000001',
   'reward_spend', 25, 'reward_request', '30000002-0000-4000-8000-000000000002',
   'แลกแผ่นคลุมดิน สำเร็จ', now() - interval '5 days'),

  -- farmer_c: intake (2 entries)
  ('50000003-0000-4000-8000-000000000001',
   'c7000000-0000-4000-8000-000000000001',
   'intake_credit', 375, 'factory_intake', '40000003-0000-4000-8000-000000000011',
   'น้ำหนักจริง 375 กก. × 1.0 pt/kg', now() - interval '5 days'),
  ('50000003-0000-4000-8000-000000000002',
   'c7000000-0000-4000-8000-000000000001',
   'intake_credit', 250, 'factory_intake', '40000003-0000-4000-8000-000000000012',
   'น้ำหนักจริง 80 กก. × 3.125 pt/kg', now() - interval '3 days'),

  -- farmer_c: RR-C01 reserve + spend (delivered)
  ('50000003-0000-4000-8000-000000000003',
   'c7000000-0000-4000-8000-000000000001',
   'reward_reserve', 125, 'reward_request', '30000003-0000-4000-8000-000000000001',
   'จองแต้มแลกไบโอดีเซล', now() - interval '4 days 12 hours'),
  ('50000003-0000-4000-8000-000000000004',
   'c7000000-0000-4000-8000-000000000001',
   'reward_spend', 125, 'reward_request', '30000003-0000-4000-8000-000000000001',
   'แลกไบโอดีเซล 10 ลิตร สำเร็จ', now() - interval '3 days 12 hours'),

  -- farmer_c: RR-C02 reserve น้ำมันไพโรไลซิส
  ('50000003-0000-4000-8000-000000000005',
   'c7000000-0000-4000-8000-000000000001',
   'reward_reserve', 50, 'reward_request', '30000003-0000-4000-8000-000000000002',
   'จองแต้มแลกน้ำมันไพโรไลซิส', now() - interval '1 day'),

  -- farmer_c: adjustment (goodwill +50 pts from operator)
  ('50000003-0000-4000-8000-000000000099',
   'c7000000-0000-4000-8000-000000000001',
   'adjustment', 50, null, null,
   'ปรับแต้มคืนเพิ่มเติม: น้ำหนักชั่งผิดพลาดรอบก่อน (อนุมัติโดยผู้บริหาร)', now() - interval '2 days'),

  -- farmer_d: intake
  ('50000004-0000-4000-8000-000000000001',
   'c8000000-0000-4000-8000-000000000001',
   'intake_credit', 400, 'factory_intake', '40000004-0000-4000-8000-000000000013',
   'น้ำหนักจริง 400 กก. × 1.0 pt/kg', now() - interval '8 days'),

  -- farmer_d: RR-D01 reserve (out_for_delivery)
  ('50000004-0000-4000-8000-000000000002',
   'c8000000-0000-4000-8000-000000000001',
   'reward_reserve', 125, 'reward_request', '30000004-0000-4000-8000-000000000001',
   'จองแต้มแลกไบโอดีเซล', now() - interval '3 days 6 hours'),

  -- farmer_d: RR-D02 reserve + release (cancelled by farmer)
  ('50000004-0000-4000-8000-000000000003',
   'c8000000-0000-4000-8000-000000000001',
   'reward_reserve', 50, 'reward_request', '30000004-0000-4000-8000-000000000002',
   'จองแต้มแลกแผ่นคลุมดิน', now() - interval '5 days'),
  ('50000004-0000-4000-8000-000000000004',
   'c8000000-0000-4000-8000-000000000001',
   'reward_release', 50, 'reward_request', '30000004-0000-4000-8000-000000000002',
   'คืนแต้ม — ยกเลิกโดยเกษตรกร', now() - interval '5 days'),

  -- farmer_e: intake (60 kg × 3.125 = 187 pts)
  ('50000005-0000-4000-8000-000000000001',
   'c9000000-0000-4000-8000-000000000001',
   'intake_credit', 187, 'factory_intake', '40000005-0000-4000-8000-000000000014',
   'น้ำหนักจริง 60 กก. × 3.125 pt/kg', now() - interval '10 days'),

  -- farmer_e: RR-E01 reserve + release (warehouse_rejected)
  ('50000005-0000-4000-8000-000000000002',
   'c9000000-0000-4000-8000-000000000001',
   'reward_reserve', 625, 'reward_request', '30000005-0000-4000-8000-000000000001',
   'จองแต้มแลกโซลาร์เซลล์ (เกินยอด)', now() - interval '8 days'),
  ('50000005-0000-4000-8000-000000000003',
   'c9000000-0000-4000-8000-000000000001',
   'reward_release', 625, 'reward_request', '30000005-0000-4000-8000-000000000001',
   'คืนแต้ม — คำขอถูกปฏิเสธ', now() - interval '7 days')

on conflict (id) do nothing;

-- ── Storage: reward-images bucket ─────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reward-images', 'reward-images', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Drop ALL existing storage.objects policies (clears any UI-generated blanket policies)
drop policy if exists "Public read reward images" on storage.objects;
drop policy if exists "Auth users can upload reward images" on storage.objects;
drop policy if exists "Auth users can update reward images" on storage.objects;
drop policy if exists "Auth users can delete reward images" on storage.objects;
drop policy if exists "Public read submission images" on storage.objects;
drop policy if exists "Auth users can upload submission images" on storage.objects;
drop policy if exists "Auth users can update submission images" on storage.objects;
drop policy if exists "Auth users can delete submission images" on storage.objects;

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

-- ── Storage: submission-images bucket ──────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submission-images', 'submission-images', true, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Public read submission images"
  on storage.objects for select
  using (bucket_id = 'submission-images');

create policy "Auth users can upload submission images"
  on storage.objects for insert
  with check (bucket_id = 'submission-images' and auth.role() = 'authenticated');

create policy "Auth users can update submission images"
  on storage.objects for update
  using (bucket_id = 'submission-images' and auth.role() = 'authenticated');

create policy "Auth users can delete submission images"
  on storage.objects for delete
  using (bucket_id = 'submission-images' and auth.role() = 'authenticated');

commit;
