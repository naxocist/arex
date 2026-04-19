-- Staging seed for AREX — mirrors local seed exactly.
-- Password for ALL accounts: 123456
-- Applied by: mise run db:seed:staging
-- Purpose: reset staging DB to a known demo state that matches local dev.

begin;

-- ── Ensure RLS on tables missing it in migrations ──────────────────────────
alter table if exists public.logistics_distances  enable row level security;
alter table if exists public.impact_baselines     enable row level security;
alter table if exists public.value_chain_mappings enable row level security;

-- -----------------------------------------------------------------------
-- Wipe all existing data (disable FK triggers to avoid ordering issues)
-- -----------------------------------------------------------------------
set session_replication_role = replica;

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'delivery_jobs') then
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
      public.logistics_distances,
      public.measurement_units,
      public.material_types,
      public.value_chain_mappings,
      public.impact_baselines,
      public.profiles
    restart identity cascade;
  end if;
end $$;

delete from auth.identities;
delete from auth.users;

set session_replication_role = default;

-- -----------------------------------------------------------------------
-- Auth users (password: 123456)
-- -----------------------------------------------------------------------
with demo_users as (
  select * from (
    values
      ('90000000-0000-4000-8000-000000000001'::uuid, 'farmer@gmail.com',    'farmer',    'สมชาย เกษตรกร',     '0810001001', 'เพชรบูรณ์'),
      ('90000000-0000-4000-8000-000000000002'::uuid, 'farmer2@gmail.com',   'farmer',    'สมหญิง เกษตรกร',    '0810001002', 'นครราชสีมา'),
      ('90000000-0000-4000-8000-000000000009'::uuid, 'farmer3@gmail.com',   'farmer',    'ประสิทธิ์ รักษ์โลก', '0810001003', 'เชียงใหม่'),
      ('90000000-0000-4000-8000-000000000003'::uuid, 'logistics@gmail.com', 'logistics', 'เอกชัย ขนส่ง',      '0810002001', 'สระบุรี'),
      ('90000000-0000-4000-8000-000000000007'::uuid, 'logistics2@gmail.com','logistics', 'ปิติ ขนส่ง',        '0810002002', 'ลพบุรี'),
      ('90000000-0000-4000-8000-000000000004'::uuid, 'factory@gmail.com',   'factory',   'วรินทร์ โรงงาน',   '0810003001', 'สระบุรี'),
      ('90000000-0000-4000-8000-000000000008'::uuid, 'factory2@gmail.com',  'factory',   'กิตติ โรงงาน',     '0810003002', 'ชัยนาท'),
      ('90000000-0000-4000-8000-000000000005'::uuid, 'warehouse@gmail.com', 'warehouse', 'มานพ คลังสินค้า',  '0810004001', 'ปทุมธานี'),
      ('90000000-0000-4000-8000-000000000006'::uuid, 'executive@gmail.com', 'executive', 'ผู้บริหาร AREX',   '0810005001', 'กรุงเทพมหานคร'),
      ('90000000-0000-4000-8000-000000000010'::uuid, 'admin@gmail.com',     'admin',     'ผู้ดูแลระบบ AREX', '0810006001', 'กรุงเทพมหานคร'),
      ('b0000000-0000-4000-8000-000000000001'::uuid, 'pending_farmer1@arex.local',   'farmer',    'สมศรี ขอสมัคร',    '0819001001', 'ขอนแก่น'),
      ('b0000000-0000-4000-8000-000000000002'::uuid, 'pending_farmer2@arex.local',   'farmer',    'วิเชียร ทำนา',     '0819001002', 'อุดรธานี'),
      ('b0000000-0000-4000-8000-000000000003'::uuid, 'rejected_farmer@arex.local',   'farmer',    'ชาย ถูกปฏิเสธ',   '0819001003', 'กาฬสินธุ์'),
      ('b0000000-0000-4000-8000-000000000004'::uuid, 'pending_logistics@arex.local', 'logistics', 'บริษัท ขนส่งใหม่', '0819002001', 'นครสวรรค์')
  ) as t(id, email, role, display_name, phone, province)
),
inserted_users as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, confirmation_token, recovery_token,
    email_change_token_new, email_change, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at
  )
  select
    '00000000-0000-0000-0000-000000000000'::uuid,
    d.id, 'authenticated', 'authenticated', d.email,
    crypt('123456', gen_salt('bf')), now(),
    '', '', '', '', '', '', '', '',
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', d.role),
    jsonb_build_object('display_name', d.display_name, 'role', d.role),
    false, now(), now()
  from demo_users d
  returning id, email
)
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(), u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', u.email, now(), now(), now()
from inserted_users u;

-- Approved profiles
insert into public.profiles (id, role, display_name, phone, province, approval_status)
values
  ('90000000-0000-4000-8000-000000000001', 'farmer',    'สมชาย เกษตรกร',     '0810001001', 'เพชรบูรณ์',      'approved'),
  ('90000000-0000-4000-8000-000000000002', 'farmer',    'สมหญิง เกษตรกร',    '0810001002', 'นครราชสีมา',     'approved'),
  ('90000000-0000-4000-8000-000000000009', 'farmer',    'ประสิทธิ์ รักษ์โลก', '0810001003', 'เชียงใหม่',      'approved'),
  ('90000000-0000-4000-8000-000000000003', 'logistics', 'เอกชัย ขนส่ง',      '0810002001', 'สระบุรี',        'approved'),
  ('90000000-0000-4000-8000-000000000007', 'logistics', 'ปิติ ขนส่ง',        '0810002002', 'ลพบุรี',         'approved'),
  ('90000000-0000-4000-8000-000000000004', 'factory',   'วรินทร์ โรงงาน',   '0810003001', 'สระบุรี',        'approved'),
  ('90000000-0000-4000-8000-000000000008', 'factory',   'กิตติ โรงงาน',     '0810003002', 'ชัยนาท',         'approved'),
  ('90000000-0000-4000-8000-000000000005', 'warehouse', 'มานพ คลังสินค้า',  '0810004001', 'ปทุมธานี',       'approved'),
  ('90000000-0000-4000-8000-000000000006', 'executive', 'ผู้บริหาร AREX',   '0810005001', 'กรุงเทพมหานคร',  'approved'),
  ('90000000-0000-4000-8000-000000000010', 'admin',     'ผู้ดูแลระบบ AREX', '0810006001', 'กรุงเทพมหานคร',  'approved');

