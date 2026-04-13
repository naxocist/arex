-- Deterministic local seed for AREX using Supabase CLI.
-- Applied by `supabase seed` and by `supabase db reset`.

begin;

-- Use stable UUIDs so demo data remains predictable across resets.
with demo_users as (
  select *
  from (
    values
      ('90000000-0000-4000-8000-000000000001'::uuid, 'farmer@gmail.com', 'farmer', 'สมชาย เกษตรกร', '0810001001', 'เพชรบูรณ์'),
      ('90000000-0000-4000-8000-000000000002'::uuid, 'farmer2@gmail.com', 'farmer', 'สมหญิง เกษตรกร', '0810001002', 'นครราชสีมา'),
      ('90000000-0000-4000-8000-000000000003'::uuid, 'logistics@gmail.com', 'logistics', 'เอกชัย ขนส่ง', '0810002001', 'สระบุรี'),
      ('90000000-0000-4000-8000-000000000004'::uuid, 'factory@gmail.com', 'factory', 'วรินทร์ โรงงาน', '0810003001', 'สระบุรี'),
      ('90000000-0000-4000-8000-000000000007'::uuid, 'logistics2@gmail.com', 'logistics', 'ปิติ ขนส่ง', '0810002002', 'ลพบุรี'),
      ('90000000-0000-4000-8000-000000000008'::uuid, 'factory2@gmail.com', 'factory', 'กิตติ โรงงาน', '0810003002', 'ชัยนาท'),
      ('90000000-0000-4000-8000-000000000005'::uuid, 'warehouse@gmail.com', 'warehouse', 'มานพ คลังสินค้า', '0810004001', 'ปทุมธานี'),
      ('90000000-0000-4000-8000-000000000006'::uuid, 'executive@gmail.com', 'executive', 'ผู้บริหาร AREX', '0810005001', 'กรุงเทพมหานคร')
  ) as t(id, email, role, display_name, phone, province)
)
delete from auth.identities i
using auth.users u, demo_users d
where i.user_id = u.id
  and u.id = d.id;

