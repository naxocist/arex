alter table if exists public.material_types
  drop column if exists sort_order;

alter table if exists public.measurement_units
  drop column if exists sort_order;
