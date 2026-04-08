-- Optional seed helpers for AREX demo data.
-- Run after 0001_init_arex.sql.

-- NOTE:
-- profiles.id must match real auth.users.id values from Supabase Auth.
-- Fill profile IDs manually after creating Auth users.

-- Example reward catalog
insert into rewards_catalog (name_th, description_th, points_cost, stock_qty, active)
values
  ('ปุ๋ยอินทรีย์สูตรพรีเมียม', 'ขนาด 25 กก.', 1200, 100, true),
  ('ชุดกรรไกรตัดแต่งกิ่ง', 'อุปกรณ์พื้นฐานสำหรับสวน', 850, 50, true),
  ('เมล็ดพันธุ์ข้าว', 'เมล็ดพันธุ์คัดเกรด', 600, 200, true)
on conflict do nothing;

-- Example factories
insert into factories (name_th, location_text, active)
values
  ('โรงงานชีวมวลสระบุรี', 'จ.สระบุรี', true),
  ('โรงงานพลังงานชีวมวลเชียงใหม่', 'จ.เชียงใหม่', true)
on conflict do nothing;
