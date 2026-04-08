# Supabase Schema Notes

This folder stores SQL migrations used by the AREX FastAPI backend.

## Initial Migration

- `migrations/0001_init_arex.sql`
- `migrations/0002_fix_plpgsql_ambiguous_columns.sql` (hotfix for existing deployments)
- `migrations/0003_guard_duplicate_reward_delivery_job.sql` (prevent duplicate reward delivery scheduling)

Includes:

- Core tables for submissions, logistics jobs, factory intakes, reward requests, points ledger, and status events
- Enum types for status/state machine fields
- Indexes and updated-at triggers
- Guarded workflow functions (RPC-ready) used by FastAPI

## Applying Migration

Run the SQL in Supabase SQL Editor, or apply via Supabase CLI migration flow for the target project.

If your environment already ran `0001_init_arex.sql`, apply `0002_fix_plpgsql_ambiguous_columns.sql` and `0003_guard_duplicate_reward_delivery_job.sql` to replace affected functions.