-- Pending / rejected profiles (admin approval workflow demo)
insert into public.profiles (id, role, display_name, phone, province, approval_status, approval_note)
values
  ('b0000000-0000-4000-8000-000000000001', 'farmer',    'สมศรี ขอสมัคร',    '0819001001', 'ขอนแก่น',   'pending',  null),
  ('b0000000-0000-4000-8000-000000000002', 'farmer',    'วิเชียร ทำนา',     '0819001002', 'อุดรธานี',  'pending',  null),
  ('b0000000-0000-4000-8000-000000000003', 'farmer',    'ชาย ถูกปฏิเสธ',   '0819001003', 'กาฬสินธุ์', 'rejected', 'ที่อยู่และข้อมูลไม่ครบถ้วน กรุณาสมัครใหม่พร้อมเอกสาร'),
  ('b0000000-0000-4000-8000-000000000004', 'logistics', 'บริษัท ขนส่งใหม่', '0819002001', 'นครสวรรค์', 'pending',  null);

-- -----------------------------------------------------------------------
-- Admin settings
-- -----------------------------------------------------------------------
insert into public.admin_settings (key, approval_required_roles)
values ('global', '["farmer", "logistics"]'::jsonb)
on conflict (key) do update
  set approval_required_roles = excluded.approval_required_roles,
      updated_at = now();

-- -----------------------------------------------------------------------
-- Material types
-- -----------------------------------------------------------------------
insert into public.material_types (code, name_th, active, points_per_kg)
values
  ('rice_straw',        'ฟางข้าว',             true,  1.000000),
  ('cassava_root',      'เหง้ามันสำปะหลัง',    true,  1.100000),
  ('sugarcane_bagasse', 'ชานอ้อย',              true,  0.950000),
  ('corn_stover',       'ตอซังข้าวโพด',         true,  1.000000),
  ('orchard_residue',   'เศษเหลือทิ้งจากสวน',  true,  3.125000),
  ('plastic_waste',     'ขยะพลาสติก',           true, 12.500000)
on conflict (code) do update
set name_th       = excluded.name_th,
    active        = excluded.active,
    points_per_kg = excluded.points_per_kg,
    updated_at    = now();

-- -----------------------------------------------------------------------
-- Measurement units
-- -----------------------------------------------------------------------
insert into public.measurement_units (code, name_th, to_kg_factor, active)
values
  ('กิโลกรัม', 'กิโลกรัม',    1.000000,    true),
  ('ตัน',      'ตัน',         1000.000000, true),
  ('ก้อน',     'ก้อน (ฟาง)',  12.500000,   true)
on conflict (code) do update
set name_th      = excluded.name_th,
    to_kg_factor = excluded.to_kg_factor,
    active       = excluded.active,
    updated_at   = now();

-- -----------------------------------------------------------------------
-- Rewards
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
set name_th        = excluded.name_th,
    description_th = excluded.description_th,
    points_cost    = excluded.points_cost,
    stock_qty      = excluded.stock_qty,
    active         = excluded.active,
    updated_at     = now();

-- -----------------------------------------------------------------------
-- Org accounts
-- -----------------------------------------------------------------------
insert into public.org_accounts (id, profile_id, type, name_th, location_text, lat, lng, active, is_focal_point)
values
  ('00000000-0000-4000-8000-00000000f001',
   '90000000-0000-4000-8000-000000000004',
   'factory', 'โรงงานชีวมวล AREX - สระบุรี', 'จ.สระบุรี', 14.528915, 100.910142, true, false),
  ('00000000-0000-4000-8000-00000000f002',
   '90000000-0000-4000-8000-000000000008',
   'factory', 'โรงงานชีวมวล AREX - ชัยนาท', 'จ.ชัยนาท', 15.186197, 100.125125, true, false),
  ('00000000-0000-4000-8000-00000000f003',
   null,
   'factory', 'มหาวิทยาลัยเชียงใหม่ (มช.)', 'เชียงใหม่', 18.788300, 98.985300, true, true),
  ('00000000-0000-4000-8000-0000000c0001',
   '90000000-0000-4000-8000-000000000003',
   'logistics', 'ทีมขนส่ง AREX - สระบุรี', 'จ.สระบุรี', 14.528915, 100.910142, true, false),
  ('00000000-0000-4000-8000-0000000c0002',
   '90000000-0000-4000-8000-000000000007',
   'logistics', 'ทีมขนส่ง AREX - ลพบุรี', 'จ.ลพบุรี', 14.799367, 100.653339, true, false)
on conflict (id) do update
set name_th        = excluded.name_th,
    location_text  = excluded.location_text,
    lat            = excluded.lat,
    lng            = excluded.lng,
    active         = excluded.active,
    is_focal_point = excluded.is_focal_point;

-- -----------------------------------------------------------------------
-- Value chain mappings
-- -----------------------------------------------------------------------
insert into public.value_chain_mappings (product_name_th, producer_org, buyer_org, buyer_use_th, active)
values
  ('เยื่อชีวมวล (Bio-pulp)',   'มช. / มก.',       'บริษัท Precise',   'ทำไม้เทียม',           true),
  ('ถ่านชีวภาพ / ไบโอชาร์',   'มช. / วว. / มก.', 'กลุ่มโรงงาน',      'ใช้ใน Boiler',         true),
  ('น้ำมันไพโรไลซิส',           'มช. / วว.',       'วิสาหกิจชุมชน',    'พลังงานชุมชน',         true),
  ('ไบโอดีเซล B100',            'GTR / น้ำมันพืชปทุม', 'สหกรณ์เกษตร', 'ใช้แทนน้ำมันดีเซล',   true),
  ('ฟางอัดก้อน',                'เกษตรกรภาคเหนือ', 'โรงงานกระดาษ',     'วัตถุดิบกระดาษรีไซเคิล', true)
on conflict do nothing;

-- -----------------------------------------------------------------------
-- Impact baselines
-- -----------------------------------------------------------------------
insert into public.impact_baselines (id, pilot_area, hotspot_count_baseline, co2_kg_baseline, avg_income_baht_per_household, recorded_by, recorded_at)
values
  ('00000000-0000-4000-8000-0000000b0001',
   'เชียงใหม่ — เขตนิคมสันทราย / สันป่าตอง',
   142,
   284000.000,
   18500.00,
   'ทีมวิจัย มช. (ดร.สมศักดิ์)',
   now() - interval '30 days')
on conflict (id) do nothing;

-- =========================================================================
-- DEMO DATA — every UI state in every flow
-- =========================================================================

