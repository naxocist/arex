# Supabase (Local + Hosted) for AREX Backend

This folder contains Supabase migrations and local development config for the backend in this monorepo.

## Folder Contract

- `backend/supabase/config.toml`: local Supabase CLI config
- `backend/supabase/migrations/*.sql`: ordered SQL migrations
- `backend/supabase/seed.sql`: deterministic SQL seed entrypoint

## One-command Operations (from repo root)

- Start local Supabase stack (includes Studio UI):
  - `mise run db:start`
- Stop local Supabase stack:
  - `mise run db:stop`
- Show local Supabase endpoints/keys:
  - `mise run db:status`
- Reset DB and apply all migrations:
  - `mise run db:reset`
- Safe linked staging deploy (schema + checks):
  - `mise run deploy:staging-safe`
- Reset data + deterministic app/auth seed (without migration reset):
  - `mise run db:reset-seed`
- Create a migration:
  - `mise run db:migrate:new -- your_migration_name`

## Studio UI

After `mise run db:start`, open Supabase Studio at `http://127.0.0.1:54323`.

This is the primary local UI for:

- Browsing and editing table data
- Managing Auth users
- Running SQL during development

## Reset + Seed Details

Deterministic SQL seed file:

- `backend/supabase/seed.sql`

It performs:

- Demo Auth user creation in `auth.users`/`auth.identities`
- Application table reset and deterministic reseed

Supabase CLI runs this seed from `backend/supabase/config.toml` via:

- `supabase db query --workdir backend --file supabase/seed.sql`
- `supabase db reset --workdir backend`

## Safe Staging Deployment (Data Intact)

To keep existing staging data intact while applying schema changes:

1. Ensure the project is linked (`supabase link --workdir backend --project-ref <ref>`).
2. If staging schema already exists but migration history is empty (first migration conflicts like "already exists"), run one-time bootstrap:
  - `mise run db:staging:bootstrap-migrations`
3. Run:
  - `mise run deploy:staging-safe`

This does:

- `supabase db push --workdir backend --linked` (applies migrations, no reset)
- `mise run db:staging:verify` (runs `supabase/verification/staging_post_deploy_checks.sql`)