with demo_users as (
  select *
  from (
    values
      ('90000000-0000-4000-8000-000000000001'::uuid),
      ('90000000-0000-4000-8000-000000000002'::uuid),
      ('90000000-0000-4000-8000-000000000003'::uuid),
      ('90000000-0000-4000-8000-000000000004'::uuid),
      ('90000000-0000-4000-8000-000000000007'::uuid),
      ('90000000-0000-4000-8000-000000000008'::uuid),
      ('90000000-0000-4000-8000-000000000005'::uuid),
      ('90000000-0000-4000-8000-000000000006'::uuid)
  ) as t(id)
)
delete from auth.users u
using demo_users d
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
-- Auth users (password 123456 for all)
-- -----------------------------------------------------------------------
with demo_users as (
  select *
  from (
    values
      ('90000000-0000-4000-8000-000000000001'::uuid, 'farmer@gmail.com', 'farmer', 'สมชาย เกษตรกร', '0810001001', 'เพชรบูรณ์'),
      ('90000000-0000-4000-8000-000000000002'::uuid, 'farmer2@gmail.com', 'farmer', 'สมหญิง เกษตรกร', '0810001002', 'นครราชสีมา'),
      ('90000000-0000-4000-8000-000000000003'::uuid, 'logistics@gmail.com', 'logistics', 'เอกชัย ขนส่ง', '0810002001', 'สระบุรี'),
      ('90000000-0000-4000-8000-000000000004'::uuid, 'factory@gmail.com', 'factory', 'วรินทร์ โรงงาน', '0810003001', 'สระบุรี'),
      ('90000000-0000-4000-8000-000000000007'::uuid, 'logistics2@gmail.com', 'logistics', 'ปิติ ขนส่ง', '0810002002', 'ลพบุรี'),
      ('90000000-0000-4000-8000-000000000008'::uuid, 'factory2@gmail.com', 'factory', 'กิตติ โรงงาน', '0810003002', 'ชัยนาท'),
      ('90000000-0000-4000-8000-000000000005'::uuid, 'warehouse@gmail.com', 'warehouse', 'มานพ คลังสินค้า', '0810004001', 'ปทุมธานี'),
      ('90000000-0000-4000-8000-000000000006'::uuid, 'executive@gmail.com', 'executive', 'ผู้บริหาร AREX', '0810005001', 'กรุงเทพมหานคร')
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
  ('90000000-0000-4000-8000-000000000001', 'farmer',    'สมชาย เกษตรกร',   '0810001001', 'เพชรบูรณ์'),
  ('90000000-0000-4000-8000-000000000002', 'farmer',    'สมหญิง เกษตรกร',  '0810001002', 'นครราชสีมา'),
  ('90000000-0000-4000-8000-000000000003', 'logistics', 'เอกชัย ขนส่ง',    '0810002001', 'สระบุรี'),
  ('90000000-0000-4000-8000-000000000004', 'factory',   'วรินทร์ โรงงาน',  '0810003001', 'สระบุรี'),
  ('90000000-0000-4000-8000-000000000007', 'logistics', 'ปิติ ขนส่ง',      '0810002002', 'ลพบุรี'),
  ('90000000-0000-4000-8000-000000000008', 'factory',   'กิตติ โรงงาน',    '0810003002', 'ชัยนาท'),
  ('90000000-0000-4000-8000-000000000005', 'warehouse', 'มานพ คลังสินค้า', '0810004001', 'ปทุมธานี'),
  ('90000000-0000-4000-8000-000000000006', 'executive', 'ผู้บริหาร AREX',  '0810005001', 'กรุงเทพมหานคร');

-- -----------------------------------------------------------------------
-- Material types
-- Source: AREX Product Changes.pdf — all groups
-- -----------------------------------------------------------------------
insert into public.material_types (code, name_th, active)
values
  ('rice_straw',       'ฟางข้าว',              true),
  ('cassava_root',     'เหง้ามันสำปะหลัง',     true),
  ('sugarcane_bagasse','ชานอ้อย',               true),
  ('corn_stover',      'ตอซังข้าวโพด',          true),
  ('orchard_residue',  'เศษเหลือทิ้งจากสวน',   true),
  ('plastic_waste',    'ขยะพลาสติก',            true)
on conflict (code) do update
set name_th    = excluded.name_th,
    active     = excluded.active,
    updated_at = now();

-- -----------------------------------------------------------------------
-- Measurement units
-- -----------------------------------------------------------------------
insert into public.measurement_units (code, name_th, to_kg_factor, active)
values
  ('กิโลกรัม',     'กิโลกรัม',     1.000000,  true),
  ('ตัน',          'ตัน',          1000.000000, true),
  ('ก้อน',         'ก้อน (ฟาง)',   12.500000,  true)
on conflict (code) do update
set name_th      = excluded.name_th,
    to_kg_factor = excluded.to_kg_factor,
    active       = excluded.active,
    updated_at   = now();

-- -----------------------------------------------------------------------
-- Point rules (coins per kg)
-- Derived from PDF section 2 exchange tables:
--   rice_straw:       1.000 pt/kg  (10 ก้อน×12.5 kg=125 kg → 125 pts = ไบโอดีเซล)
--   orchard_residue:  3.125 pt/kg  (200 kg → 625 pts = โซลาร์)
--   plastic_waste:   12.500 pt/kg  ( 50 kg → 625 pts = โซลาร์)
--   others: 1.0 pt/kg default
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
-- Source: AREX Product Changes.pdf sections 1 & 2
--   ไบโอดีเซล 10L   = 125 pts  (ฟาง 10 ก้อน = 125 kg × 1.0)
--   โซลาร์ 1 แผง    = 625 pts  (ฟาง 50 ก้อน / เศษสวน 200 kg / พลาสติก 50 kg)
--   แผ่นคลุมดิน     =  25 pts  (ฟาง 2 ก้อน = 25 kg × 1.0)
--   น้ำมันไพโรไลซิส  =  50 pts  (เศษสวน ~16 kg × 3.125 / พลาสติก 4 kg × 12.5)
--     PDF "น้ำมัน" for ชาวสวน/ชุมชน = น้ำมันไพโรไลซิส (different product from biodiesel)
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
   'ทีมขนส่ง AREX - สระบุรี', 'จ.สระบุรี', 14.528915, 100.910142, true)
on conflict (id) do update
set name_th       = excluded.name_th,
    location_text = excluded.location_text,
    lat           = excluded.lat,
    lng           = excluded.lng,
    active        = excluded.active;

-- -----------------------------------------------------------------------
-- Value chain mappings (PDF section 4.2)
-- -----------------------------------------------------------------------
insert into public.value_chain_mappings (product_name_th, producer_org, buyer_org, buyer_use_th, active)
values
  ('เยื่อชีวมวล (Bio-pulp)',  'มช. / มก.',      'บริษัท Precise', 'ทำไม้เทียม',    true),
  ('ถ่านชีวภาพ / ไบโอชาร์',  'มช. / วว. / มก.', 'กลุ่มโรงงาน',   'ใช้ใน Boiler',  true),
  ('น้ำมันไพโรไลซิส',         'มช. / วว.',       'วิสาหกิจชุมชน', 'พลังงานชุมชน',  true)
on conflict do nothing;

-- -----------------------------------------------------------------------
-- Base demo data — covers every status in every flow
-- -----------------------------------------------------------------------

-- ── Material submissions ──────────────────────────────────────────────
-- Sub 01: submitted — waiting for logistics to schedule
-- Sub 02: pickup_scheduled — logistics has assigned a job, waiting pickup
-- Sub 03: picked_up — logistics picked it up, not yet delivered
-- Sub 04: delivered_to_factory — delivered, factory not yet confirmed
-- Sub 05: factory_confirmed — factory weighed, points not yet credited (edge case)
-- Sub 06: points_credited — full flow complete
-- Sub 07: cancelled — by farmer before pickup
insert into public.material_submissions (
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
   now() - interval '10 days', now() - interval '8 days'),
  ('10000000-0000-4000-8000-000000000007',
   '90000000-0000-4000-8000-000000000002',
   'sugarcane_bagasse', 150.0, 'กิโลกรัม',
   'อ.เมือง จ.นครราชสีมา', 14.97990, 102.09777,
   null, 'cancelled',
   now() - interval '6 days', now() - interval '6 days')
on conflict (id) do nothing;

-- ── Pickup jobs ───────────────────────────────────────────────────────
-- Job 02: pickup_scheduled (linked to sub 02)
-- Job 03: picked_up (linked to sub 03)
-- Job 04: delivered_to_factory (linked to sub 04)
-- Job 05: factory_confirmed (linked to sub 05)
-- Job 06: factory_confirmed (linked to sub 06, points credited)
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
   now() - interval '10 days', now() - interval '9 days 20 hours',
   now() - interval '9 days 22 hours', now() - interval '9 days 12 hours', now() - interval '8 days',
   'factory_confirmed', null,
   now() - interval '10 days', now() - interval '8 days')
