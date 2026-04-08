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

Includes:

- Core tables for submissions, logistics jobs, factory intakes, reward requests, points ledger, and status events
- Enum types for status/state machine fields
- Indexes and updated-at triggers
- Guarded workflow functions (RPC-ready) used by FastAPI

## Applying Migration

Run the SQL in Supabase SQL Editor, or apply via Supabase CLI migration flow for the target project.

If your environment already ran `0001_init_arex.sql`, apply `0002_fix_plpgsql_ambiguous_columns.sql`, `0003_guard_duplicate_reward_delivery_job.sql`, `0004_farmer_cancel_reward_request.sql`, `0005_logistics_date_windows.sql`, `0006_thai_measurement_units.sql`, and `0007_dynamic_material_types.sql` to replace affected functions and add all latest schema updates.
