-- Deterministic local seed for AREX using Supabase CLI.
-- Applied by `supabase seed` and by `supabase db reset`.
-- Every status combination across every flow is represented.

begin;

-- -----------------------------------------------------------------------
-- Clean up existing demo accounts (stable + D-06 pilot)
-- -----------------------------------------------------------------------
with all_demo_ids as (
  select id from (values
    ('90000000-0000-4000-8000-000000000001'::uuid),
    ('90000000-0000-4000-8000-000000000002'::uuid),
    ('90000000-0000-4000-8000-000000000003'::uuid),
    ('90000000-0000-4000-8000-000000000004'::uuid),
    ('90000000-0000-4000-8000-000000000005'::uuid),
    ('90000000-0000-4000-8000-000000000006'::uuid),
    ('90000000-0000-4000-8000-000000000007'::uuid),
    ('90000000-0000-4000-8000-000000000008'::uuid),
    ('90000000-0000-4000-8000-000000000009'::uuid),
    ('aaaaaaaa-d06f-0001-0000-000000000001'::uuid),
    ('aaaaaaaa-d06f-0001-0000-000000000002'::uuid),
    ('aaaaaaaa-d06f-0001-0000-000000000003'::uuid),
    ('aaaaaaaa-d06f-0001-0000-000000000010'::uuid),
    ('aaaaaaaa-d06f-0001-0000-000000000020'::uuid),
    ('aaaaaaaa-d06f-0001-0000-000000000030'::uuid)
  ) as t(id)
)
delete from auth.identities i
using auth.users u, all_demo_ids d
where i.user_id = u.id and u.id = d.id;

with all_demo_ids as (
  select id from (values
    ('90000000-0000-4000-8000-000000000001'::uuid),
    ('90000000-0000-4000-8000-000000000002'::uuid),
    ('90000000-0000-4000-8000-000000000003'::uuid),
    ('90000000-0000-4000-8000-000000000004'::uuid),
    ('90000000-0000-4000-8000-000000000005'::uuid),
    ('90000000-0000-4000-8000-000000000006'::uuid),
    ('90000000-0000-4000-8000-000000000007'::uuid),
    ('90000000-0000-4000-8000-000000000008'::uuid),
    ('90000000-0000-4000-8000-000000000009'::uuid),
    ('aaaaaaaa-d06f-0001-0000-000000000001'::uuid),
    ('aaaaaaaa-d06f-0001-0000-000000000002'::uuid),
    ('aaaaaaaa-d06f-0001-0000-000000000003'::uuid),
    ('aaaaaaaa-d06f-0001-0000-000000000010'::uuid),
    ('aaaaaaaa-d06f-0001-0000-000000000020'::uuid),
    ('aaaaaaaa-d06f-0001-0000-000000000030'::uuid)
  ) as t(id)
)
delete from auth.users u
using all_demo_ids d
where u.id = d.id;

truncate table
  public.reward_delivery_jobs,
  public.factory_intakes,
  public.pickup_jobs,
  public.reward_requests,
  public.points_ledger,
  public.status_events,
  public.material_submissions,
  public.factories,
  public.rewards_catalog,
  public.material_point_rules,
  public.measurement_units,
  public.material_types,
  public.profiles
restart identity cascade;