on conflict (id) do nothing;

-- ── Factory intakes ───────────────────────────────────────────────────
-- Intake 05: plastic_waste 50 kg × 12.5 pt/kg = 625 pts (factory_confirmed, not yet credited)
-- Intake 06: rice_straw 1000 kg × 1.0 pt/kg = 1000 pts (points_credited)
insert into public.factory_intakes (
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
   now() - interval '8 days', now() - interval '8 days')
on conflict (id) do nothing;

-- ── Points ledger ─────────────────────────────────────────────────────
-- farmer1: 1000 pts from rice_straw (sub 06)
-- farmer2: 625 pts from plastic_waste (sub 05, factory_confirmed but points not auto-seeded
--          so we credit it directly for demo realism)
insert into public.points_ledger (id, farmer_profile_id, entry_type, points_amount, reference_type, reference_id, note, created_at)
values
  ('50000000-0000-4000-8000-000000000001',
   '90000000-0000-4000-8000-000000000001',
   'intake_credit', 1000, 'factory_intake', '40000000-0000-4000-8000-000000000006',
   'น้ำหนักจริง 1,000 กก. × 1.0 pt/kg', now() - interval '8 days'),
  ('50000000-0000-4000-8000-000000000002',
   '90000000-0000-4000-8000-000000000002',
   'intake_credit', 625, 'factory_intake', '40000000-0000-4000-8000-000000000005',
   'น้ำหนักจริง 50 กก. × 12.5 pt/kg', now() - interval '6 days')
on conflict (id) do nothing;

