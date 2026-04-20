# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

# Project: AREX Platform

Agricultural residue exchange platform connecting farmers, logistics, factories, warehouses, and executives in a points-based supply chain.

## Commands

All common operations via `mise` from repo root:

```bash
mise run setup              # npm install + uv sync
mise run dev:up             # start Supabase stack + Docker containers with watch
mise run dev:down           # stop containers + Supabase
mise run db:reset           # reset DB, reapply all migrations, run seed
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

## Tech Stack

### Frontend
- **Next.js 16** (App Router) + **React 19** + **TypeScript 5.8**
- **Tailwind CSS v4** (PostCSS plugin, no config file)
- **lucide-react** for icons (minimal, monochrome style preferred)
- **recharts** for charts
- **react-leaflet** + **leaflet** for maps
- **motion** for animations
- **jspdf** for PDF generation
- **react-day-picker** for date inputs

### Backend
- **FastAPI** (Python 3.11+) managed by **uv**
- **Pydantic v2** + **pydantic-settings** for config/models
- **supabase-py** client for all DB operations
- **uvicorn** ASGI server

### Database
- **Supabase** (PostgreSQL) with RLS enabled on all public tables
- Local dev via Supabase CLI (`supabase start --workdir backend`)
- Migrations in `backend/supabase/migrations/` — schema DDL only, no data
- Seed data in `backend/supabase/seeds/seed.sql` (local) and `seed.prod.sql` (prod)

### Dev Tooling
- **mise** — task runner + tool version manager (Node 20, Python 3.11, uv, supabase CLI)
- **Docker Compose** — containerized local dev with `docker compose watch` hot reload
- Two containers: `frontend` (port 3000) and `backend` (port 8000)

## Architecture

### Monorepo layout
```
/                   Next.js 14 frontend (App Router)
/backend            FastAPI backend (Python, managed by uv)
/backend/supabase   Supabase migrations + seeds
```

### Frontend structure
- All authenticated pages under `app/(protected)/`
- Role segments: `/farmer`, `/logistics`, `/factory`, `/warehouse`, `/executive`, `/admin`
- Each role page renders a single `_views/` component — large single-file components owning data loading + state
- `app/_lib/api/` — one file per role + core/auth/types. All HTTP calls go through `app/_lib/apiClient.ts`
  - Handles token storage (localStorage), auto-refresh on 401, 5-min in-memory GET cache (`GET_RESPONSE_CACHE`)
  - Pass `{ forceRefresh: true }` to bypass cache
- `app/_components/` — shared UI primitives: `StatCard`, `SectionCard`, `AlertBanner`, `StatusBadge`, `Sidebar`, `Skeleton`, `EmptyState`, `ConfirmDialog`, `DateRangePicker`, `Pagination`, `PickupLocationMapPicker`, `FarmerProfileSheet`, `StatusStepper`, `ProtectedRoute`, `ErrorBoundary`, `AppLoadingOverlay`
- `app/_contexts/` — `UserContext` (role from `localStorage AREX_AUTH_ROLE`), `FarmerProfileContext`
- `app/_shared/` — shared page-level components like `OverviewDashboard`

### Backend structure
```
backend/app/
  main.py           FastAPI app + CORS + router registration
  core/config.py    Settings via pydantic-settings (reads .env.local)
  api/
    deps.py         get_current_user (JWT via Supabase), require_roles()
    routes/         farmer.py, logistics.py, factory.py, warehouse.py,
                    executive.py, admin.py, auth.py, health.py
  services/
    workflow_service.py   single service for all DB reads/writes
    _base.py, farmer_service.py, logistics_service.py, factory_service.py,
    warehouse_service.py, executive_service.py, rewards_service.py,
    catalog_service.py
  db/supabase.py    get_publishable_client() (auth), get_service_client() (DB, bypasses RLS)
  models/
    auth.py         AuthenticatedUser, Role enum
    workflow.py     all request/response Pydantic shapes