-- -----------------------------------------------------------------------
-- Submissions — all 7 statuses
-- -----------------------------------------------------------------------
insert into public.submissions (
  id, farmer_profile_id, material_type, quantity_value, quantity_unit,
  pickup_location_text, pickup_lat, pickup_lng, notes, status, created_at, updated_at
)
values
  ('10000000-0000-4000-8000-000000000001',
   '90000000-0000-4000-8000-000000000001',
   'rice_straw', 800.0, 'กิโลกรัม',
   'ต.นาเฉลียง อ.หนองไผ่ จ.เพชรบูรณ์', 16.04905, 101.14966,
   null, 'submitted',
   now() - interval '3 hours', now() - interval '3 hours'),

  ('10000000-0000-4000-8000-000000000002',
   '90000000-0000-4000-8000-000000000001',
   'cassava_root', 500.0, 'กิโลกรัม',
   'ต.นาเฉลียง อ.หนองไผ่ จ.เพชรบูรณ์', 16.04905, 101.14966,
   null, 'pickup_scheduled',
   now() - interval '2 days', now() - interval '1 day 20 hours'),

  ('10000000-0000-4000-8000-000000000003',
   '90000000-0000-4000-8000-000000000001',
   'corn_stover', 300.0, 'กิโลกรัม',
   'ต.นาเฉลียง อ.หนองไผ่ จ.เพชรบูรณ์', 16.04905, 101.14966,
   null, 'picked_up',
   now() - interval '4 days', now() - interval '3 days 18 hours'),

  ('10000000-0000-4000-8000-000000000004',
   '90000000-0000-4000-8000-000000000002',
   'orchard_residue', 200.0, 'กิโลกรัม',
   'อ.เมือง จ.นครราชสีมา', 14.97990, 102.09777,
   null, 'delivered_to_factory',
   now() - interval '5 days', now() - interval '4 days 12 hours'),

  ('10000000-0000-4000-8000-000000000005',
   '90000000-0000-4000-8000-000000000002',
   'plastic_waste', 50.0, 'กิโลกรัม',
   'อ.เมือง จ.นครราชสีมา', 14.97990, 102.09777,
   null, 'factory_confirmed',
   now() - interval '7 days', now() - interval '6 days'),

  ('10000000-0000-4000-8000-000000000006',
   '90000000-0000-4000-8000-000000000001',
   'rice_straw', 1000.0, 'กิโลกรัม',
   'ต.นาเฉลียง อ.หนองไผ่ จ.เพชรบูรณ์', 16.04905, 101.14966,
   null, 'points_credited',
   now() - interval '14 days', now() - interval '12 days'),

  ('10000000-0000-4000-8000-000000000007',
   '90000000-0000-4000-8000-000000000002',
   'sugarcane_bagasse', 150.0, 'กิโลกรัม',
   'อ.เมือง จ.นครราชสีมา', 14.97990, 102.09777,
   null, 'cancelled',
   now() - interval '6 days', now() - interval '6 days'),

  ('10000000-0000-4000-8000-000000000011',
   '90000000-0000-4000-8000-000000000009',
   'rice_straw', 30.0, 'ก้อน',
   'ต.สันทราย อ.สันทราย จ.เชียงใหม่', 18.85100, 99.01800,
   null, 'points_credited',
   now() - interval '8 days', now() - interval '5 days'),

  ('10000000-0000-4000-8000-000000000012',
   '90000000-0000-4000-8000-000000000009',
   'orchard_residue', 80.0, 'กิโลกรัม',
   'ต.สันทราย อ.สันทราย จ.เชียงใหม่', 18.85100, 99.01800,
   null, 'points_credited',
   now() - interval '6 days', now() - interval '3 days')

on conflict (id) do nothing;

-- -----------------------------------------------------------------------
-- Pickup jobs
-- -----------------------------------------------------------------------
insert into public.pickup_jobs (
  id, submission_id, logistics_profile_id, destination_factory_id,
  planned_pickup_at, pickup_window_end_at,
  picked_up_at, delivered_factory_at, factory_confirmed_at,
  status, notes, created_at, updated_at
)
values
  ('20000000-0000-4000-8000-000000000002',
   '10000000-0000-4000-8000-000000000002',
   '90000000-0000-4000-8000-000000000003',
   '00000000-0000-4000-8000-00000000f001',
   now() + interval '4 hours', now() + interval '8 hours',
   null, null, null,
   'pickup_scheduled', null,
   now() - interval '1 day 20 hours', now() - interval '1 day 20 hours'),

  ('20000000-0000-4000-8000-000000000003',
   '10000000-0000-4000-8000-000000000003',
   '90000000-0000-4000-8000-000000000003',
   '00000000-0000-4000-8000-00000000f001',
   now() - interval '3 days 20 hours', now() - interval '3 days 16 hours',
   now() - interval '3 days 18 hours', null, null,
   'picked_up', null,
   now() - interval '4 days', now() - interval '3 days 18 hours'),

  ('20000000-0000-4000-8000-000000000004',
   '10000000-0000-4000-8000-000000000004',
   '90000000-0000-4000-8000-000000000003',
   '00000000-0000-4000-8000-00000000f001',
   now() - interval '5 days', now() - interval '4 days 20 hours',
   now() - interval '4 days 22 hours', now() - interval '4 days 12 hours', null,
   'delivered_to_factory', null,
   now() - interval '5 days', now() - interval '4 days 12 hours'),

  ('20000000-0000-4000-8000-000000000005',
   '10000000-0000-4000-8000-000000000005',
   '90000000-0000-4000-8000-000000000003',
   '00000000-0000-4000-8000-00000000f001',
   now() - interval '7 days', now() - interval '6 days 20 hours',
   now() - interval '6 days 22 hours', now() - interval '6 days 12 hours', now() - interval '6 days',
   'factory_confirmed', null,
   now() - interval '7 days', now() - interval '6 days'),

  ('20000000-0000-4000-8000-000000000006',
   '10000000-0000-4000-8000-000000000006',
   '90000000-0000-4000-8000-000000000003',
   '00000000-0000-4000-8000-00000000f001',
   now() - interval '14 days', now() - interval '13 days 20 hours',
   now() - interval '13 days 22 hours', now() - interval '13 days 12 hours', now() - interval '12 days',
   'factory_confirmed', null,
   now() - interval '14 days', now() - interval '12 days'),

  ('20000000-0000-4000-8000-000000000011',
   '10000000-0000-4000-8000-000000000011',
   '90000000-0000-4000-8000-000000000007',
   '00000000-0000-4000-8000-00000000f003',
   now() - interval '8 days', now() - interval '7 days 20 hours',
   now() - interval '7 days 18 hours', now() - interval '6 days 12 hours', now() - interval '5 days',
   'factory_confirmed', null,
   now() - interval '8 days', now() - interval '5 days'),

  ('20000000-0000-4000-8000-000000000012',
   '10000000-0000-4000-8000-000000000012',
   '90000000-0000-4000-8000-000000000007',
   '00000000-0000-4000-8000-00000000f003',
   now() - interval '6 days', now() - interval '5 days 20 hours',
   now() - interval '5 days 18 hours', now() - interval '4 days 12 hours', now() - interval '3 days',
   'factory_confirmed', null,
   now() - interval '6 days', now() - interval '3 days')

on conflict (id) do nothing;

