# Supabase Schema Notes

This folder stores SQL migrations used by the AREX FastAPI backend.

## Initial Migration

- `migrations/0001_init_arex.sql`
- `migrations/0002_fix_plpgsql_ambiguous_columns.sql` (hotfix for existing deployments)
- `migrations/0003_guard_duplicate_reward_delivery_job.sql` (prevent duplicate reward delivery scheduling)
- `migrations/0004_farmer_cancel_reward_request.sql` (allow farmer to cancel requested reward requests)
- `migrations/0005_logistics_date_windows.sql` (require pickup/delivery start-end windows and expose to waiting users)
- `migrations/0006_thai_measurement_units.sql` (Thai unit master table, configurable units, farmer-selectable unit)
- `migrations/0007_dynamic_material_types.sql` (material type master table and dynamic farmer selection)
- `migrations/0008_factory_account_mapping.sql` (link one factory profile to one factory record)
- `migrations/0009_logistics_pickup_destination_factory.sql` (pickup scheduling requires destination factory)
- `migrations/0010_minimal_schema_cleanup.sql` (drop unused farm schema and keep canonical pickup RPC signature)
- `migrations/0011_enable_rls_on_public_tables.sql` (enable RLS on all active public tables; default deny for direct client access unless policies are added)

Includes:

- Core tables for submissions, logistics jobs, factory intakes, reward requests, points ledger, and status events
- Enum types for status/state machine fields
- Indexes and updated-at triggers
- Guarded workflow functions (RPC-ready) used by FastAPI

## Applying Migration

Run the SQL in Supabase SQL Editor, or apply via Supabase CLI migration flow for the target project.

If your environment already ran `0001_init_arex.sql`, apply all later migrations in order.

## Reset and Seed

Use `../scripts/reset_and_seed.py` for deterministic reset and seed.

It performs both:

- Supabase Auth upsert/seed for demo users
- App data reset/seed for master and workflow tables

Command:

```bash
cd backend
uv run python scripts/reset_and_seed.py --confirm RESET_AREX_DATA
```

Works for local and hosted Supabase projects as long as `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set.

If you get `403 User not allowed`, verify `SUPABASE_SERVICE_ROLE_KEY` is a real service-role/secret key, not the anon key.

Compatibility note for this repo:

- Current `supabase-py` client behavior in this script expects JWT-style keys for `create_client(...)` and may reject `sb_secret_*` keys as `Invalid API key`.
- If this happens, set `SUPABASE_SERVICE_ROLE_JWT` in `backend/.env` and rerun reset script.

If hosted environment permissions block auth admin APIs, create auth users manually in Supabase dashboard first, then run only app-data portions from `../scripts/reset_and_seed.py` while keeping `profiles.id` aligned to each auth user UUID.
