# AREX Backend (FastAPI + Supabase)

Backend service for workflow rules, role-safe APIs, and Supabase Postgres/Auth integration.

## Monorepo Layout

- Frontend app: repository root
- Backend app: `backend/`
- Supabase assets for backend: `backend/supabase/`

## Environment Variables

Copy and edit the backend env file:

```bash
cd backend
cp .env.example .env
```

Required values:

- `SUPABASE_URL`: local (`http://host.docker.internal:54321`) when backend runs in Docker, or hosted Supabase URL in production.
- `SUPABASE_PUBLISHABLE_KEY`: publishable key from your Supabase project.
- `SUPABASE_SECRET_KEY`: secret/service key from your Supabase project.
- `SUPABASE_LEGACY_SERVICE_ROLE_JWT`: optional fallback key used by backend auth-admin flows with older client compatibility.

## Local Development (with monorepo tasks)

Run all local dev commands from repository root using `mise`:

- `mise run dev:up` starts Supabase local stack, backend container, and frontend container.
- `mise run dev:down` stops app containers and Supabase stack.
- `mise run db:status` prints local Supabase URLs and keys (includes Studio URL).
- `mise run db:reset-seed` resets data and seeds deterministic demo data (without migration reset).

You can still run backend only:

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Supabase Migration

Migrations live in `backend/supabase/migrations` and are applied by Supabase CLI workflows.
Create a new migration with:

```bash
mise run db:migrate:new -- your_migration_name
```

Then apply and verify with:

```bash
mise run db:reset-seed
mise run db:status
```

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

Seed data is now SQL-native and executed by Supabase CLI from `backend/supabase/seed.sql`.

Use this command from the repo root:

```bash
mise run db:reset-seed
```

- `db:reset-seed` resets application/auth data and reruns deterministic seed SQL (no migration reset).

The seed includes deterministic demo Auth users and matching app data for end-to-end testing.

## Minimal Manual Setup (One-time)

1. Copy backend `.env.example` to `.env` and set:
	- `SUPABASE_URL`
	- `SUPABASE_PUBLISHABLE_KEY`
	- `SUPABASE_SECRET_KEY`
	- `SUPABASE_LEGACY_SERVICE_ROLE_JWT` (optional fallback for auth-admin key compatibility)
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

## Production Deployment (Google Cloud Run)

Backend deployment is configured via `backend/cloudbuild.yaml`.

Manual command from repo root:

```bash
gcloud builds submit backend --config backend/cloudbuild.yaml
```

Before first deploy, configure Cloud Build substitutions and secrets:

- `_SERVICE`: Cloud Run service name
- `_REGION`: deployment region
- `_SUPABASE_URL`: hosted Supabase project URL
- `_SUPABASE_PUBLISHABLE_KEY`: hosted publishable key
- `_SUPABASE_SECRET_KEY`: Secret Manager secret name for backend secret key
- `_SUPABASE_LEGACY_SERVICE_ROLE_JWT`: Secret Manager secret name for fallback JWT key (can be omitted if not needed)

For frontend (Vercel), set `VITE_API_BASE_URL` to the Cloud Run HTTPS URL plus `/api/v1`.