-- ── Reward requests ───────────────────────────────────────────────────
-- RR 01: requested — farmer1 wants biodiesel, pending warehouse
-- RR 02: warehouse_approved, delivery scheduled — farmer1 second request (แผ่นคลุมดิน)
-- RR 03: warehouse_approved, out_for_delivery — farmer2 (biodiesel)
-- RR 04: warehouse_approved, delivered — farmer2 (แผ่นคลุมดิน), complete flow
-- RR 05: warehouse_rejected — farmer1 (solar, not enough stock narrative)
-- RR 06: cancelled — farmer2 (cancelled before warehouse acted)
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
   now() - interval '5 hours', now() - interval '5 hours'),
  ('30000000-0000-4000-8000-000000000002',
   '90000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000a003',
   1, 25, 'warehouse_approved',
   '90000000-0000-4000-8000-000000000005',
   now() - interval '7 days 22 hours', null,
   'บ้านเลขที่ 12 ต.นาเฉลียง อ.หนองไผ่ จ.เพชรบูรณ์ 67220', 16.04905, 101.14966,
   now() - interval '8 days', now() - interval '7 days 22 hours'),
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
   now() - interval '9 days 20 hours', null,
   '45 ถ.สุรนารี อ.เมือง จ.นครราชสีมา 30000', 14.97990, 102.09777,
   now() - interval '10 days', now() - interval '9 days 20 hours'),
  ('30000000-0000-4000-8000-000000000005',
   '90000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-00000000a002',
   1, 625, 'warehouse_rejected',
   '90000000-0000-4000-8000-000000000005',
   now() - interval '3 days 10 hours',
   'ของรางวัลชิ้นนี้หมดสต็อกชั่วคราว กรุณายื่นคำขอใหม่เมื่อมีสต็อก',
   null, null, null,
   now() - interval '4 days', now() - interval '3 days 10 hours'),
  ('30000000-0000-4000-8000-000000000006',
   '90000000-0000-4000-8000-000000000002',
   '00000000-0000-4000-8000-00000000a004',
   1, 50, 'cancelled',
   null, null, null,
   null, null, null,
   now() - interval '2 days', now() - interval '2 days')
on conflict (id) do nothing;

-- ── Points reserved/spent for reward requests ─────────────────────────
-- RR 02: reserve only (approved, delivery scheduled, not yet delivered)
-- RR 03: reserve only (approved, out for delivery)
-- RR 04: reserve + spend (delivered)
-- RR 05: reserve + release (rejected)
insert into public.points_ledger (id, farmer_profile_id, entry_type, points_amount, reference_type, reference_id, note, created_at)
values
  ('50000000-0000-4000-8000-000000000010',
   '90000000-0000-4000-8000-000000000001',
   'reward_reserve', 25, 'reward_request', '30000000-0000-4000-8000-000000000002',
   'จองแต้มแลกแผ่นคลุมดิน', now() - interval '8 days'),
  ('50000000-0000-4000-8000-000000000011',
   '90000000-0000-4000-8000-000000000002',
   'reward_reserve', 125, 'reward_request', '30000000-0000-4000-8000-000000000003',
   'จองแต้มแลกไบโอดีเซล', now() - interval '6 days'),
  ('50000000-0000-4000-8000-000000000012',
   '90000000-0000-4000-8000-000000000002',
   'reward_reserve', 25, 'reward_request', '30000000-0000-4000-8000-000000000004',
   'จองแต้มแลกแผ่นคลุมดิน', now() - interval '10 days'),
  ('50000000-0000-4000-8000-000000000013',
   '90000000-0000-4000-8000-000000000002',
   'reward_spend', 25, 'reward_request', '30000000-0000-4000-8000-000000000004',
   'แลกแผ่นคลุมดิน สำเร็จ', now() - interval '9 days'),
  ('50000000-0000-4000-8000-000000000014',
   '90000000-0000-4000-8000-000000000001',
   'reward_reserve', 625, 'reward_request', '30000000-0000-4000-8000-000000000005',
   'จองแต้มแลกโซลาร์เซลล์', now() - interval '4 days'),
  ('50000000-0000-4000-8000-000000000015',
   '90000000-0000-4000-8000-000000000001',
   'reward_release', 625, 'reward_request', '30000000-0000-4000-8000-000000000005',
   'คืนแต้ม — คำขอโซลาร์ถูกปฏิเสธ', now() - interval '3 days 10 hours')
on conflict (id) do nothing;

