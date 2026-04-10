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
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    email_change_token_current,
    phone_change,
    phone_change_token,
    reauthentication_token,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at
  )
  select
    '00000000-0000-0000-0000-000000000000'::uuid,
    d.id,
    'authenticated',
    'authenticated',
    d.email,
    crypt('123456', gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', d.role),
    jsonb_build_object('display_name', d.display_name, 'role', d.role),
    false,
    now(),
    now()
  from demo_users d
  returning id, email
)
insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email',
  u.email,
  now(),
  now(),
  now()
from inserted_users u;

insert into public.profiles (id, role, display_name, phone, province)
values
  ('90000000-0000-4000-8000-000000000001', 'farmer', 'สมชาย เกษตรกร', '0810001001', 'เพชรบูรณ์'),
  ('90000000-0000-4000-8000-000000000002', 'farmer', 'สมหญิง เกษตรกร', '0810001002', 'นครราชสีมา'),
  ('90000000-0000-4000-8000-000000000003', 'logistics', 'เอกชัย ขนส่ง', '0810002001', 'สระบุรี'),
  ('90000000-0000-4000-8000-000000000004', 'factory', 'วรินทร์ โรงงาน', '0810003001', 'สระบุรี'),
  ('90000000-0000-4000-8000-000000000007', 'logistics', 'ปิติ ขนส่ง', '0810002002', 'ลพบุรี'),
  ('90000000-0000-4000-8000-000000000008', 'factory', 'กิตติ โรงงาน', '0810003002', 'ชัยนาท'),
  ('90000000-0000-4000-8000-000000000005', 'warehouse', 'มานพ คลังสินค้า', '0810004001', 'ปทุมธานี'),
  ('90000000-0000-4000-8000-000000000006', 'executive', 'ผู้บริหาร AREX', '0810005001', 'กรุงเทพมหานคร');

insert into public.material_types (code, name_th, active)
values
  ('rice_straw', 'ฟางข้าว', true),
  ('cassava_root', 'เหง้ามันสำปะหลัง', true),
  ('sugarcane_bagasse', 'ชานอ้อย', true),
  ('corn_stover', 'ตอซังข้าวโพด', true)
on conflict (code) do update
set name_th = excluded.name_th,
    active = excluded.active,
    updated_at = now();

insert into public.measurement_units (code, name_th, to_kg_factor, active)
values
  ('กิโลกรัม', 'กิโลกรัม', 1.000000, true),
  ('ตัน', 'ตัน', 1000.000000, true),
  ('ลูกบาศก์เมตร', 'ลูกบาศก์เมตร', null, true)
on conflict (code) do update
set name_th = excluded.name_th,
    to_kg_factor = excluded.to_kg_factor,
    active = excluded.active,
    updated_at = now();

insert into public.material_point_rules (material_type, points_per_kg)
values
  ('rice_straw', 1.20),
  ('cassava_root', 1.10),
  ('sugarcane_bagasse', 0.95),
  ('corn_stover', 1.00)
on conflict (material_type) do update
set points_per_kg = excluded.points_per_kg,
    updated_at = now();

insert into public.rewards_catalog (id, name_th, description_th, points_cost, stock_qty, active)
values
  ('00000000-0000-4000-8000-00000000a001', 'ปุ๋ยอินทรีย์', 'ขนาด 25 กก.', 1200, 500, true),
  ('00000000-0000-4000-8000-00000000a002', 'เมล็ดพันธุ์ข้าว', 'เมล็ดพันธุ์คัดเกรด', 600, 800, true)
on conflict (id) do update
set name_th = excluded.name_th,
    description_th = excluded.description_th,
    points_cost = excluded.points_cost,
    stock_qty = excluded.stock_qty,
    active = excluded.active,
    updated_at = now();

insert into public.factories (id, factory_profile_id, name_th, location_text, lat, lng, active)
values
  ('00000000-0000-4000-8000-00000000f001', '90000000-0000-4000-8000-000000000004', 'โรงงานชีวมวล AREX - สระบุรี', 'จ.สระบุรี', 14.528915, 100.910142, true),
  ('00000000-0000-4000-8000-00000000f002', '90000000-0000-4000-8000-000000000008', 'โรงงานชีวมวล AREX - ชัยนาท', 'จ.ชัยนาท', 15.186197, 100.125125, true);

insert into public.material_submissions (
  id,
  farmer_profile_id,
  material_type,
  quantity_value,
  quantity_unit,
  pickup_location_text,
  pickup_lat,
  pickup_lng,
  notes,
  status,
  created_at,
  updated_at
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000001',
    'rice_straw',
    10.0,
    'ตัน',
    'ต.นาเฉลียง อ.หนองไผ่ จ.เพชรบูรณ์',
    16.04905,
    101.14966,
    'seed: submitted #1',
    'submitted',
    now() - interval '72 hours',
    now() - interval '72 hours'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '90000000-0000-4000-8000-000000000001',
    'cassava_root',
    7.5,
    'ตัน',
    'อ.เมือง จ.นครราชสีมา',
    14.97990,
    102.09777,
    'seed: pickup_scheduled',
    'pickup_scheduled',
    now() - interval '48 hours',
    now() - interval '24 hours'
  );

insert into public.pickup_jobs (
  id,
  submission_id,
  logistics_profile_id,
  destination_factory_id,
  planned_pickup_at,
  pickup_window_end_at,
  status,
  notes,
  created_at,
  updated_at
)
values
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '90000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-00000000f001',
    now() + interval '6 hours',
    now() + interval '10 hours',
    'pickup_scheduled',
    'seed pickup scheduled',
    now() - interval '24 hours',
    now() - interval '24 hours'
  );

insert into public.points_ledger (
  id,
  farmer_profile_id,
  entry_type,
  points_amount,
  reference_type,
  note,
  created_at
)
values
  ('50000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'adjustment', 5000, 'seed', 'seed initial points', now() - interval '72 hours'),
  ('50000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000002', 'adjustment', 3500, 'seed', 'seed initial points', now() - interval '72 hours');

insert into public.reward_requests (
  id,
  farmer_profile_id,
  reward_id,
  quantity,
  requested_points,
  status,
  warehouse_profile_id,
  warehouse_decision_at,
  requested_at,
  updated_at
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-00000000a001',
    1,
    1200,
    'requested',
    null,
    null,
    now() - interval '6 hours',
    now() - interval '6 hours'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '90000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-00000000a002',
    1,
    600,
    'warehouse_approved',
    '90000000-0000-4000-8000-000000000005',
    now() - interval '5 hours',
    now() - interval '8 hours',
    now() - interval '5 hours'
  );

commit;
