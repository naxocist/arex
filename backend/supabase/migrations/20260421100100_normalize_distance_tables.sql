-- Normalize distance storage: split logistics_distances into two purpose-built tables.
-- logistics_to_farmer_distances: provider-dependent (logistics hub → farmer point)
-- submission_factory_distances: provider-independent (farmer pickup → factory)

drop table if exists logistics_distances;

create table logistics_to_farmer_distances (
  logistics_profile_id uuid        not null references profiles(id) on delete cascade,
  reference_type       text        not null check (reference_type in ('submission', 'reward_request')),
  reference_id         uuid        not null,
  distance_km          double precision,
  updated_at           timestamptz not null default now(),
  primary key (logistics_profile_id, reference_type, reference_id)
);
create index on logistics_to_farmer_distances (reference_type, reference_id);
alter table logistics_to_farmer_distances enable row level security;
create policy "service role bypass" on logistics_to_farmer_distances using (true);

create table submission_factory_distances (
  submission_id uuid        not null references submissions(id) on delete cascade,
  factory_id    uuid        not null references org_accounts(id) on delete cascade,
  distance_km   double precision,
  updated_at    timestamptz not null default now(),
  primary key (submission_id, factory_id)
);
alter table submission_factory_distances enable row level security;
create policy "service role bypass" on submission_factory_distances using (true);