-- -----------------------------------------------------------------------
-- Factory intakes
-- -----------------------------------------------------------------------
insert into public.intakes (
  id, pickup_job_id, factory_profile_id, measured_weight_kg, status, confirmed_at, created_at
)
values
  ('40000000-0000-4000-8000-000000000005',
   '20000000-0000-4000-8000-000000000005',
   '90000000-0000-4000-8000-000000000004',
   50.0, 'confirmed',
   now() - interval '6 days', now() - interval '6 days'),

  ('40000000-0000-4000-8000-000000000006',
   '20000000-0000-4000-8000-000000000006',
   '90000000-0000-4000-8000-000000000004',
   1000.0, 'confirmed',
   now() - interval '12 days', now() - interval '12 days'),

  ('40000000-0000-4000-8000-000000000011',
   '20000000-0000-4000-8000-000000000011',
   '90000000-0000-4000-8000-000000000004',
   375.0, 'confirmed',
   now() - interval '5 days', now() - interval '5 days'),

  ('40000000-0000-4000-8000-000000000012',
   '20000000-0000-4000-8000-000000000012',
   '90000000-0000-4000-8000-000000000004',
   80.0, 'confirmed',
   now() - interval '3 days', now() - interval '3 days')

on conflict (id) do nothing;

-- -----------------------------------------------------------------------
-- Reward requests — all statuses
-- -----------------------------------------------------------------------
insert into public.reward_requests (
  id, farmer_profile_id, reward_id, quantity, requested_points,
  status, warehouse_profile_id, warehouse_decision_at, rejection_reason,
  delivery_location_text, delivery_lat, delivery_lng,
  requested_at, updated_at
)
values
  ('30000000-0000-4000-8000-000000000001',
   '90000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000a001',
   1, 125, 'requested', null, null, null,
   'บ้านเลขที่ 12 ต.นาเฉลียง อ.หนองไผ่ จ.เพชรบูรณ์ 67220', 16.04905, 101.14966,
   now() - interval '2 hours', now() - interval '2 hours'),

  ('30000000-0000-4000-8000-000000000002',
   '90000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000a003',
   1, 25, 'warehouse_approved',
   '90000000-0000-4000-8000-000000000005',
   now() - interval '11 days', null,
   'บ้านเลขที่ 12 ต.นาเฉลียง อ.หนองไผ่ จ.เพชรบูรณ์ 67220', 16.04905, 101.14966,
   now() - interval '12 days', now() - interval '11 days'),

  ('30000000-0000-4000-8000-000000000003',
   '90000000-0000-4000-8000-000000000002',
   '00000000-0000-4000-8000-00000000a001',
   1, 125, 'warehouse_approved',
   '90000000-0000-4000-8000-000000000005',
   now() - interval '5 days 20 hours', null,
   '45 ถ.สุรนารี อ.เมือง จ.นครราชสีมา 30000', 14.97990, 102.09777,
   now() - interval '6 days', now() - interval '5 days 20 hours'),

  ('30000000-0000-4000-8000-000000000004',
   '90000000-0000-4000-8000-000000000002',
   '00000000-0000-4000-8000-00000000a003',
   1, 25, 'warehouse_approved',
   '90000000-0000-4000-8000-000000000005',
   now() - interval '5 days 22 hours', null,
   '45 ถ.สุรนารี อ.เมือง จ.นครราชสีมา 30000', 14.97990, 102.09777,
   now() - interval '6 days', now() - interval '5 days'),

  ('30000000-0000-4000-8000-000000000005',
   '90000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000a002',
   1, 625, 'warehouse_rejected',
   '90000000-0000-4000-8000-000000000005',
   now() - interval '5 days 10 hours',
   'ของรางวัลชิ้นนี้หมดสต็อกชั่วคราว กรุณายื่นคำขอใหม่เมื่อมีสต็อก',
   null, null, null,
   now() - interval '6 days', now() - interval '5 days 10 hours'),

  ('30000000-0000-4000-8000-000000000006',
   '90000000-0000-4000-8000-000000000002',
   '00000000-0000-4000-8000-00000000a004',
   1, 50, 'cancelled',
   null, null, null,
   null, null, null,
   now() - interval '3 days', now() - interval '3 days'),

  ('30000000-0000-4000-8000-000000000007',
   '90000000-0000-4000-8000-000000000002',
   '00000000-0000-4000-8000-00000000a004',
   2, 100, 'requested', null, null, null,
   '45 ถ.สุรนารี อ.เมือง จ.นครราชสีมา 30000', 14.97990, 102.09777,
   now() - interval '1 hour', now() - interval '1 hour'),

  ('30000000-0000-4000-8000-000000000008',
   '90000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000a001',
   1, 125, 'warehouse_approved',
   '90000000-0000-4000-8000-000000000005',
   now() - interval '4 days', null,
   'บ้านเลขที่ 12 ต.นาเฉลียง อ.หนองไผ่ จ.เพชรบูรณ์ 67220', 16.04905, 101.14966,
   now() - interval '4 days 6 hours', now() - interval '4 days'),

  ('30000000-0000-4000-8000-000000000009',
   '90000000-0000-4000-8000-000000000009',
   '00000000-0000-4000-8000-00000000a001',
   1, 125, 'warehouse_approved',
   '90000000-0000-4000-8000-000000000005',
   now() - interval '4 days 6 hours', null,
   'ต.สันทราย อ.สันทราย จ.เชียงใหม่ 50210', 18.85100, 99.01800,
   now() - interval '4 days 12 hours', now() - interval '3 days 12 hours'),

  ('30000000-0000-4000-8000-000000000010',
   '90000000-0000-4000-8000-000000000009',
   '00000000-0000-4000-8000-00000000a004',
   1, 50, 'warehouse_approved',
   '90000000-0000-4000-8000-000000000005',
   now() - interval '22 hours', null,
   'ต.สันทราย อ.สันทราย จ.เชียงใหม่ 50210', 18.85100, 99.01800,
   now() - interval '1 day', now() - interval '22 hours')

on conflict (id) do nothing;

