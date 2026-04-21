-- Supabase cloud does not always auto-grant public schema access.
-- Explicit grants ensure PostgREST and RLS work correctly.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;
