-- Hotfix: move material types to configurable master table.
-- Apply this after initial schema plus measurement unit updates.

create table if not exists material_types (
  code text primary key,
  name_th text not null,
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into material_types (code, name_th, sort_order, active)
values
  ('rice_straw', 'ฟางข้าว', 10, true),
  ('cassava_root', 'เหง้ามันสำปะหลัง', 20, true),
  ('sugarcane_bagasse', 'ชานอ้อย', 30, true),
  ('corn_stover', 'ตอซังข้าวโพด', 40, true)
on conflict (code) do update
set name_th = excluded.name_th,
    sort_order = excluded.sort_order,
    active = excluded.active,
    updated_at = now();

-- Preserve any existing material_type values as configurable rows.
insert into material_types (code, name_th, sort_order, active)
select distinct ms.material_type, ms.material_type, 999, true
from material_submissions ms
where ms.material_type is not null
  and not exists (
    select 1
    from material_types mt
    where mt.code = ms.material_type
  );

insert into material_types (code, name_th, sort_order, active)
select distinct mpr.material_type, mpr.material_type, 999, true
from material_point_rules mpr
where mpr.material_type is not null
  and not exists (
    select 1
    from material_types mt
    where mt.code = mpr.material_type
  );

alter table if exists material_submissions
  drop constraint if exists fk_material_submissions_material_type;

alter table if exists material_submissions
  add constraint fk_material_submissions_material_type
  foreign key (material_type)
  references material_types(code)
  on update cascade
  on delete restrict;

alter table if exists material_point_rules
  drop constraint if exists fk_material_point_rules_material_type;

alter table if exists material_point_rules
  add constraint fk_material_point_rules_material_type
  foreign key (material_type)
  references material_types(code)
  on update cascade
  on delete restrict;

drop trigger if exists trg_material_types_updated_at on material_types;
create trigger trg_material_types_updated_at
before update on material_types
for each row execute function set_updated_at();
