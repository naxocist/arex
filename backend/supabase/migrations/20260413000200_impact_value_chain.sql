-- Add impact_baselines table (KPI placeholders until CMU provides data, May 2568)
-- Add value_chain_mappings table (processed product → buyer display)
-- Source: AREX Product Changes.pdf sections 4.2, 4.3

create table if not exists impact_baselines (
  id uuid primary key default gen_random_uuid(),
  pilot_area text not null,
  hotspot_count_baseline integer,
  co2_kg_baseline numeric(15, 3),
  avg_income_baht_per_household numeric(12, 2),
  recorded_by text,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists value_chain_mappings (
  id uuid primary key default gen_random_uuid(),
  product_name_th text not null,
  producer_org text,
  buyer_org text,
  buyer_use_th text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_value_chain_mappings_updated_at on value_chain_mappings;
create trigger trg_value_chain_mappings_updated_at
before update on value_chain_mappings
for each row execute function set_updated_at();
