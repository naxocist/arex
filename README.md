# AREX Monorepo

This repository is a monorepo:

- Frontend (React + Vite): repository root
- Backend (FastAPI): `backend/`
- Supabase schema/migrations: `backend/supabase/`

## Prerequisites

- `mise` installed
- Docker Desktop (or compatible Docker runtime)
- Supabase CLI installed (or managed by `mise`)

## Environment Setup

### Frontend env

```bash
cp .env.example .env.local
```

Set `VITE_API_BASE_URL` to your backend URL.

### Backend env

```bash
cp backend/.env.example backend/.env
```

For local Supabase with backend running in Docker:

- `SUPABASE_URL=http://host.docker.internal:54321`
- keys come from `mise run db:status`

## One-command Developer Workflow

All common operations are exposed as `mise` tasks:

- `mise run setup` - install frontend and backend dependencies
- `mise run dev:up` - start Supabase local stack + backend/frontend containers
- `mise run dev:down` - stop containers and Supabase stack
- `mise run db:status` - print local Supabase endpoints and keys
- `mise run db:reset` - reset and migrate local database
- `mise run db:migrate:new -- feature_name` - create a migration file
- `mise run logs:frontend` / `mise run logs:backend` - tail service logs
- `mise run check` - run frontend type-check and backend compile checks

## Local URLs

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000/api/v1`
- Supabase API: `http://localhost:54321`
- Supabase Studio: `http://127.0.0.1:54323`

## Deployment Targets

- Frontend: Vercel
- Backend: Google Cloud Run

Manual deployment:

- Frontend: use Vercel CLI or Vercel dashboard
- Backend: `gcloud builds submit backend --config backend/cloudbuild.yaml`

Frontend production env on Vercel:

- `VITE_API_BASE_URL=https://<your-cloud-run-domain>/api/v1`

Backend production env on Cloud Run is set by `backend/cloudbuild.yaml` (`--set-env-vars` + `--set-secrets`).

See `backend/README.md` for backend runtime details and `backend/supabase/README.md` for database/auth workflows.
