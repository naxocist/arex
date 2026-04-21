alter table factory_material_preferences
  add column if not exists minimum_amount_value numeric(12,3),
  add column if not exists minimum_amount_unit  text references measurement_units(code);
