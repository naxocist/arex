-- Hotfix: move quantity units to Thai-friendly configurable master table.
-- Apply this after 0001-0005.

create table if not exists measurement_units (
  code text primary key,
  name_th text not null,
  to_kg_factor numeric(14, 6),
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_measurement_units_to_kg_factor_positive
    check (to_kg_factor is null or to_kg_factor > 0)
);

insert into measurement_units (code, name_th, to_kg_factor, sort_order, active)
values
  ('กิโลกรัม', 'กิโลกรัม', 1.000000, 10, true),
  ('ตัน', 'ตัน', 1000.000000, 20, true),
  ('ลูกบาศก์เมตร', 'ลูกบาศก์เมตร', null, 30, true)
on conflict (code) do update
set name_th = excluded.name_th,
    to_kg_factor = excluded.to_kg_factor,
    sort_order = excluded.sort_order,
    active = excluded.active,
    updated_at = now();

alter table if exists material_submissions
  drop constraint if exists material_submissions_quantity_unit_check;

alter table if exists material_submissions
  drop constraint if exists fk_material_submissions_quantity_unit;

update material_submissions
set quantity_unit = case
  when quantity_unit = 'kg' then 'กิโลกรัม'
  when quantity_unit = 'ton' then 'ตัน'
  when quantity_unit = 'm3' then 'ลูกบาศก์เมตร'
  else quantity_unit
end;

-- Preserve any existing custom unit values as configurable rows.
insert into measurement_units (code, name_th, to_kg_factor, sort_order, active)
select distinct ms.quantity_unit, ms.quantity_unit, null::numeric(14, 6), 999, true
from material_submissions ms
where ms.quantity_unit is not null
  and not exists (
    select 1
    from measurement_units mu
    where mu.code = ms.quantity_unit
  );

alter table if exists material_submissions
  add constraint fk_material_submissions_quantity_unit
  foreign key (quantity_unit)
  references measurement_units(code)
  on update cascade
  on delete restrict;

drop trigger if exists trg_measurement_units_updated_at on measurement_units;
create trigger trg_measurement_units_updated_at
before update on measurement_units
for each row execute function set_updated_at();