-- -----------------------------------------------------------------------
-- Delivery jobs
-- -----------------------------------------------------------------------
insert into public.delivery_jobs (
  id, reward_request_id, logistics_profile_id,
  planned_delivery_at, delivery_window_end_at,
  out_for_delivery_at, delivered_at, status, created_at, updated_at
)
values
  ('60000000-0000-4000-8000-000000000002',
   '30000000-0000-4000-8000-000000000002',
   '90000000-0000-4000-8000-000000000003',
   now() + interval '2 days', now() + interval '2 days 4 hours',
   null, null,
   'reward_delivery_scheduled',
   now() - interval '11 days', now() - interval '11 days'),

  ('60000000-0000-4000-8000-000000000003',
   '30000000-0000-4000-8000-000000000003',
   '90000000-0000-4000-8000-000000000003',
   now() - interval '5 days', now() - interval '4 days 20 hours',
   now() - interval '3 hours', null,
   'out_for_delivery',
   now() - interval '5 days', now() - interval '3 hours'),

  ('60000000-0000-4000-8000-000000000004',
   '30000000-0000-4000-8000-000000000004',
   '90000000-0000-4000-8000-000000000003',
   now() - interval '5 days', now() - interval '4 days 20 hours',
   now() - interval '5 days 2 hours', now() - interval '5 days',
   'reward_delivered',
   now() - interval '5 days', now() - interval '5 days'),

  ('60000000-0000-4000-8000-000000000008',
   '30000000-0000-4000-8000-000000000008',
   '90000000-0000-4000-8000-000000000003',
   now() - interval '4 days', now() - interval '3 days 20 hours',
   now() - interval '5 hours', null,
   'out_for_delivery',
   now() - interval '4 days', now() - interval '5 hours'),

  ('60000000-0000-4000-8000-000000000009',
   '30000000-0000-4000-8000-000000000009',
   '90000000-0000-4000-8000-000000000007',
   now() - interval '3 days 18 hours', now() - interval '3 days 14 hours',
   now() - interval '3 days 16 hours', now() - interval '3 days 12 hours',
   'reward_delivered',
   now() - interval '4 days', now() - interval '3 days 12 hours'),

  ('60000000-0000-4000-8000-000000000010',
   '30000000-0000-4000-8000-000000000010',
   '90000000-0000-4000-8000-000000000007',
   now() + interval '1 day', now() + interval '1 day 4 hours',
   null, null,
   'reward_delivery_scheduled',
   now() - interval '22 hours', now() - interval '22 hours')

on conflict (id) do nothing;

-- -----------------------------------------------------------------------
-- Logistics distances
-- -----------------------------------------------------------------------
insert into public.logistics_distances
  (logistics_profile_id, reference_type, reference_id, leg, distance_km)
values
  ('90000000-0000-4000-8000-000000000003','submission','10000000-0000-4000-8000-000000000001','to_farmer',          185.3),
  ('90000000-0000-4000-8000-000000000007','submission','10000000-0000-4000-8000-000000000001','to_farmer',          316.2),
  ('90000000-0000-4000-8000-000000000003','submission','10000000-0000-4000-8000-000000000002','to_farmer',          185.3),
  ('90000000-0000-4000-8000-000000000003','submission','10000000-0000-4000-8000-000000000002','farmer_to_factory',  185.3),
  ('90000000-0000-4000-8000-000000000003','submission','10000000-0000-4000-8000-000000000003','to_farmer',          185.3),
  ('90000000-0000-4000-8000-000000000003','submission','10000000-0000-4000-8000-000000000003','farmer_to_factory',  185.3),
  ('90000000-0000-4000-8000-000000000003','submission','10000000-0000-4000-8000-000000000004','to_farmer',          144.8),
  ('90000000-0000-4000-8000-000000000003','submission','10000000-0000-4000-8000-000000000004','farmer_to_factory',  144.8),
  ('90000000-0000-4000-8000-000000000003','submission','10000000-0000-4000-8000-000000000005','to_farmer',          144.8),
  ('90000000-0000-4000-8000-000000000003','submission','10000000-0000-4000-8000-000000000005','farmer_to_factory',  144.8),
  ('90000000-0000-4000-8000-000000000003','submission','10000000-0000-4000-8000-000000000006','to_farmer',          185.3),
  ('90000000-0000-4000-8000-000000000003','submission','10000000-0000-4000-8000-000000000006','farmer_to_factory',  185.3),
  ('90000000-0000-4000-8000-000000000007','submission','10000000-0000-4000-8000-000000000011','to_farmer',          491.7),
  ('90000000-0000-4000-8000-000000000007','submission','10000000-0000-4000-8000-000000000011','farmer_to_factory',    7.1),
  ('90000000-0000-4000-8000-000000000007','submission','10000000-0000-4000-8000-000000000012','to_farmer',          491.7),
  ('90000000-0000-4000-8000-000000000007','submission','10000000-0000-4000-8000-000000000012','farmer_to_factory',    7.1),
  ('90000000-0000-4000-8000-000000000003','reward_request','30000000-0000-4000-8000-000000000002','to_farmer', 185.3),
  ('90000000-0000-4000-8000-000000000003','reward_request','30000000-0000-4000-8000-000000000003','to_farmer', 144.8),
  ('90000000-0000-4000-8000-000000000003','reward_request','30000000-0000-4000-8000-000000000004','to_farmer', 144.8),
  ('90000000-0000-4000-8000-000000000003','reward_request','30000000-0000-4000-8000-000000000008','to_farmer', 185.3),
  ('90000000-0000-4000-8000-000000000007','reward_request','30000000-0000-4000-8000-000000000009','to_farmer', 491.7),
  ('90000000-0000-4000-8000-000000000007','reward_request','30000000-0000-4000-8000-000000000010','to_farmer', 491.7)

on conflict (logistics_profile_id, reference_type, reference_id, leg) do nothing;

