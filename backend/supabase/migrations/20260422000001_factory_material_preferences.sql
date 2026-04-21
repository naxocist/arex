create table if not exists factory_material_preferences (
  factory_id          uuid    not null references org_accounts(id) on delete cascade,
  material_type_code  text    not null references material_types(code) on delete cascade,
  accepts             boolean not null default true,
  capacity_value      numeric(12,3),
  capacity_unit       text    references measurement_units(code),
  updated_at          timestamptz not null default now(),
  primary key (factory_id, material_type_code)
);

alter table factory_material_preferences enable row level security;

create policy "factory_own_read" on factory_material_preferences
  for select using (
    factory_id = (select id from org_accounts where profile_id = auth.uid() and type = 'factory' limit 1)
  );

create policy "factory_own_write" on factory_material_preferences
  for all using (
    factory_id = (select id from org_accounts where profile_id = auth.uid() and type = 'factory' limit 1)
  );