-- -----------------------------------------------------------------------
-- Auth users  (password 123456 for ALL accounts)
-- -----------------------------------------------------------------------
-- Accounts:
--   farmer@gmail.com   — สมชาย  — has submissions in every status, reward requests in every status
--   farmer2@gmail.com  — สมหญิง — has delivery jobs in every status
--   farmer3@gmail.com  — ประสิทธิ์ — complete end-to-end flow (points_credited + reward delivered)
--   logistics@gmail.com / logistics2@gmail.com
--   factory@gmail.com  / factory2@gmail.com
--   warehouse@gmail.com
--   executive@gmail.com
-- -----------------------------------------------------------------------
with demo_users as (
  select *
  from (
    values
      ('90000000-0000-4000-8000-000000000001'::uuid, 'farmer@gmail.com',    'farmer',    'สมชาย เกษตรกร',    '0810001001', 'เพชรบูรณ์'),
      ('90000000-0000-4000-8000-000000000002'::uuid, 'farmer2@gmail.com',   'farmer',    'สมหญิง เกษตรกร',   '0810001002', 'นครราชสีมา'),
      ('90000000-0000-4000-8000-000000000009'::uuid, 'farmer3@gmail.com',   'farmer',    'ประสิทธิ์ รักษ์โลก','0810001003', 'เชียงใหม่'),
      ('90000000-0000-4000-8000-000000000003'::uuid, 'logistics@gmail.com', 'logistics', 'เอกชัย ขนส่ง',     '0810002001', 'สระบุรี'),
      ('90000000-0000-4000-8000-000000000007'::uuid, 'logistics2@gmail.com','logistics', 'ปิติ ขนส่ง',       '0810002002', 'ลพบุรี'),
      ('90000000-0000-4000-8000-000000000004'::uuid, 'factory@gmail.com',   'factory',   'วรินทร์ โรงงาน',  '0810003001', 'สระบุรี'),
      ('90000000-0000-4000-8000-000000000008'::uuid, 'factory2@gmail.com',  'factory',   'กิตติ โรงงาน',    '0810003002', 'ชัยนาท'),
      ('90000000-0000-4000-8000-000000000005'::uuid, 'warehouse@gmail.com', 'warehouse', 'มานพ คลังสินค้า', '0810004001', 'ปทุมธานี'),
      ('90000000-0000-4000-8000-000000000006'::uuid, 'executive@gmail.com', 'executive', 'ผู้บริหาร AREX',  '0810005001', 'กรุงเทพมหานคร'),
      ('90000000-0000-4000-8000-000000000010'::uuid, 'admin@gmail.com',     'admin',     'ผู้ดูแลระบบ AREX','0810006001', 'กรุงเทพมหานคร')
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

insert into public.profiles (id, role, display_name, phone, province)
values
  ('90000000-0000-4000-8000-000000000001', 'farmer',    'สมชาย เกษตรกร',    '0810001001', 'เพชรบูรณ์'),
  ('90000000-0000-4000-8000-000000000002', 'farmer',    'สมหญิง เกษตรกร',   '0810001002', 'นครราชสีมา'),
  ('90000000-0000-4000-8000-000000000009', 'farmer',    'ประสิทธิ์ รักษ์โลก','0810001003', 'เชียงใหม่'),
  ('90000000-0000-4000-8000-000000000003', 'logistics', 'เอกชัย ขนส่ง',     '0810002001', 'สระบุรี'),
  ('90000000-0000-4000-8000-000000000007', 'logistics', 'ปิติ ขนส่ง',       '0810002002', 'ลพบุรี'),
  ('90000000-0000-4000-8000-000000000004', 'factory',   'วรินทร์ โรงงาน',  '0810003001', 'สระบุรี'),
  ('90000000-0000-4000-8000-000000000008', 'factory',   'กิตติ โรงงาน',    '0810003002', 'ชัยนาท'),
  ('90000000-0000-4000-8000-000000000005', 'warehouse', 'มานพ คลังสินค้า', '0810004001', 'ปทุมธานี'),
  ('90000000-0000-4000-8000-000000000006', 'executive', 'ผู้บริหาร AREX',  '0810005001', 'กรุงเทพมหานคร'),
  ('90000000-0000-4000-8000-000000000010', 'admin',     'ผู้ดูแลระบบ AREX','0810006001', 'กรุงเทพมหานคร');

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
  ('plastic_waste',     'ขยะพลาสติก',            true)
on conflict (code) do update
set name_th    = excluded.name_th,
    active     = excluded.active,
    updated_at = now();

-- -----------------------------------------------------------------------
-- Measurement units
-- -----------------------------------------------------------------------
insert into public.measurement_units (code, name_th, to_kg_factor, active)
values
  ('กิโลกรัม', 'กิโลกรัม',    1.000000,   true),
  ('ตัน',      'ตัน',         1000.000000, true),
  ('ก้อน',     'ก้อน (ฟาง)',  12.500000,  true)
on conflict (code) do update
set name_th      = excluded.name_th,
    to_kg_factor = excluded.to_kg_factor,
    active       = excluded.active,
    updated_at   = now();

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
  ('plastic_waste',    12.500000)
on conflict (material_type) do update
set points_per_kg = excluded.points_per_kg,
    updated_at    = now();

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
   50, 5000, true)
on conflict (id) do update
set name_th        = excluded.name_th,
    description_th = excluded.description_th,
    points_cost    = excluded.points_cost,
    stock_qty      = excluded.stock_qty,
    active         = excluded.active,
    updated_at     = now();

-- -----------------------------------------------------------------------
-- Factories
-- -----------------------------------------------------------------------
insert into public.factories (id, factory_profile_id, name_th, location_text, lat, lng, active, is_focal_point)
values
  ('00000000-0000-4000-8000-00000000f001',
   '90000000-0000-4000-8000-000000000004',
   'โรงงานชีวมวล AREX - สระบุรี', 'จ.สระบุรี', 14.528915, 100.910142, true, false),
  ('00000000-0000-4000-8000-00000000f002',
   '90000000-0000-4000-8000-000000000008',
   'โรงงานชีวมวล AREX - ชัยนาท', 'จ.ชัยนาท', 15.186197, 100.125125, true, false),
  ('00000000-0000-4000-8000-00000000f003',
   null,
   'มหาวิทยาลัยเชียงใหม่ (มช.)', 'เชียงใหม่', 18.788300, 98.985300, true, true)
on conflict (id) do update
set name_th        = excluded.name_th,
    location_text  = excluded.location_text,
    lat            = excluded.lat,
    lng            = excluded.lng,
    active         = excluded.active,
    is_focal_point = excluded.is_focal_point;

-- -----------------------------------------------------------------------
-- Logistics accounts
-- -----------------------------------------------------------------------
insert into public.logistics_accounts (id, logistics_profile_id, name_th, location_text, lat, lng, active)
values
  ('00000000-0000-4000-8000-0000000c0001',
   '90000000-0000-4000-8000-000000000003',
   'ทีมขนส่ง AREX - สระบุรี', 'จ.สระบุรี', 14.528915, 100.910142, true),
  ('00000000-0000-4000-8000-0000000c0002',
   '90000000-0000-4000-8000-000000000007',
   'ทีมขนส่ง AREX - ลพบุรี', 'จ.ลพบุรี', 14.799367, 100.653339, true)
on conflict (id) do update
set name_th       = excluded.name_th,
    location_text = excluded.location_text,
    lat           = excluded.lat,
    lng           = excluded.lng,
    active        = excluded.active;

-- -----------------------------------------------------------------------
-- Value chain mappings
-- -----------------------------------------------------------------------
insert into public.value_chain_mappings (product_name_th, producer_org, buyer_org, buyer_use_th, active)
values
  ('เยื่อชีวมวล (Bio-pulp)',  'มช. / มก.',       'บริษัท Precise', 'ทำไม้เทียม',   true),
  ('ถ่านชีวภาพ / ไบโอชาร์',  'มช. / วว. / มก.', 'กลุ่มโรงงาน',   'ใช้ใน Boiler', true),
  ('น้ำมันไพโรไลซิส',          'มช. / วว.',       'วิสาหกิจชุมชน', 'พลังงานชุมชน', true)
on conflict do nothing;

-- =========================================================================
-- DEMO DATA — covers every UI state in every flow
-- =========================================================================

-- -----------------------------------------------------------------------
-- Material submissions
-- All 7 statuses across 3 farmers:
--   submitted           → farmer1 Sub-01
--   pickup_scheduled    → farmer1 Sub-02
--   picked_up           → farmer1 Sub-03
--   delivered_to_factory→ farmer2 Sub-04
--   factory_confirmed   → farmer2 Sub-05
--   points_credited     → farmer1 Sub-06, farmer3 Sub-11, Sub-12
--   cancelled           → farmer2 Sub-07
-- -----------------------------------------------------------------------
insert into public.material_submissions (
  id, farmer_profile_id, material_type, quantity_value, quantity_unit,
  pickup_location_text, pickup_lat, pickup_lng, notes, status, created_at, updated_at
)
values
  -- farmer1: submitted (waiting for logistics to schedule)
  ('10000000-0000-4000-8000-000000000001',
   '90000000-0000-4000-8000-000000000001',
   'rice_straw', 800.0, 'กิโลกรัม',
   'ต.นาเฉลียง อ.หนองไผ่ จ.เพชรบูรณ์', 16.04905, 101.14966,
   null, 'submitted',
   now() - interval '3 hours', now() - interval '3 hours'),

  -- farmer1: pickup_scheduled (logistics assigned)
  ('10000000-0000-4000-8000-000000000002',
   '90000000-0000-4000-8000-000000000001',
   'cassava_root', 500.0, 'กิโลกรัม',
   'ต.นาเฉลียง อ.หนองไผ่ จ.เพชรบูรณ์', 16.04905, 101.14966,
   null, 'pickup_scheduled',
   now() - interval '2 days', now() - interval '1 day 20 hours'),

  -- farmer1: picked_up (logistics has it, not yet at factory)
  ('10000000-0000-4000-8000-000000000003',
   '90000000-0000-4000-8000-000000000001',
   'corn_stover', 300.0, 'กิโลกรัม',
   'ต.นาเฉลียง อ.หนองไผ่ จ.เพชรบูรณ์', 16.04905, 101.14966,
   null, 'picked_up',
   now() - interval '4 days', now() - interval '3 days 18 hours'),

  -- farmer2: delivered_to_factory (at factory, pending confirmation)
  ('10000000-0000-4000-8000-000000000004',
   '90000000-0000-4000-8000-000000000002',
   'orchard_residue', 200.0, 'กิโลกรัม',
   'อ.เมือง จ.นครราชสีมา', 14.97990, 102.09777,
   null, 'delivered_to_factory',
   now() - interval '5 days', now() - interval '4 days 12 hours'),

  -- farmer2: factory_confirmed (weighed, points not yet credited)
  ('10000000-0000-4000-8000-000000000005',
   '90000000-0000-4000-8000-000000000002',
   'plastic_waste', 50.0, 'กิโลกรัม',
   'อ.เมือง จ.นครราชสีมา', 14.97990, 102.09777,
   null, 'factory_confirmed',
   now() - interval '7 days', now() - interval '6 days'),

  -- farmer1: points_credited (full flow complete, older)
  ('10000000-0000-4000-8000-000000000006',
   '90000000-0000-4000-8000-000000000001',
   'rice_straw', 1000.0, 'กิโลกรัม',
   'ต.นาเฉลียง อ.หนองไผ่ จ.เพชรบูรณ์', 16.04905, 101.14966,
   null, 'points_credited',
   now() - interval '14 days', now() - interval '12 days'),

  -- farmer2: cancelled (before logistics acted)
  ('10000000-0000-4000-8000-000000000007',
   '90000000-0000-4000-8000-000000000002',
   'sugarcane_bagasse', 150.0, 'กิโลกรัม',
   'อ.เมือง จ.นครราชสีมา', 14.97990, 102.09777,
   null, 'cancelled',
   now() - interval '6 days', now() - interval '6 days'),

  -- farmer3: points_credited (complete flow, recent — for full demo)
  ('10000000-0000-4000-8000-000000000011',
   '90000000-0000-4000-8000-000000000009',
   'rice_straw', 30.0, 'ก้อน',
   'ต.สันทราย อ.สันทราย จ.เชียงใหม่', 18.85100, 99.01800,
   null, 'points_credited',
   now() - interval '8 days', now() - interval '5 days'),

  -- farmer3: points_credited (second batch — orchard residue)
  ('10000000-0000-4000-8000-000000000012',
   '90000000-0000-4000-8000-000000000009',
   'orchard_residue', 80.0, 'กิโลกรัม',
   'ต.สันทราย อ.สันทราย จ.เชียงใหม่', 18.85100, 99.01800,
   null, 'points_credited',
   now() - interval '6 days', now() - interval '3 days')

on conflict (id) do nothing;

-- -----------------------------------------------------------------------
-- Pickup jobs
-- Statuses: pickup_scheduled, picked_up, delivered_to_factory, factory_confirmed
-- -----------------------------------------------------------------------
insert into public.pickup_jobs (
  id, submission_id, logistics_profile_id, destination_factory_id,
  planned_pickup_at, pickup_window_end_at,
  picked_up_at, delivered_factory_at, factory_confirmed_at,
  status, notes, created_at, updated_at
)
values
  -- Job 02: pickup_scheduled → farmer1 cassava_root (Sub-02)
  ('20000000-0000-4000-8000-000000000002',
   '10000000-0000-4000-8000-000000000002',
   '90000000-0000-4000-8000-000000000003',
   '00000000-0000-4000-8000-00000000f001',
   now() + interval '4 hours', now() + interval '8 hours',
   null, null, null,
   'pickup_scheduled', null,
   now() - interval '1 day 20 hours', now() - interval '1 day 20 hours'),

  -- Job 03: picked_up → farmer1 corn_stover (Sub-03)
  ('20000000-0000-4000-8000-000000000003',
   '10000000-0000-4000-8000-000000000003',
   '90000000-0000-4000-8000-000000000003',
   '00000000-0000-4000-8000-00000000f001',
   now() - interval '3 days 20 hours', now() - interval '3 days 16 hours',
   now() - interval '3 days 18 hours', null, null,
   'picked_up', null,
   now() - interval '4 days', now() - interval '3 days 18 hours'),

  -- Job 04: delivered_to_factory → farmer2 orchard_residue (Sub-04)
  ('20000000-0000-4000-8000-000000000004',
   '10000000-0000-4000-8000-000000000004',
   '90000000-0000-4000-8000-000000000003',
   '00000000-0000-4000-8000-00000000f001',
   now() - interval '5 days', now() - interval '4 days 20 hours',
   now() - interval '4 days 22 hours', now() - interval '4 days 12 hours', null,
   'delivered_to_factory', null,
   now() - interval '5 days', now() - interval '4 days 12 hours'),

  -- Job 05: factory_confirmed → farmer2 plastic_waste (Sub-05)
  ('20000000-0000-4000-8000-000000000005',
   '10000000-0000-4000-8000-000000000005',
   '90000000-0000-4000-8000-000000000003',
   '00000000-0000-4000-8000-00000000f001',
   now() - interval '7 days', now() - interval '6 days 20 hours',
   now() - interval '6 days 22 hours', now() - interval '6 days 12 hours', now() - interval '6 days',
   'factory_confirmed', null,
   now() - interval '7 days', now() - interval '6 days'),

  -- Job 06: factory_confirmed → farmer1 rice_straw (Sub-06, points_credited)
  ('20000000-0000-4000-8000-000000000006',
   '10000000-0000-4000-8000-000000000006',
   '90000000-0000-4000-8000-000000000003',
   '00000000-0000-4000-8000-00000000f001',
   now() - interval '14 days', now() - interval '13 days 20 hours',
   now() - interval '13 days 22 hours', now() - interval '13 days 12 hours', now() - interval '12 days',
   'factory_confirmed', null,
   now() - interval '14 days', now() - interval '12 days'),

  -- Job 11: factory_confirmed → farmer3 rice_straw 30 ก้อน (Sub-11)
  ('20000000-0000-4000-8000-000000000011',
   '10000000-0000-4000-8000-000000000011',
   '90000000-0000-4000-8000-000000000007',
   '00000000-0000-4000-8000-00000000f003',
   now() - interval '8 days', now() - interval '7 days 20 hours',
   now() - interval '7 days 18 hours', now() - interval '6 days 12 hours', now() - interval '5 days',
   'factory_confirmed', null,
   now() - interval '8 days', now() - interval '5 days'),

  -- Job 12: factory_confirmed → farmer3 orchard_residue (Sub-12)
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
-- Factory intakes (confirmed weighing at factory)
-- -----------------------------------------------------------------------
insert into public.factory_intakes (
  id, pickup_job_id, factory_profile_id, measured_weight_kg, status, confirmed_at, created_at
)
values
  -- Intake 05: plastic_waste 50 kg × 12.5 = 625 pts  (factory_confirmed, points not yet credited)
  ('40000000-0000-4000-8000-000000000005',
   '20000000-0000-4000-8000-000000000005',
   '90000000-0000-4000-8000-000000000004',
   50.0, 'confirmed',
   now() - interval '6 days', now() - interval '6 days'),

  -- Intake 06: rice_straw 1000 kg × 1.0 = 1000 pts  (points_credited)
  ('40000000-0000-4000-8000-000000000006',
   '20000000-0000-4000-8000-000000000006',
   '90000000-0000-4000-8000-000000000004',
   1000.0, 'confirmed',
   now() - interval '12 days', now() - interval '12 days'),

  -- Intake 11: rice_straw 30×12.5=375 kg × 1.0 = 375 pts  (farmer3)
  ('40000000-0000-4000-8000-000000000011',
   '20000000-0000-4000-8000-000000000011',
   '90000000-0000-4000-8000-000000000004',
   375.0, 'confirmed',
   now() - interval '5 days', now() - interval '5 days'),

  -- Intake 12: orchard_residue 80 kg × 3.125 = 250 pts  (farmer3)
  ('40000000-0000-4000-8000-000000000012',
   '20000000-0000-4000-8000-000000000012',
   '90000000-0000-4000-8000-000000000004',
   80.0, 'confirmed',
   now() - interval '3 days', now() - interval '3 days')

on conflict (id) do nothing;

-- -----------------------------------------------------------------------
-- Points ledger
-- farmer1: +1000 (rice_straw) -25 (reserve แผ่นคลุมดิน) -125 (reserve biodiesel)
--          +625 (release solar rejected) -625 (reserve solar) = 850 available (after reserves)
-- farmer2: +625 (plastic_waste) -125 (reserve biodiesel) -25 (reserve+spend แผ่นคลุมดิน)
-- farmer3: +375 (rice_straw) +250 (orchard_residue) -125 (spend biodiesel) = 500 available
-- -----------------------------------------------------------------------
insert into public.points_ledger (id, farmer_profile_id, entry_type, points_amount, reference_type, reference_id, note, created_at)
values
  -- farmer1: credits
  ('50000000-0000-4000-8000-000000000001',
   '90000000-0000-4000-8000-000000000001',
   'intake_credit', 1000, 'factory_intake', '40000000-0000-4000-8000-000000000006',
   'น้ำหนักจริง 1,000 กก. × 1.0 pt/kg', now() - interval '12 days'),

  -- farmer2: credits
  ('50000000-0000-4000-8000-000000000002',
   '90000000-0000-4000-8000-000000000002',
   'intake_credit', 625, 'factory_intake', '40000000-0000-4000-8000-000000000005',
   'น้ำหนักจริง 50 กก. × 12.5 pt/kg', now() - interval '6 days'),

  -- farmer3: credits
  ('50000000-0000-4000-8000-000000000011',
   '90000000-0000-4000-8000-000000000009',
   'intake_credit', 375, 'factory_intake', '40000000-0000-4000-8000-000000000011',
   'น้ำหนักจริง 375 กก. × 1.0 pt/kg', now() - interval '5 days'),
  ('50000000-0000-4000-8000-000000000012',
   '90000000-0000-4000-8000-000000000009',
   'intake_credit', 250, 'factory_intake', '40000000-0000-4000-8000-000000000012',
   'น้ำหนักจริง 80 กก. × 3.125 pt/kg', now() - interval '3 days'),

  -- farmer1: RR-02 แผ่นคลุมดิน reserve (delivery_scheduled)
  ('50000000-0000-4000-8000-000000000010',
   '90000000-0000-4000-8000-000000000001',
   'reward_reserve', 25, 'reward_request', '30000000-0000-4000-8000-000000000002',
   'จองแต้มแลกแผ่นคลุมดิน', now() - interval '11 days'),

  -- farmer1: RR-05 solar reserve (rejected — will be released)
  ('50000000-0000-4000-8000-000000000014',
   '90000000-0000-4000-8000-000000000001',
   'reward_reserve', 625, 'reward_request', '30000000-0000-4000-8000-000000000005',
   'จองแต้มแลกโซลาร์เซลล์', now() - interval '6 days'),
  ('50000000-0000-4000-8000-000000000015',
   '90000000-0000-4000-8000-000000000001',
   'reward_release', 625, 'reward_request', '30000000-0000-4000-8000-000000000005',
   'คืนแต้ม — คำขอโซลาร์ถูกปฏิเสธ', now() - interval '5 days 10 hours'),

  -- farmer1: RR-08 biodiesel reserve (out_for_delivery)
  ('50000000-0000-4000-8000-000000000016',
   '90000000-0000-4000-8000-000000000001',
   'reward_reserve', 125, 'reward_request', '30000000-0000-4000-8000-000000000008',
   'จองแต้มแลกไบโอดีเซล', now() - interval '4 days'),

  -- farmer2: RR-03 biodiesel reserve (out_for_delivery)
  ('50000000-0000-4000-8000-000000000031',
   '90000000-0000-4000-8000-000000000002',
   'reward_reserve', 125, 'reward_request', '30000000-0000-4000-8000-000000000003',
   'จองแต้มแลกไบโอดีเซล', now() - interval '5 days 20 hours'),

  -- farmer2: RR-04 แผ่นคลุมดิน reserve+spend (delivered)
  ('50000000-0000-4000-8000-000000000032',
   '90000000-0000-4000-8000-000000000002',
   'reward_reserve', 25, 'reward_request', '30000000-0000-4000-8000-000000000004',
   'จองแต้มแลกแผ่นคลุมดิน', now() - interval '5 days 22 hours'),
  ('50000000-0000-4000-8000-000000000013',
   '90000000-0000-4000-8000-000000000002',
   'reward_spend', 25, 'reward_request', '30000000-0000-4000-8000-000000000004',
   'แลกแผ่นคลุมดิน สำเร็จ', now() - interval '5 days'),

  -- farmer3: RR-09 biodiesel reserve+spend (delivered)
  ('50000000-0000-4000-8000-000000000021',
   '90000000-0000-4000-8000-000000000009',
   'reward_reserve', 125, 'reward_request', '30000000-0000-4000-8000-000000000009',
   'จองแต้มแลกไบโอดีเซล', now() - interval '4 days 12 hours'),
  ('50000000-0000-4000-8000-000000000022',
   '90000000-0000-4000-8000-000000000009',
   'reward_spend', 125, 'reward_request', '30000000-0000-4000-8000-000000000009',
   'แลกไบโอดีเซล 10 ลิตร สำเร็จ', now() - interval '3 days 12 hours'),

  -- farmer3: RR-10 น้ำมันไพโรไลซิส reserve (delivery_scheduled)
  ('50000000-0000-4000-8000-000000000023',
   '90000000-0000-4000-8000-000000000009',
   'reward_reserve', 50, 'reward_request', '30000000-0000-4000-8000-000000000010',
   'จองแต้มแลกน้ำมันไพโรไลซิส', now() - interval '1 day')

on conflict (id) do nothing;

-- -----------------------------------------------------------------------
-- Reward requests — every status combination
--
-- RR-01: requested (pending warehouse) — farmer1
-- RR-02: warehouse_approved + delivery_scheduled — farmer1 แผ่นคลุมดิน
-- RR-03: warehouse_approved + out_for_delivery — farmer2 biodiesel
-- RR-04: warehouse_approved + reward_delivered — farmer2 แผ่นคลุมดิน
-- RR-05: warehouse_rejected — farmer1 solar
-- RR-06: cancelled — farmer2 (before warehouse acted)
-- RR-07: requested (second pending for farmer2, different reward)
-- RR-08: warehouse_approved + out_for_delivery — farmer1 biodiesel
-- RR-09: warehouse_approved + reward_delivered — farmer3 biodiesel (complete flow)
-- RR-10: warehouse_approved + delivery_scheduled — farmer3 น้ำมันไพโรไลซิส
-- -----------------------------------------------------------------------
insert into public.reward_requests (
  id, farmer_profile_id, reward_id, quantity, requested_points,
  status, warehouse_profile_id, warehouse_decision_at, rejection_reason,
  delivery_location_text, delivery_lat, delivery_lng,
  requested_at, updated_at
)
values
  -- RR-01: requested — farmer1 wants biodiesel, pending warehouse
  ('30000000-0000-4000-8000-000000000001',
   '90000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000a001',
   1, 125, 'requested', null, null, null,
   'บ้านเลขที่ 12 ต.นาเฉลียง อ.หนองไผ่ จ.เพชรบูรณ์ 67220', 16.04905, 101.14966,
   now() - interval '2 hours', now() - interval '2 hours'),

  -- RR-02: approved + delivery_scheduled — farmer1 แผ่นคลุมดิน
  ('30000000-0000-4000-8000-000000000002',
   '90000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000a003',
   1, 25, 'warehouse_approved',
   '90000000-0000-4000-8000-000000000005',
   now() - interval '11 days', null,
   'บ้านเลขที่ 12 ต.นาเฉลียง อ.หนองไผ่ จ.เพชรบูรณ์ 67220', 16.04905, 101.14966,
   now() - interval '12 days', now() - interval '11 days'),

  -- RR-03: approved + out_for_delivery — farmer2 biodiesel
  ('30000000-0000-4000-8000-000000000003',
   '90000000-0000-4000-8000-000000000002',
   '00000000-0000-4000-8000-00000000a001',
   1, 125, 'warehouse_approved',
   '90000000-0000-4000-8000-000000000005',
   now() - interval '5 days 20 hours', null,
   '45 ถ.สุรนารี อ.เมือง จ.นครราชสีมา 30000', 14.97990, 102.09777,
   now() - interval '6 days', now() - interval '5 days 20 hours'),

  -- RR-04: approved + reward_delivered — farmer2 แผ่นคลุมดิน (complete)
  ('30000000-0000-4000-8000-000000000004',
   '90000000-0000-4000-8000-000000000002',
   '00000000-0000-4000-8000-00000000a003',
   1, 25, 'warehouse_approved',
   '90000000-0000-4000-8000-000000000005',
   now() - interval '5 days 22 hours', null,
   '45 ถ.สุรนารี อ.เมือง จ.นครราชสีมา 30000', 14.97990, 102.09777,
   now() - interval '6 days', now() - interval '5 days'),

  -- RR-05: warehouse_rejected — farmer1 solar (out of stock narrative)
  ('30000000-0000-4000-8000-000000000005',
   '90000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000a002',
   1, 625, 'warehouse_rejected',
   '90000000-0000-4000-8000-000000000005',
   now() - interval '5 days 10 hours',
   'ของรางวัลชิ้นนี้หมดสต็อกชั่วคราว กรุณายื่นคำขอใหม่เมื่อมีสต็อก',
   null, null, null,
   now() - interval '6 days', now() - interval '5 days 10 hours'),

  -- RR-06: cancelled — farmer2 cancelled before warehouse acted
  ('30000000-0000-4000-8000-000000000006',
   '90000000-0000-4000-8000-000000000002',
   '00000000-0000-4000-8000-00000000a004',
   1, 50, 'cancelled',
   null, null, null,
   null, null, null,
   now() - interval '3 days', now() - interval '3 days'),

  -- RR-07: requested — farmer2 second pending (น้ำมันไพโรไลซิส)
  ('30000000-0000-4000-8000-000000000007',
   '90000000-0000-4000-8000-000000000002',
   '00000000-0000-4000-8000-00000000a004',
   2, 100, 'requested', null, null, null,
   '45 ถ.สุรนารี อ.เมือง จ.นครราชสีมา 30000', 14.97990, 102.09777,
   now() - interval '1 hour', now() - interval '1 hour'),

  -- RR-08: approved + out_for_delivery — farmer1 biodiesel (different from RR-01)
  ('30000000-0000-4000-8000-000000000008',
   '90000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000a001',
   1, 125, 'warehouse_approved',
   '90000000-0000-4000-8000-000000000005',
   now() - interval '4 days', null,
   'บ้านเลขที่ 12 ต.นาเฉลียง อ.หนองไผ่ จ.เพชรบูรณ์ 67220', 16.04905, 101.14966,
   now() - interval '4 days 6 hours', now() - interval '4 days'),

  -- RR-09: approved + reward_delivered — farmer3 biodiesel (complete end-to-end)
  ('30000000-0000-4000-8000-000000000009',
   '90000000-0000-4000-8000-000000000009',
   '00000000-0000-4000-8000-00000000a001',
   1, 125, 'warehouse_approved',
   '90000000-0000-4000-8000-000000000005',
   now() - interval '4 days 6 hours', null,
   'ต.สันทราย อ.สันทราย จ.เชียงใหม่ 50210', 18.85100, 99.01800,
   now() - interval '4 days 12 hours', now() - interval '3 days 12 hours'),

  -- RR-10: approved + delivery_scheduled — farmer3 น้ำมันไพโรไลซิส
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
-- Reward delivery jobs — all 3 statuses
--   RDJ-02: reward_delivery_scheduled — farmer1 แผ่นคลุมดิน (RR-02)
--   RDJ-03: out_for_delivery — farmer2 biodiesel (RR-03)
--   RDJ-04: reward_delivered — farmer2 แผ่นคลุมดิน (RR-04)
--   RDJ-08: out_for_delivery — farmer1 biodiesel (RR-08)
--   RDJ-09: reward_delivered — farmer3 biodiesel (RR-09)
--   RDJ-10: reward_delivery_scheduled — farmer3 น้ำมันไพโรไลซิส (RR-10)
-- -----------------------------------------------------------------------
insert into public.reward_delivery_jobs (
  id, reward_request_id, logistics_profile_id,
  planned_delivery_at, delivery_window_end_at,
  out_for_delivery_at, delivered_at, status, created_at, updated_at
)
values
  -- RDJ-02: delivery_scheduled — farmer1 แผ่นคลุมดิน
  ('60000000-0000-4000-8000-000000000002',
   '30000000-0000-4000-8000-000000000002',
   '90000000-0000-4000-8000-000000000003',
   now() + interval '2 days', now() + interval '2 days 4 hours',
   null, null,
   'reward_delivery_scheduled',
   now() - interval '11 days', now() - interval '11 days'),

  -- RDJ-03: out_for_delivery — farmer2 biodiesel
  ('60000000-0000-4000-8000-000000000003',
   '30000000-0000-4000-8000-000000000003',
   '90000000-0000-4000-8000-000000000003',
   now() - interval '5 days', now() - interval '4 days 20 hours',
   now() - interval '3 hours', null,
   'out_for_delivery',
   now() - interval '5 days', now() - interval '3 hours'),

  -- RDJ-04: reward_delivered — farmer2 แผ่นคลุมดิน (complete)
  ('60000000-0000-4000-8000-000000000004',
   '30000000-0000-4000-8000-000000000004',
   '90000000-0000-4000-8000-000000000003',
   now() - interval '5 days', now() - interval '4 days 20 hours',
   now() - interval '5 days 2 hours', now() - interval '5 days',
   'reward_delivered',
   now() - interval '5 days', now() - interval '5 days'),

  -- RDJ-08: out_for_delivery — farmer1 biodiesel
  ('60000000-0000-4000-8000-000000000008',
   '30000000-0000-4000-8000-000000000008',
   '90000000-0000-4000-8000-000000000003',
   now() - interval '4 days', now() - interval '3 days 20 hours',
   now() - interval '5 hours', null,
   'out_for_delivery',
   now() - interval '4 days', now() - interval '5 hours'),

  -- RDJ-09: reward_delivered — farmer3 biodiesel (complete end-to-end)
  ('60000000-0000-4000-8000-000000000009',
   '30000000-0000-4000-8000-000000000009',
   '90000000-0000-4000-8000-000000000007',
   now() - interval '3 days 18 hours', now() - interval '3 days 14 hours',
   now() - interval '3 days 16 hours', now() - interval '3 days 12 hours',
   'reward_delivered',
   now() - interval '4 days', now() - interval '3 days 12 hours'),

  -- RDJ-10: reward_delivery_scheduled — farmer3 น้ำมันไพโรไลซิส
  ('60000000-0000-4000-8000-000000000010',
   '30000000-0000-4000-8000-000000000010',
   '90000000-0000-4000-8000-000000000007',
   now() + interval '1 day', now() + interval '1 day 4 hours',
   null, null,
   'reward_delivery_scheduled',
   now() - interval '22 hours', now() - interval '22 hours')

on conflict (id) do nothing;

-- =========================================================================
-- Demo D-06: pilot data for Minister presentation, 27 April 2568
-- Separate user accounts at @arex.local — full end-to-end showcase
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

  v_rdj1_id    uuid := 'ffffffff-d06f-0001-0000-000000000001';
begin
  select id into v_cmu_factory_id from factories
  where name_th ilike '%มช%' and is_focal_point = true limit 1;

  select id into v_biodiesel_id from rewards_catalog
  where name_th ilike '%ไบโอดีเซล%' limit 1;

  select id into v_solar_id from rewards_catalog
  where name_th ilike '%โซลาร์%' limit 1;

  if v_cmu_factory_id is null then
    raise notice 'D-06: CMU factory not found — skipping demo seed';
    return;
  end if;

  -- Auth users for D-06 (no encrypted_password means login via magic link only in prod;
  -- for local dev we set password 123456 via raw_app_meta_data trick is unsupported,
  -- so these accounts are profile-only for dashboard demo — log in as farmer@gmail.com instead)
  insert into auth.users (id, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  values
    (v_farmer1_id,   'demo_farmer1@arex.local',   now(), now(),
     jsonb_build_object('provider','email','providers',jsonb_build_array('email'),'role','farmer'),
     jsonb_build_object('display_name','สมชาย ใจดี','role','farmer'),
     'authenticated', 'authenticated'),
    (v_farmer2_id,   'demo_farmer2@arex.local',   now(), now(),
     jsonb_build_object('provider','email','providers',jsonb_build_array('email'),'role','farmer'),
     jsonb_build_object('display_name','สมหญิง มีสุข','role','farmer'),
     'authenticated', 'authenticated'),
    (v_farmer3_id,   'demo_farmer3@arex.local',   now(), now(),
     jsonb_build_object('provider','email','providers',jsonb_build_array('email'),'role','farmer'),
     jsonb_build_object('display_name','ประสิทธิ์ รักษ์โลก','role','farmer'),
     'authenticated', 'authenticated'),
    (v_logistics_id, 'demo_logistics@arex.local', now(), now(),
     jsonb_build_object('provider','email','providers',jsonb_build_array('email'),'role','logistics'),
     jsonb_build_object('display_name','WeMove พนักงาน','role','logistics'),
     'authenticated', 'authenticated'),
    (v_factory_id,   'demo_factory@arex.local',   now(), now(),
     jsonb_build_object('provider','email','providers',jsonb_build_array('email'),'role','factory'),
     jsonb_build_object('display_name','เจ้าหน้าที่ มช.','role','factory'),
     'authenticated', 'authenticated'),
    (v_warehouse_id, 'demo_warehouse@arex.local', now(), now(),
     jsonb_build_object('provider','email','providers',jsonb_build_array('email'),'role','warehouse'),
     jsonb_build_object('display_name','คลังสินค้า มช.','role','warehouse'),
     'authenticated', 'authenticated')
  on conflict (id) do nothing;

  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values
    (gen_random_uuid(), v_farmer1_id,   jsonb_build_object('sub',v_farmer1_id::text,  'email','demo_farmer1@arex.local'),   'email','demo_farmer1@arex.local',   now(),now(),now()),
    (gen_random_uuid(), v_farmer2_id,   jsonb_build_object('sub',v_farmer2_id::text,  'email','demo_farmer2@arex.local'),   'email','demo_farmer2@arex.local',   now(),now(),now()),
    (gen_random_uuid(), v_farmer3_id,   jsonb_build_object('sub',v_farmer3_id::text,  'email','demo_farmer3@arex.local'),   'email','demo_farmer3@arex.local',   now(),now(),now()),
    (gen_random_uuid(), v_logistics_id, jsonb_build_object('sub',v_logistics_id::text,'email','demo_logistics@arex.local'), 'email','demo_logistics@arex.local', now(),now(),now()),
    (gen_random_uuid(), v_factory_id,   jsonb_build_object('sub',v_factory_id::text,  'email','demo_factory@arex.local'),   'email','demo_factory@arex.local',   now(),now(),now()),
    (gen_random_uuid(), v_warehouse_id, jsonb_build_object('sub',v_warehouse_id::text,'email','demo_warehouse@arex.local'), 'email','demo_warehouse@arex.local', now(),now(),now());

  insert into profiles (id, role, display_name, phone, province)
  values
    (v_farmer1_id,   'farmer',    'สมชาย ใจดี',         '0812345601', 'เชียงใหม่'),
    (v_farmer2_id,   'farmer',    'สมหญิง มีสุข',        '0812345602', 'เชียงใหม่'),
    (v_farmer3_id,   'farmer',    'ประสิทธิ์ รักษ์โลก',  '0812345603', 'เชียงใหม่'),
    (v_logistics_id, 'logistics', 'WeMove พนักงาน',      '0812345610', 'เชียงใหม่'),
    (v_factory_id,   'factory',   'เจ้าหน้าที่ มช.',     '0812345620', 'เชียงใหม่'),
    (v_warehouse_id, 'warehouse', 'คลังสินค้า มช.',      '0812345630', 'เชียงใหม่')
  on conflict (id) do nothing;

  -- Logistics account for demo logistics user
  insert into public.logistics_accounts (logistics_profile_id, name_th, location_text, lat, lng, active)
  values (v_logistics_id, 'WeMove ทีมขนส่งเชียงใหม่', 'อ.เมือง จ.เชียงใหม่', 18.7885, 98.9853, true)
  on conflict (logistics_profile_id) do nothing;

  -- Material submissions (4 statuses for the demo)
  insert into material_submissions
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

  -- Pickup jobs
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
     now() - interval '1 day', now() - interval '20 hours',
     now() - interval '20 hours', null, null,
     'picked_up', now() - interval '1 day', now() - interval '20 hours')
  on conflict (id) do nothing;

  -- Factory intakes (sub1: 375 kg × 1.0 = 375 pts; sub2: 80 kg × 3.125 = 250 pts)
  insert into factory_intakes
    (id, pickup_job_id, factory_profile_id, measured_weight_kg, status, confirmed_at, created_at)
  values
    (v_intake1_id, v_pickup1_id, v_factory_id, 375.000, 'confirmed',
     now() - interval '2 days', now() - interval '2 days'),
    (v_intake2_id, v_pickup2_id, v_factory_id, 80.000,  'confirmed',
     now() - interval '1 day', now() - interval '1 day')
  on conflict (id) do nothing;

  insert into points_ledger
    (farmer_profile_id, entry_type, points_amount, reference_type, reference_id, note, created_at)
  values
    (v_farmer1_id, 'intake_credit', 375, 'factory_intake', v_intake1_id,
     'น้ำหนักจริง 375 กก. ที่ มช.', now() - interval '2 days'),
    (v_farmer2_id, 'intake_credit', 250, 'factory_intake', v_intake2_id,
     'น้ำหนักจริง 80 กก. × 3.125 pt/kg ที่ มช.', now() - interval '1 day')
  on conflict do nothing;

  -- Reward request: demo farmer1 redeems biodiesel (125 coins), fully delivered
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

    insert into reward_delivery_jobs
      (id, reward_request_id, logistics_profile_id,
       planned_delivery_at, delivery_window_end_at,
       out_for_delivery_at, delivered_at, status, created_at, updated_at)
    values
      (v_rdj1_id, v_rr1_id, v_logistics_id,
       now() - interval '1 day', now() - interval '20 hours',
       now() - interval '22 hours', now() - interval '18 hours',
       'reward_delivered', now() - interval '1 day', now() - interval '18 hours')
    on conflict (id) do nothing;

    update rewards_catalog
    set stock_qty  = greatest(stock_qty - 1, 0),
        updated_at = now()
    where id = v_biodiesel_id;
  end if;

  -- Reward request: demo farmer2 requests solar (250 pts, 625 needed — pending)
  if v_solar_id is not null then
    insert into reward_requests
      (id, farmer_profile_id, reward_id, quantity, requested_points,
       status, requested_at, updated_at)
    values
      (v_rr2_id, v_farmer2_id, v_solar_id, 1, 625,
       'requested', now() - interval '12 hours', now() - interval '12 hours')
    on conflict (id) do nothing;

    insert into points_ledger
      (farmer_profile_id, entry_type, points_amount, reference_type, reference_id, note, created_at)
    values
      (v_farmer2_id, 'reward_reserve', 625, 'reward_request', v_rr2_id,
       'จองแต้มแลกโซลาร์เซลล์', now() - interval '12 hours')
    on conflict do nothing;
  end if;

end $$;

-- ── Storage: reward-images bucket ─────────────────────────────────────────
-- Must be in seed (not migrations) because Supabase manages storage schema.
-- Recreated on every db:reset so the bucket is always available locally.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reward-images',
  'reward-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$ begin
  drop policy if exists "Public read reward images" on storage.objects;
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