```

All routes are under `/api/v1`. `WorkflowError` → 400 in routes. Routes never touch DB directly.

### Domain concepts
- **Points (PMUC coins)**: `material_point_rules.points_per_kg` × confirmed `measured_weight_kg`
  - rice_straw = 1.0 pt/kg, orchard_residue = 3.125 pt/kg, plastic_waste = 12.5 pt/kg
- **Points ledger**: `points_ledger` table with types `intake_credit`, `reward_reserve`, `reward_release`, `reward_spend`, `adjustment`
- **Rewards**: fixed `points_cost` in `rewards_catalog`. Farmer redeems → warehouse approves → logistics delivers
- **Factories**: `is_focal_point = true` marks CMU (มช.) as northern hub
- **Pickup flow**: `material_submissions` → `pickup_jobs` (logistics) → `factory_intakes` (factory confirms weight) → `points_ledger` credit
- **Reward flow**: farmer requests → `reward_requests` (warehouse approves) → `reward_delivery_jobs` (logistics delivers) → points debited

### Roles
`farmer`, `logistics`, `factory`, `warehouse`, `executive`, `admin`
Role stored in `auth.users.app_metadata.role` and mirrored in `profiles.role`.
Executive manages material types, point rules, measurement units, rewards catalog via Settings UI.
Admin manages account approvals.

### Self-registration
`farmer`, `logistics`, `factory` support self-registration:
- `POST /api/v1/auth/register/farmer`
- `POST /api/v1/auth/register/logistics`
- `POST /api/v1/auth/register/factory`

## Local Dev Accounts (after db:reset)

All passwords: `123456`. Farmer is the only role requiring admin approval.

| Email | Role | Notes |
|---|---|---|
| fac1@gmail.com | factory | โรงงาน 1 — สระบุรี |
| fac2@gmail.com | factory | โรงงาน 2 — ชัยนาท |
| logis1@gmail.com | logistics | ขนส่ง 1 — สระบุรี, handles central/east/north-east jobs |
| logis2@gmail.com | logistics | ขนส่ง 2 — เชียงใหม่, handles CMU-area jobs |
| farmer1@gmail.com | farmer | เกษตรกร 1 — all submission statuses + reward requested/approved/rejected |
| farmer2@gmail.com | farmer | เกษตรกร 2 — reward delivered + cancelled |
| farmer3@gmail.com | farmer | เกษตรกร 3 — complete end-to-end (points + reward delivered via CMU) |
| farmer4@gmail.com | farmer | เกษตรกร 4 — reward out_for_delivery + release (cancel) |
| farmer5@gmail.com | farmer | เกษตรกร 5 — warehouse_rejected reward flow |
| warehouse@gmail.com | warehouse | |
| executive@gmail.com | executive | |
| admin@gmail.com | admin | sees 2 pending farmer approvals + 1 rejected |
| farmerpending1@gmail.com | farmer | approval_status = pending |
| farmerpending2@gmail.com | farmer | approval_status = pending |
| farmerrejected@gmail.com | farmer | approval_status = rejected |

## Local URLs

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000/api/v1`
- Supabase Studio: `http://127.0.0.1:54323`

## Backend Env Vars (`.env.local`)

```
APP_NAME=AREX Backend API
ENVIRONMENT=development
DEBUG=true
API_PREFIX=/api/v1
CORS_ORIGINS=["http://localhost:3000"]
SUPABASE_URL=<local supabase url>
SUPABASE_PUBLISHABLE_KEY=<anon key>
SUPABASE_SECRET_KEY=<service role key>
SUPABASE_LEGACY_SERVICE_ROLE_JWT=<optional legacy jwt>
```

## Deployment

### Branch strategy
```
feature branch → merge to staging → test → merge to main → prod deploys
```

### Frontend — Vercel
- Auto-deploys on every push: `main` → production, `staging` → preview
- Env var `NEXT_PUBLIC_API_BASE_URL` set twice in Vercel dashboard: Production = prod Cloud Run URL, Preview = staging Cloud Run URL
- Root directory: `/` (repo root). Ignore Vercel's offer to deploy `backend/`

### Backend — GCP Cloud Run
- Region: `asia-southeast1`
- Services: `arex-backend-prod` (main) and `arex-backend-staging` (staging)
- Images stored in Artifact Registry, tagged by commit SHA
- All app secrets (Supabase keys, CORS) stored in **GCP Secret Manager** — GitHub Actions never sees them
- Cloud Run pulls secrets from Secret Manager at runtime

### CI/CD — GitHub Actions
- `deploy-backend.yml` — triggers on push to `main` touching `backend/`
- `deploy-backend-staging.yml` — triggers on push to `staging` touching `backend/`
- Pipeline: build Docker image → push to Artifact Registry → deploy to Cloud Run → smoke-check `/api/v1/health` (5 retries, rollback on failure) → upload deploy artifacts
- Image tags: prod = `SHA`, staging = `SHA-staging` (both also tagged `latest`/`staging` as floating)
- Concurrency locked per environment (no cancellation of in-flight deploys)

### GitHub Actions secrets required
| Secret | Value |
|---|---|
| `GCP_SA_KEY` | arex-github-deployer service account JSON key |
| `GCP_PROJECT_ID` | GCP project ID |
| `GCP_REGION` | e.g. `asia-southeast1` |

### GCP Secret Manager keys
`AREX_PROD_SUPABASE_URL`, `AREX_PROD_SUPABASE_PUBLISHABLE_KEY`, `AREX_PROD_SUPABASE_SECRET_KEY`, `AREX_PROD_CORS_ORIGINS`, `AREX_STAGING_*` equivalents

### Database migrations for production
```bash
# After GCP + Supabase prod project are set up:
mise run db:push:prod    # apply migrations
mise run db:seed:prod    # apply reference data (safe to re-run, never wipes)
```

### Rotating secrets
```bash
echo -n "new_value" | gcloud secrets versions add SECRET_NAME --data-file=-
gcloud run services update arex-backend-prod --region REGION \
  --update-secrets "ENV_VAR=SECRET_NAME:latest"
```

See `DEPLOY.md` for full step-by-step first-deploy instructions.
