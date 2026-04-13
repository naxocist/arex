# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All common operations run via `mise` from the repo root.

```bash
mise run setup              # npm install + uv sync
mise run dev:up             # start Supabase stack + all containers (Docker watch)
mise run dev:down           # stop containers + Supabase
mise run db:reset           # reset DB, reapply all migrations, run seed.sql
mise run db:status          # print local Supabase URLs and keys
mise run db:migrate:new -- name   # create a new migration file
mise run check              # tsc --noEmit + npm run build + python compileall
mise run logs:backend       # tail backend container logs
mise run logs:frontend      # tail frontend container logs
```

Backend only (no Docker):
```bash
cd backend && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

TypeScript check only:
```bash
npx tsc --noEmit
```

## Architecture

### Monorepo layout

- **`/`** — Next.js 14 (App Router) frontend
- **`/backend`** — FastAPI backend (Python, managed by `uv`)
- **`/backend/supabase`** — Supabase migrations + seed

### Frontend

- Next.js App Router. All authenticated pages live under `app/(protected)/`.
- Route segments map to roles: `/farmer`, `/logistics`, `/factory`, `/warehouse`, `/executive`.
- Each role page renders a single `_views/` component. Views are large single-file components that own their own data loading and state.
- `app/_lib/apiClient.ts` is the only HTTP layer — all API calls go through it. It handles token storage (localStorage), auto-refresh on 401, and a 5-minute in-memory GET cache (`GET_RESPONSE_CACHE`). Pass `{ forceRefresh: true }` to bypass cache.
- Role is stored in `UserContext` (initialized from localStorage `AREX_AUTH_ROLE`). After login the role drives which `(protected)/[role]/page.tsx` the user lands on.
- `app/_components/` holds shared UI primitives (StatCard, SectionCard, AlertBanner, etc.). Do not put business logic here.

### Backend

All routes are under `/api/v1`. The stack:

1. **`app/api/deps.py`** — `get_current_user` validates the Bearer JWT via Supabase publishable client, extracts role from `app_metadata` or falls back to `profiles` table. `require_roles(*roles)` is the FastAPI dependency used in every protected route.
2. **`app/api/routes/`** — one file per role (`farmer.py`, `logistics.py`, `factory.py`, `warehouse.py`, `executive.py`) plus `auth.py` and `health.py`.
3. **`app/services/workflow_service.py`** — single service class injected into routes via `get_workflow_service`. All DB reads/writes go here using the Supabase Python client (service role). No raw SQL — uses `.table().select().execute()` pattern.
4. **`app/db/supabase.py`** — two clients: `get_publishable_client()` (for auth token validation) and `get_service_client()` (for all DB operations, bypasses RLS).
5. **`app/models/`** — Pydantic models: `auth.py` for `AuthenticatedUser` + `Role` enum; `workflow.py` for request/response shapes.

Errors from `WorkflowService` raise `WorkflowError` (caught in routes and converted to 400). Routes never call the DB directly.

### Database

- Supabase Postgres with RLS enabled on all public tables.
- **Migrations** in `backend/supabase/migrations/` are schema-only SQL (DDL). Named `YYYYMMDDHHMMSS_description.sql`.
- **`backend/supabase/seed.sql`** contains all seed data — runs after every `db:reset`. Includes demo auth users, master data (material types, units, point rules, rewards, factories), value chain mappings, and Demo D-06 pilot data block.
- Never put INSERT/UPDATE data in migrations. Migrations = schema only.

### Key domain concepts

- **Points (PMUC coins)**: `material_point_rules.points_per_kg` × confirmed `measured_weight_kg` = coins credited. Each material type has its own rate (rice_straw=1.0, orchard_residue=3.125, plastic_waste=12.5 pt/kg).
- **Rewards**: fixed `points_cost` in `rewards_catalog`. Farmers redeem via `reward_requests` → warehouse approves → logistics delivers.
- **Points ledger**: `points_ledger` table with entry types `intake_credit`, `reward_reserve`, `reward_release`, `reward_spend`, `adjustment`. Balance = sum of all entries for a farmer.
- **Factories**: `is_focal_point = true` marks CMU (มช.) as the northern hub. Shown as a badge in logistics view.
- **Pickup flow**: `material_submissions` → `pickup_jobs` (logistics schedules/picks up/delivers) → `factory_intakes` (factory confirms weight) → `points_ledger` credit.
- **Reward flow**: farmer requests → `reward_requests` (warehouse approves) → `reward_delivery_jobs` (logistics delivers) → points debited.

### Roles

`farmer`, `logistics`, `factory`, `warehouse`, `executive`. Role is stored in `auth.users.app_metadata.role` and mirrored in `profiles.role`. Executive can manage material types, point rules, measurement units, and rewards catalog via the Settings UI.

## Local dev accounts (after db:reset)

All passwords: `123456`

| Email | Role |
|---|---|
| farmer@gmail.com | farmer |
| farmer2@gmail.com | farmer |
| logistics@gmail.com | logistics |
| factory@gmail.com | factory |
| warehouse@gmail.com | warehouse |
| executive@gmail.com | executive |
| demo_farmer1@arex.local | farmer (D-06 demo) |
| demo_logistics@arex.local | logistics (D-06 demo) |
| demo_factory@arex.local | factory (D-06 demo) |
| demo_warehouse@arex.local | warehouse (D-06 demo) |

## Local URLs

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000/api/v1`
- Supabase Studio: `http://127.0.0.1:54323`

## Deployment

- Frontend: Vercel (`vercel.json` at root)
- Backend: Google Cloud Run (`backend/cloudbuild.yaml`)
- CI/CD: GitHub Actions in `.github/workflows/` — `deploy-backend.yml` (prod) and `deploy-backend-staging.yml` (staging)
- Staging schema deploy: `mise run deploy:staging-safe` (applies migrations without data reset)
- Backend env in prod is set via Cloud Build substitutions + Secret Manager secrets

## Self-registration

`farmer`, `logistics`, and `factory` roles support self-registration:
- `POST /api/v1/auth/register/farmer`
- `POST /api/v1/auth/register/logistics`
- `POST /api/v1/auth/register/factory`

Each creates a Supabase Auth user + `profiles` row (+ `factories` row for factory). Returns tokens immediately.
