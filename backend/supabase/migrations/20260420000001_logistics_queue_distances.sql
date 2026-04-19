create table if not exists public.logistics_queue_distances (
  logistics_profile_id uuid not null,
  reference_type       text not null check (reference_type in ('submission', 'reward_request')),
  reference_id         uuid not null,
  distance_km          double precision,
  updated_at           timestamptz not null default now(),
  primary key (logistics_profile_id, reference_type, reference_id)
);
