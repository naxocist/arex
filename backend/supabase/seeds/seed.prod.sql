-- Production seed for AREX.
--
-- Run ONCE after first migration push to production.
-- Sets up reference data and the initial admin account.
--
-- What this includes:
--   ✓ Reference data  (material types, units, point rules, rewards catalog, value chain)
--   ✓ Storage bucket + RLS policies for reward images
--   ✓ Initial accounts: admin, executive, warehouse (roles that can't self-register)
--
-- What this does NOT include:
--   ✗ Demo / test users of any kind
--   ✗ Factories or logistics accounts  (admin links these through the UI)
--   ✗ TRUNCATE — never wipes existing data
--
-- Safe to re-run: every INSERT uses ON CONFLICT DO UPDATE or DO NOTHING.
-- The admin account insert is skipped if the email already exists.

begin;

-- -----------------------------------------------------------------------
-- Initial accounts (admin + executive)
-- -----------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select *
    from (values
      ('cccccccc-0000-4000-8000-000000000001'::uuid, 'admin@arex.com',     'admin',     'AREX Admin',      'Arex2026!'),
      ('cccccccc-0000-4000-8000-000000000002'::uuid, 'executive@arex.com', 'executive', 'AREX Executive',  'Arex2026!'),
      ('cccccccc-0000-4000-8000-000000000003'::uuid, 'warehouse@arex.com', 'warehouse', 'AREX Warehouse',  'Arex2026!')
    ) as t(id, email, role, display_name, password)
  loop
    if exists (select 1 from auth.users where email = r.email or id = r.id) then
      raise notice 'Account % already exists, skipping.', r.email;
      continue;
    end if;

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, confirmation_token, recovery_token,
      email_change_token_new, email_change, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      r.id, 'authenticated', 'authenticated', r.email,
      crypt(r.password, gen_salt('bf')), now(),
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

    insert into public.profiles (id, role, display_name, phone, province)
    values (r.id, r.role, r.display_name, '', 'กรุงเทพมหานคร')
    on conflict (id) do nothing;

    raise notice 'Account created: % (%)', r.email, r.role;
  end loop;
end $$;

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
  ('กิโลกรัม', 'กิโลกรัม',    1.000000,    true),
  ('ตัน',      'ตัน',         1000.000000, true),
  ('ก้อน',     'ก้อน (ฟาง)',  12.500000,   true)
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
-- Value chain mappings
-- -----------------------------------------------------------------------
insert into public.value_chain_mappings (product_name_th, producer_org, buyer_org, buyer_use_th, active)
values
  ('เยื่อชีวมวล (Bio-pulp)',  'มช. / มก.',       'บริษัท Precise', 'ทำไม้เทียม',   true),
  ('ถ่านชีวภาพ / ไบโอชาร์',  'มช. / วว. / มก.', 'กลุ่มโรงงาน',   'ใช้ใน Boiler', true),
  ('น้ำมันไพโรไลซิส',          'มช. / วว.',       'วิสาหกิจชุมชน', 'พลังงานชุมชน', true)
on conflict do nothing;

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
