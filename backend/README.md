# AREX Backend (FastAPI + Supabase)

This backend is a separate service for workflow rules, role-safe APIs, and integration with Supabase Postgres/Auth.

## Prerequisites

- Python 3.11+
- A Supabase project (URL, anon key, service role key)

## Setup

1. Create and activate a virtual environment.
2. Install dependencies.
3. Copy `.env.example` to `.env` and set values.
4. Run the API.

```bash
python -m venv .venv
source .venv/Scripts/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Supabase Migration

Apply the initial schema and workflow functions from:

- `supabase/migrations/0001_init_arex.sql`

You can run it in Supabase SQL Editor or using Supabase CLI migrations.

## Required Manual Setup (One-time)

1. In Supabase Auth, create users for each demo role you want to test (farmer, logistics, factory, warehouse, executive).
2. For each created user, insert/update corresponding row in `profiles` with the same `id` and correct `role`.
3. Insert initial reward rows into `rewards_catalog` so farmer reward list and trade requests can work.
4. Copy backend `.env.example` to `.env` and set:
	- `SUPABASE_URL`
	- `SUPABASE_ANON_KEY`
	- `SUPABASE_SERVICE_ROLE_KEY`
5. Set frontend `VITE_API_BASE_URL` in root `.env` (or `.env.local`) to your running backend URL.

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
- `GET /api/v1/farmer/me`
- `GET /api/v1/farmer/rewards`
- `GET /api/v1/farmer/reward-requests`
- `POST /api/v1/farmer/submissions`
- `GET /api/v1/farmer/submissions`
- `GET /api/v1/farmer/points`
- `POST /api/v1/farmer/reward-requests`
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