-- -----------------------------------------------------------------------
-- Points ledger — all 5 entry types
-- -----------------------------------------------------------------------
insert into public.points_ledger (id, farmer_profile_id, entry_type, points_amount, reference_type, reference_id, note, created_at)
values
  ('50000000-0000-4000-8000-000000000001',
   '90000000-0000-4000-8000-000000000001',
   'intake_credit', 1000, 'factory_intake', '40000000-0000-4000-8000-000000000006',
   'น้ำหนักจริง 1,000 กก. × 1.0 pt/kg', now() - interval '12 days'),

  ('50000000-0000-4000-8000-000000000002',
   '90000000-0000-4000-8000-000000000002',
   'intake_credit', 625, 'factory_intake', '40000000-0000-4000-8000-000000000005',
   'น้ำหนักจริง 50 กก. × 12.5 pt/kg', now() - interval '6 days'),

  ('50000000-0000-4000-8000-000000000011',
   '90000000-0000-4000-8000-000000000009',
   'intake_credit', 375, 'factory_intake', '40000000-0000-4000-8000-000000000011',
   'น้ำหนักจริง 375 กก. × 1.0 pt/kg', now() - interval '5 days'),

  ('50000000-0000-4000-8000-000000000012',
   '90000000-0000-4000-8000-000000000009',
   'intake_credit', 250, 'factory_intake', '40000000-0000-4000-8000-000000000012',
   'น้ำหนักจริง 80 กก. × 3.125 pt/kg', now() - interval '3 days'),

  ('50000000-0000-4000-8000-000000000010',
   '90000000-0000-4000-8000-000000000001',
   'reward_reserve', 25, 'reward_request', '30000000-0000-4000-8000-000000000002',
   'จองแต้มแลกแผ่นคลุมดิน', now() - interval '11 days'),

  ('50000000-0000-4000-8000-000000000014',
   '90000000-0000-4000-8000-000000000001',
   'reward_reserve', 625, 'reward_request', '30000000-0000-4000-8000-000000000005',
   'จองแต้มแลกโซลาร์เซลล์', now() - interval '6 days'),

  ('50000000-0000-4000-8000-000000000015',
   '90000000-0000-4000-8000-000000000001',
   'reward_release', 625, 'reward_request', '30000000-0000-4000-8000-000000000005',
   'คืนแต้ม — คำขอโซลาร์ถูกปฏิเสธ', now() - interval '5 days 10 hours'),

  ('50000000-0000-4000-8000-000000000016',
   '90000000-0000-4000-8000-000000000001',
   'reward_reserve', 125, 'reward_request', '30000000-0000-4000-8000-000000000008',
   'จองแต้มแลกไบโอดีเซล', now() - interval '4 days'),

  ('50000000-0000-4000-8000-000000000031',
   '90000000-0000-4000-8000-000000000002',
   'reward_reserve', 125, 'reward_request', '30000000-0000-4000-8000-000000000003',
   'จองแต้มแลกไบโอดีเซล', now() - interval '5 days 20 hours'),

  ('50000000-0000-4000-8000-000000000032',
   '90000000-0000-4000-8000-000000000002',
   'reward_reserve', 25, 'reward_request', '30000000-0000-4000-8000-000000000004',
   'จองแต้มแลกแผ่นคลุมดิน', now() - interval '5 days 22 hours'),

  ('50000000-0000-4000-8000-000000000013',
   '90000000-0000-4000-8000-000000000002',
   'reward_spend', 25, 'reward_request', '30000000-0000-4000-8000-000000000004',
   'แลกแผ่นคลุมดิน สำเร็จ', now() - interval '5 days'),

  ('50000000-0000-4000-8000-000000000021',
   '90000000-0000-4000-8000-000000000009',
   'reward_reserve', 125, 'reward_request', '30000000-0000-4000-8000-000000000009',
   'จองแต้มแลกไบโอดีเซล', now() - interval '4 days 12 hours'),

  ('50000000-0000-4000-8000-000000000022',
   '90000000-0000-4000-8000-000000000009',
   'reward_spend', 125, 'reward_request', '30000000-0000-4000-8000-000000000009',
   'แลกไบโอดีเซล 10 ลิตร สำเร็จ', now() - interval '3 days 12 hours'),

  ('50000000-0000-4000-8000-000000000023',
   '90000000-0000-4000-8000-000000000009',
   'reward_reserve', 50, 'reward_request', '30000000-0000-4000-8000-000000000010',
   'จองแต้มแลกน้ำมันไพโรไลซิส', now() - interval '1 day'),

  ('50000000-0000-4000-8000-000000000099',
   '90000000-0000-4000-8000-000000000009',
   'adjustment', 50, null, null,
   'ปรับแต้มคืนเพิ่มเติม: น้ำหนักชั่งผิดพลาดรอบก่อน (อนุมัติโดยผู้บริหาร)', now() - interval '2 days')

on conflict (id) do nothing;

-- =========================================================================
-- Demo D-06 accounts (password: 123456, @arex.local — same as local)
-- =========================================================================
do $$
declare
  v_farmer1_id   uuid := 'aaaaaaaa-d06f-0001-0000-000000000001';
  v_farmer2_id   uuid := 'aaaaaaaa-d06f-0001-0000-000000000002';
  v_farmer3_id   uuid := 'aaaaaaaa-d06f-0001-0000-000000000003';
  v_logistics_id uuid := 'aaaaaaaa-d06f-0001-0000-000000000010';
  v_factory_id   uuid := 'aaaaaaaa-d06f-0001-0000-000000000020';
  v_warehouse_id uuid := 'aaaaaaaa-d06f-0001-0000-000000000030';

  v_cmu_factory_id uuid;
  v_biodiesel_id   uuid;
  v_solar_id       uuid;

  v_sub1_id    uuid := 'bbbbbbbb-d06f-0001-0000-000000000001';
  v_sub2_id    uuid := 'bbbbbbbb-d06f-0001-0000-000000000002';
  v_sub3_id    uuid := 'bbbbbbbb-d06f-0001-0000-000000000003';
  v_sub4_id    uuid := 'bbbbbbbb-d06f-0001-0000-000000000004';

  v_pickup1_id uuid := 'cccccccc-d06f-0001-0000-000000000001';
  v_pickup2_id uuid := 'cccccccc-d06f-0001-0000-000000000002';
  v_pickup3_id uuid := 'cccccccc-d06f-0001-0000-000000000003';

  v_intake1_id uuid := 'dddddddd-d06f-0001-0000-000000000001';
  v_intake2_id uuid := 'dddddddd-d06f-0001-0000-000000000002';

  v_rr1_id     uuid := 'eeeeeeee-d06f-0001-0000-000000000001';
  v_rr2_id     uuid := 'eeeeeeee-d06f-0001-0000-000000000002';
  v_rr3_id     uuid := 'eeeeeeee-d06f-0001-0000-000000000003';

  v_rdj1_id    uuid := 'ffffffff-d06f-0001-0000-000000000001';
  v_rdj2_id    uuid := 'ffffffff-d06f-0001-0000-000000000002';
