# AREX Backend (FastAPI + Supabase)

This backend is a separate service for workflow rules, role-safe APIs, and integration with Supabase Postgres/Auth.

## Prerequisites

- Python 3.11+
- A Supabase project (URL, anon key, service role key)

## Setup

1. Sync dependencies with UV.
2. Copy `.env.example` to `.env` and set values.
3. Run the API.

```bash
cd backend
uv sync
cp .env.example .env
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Supabase Migration

Apply migrations in order from:

- `supabase/migrations/0001_init_arex.sql`
- `supabase/migrations/0002_fix_plpgsql_ambiguous_columns.sql`
- `supabase/migrations/0003_guard_duplicate_reward_delivery_job.sql`
- `supabase/migrations/0004_farmer_cancel_reward_request.sql`
- `supabase/migrations/0005_logistics_date_windows.sql`
- `supabase/migrations/0006_thai_measurement_units.sql`
- `supabase/migrations/0007_dynamic_material_types.sql`
- `supabase/migrations/0008_factory_account_mapping.sql`
- `supabase/migrations/0009_logistics_pickup_destination_factory.sql`
- `supabase/migrations/0010_minimal_schema_cleanup.sql`
- `supabase/migrations/0011_enable_rls_on_public_tables.sql`

You can run it in Supabase SQL Editor or using Supabase CLI migrations.

## Registration Flow

Self-registration is now available for these roles:

- farmer
- logistics
- factory

New endpoints:

- `POST /api/v1/auth/register/farmer`
- `POST /api/v1/auth/register/logistics`
- `POST /api/v1/auth/register/factory`

Behavior:

- Creates Supabase Auth user via service-role admin API
- Creates matching `profiles` row with same UUID and role
- For factory registration, creates linked `factories` row (`factory_profile_id`)
- Immediately signs in and returns access token + refresh token + role

## Deterministic Reset + Seed (Auth + App Data)

Use the Python script below to fully reset and reseed test data, including Supabase Auth users:

- `scripts/reset_and_seed.py`

### Local Supabase

```bash
cd backend
uv run python scripts/reset_and_seed.py --confirm RESET_AREX_DATA
```

### Hosted Supabase

Set backend `.env` (or environment variables) with hosted project credentials:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

If your service key is the new `sb_secret_*` format, current Python Supabase client behavior in this script may still require a JWT-format service role key for `create_client(...)`.
In that case, add:

- `SUPABASE_SERVICE_ROLE_JWT` (legacy JWT service_role key)

The reset script will prefer `SUPABASE_SERVICE_ROLE_JWT` when needed.

Then run the same command:

```bash
cd backend
uv run python scripts/reset_and_seed.py --confirm RESET_AREX_DATA
```

The script upserts deterministic demo users (all major roles) and reseeds workflow data for end-to-end testing.

If you see `403 User not allowed`, your `SUPABASE_SERVICE_ROLE_KEY` is usually incorrect (often accidentally set to the anon key). Use the service-role key from Supabase project settings.

If hosted policies block Auth admin operations, fallback manually:

1. Create required users in Supabase Auth dashboard using the same emails shown by the script.
2. Run profile and app-data seed steps only by adapting `scripts/reset_and_seed.py` (skip auth delete/create blocks).
3. Keep `profiles.id` equal to the matching `auth.users.id` UUID.

## Minimal Manual Setup (One-time)

1. Copy backend `.env.example` to `.env` and set:
	- `SUPABASE_URL`
	- `SUPABASE_ANON_KEY`
	- `SUPABASE_SERVICE_ROLE_KEY`
	- `SUPABASE_SERVICE_ROLE_JWT` (optional fallback for reset script)
2. Set frontend `VITE_API_BASE_URL` in root `.env` (or `.env.local`) to your running backend URL.

## API Prefix

All routes are mounted under `/api/v1` by default.

## Current Scope

- App bootstrap and configuration
- Supabase clients (anon + service)
- JWT-based auth dependency and role guards
- Role-based route modules for farmer/logistics/factory/warehouse/executive
- Service layer wired to real table/RPC operations

## Implemented Endpoint Groups

- `GET /api/v1/health`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/register/farmer`
- `POST /api/v1/auth/register/logistics`
- `POST /api/v1/auth/register/factory`
- `GET /api/v1/farmer/me`
- `GET /api/v1/farmer/material-types`
- `GET /api/v1/farmer/measurement-units`
- `GET /api/v1/farmer/rewards`
- `GET /api/v1/farmer/reward-requests`
- `POST /api/v1/farmer/submissions`
- `GET /api/v1/farmer/submissions`
- `GET /api/v1/farmer/points`
- `POST /api/v1/farmer/reward-requests`
- `POST /api/v1/farmer/reward-requests/{request_id}/cancel`
- `GET /api/v1/logistics/pickup-queue`
- `GET /api/v1/logistics/pickup-jobs`
- `GET /api/v1/logistics/reward-requests/approved`
- `GET /api/v1/logistics/reward-delivery-jobs`
- `POST /api/v1/logistics/pickup-jobs/{submission_id}/schedule`
- `POST /api/v1/logistics/pickup-jobs/{pickup_job_id}/picked-up`
- `POST /api/v1/logistics/pickup-jobs/{pickup_job_id}/delivered-to-factory`
- `POST /api/v1/logistics/reward-delivery-jobs/{request_id}/schedule`
- `POST /api/v1/logistics/reward-delivery-jobs/{delivery_job_id}/out-for-delivery`
- `POST /api/v1/logistics/reward-delivery-jobs/{delivery_job_id}/delivered`
- `GET /api/v1/factory/intakes/pending`
- `POST /api/v1/factory/intakes/confirm`
- `GET /api/v1/warehouse/reward-requests/pending`
- `POST /api/v1/warehouse/reward-requests/{request_id}/approve`
- `POST /api/v1/warehouse/reward-requests/{request_id}/reject`
- `GET /api/v1/executive/dashboard/overview`

## Next Implementation Steps

1. Add JWT integration on frontend and connect first screen (`FarmerHome`) to backend endpoints.
2. Add picked-up and reward delivered transitions as dedicated endpoints.
3. Add role-safe integration tests for workflow guards and points accounting.
4. Add RLS policies and verify with non-service-role data access where needed.
