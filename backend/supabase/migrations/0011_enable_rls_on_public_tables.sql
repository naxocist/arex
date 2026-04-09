-- Enable Row Level Security (RLS) on AREX public tables.
--
-- Note:
-- - RLS enabled with no policies means anon/authenticated client access is denied by default.
-- - Backend operations using service-role key continue to work (service role bypasses RLS).

alter table if exists public.profiles enable row level security;
alter table if exists public.factories enable row level security;
alter table if exists public.material_types enable row level security;
alter table if exists public.measurement_units enable row level security;
alter table if exists public.material_point_rules enable row level security;
alter table if exists public.material_submissions enable row level security;
alter table if exists public.pickup_jobs enable row level security;
alter table if exists public.factory_intakes enable row level security;
alter table if exists public.points_ledger enable row level security;
alter table if exists public.rewards_catalog enable row level security;
alter table if exists public.reward_requests enable row level security;
alter table if exists public.reward_delivery_jobs enable row level security;
alter table if exists public.status_events enable row level security;