begin
  select id into v_cmu_factory_id from org_accounts
  where type = 'factory' and name_th ilike '%มช%' and is_focal_point = true limit 1;

  select id into v_biodiesel_id from rewards where name_th ilike '%ไบโอดีเซล%' limit 1;
  select id into v_solar_id     from rewards where name_th ilike '%โซลาร์%'    limit 1;

  if v_cmu_factory_id is null then
    raise notice 'D-06: CMU factory not found — skipping demo seed';
    return;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, confirmation_token, recovery_token,
    email_change_token_new, email_change, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at
  )
  values
    ('00000000-0000-0000-0000-000000000000'::uuid, v_farmer1_id,
     'authenticated', 'authenticated', 'demo_farmer1@arex.local',
     crypt('123456', gen_salt('bf')), now(), '','','','','','','','',
     jsonb_build_object('provider','email','providers',jsonb_build_array('email'),'role','farmer'),
     jsonb_build_object('display_name','สมชาย ใจดี','role','farmer'),
     false, now(), now()),
    ('00000000-0000-0000-0000-000000000000'::uuid, v_farmer2_id,
     'authenticated', 'authenticated', 'demo_farmer2@arex.local',
     crypt('123456', gen_salt('bf')), now(), '','','','','','','','',
     jsonb_build_object('provider','email','providers',jsonb_build_array('email'),'role','farmer'),
     jsonb_build_object('display_name','สมหญิง มีสุข','role','farmer'),
     false, now(), now()),
    ('00000000-0000-0000-0000-000000000000'::uuid, v_farmer3_id,
     'authenticated', 'authenticated', 'demo_farmer3@arex.local',
     crypt('123456', gen_salt('bf')), now(), '','','','','','','','',
     jsonb_build_object('provider','email','providers',jsonb_build_array('email'),'role','farmer'),
     jsonb_build_object('display_name','ประสิทธิ์ รักษ์โลก','role','farmer'),
     false, now(), now()),
    ('00000000-0000-0000-0000-000000000000'::uuid, v_logistics_id,
     'authenticated', 'authenticated', 'demo_logistics@arex.local',
     crypt('123456', gen_salt('bf')), now(), '','','','','','','','',
     jsonb_build_object('provider','email','providers',jsonb_build_array('email'),'role','logistics'),
     jsonb_build_object('display_name','WeMove พนักงาน','role','logistics'),
     false, now(), now()),
    ('00000000-0000-0000-0000-000000000000'::uuid, v_factory_id,
     'authenticated', 'authenticated', 'demo_factory@arex.local',
     crypt('123456', gen_salt('bf')), now(), '','','','','','','','',
     jsonb_build_object('provider','email','providers',jsonb_build_array('email'),'role','factory'),
     jsonb_build_object('display_name','เจ้าหน้าที่ มช.','role','factory'),
     false, now(), now()),
    ('00000000-0000-0000-0000-000000000000'::uuid, v_warehouse_id,
     'authenticated', 'authenticated', 'demo_warehouse@arex.local',
     crypt('123456', gen_salt('bf')), now(), '','','','','','','','',
     jsonb_build_object('provider','email','providers',jsonb_build_array('email'),'role','warehouse'),
     jsonb_build_object('display_name','คลังสินค้า มช.','role','warehouse'),
     false, now(), now())
  on conflict (id) do nothing;

  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values
    (gen_random_uuid(), v_farmer1_id,   jsonb_build_object('sub',v_farmer1_id::text,  'email','demo_farmer1@arex.local'),   'email','demo_farmer1@arex.local',   now(),now(),now()),
    (gen_random_uuid(), v_farmer2_id,   jsonb_build_object('sub',v_farmer2_id::text,  'email','demo_farmer2@arex.local'),   'email','demo_farmer2@arex.local',   now(),now(),now()),
    (gen_random_uuid(), v_farmer3_id,   jsonb_build_object('sub',v_farmer3_id::text,  'email','demo_farmer3@arex.local'),   'email','demo_farmer3@arex.local',   now(),now(),now()),
    (gen_random_uuid(), v_logistics_id, jsonb_build_object('sub',v_logistics_id::text,'email','demo_logistics@arex.local'), 'email','demo_logistics@arex.local', now(),now(),now()),
    (gen_random_uuid(), v_factory_id,   jsonb_build_object('sub',v_factory_id::text,  'email','demo_factory@arex.local'),   'email','demo_factory@arex.local',   now(),now(),now()),
    (gen_random_uuid(), v_warehouse_id, jsonb_build_object('sub',v_warehouse_id::text,'email','demo_warehouse@arex.local'), 'email','demo_warehouse@arex.local', now(),now(),now());

  insert into profiles (id, role, display_name, phone, province, approval_status)
  values
    (v_farmer1_id,   'farmer',    'สมชาย ใจดี',        '0812345601', 'เชียงใหม่', 'approved'),
    (v_farmer2_id,   'farmer',    'สมหญิง มีสุข',       '0812345602', 'เชียงใหม่', 'approved'),
    (v_farmer3_id,   'farmer',    'ประสิทธิ์ รักษ์โลก', '0812345603', 'เชียงใหม่', 'approved'),
    (v_logistics_id, 'logistics', 'WeMove พนักงาน',     '0812345610', 'เชียงใหม่', 'approved'),
    (v_factory_id,   'factory',   'เจ้าหน้าที่ มช.',    '0812345620', 'เชียงใหม่', 'approved'),
    (v_warehouse_id, 'warehouse', 'คลังสินค้า มช.',     '0812345630', 'เชียงใหม่', 'approved')
  on conflict (id) do nothing;

  insert into public.org_accounts (profile_id, type, name_th, location_text, lat, lng, active)
  values (v_logistics_id, 'logistics', 'WeMove ทีมขนส่งเชียงใหม่', 'อ.เมือง จ.เชียงใหม่', 18.7885, 98.9853, true)
  on conflict (profile_id, type) where profile_id is not null do nothing;

  insert into submissions
    (id, farmer_profile_id, material_type, quantity_value, quantity_unit,
     pickup_location_text, pickup_lat, pickup_lng, status, created_at, updated_at)
  values
    (v_sub1_id, v_farmer1_id, 'rice_straw', 30, 'ก้อน',
     'ไร่นาสมชาย ต.สันทราย อ.สันทราย เชียงใหม่', 18.8510, 99.0180,
     'points_credited', now() - interval '5 days', now() - interval '2 days'),
    (v_sub2_id, v_farmer2_id, 'orchard_residue', 80, 'กิโลกรัม',
     'สวนลำไย ต.แม่แตง อ.แม่แตง เชียงใหม่', 19.0300, 98.9500,
     'points_credited', now() - interval '4 days', now() - interval '1 day'),
    (v_sub3_id, v_farmer1_id, 'rice_straw', 20, 'ก้อน',
     'ไร่นาสมชาย ต.สันทราย อ.สันทราย เชียงใหม่', 18.8510, 99.0180,
     'pickup_scheduled', now() - interval '1 day', now() - interval '1 day'),
    (v_sub4_id, v_farmer3_id, 'plastic_waste', 15, 'กิโลกรัม',
     'ชุมชนแม่ริม ต.แม่ริม อ.แม่ริม เชียงใหม่', 18.9100, 98.9600,
     'submitted', now() - interval '6 hours', now() - interval '6 hours')
  on conflict (id) do nothing;

  insert into pickup_jobs
    (id, submission_id, logistics_profile_id, destination_factory_id,
     planned_pickup_at, pickup_window_end_at, picked_up_at, delivered_factory_at, factory_confirmed_at,
     status, created_at, updated_at)
  values
    (v_pickup1_id, v_sub1_id, v_logistics_id, v_cmu_factory_id,
     now() - interval '5 days', now() - interval '4 days 20 hours',
     now() - interval '4 days 18 hours', now() - interval '4 days 12 hours', now() - interval '2 days',
     'factory_confirmed', now() - interval '5 days', now() - interval '2 days'),
    (v_pickup2_id, v_sub2_id, v_logistics_id, v_cmu_factory_id,
     now() - interval '4 days', now() - interval '3 days 20 hours',
     now() - interval '3 days 18 hours', now() - interval '3 days 12 hours', now() - interval '1 day',
     'factory_confirmed', now() - interval '4 days', now() - interval '1 day'),
    (v_pickup3_id, v_sub3_id, v_logistics_id, v_cmu_factory_id,
     now() + interval '4 hours', now() + interval '8 hours',
     null, null, null,
     'pickup_scheduled', now() - interval '1 day', now() - interval '1 day')
  on conflict (id) do nothing;

  insert into logistics_distances
    (logistics_profile_id, reference_type, reference_id, leg, distance_km)
  values
    (v_logistics_id, 'submission', v_sub4_id, 'to_farmer',         13.2),
    (v_logistics_id, 'submission', v_sub1_id, 'to_farmer',         12.1),
    (v_logistics_id, 'submission', v_sub1_id, 'farmer_to_factory',  7.1),
    (v_logistics_id, 'submission', v_sub2_id, 'to_farmer',         36.4),
    (v_logistics_id, 'submission', v_sub2_id, 'farmer_to_factory', 42.3),
    (v_logistics_id, 'submission', v_sub3_id, 'to_farmer',         12.1),
    (v_logistics_id, 'submission', v_sub3_id, 'farmer_to_factory',  7.1)
  on conflict (logistics_profile_id, reference_type, reference_id, leg) do nothing;

  insert into intakes
    (id, pickup_job_id, factory_profile_id, measured_weight_kg, status, confirmed_at, created_at)
  values
    (v_intake1_id, v_pickup1_id, v_factory_id, 375.000, 'confirmed', now() - interval '2 days', now() - interval '2 days'),
    (v_intake2_id, v_pickup2_id, v_factory_id,  80.000, 'confirmed', now() - interval '1 day',  now() - interval '1 day')
  on conflict (id) do nothing;

  insert into points_ledger
    (farmer_profile_id, entry_type, points_amount, reference_type, reference_id, note, created_at)
  values
    (v_farmer1_id, 'intake_credit', 375, 'factory_intake', v_intake1_id,
     'น้ำหนักจริง 375 กก. ที่ มช.', now() - interval '2 days'),
    (v_farmer2_id, 'intake_credit', 250, 'factory_intake', v_intake2_id,
     'น้ำหนักจริง 80 กก. × 3.125 pt/kg ที่ มช.', now() - interval '1 day')
  on conflict do nothing;

  if v_biodiesel_id is not null then
    insert into reward_requests
      (id, farmer_profile_id, reward_id, quantity, requested_points,
       status, warehouse_profile_id, warehouse_decision_at,
       delivery_location_text, delivery_lat, delivery_lng,
       requested_at, updated_at)
    values
      (v_rr1_id, v_farmer1_id, v_biodiesel_id, 1, 125,
       'warehouse_approved', v_warehouse_id, now() - interval '1 day 18 hours',
       'ไร่นาสมชาย ต.สันทราย อ.สันทราย เชียงใหม่ 50210', 18.8510, 99.0180,
       now() - interval '2 days', now() - interval '1 day 18 hours')
    on conflict (id) do nothing;

    insert into points_ledger
      (farmer_profile_id, entry_type, points_amount, reference_type, reference_id, note, created_at)
    values
      (v_farmer1_id, 'reward_reserve', 125, 'reward_request', v_rr1_id,
       'จองแต้มแลกไบโอดีเซล 10 ลิตร', now() - interval '2 days'),
      (v_farmer1_id, 'reward_spend', 125, 'reward_request', v_rr1_id,
       'แลกไบโอดีเซล 10 ลิตร สำเร็จ', now() - interval '18 hours')
    on conflict do nothing;

    insert into delivery_jobs
      (id, reward_request_id, logistics_profile_id,
       planned_delivery_at, delivery_window_end_at,
       out_for_delivery_at, delivered_at, status, created_at, updated_at)
    values
      (v_rdj1_id, v_rr1_id, v_logistics_id,
       now() - interval '1 day', now() - interval '20 hours',
       now() - interval '22 hours', now() - interval '18 hours',
       'reward_delivered', now() - interval '1 day', now() - interval '18 hours')
    on conflict (id) do nothing;

    insert into logistics_distances
      (logistics_profile_id, reference_type, reference_id, leg, distance_km)
    values
      (v_logistics_id, 'reward_request', v_rr1_id, 'to_farmer', 12.1)
    on conflict (logistics_profile_id, reference_type, reference_id, leg) do nothing;

    update rewards set stock_qty = greatest(stock_qty - 1, 0), updated_at = now()
    where id = v_biodiesel_id;
  end if;

  if v_solar_id is not null then
    insert into reward_requests
      (id, farmer_profile_id, reward_id, quantity, requested_points,
       status, requested_at, updated_at,
       delivery_location_text, delivery_lat, delivery_lng)
    values
      (v_rr2_id, v_farmer2_id, v_solar_id, 1, 625,
       'requested', now() - interval '12 hours', now() - interval '12 hours',
       'สวนลำไย ต.แม่แตง อ.แม่แตง เชียงใหม่ 50150', 19.0300, 98.9500)
    on conflict (id) do nothing;

    insert into points_ledger
      (farmer_profile_id, entry_type, points_amount, reference_type, reference_id, note, created_at)
    values
      (v_farmer2_id, 'reward_reserve', 625, 'reward_request', v_rr2_id,
       'จองแต้มแลกโซลาร์เซลล์', now() - interval '12 hours')
    on conflict do nothing;
  end if;

  insert into reward_requests
    (id, farmer_profile_id, reward_id, quantity, requested_points,
     status, warehouse_profile_id, warehouse_decision_at,
     delivery_location_text, delivery_lat, delivery_lng,
     requested_at, updated_at)
  values
    (v_rr3_id, v_farmer1_id, '00000000-0000-4000-8000-00000000a004', 1, 50,
     'warehouse_approved', v_warehouse_id, now() - interval '6 hours',
     'ไร่นาสมชาย ต.สันทราย อ.สันทราย เชียงใหม่ 50210', 18.8510, 99.0180,
     now() - interval '8 hours', now() - interval '6 hours')
  on conflict (id) do nothing;

  insert into points_ledger
    (farmer_profile_id, entry_type, points_amount, reference_type, reference_id, note, created_at)
  values
    (v_farmer1_id, 'reward_reserve', 50, 'reward_request', v_rr3_id,
     'จองแต้มแลกน้ำมันไพโรไลซิส', now() - interval '8 hours')
  on conflict do nothing;

  insert into delivery_jobs
    (id, reward_request_id, logistics_profile_id,
     planned_delivery_at, delivery_window_end_at,
     out_for_delivery_at, delivered_at, status, created_at, updated_at)
  values
    (v_rdj2_id, v_rr3_id, v_logistics_id,
     now() + interval '1 day', now() + interval '1 day 4 hours',
     null, null,
     'reward_delivery_scheduled', now() - interval '6 hours', now() - interval '6 hours')
  on conflict (id) do nothing;

end $$;

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

do $$ begin
  drop policy if exists "Public read reward images"           on storage.objects;
  drop policy if exists "Auth users can upload reward images" on storage.objects;
  drop policy if exists "Auth users can update reward images" on storage.objects;
  drop policy if exists "Auth users can delete reward images" on storage.objects;
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
