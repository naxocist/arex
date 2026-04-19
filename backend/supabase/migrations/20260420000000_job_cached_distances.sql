alter table pickup_jobs
  add column distance_to_farmer_km double precision,
  add column distance_farmer_to_factory_km double precision;

alter table reward_delivery_jobs
  add column distance_to_farmer_km double precision;