-- ── Reward delivery jobs ──────────────────────────────────────────────
-- RDJ 02: reward_delivery_scheduled — logistics assigned, waiting pickup
-- RDJ 03: out_for_delivery — en route to farmer2
-- RDJ 04: reward_delivered — completed delivery to farmer2
insert into public.reward_delivery_jobs (
  id, reward_request_id, logistics_profile_id,
  planned_delivery_at, delivery_window_end_at,
  out_for_delivery_at, delivered_at, status, created_at, updated_at
)
values
  ('60000000-0000-4000-8000-000000000002',
   '30000000-0000-4000-8000-000000000002',
   '90000000-0000-4000-8000-000000000003',
   now() + interval '1 day', now() + interval '1 day 4 hours',
   null, null,
   'reward_delivery_scheduled',
   now() - interval '7 days 20 hours', now() - interval '7 days 20 hours'),
  ('60000000-0000-4000-8000-000000000003',
   '30000000-0000-4000-8000-000000000003',
   '90000000-0000-4000-8000-000000000003',
   now() - interval '5 days', now() - interval '4 days 20 hours',
   now() - interval '5 hours', null,
   'out_for_delivery',
   now() - interval '5 days', now() - interval '5 hours'),
  ('60000000-0000-4000-8000-000000000004',
   '30000000-0000-4000-8000-000000000004',
   '90000000-0000-4000-8000-000000000003',
   now() - interval '9 days', now() - interval '8 days 20 hours',
   now() - interval '9 days 2 hours', now() - interval '9 days',
   'reward_delivered',
   now() - interval '9 days', now() - interval '9 days')
on conflict (id) do nothing;

-- -----------------------------------------------------------------------
-- Demo D-06: pilot data for Minister presentation, 27 April 2568
-- End-to-end: farmer submits → logistics picks up → CMU confirms → points credited → reward redeemed
-- -----------------------------------------------------------------------
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

  -- Auth users for D-06 demo accounts
  insert into auth.users (id, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
  values
    (v_farmer1_id,   'demo_farmer1@arex.local',   now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
    (v_farmer2_id,   'demo_farmer2@arex.local',   now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
    (v_farmer3_id,   'demo_farmer3@arex.local',   now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
    (v_logistics_id, 'demo_logistics@arex.local', now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
    (v_factory_id,   'demo_factory@arex.local',   now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
    (v_warehouse_id, 'demo_warehouse@arex.local', now(), now(), '{}', '{}', 'authenticated', 'authenticated')
  on conflict (id) do nothing;

  insert into profiles (id, role, display_name, phone, province)
  values
    (v_farmer1_id,   'farmer',    'สมชาย ใจดี',          '0812345601', 'เชียงใหม่'),
    (v_farmer2_id,   'farmer',    'สมหญิง มีสุข',         '0812345602', 'เชียงใหม่'),
    (v_farmer3_id,   'farmer',    'ประสิทธิ์ รักษ์โลก',   '0812345603', 'เชียงใหม่'),
    (v_logistics_id, 'logistics', 'WeMove พนักงาน',       '0812345610', 'เชียงใหม่'),
    (v_factory_id,   'factory',   'เจ้าหน้าที่ มช.',      '0812345620', 'เชียงใหม่'),
    (v_warehouse_id, 'warehouse', 'คลังสินค้า มช.',       '0812345630', 'เชียงใหม่')
  on conflict (id) do nothing;

  -- Logistics account for demo logistics user
  insert into public.logistics_accounts (logistics_profile_id, name_th, location_text, lat, lng, active)
  values (v_logistics_id, 'WeMove ทีมขนส่งเชียงใหม่', 'อ.เมือง จ.เชียงใหม่', 18.7885, 98.9853, true)
  on conflict (logistics_profile_id) do nothing;

  -- Material submissions
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

  -- Factory intakes
  -- sub1: 30 ก้อน × 12.5 kg = 375 kg × 1.0 pt/kg = 375 coins
  -- sub2: 80 kg × 3.125 pt/kg = 250 coins
  insert into factory_intakes
    (id, pickup_job_id, factory_profile_id, measured_weight_kg, status, confirmed_at, created_at)
  values
    (v_intake1_id, v_pickup1_id, v_factory_id, 375.000, 'confirmed',
     now() - interval '2 days', now() - interval '2 days'),
    (v_intake2_id, v_pickup2_id, v_factory_id, 80.000, 'confirmed',
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

  -- Reward request: farmer1 redeems biodiesel (125 coins), fully delivered
  if v_biodiesel_id is not null then
    insert into reward_requests
      (id, farmer_profile_id, reward_id, quantity, requested_points,
       status, warehouse_profile_id, warehouse_decision_at, requested_at, updated_at)
    values
      (v_rr1_id, v_farmer1_id, v_biodiesel_id, 1, 125,
       'warehouse_approved', v_warehouse_id, now() - interval '1 day 18 hours',
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

  -- Reward request: farmer2 requests solar (250 pts credited, 625 needed — pending)
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

commit;
