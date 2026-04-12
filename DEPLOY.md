# Deployment Guide

## Architecture

```
GitHub branches
  ├── staging → Vercel preview URL  +  GCP VM backend :8001  (staging)
  └── main    → Vercel production   +  GCP VM backend :8000  (production)

Supabase is always cloud-hosted. No local Supabase in production or staging.
```

### Branch workflow

```
feature branch → merge to staging → test staging → merge to main → prod deploys
```

---

## Frontend — Vercel

Vercel deploys automatically on every push. No manual steps needed.

- `main` → production URL
- `staging` → preview URL (e.g. `arex-platform-git-staging-yourteam.vercel.app`)

### One-time Vercel setup

1. Import repo at vercel.com → New Project
2. Framework: **Next.js** (auto-detected)
3. Root directory: `/` (repo root)
4. Add environment variables in Vercel dashboard → Settings → Environment Variables:

| Variable | Value | Environment |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://YOUR_VM_IP:8000/api/v1` | Production |
| `NEXT_PUBLIC_API_BASE_URL` | `http://YOUR_VM_IP:8001/api/v1` | Preview (staging branch) |

5. Deploy. Every future push to `main` or `staging` redeploys automatically.

> If you add a custom domain, update `NEXT_PUBLIC_API_BASE_URL` in Vercel and `CORS_ORIGINS` in the corresponding env file on the VM.

---

## Backend — GCP VM

Both environments run on the **same VM**, different ports:

| Env | Port | Compose file | Env file |
|---|---|---|---|
| Production | 8000 | `docker-compose.prod.yml` | `.env.prod` |
| Staging | 8001 | `docker-compose.staging.yml` | `.env.staging` |

### One-time VM setup

```bash
# 1. Create VM (e2-micro or larger), Debian/Ubuntu, enable HTTP traffic

# 2. SSH into VM, install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# log out and back in

# 3. Clone repo
git clone https://github.com/YOUR_ORG/arex-platform.git ~/arex-platform

# 4. Create prod env file
cp ~/arex-platform/backend/.env.prod.example ~/arex-platform/backend/.env.prod
nano ~/arex-platform/backend/.env.prod   # fill in Supabase keys + Vercel prod URL for CORS_ORIGINS

# 5. Create staging env file
cp ~/arex-platform/backend/.env.staging.example ~/arex-platform/backend/.env.staging
nano ~/arex-platform/backend/.env.staging   # fill in Supabase keys + Vercel staging URL for CORS_ORIGINS

# 6. Open ports in GCP firewall
# GCP Console → VPC network → Firewall → Add two rules:
#   Port 8000 (prod):    Direction: Ingress, tcp:8000, Source: 0.0.0.0/0
#   Port 8001 (staging): Direction: Ingress, tcp:8001, Source: 0.0.0.0/0

# 7. Start both backends
cd ~/arex-platform/backend
docker compose -f docker-compose.prod.yml --env-file .env.prod up --build -d
docker compose -f docker-compose.staging.yml --env-file .env.staging up --build -d
```

### GitHub Actions auto-deploy setup (one-time)

Add these secrets in GitHub → Settings → Secrets → Actions (shared by both workflows):

| Secret | Value |
|---|---|
| `GCP_VM_HOST` | VM public IP |
| `GCP_VM_USER` | SSH username (e.g. `ubuntu`) |
| `GCP_VM_SSH_KEY` | Private SSH key that has access to the VM |

After this:
- Push to `main` touching `backend/` → auto-deploys production via [`.github/workflows/deploy-backend.yml`](.github/workflows/deploy-backend.yml)
- Push to `staging` touching `backend/` → auto-deploys staging via [`.github/workflows/deploy-backend-staging.yml`](.github/workflows/deploy-backend-staging.yml)

### Manual deploy (if needed)

```bash
ssh user@YOUR_VM_IP
cd ~/arex-platform

# Production
git pull origin main
cd backend
docker compose -f docker-compose.prod.yml --env-file .env.prod up --build -d
docker image prune -f

# Staging
git pull origin staging
cd backend
docker compose -f docker-compose.staging.yml --env-file .env.staging up --build -d
docker image prune -f
```

### Useful commands on VM

```bash
cd ~/arex-platform/backend

# --- Production ---
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml restart backend

# --- Staging ---
docker compose -f docker-compose.staging.yml logs -f
docker compose -f docker-compose.staging.yml down
docker compose -f docker-compose.staging.yml restart backend-staging
```

---

## Local dev (unchanged)

```bash
mise run dev:up    # Supabase + frontend + backend with hot reload
mise run dev:down  # stop everything
```

---

## Environment variables reference

| Variable | Where | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Vercel dashboard | Backend URL the browser calls |
| `SUPABASE_URL` | `.env.prod` / `.env.staging` on VM | Supabase cloud project URL |
| `SUPABASE_PUBLISHABLE_KEY` | `.env.prod` / `.env.staging` on VM | Supabase anon/publishable key |
| `SUPABASE_SECRET_KEY` | `.env.prod` / `.env.staging` on VM | Supabase service role key |
| `CORS_ORIGINS` | `.env.prod` / `.env.staging` on VM | JSON array of allowed origins |

---

## CORS note

Each environment needs its own `CORS_ORIGINS` pointing to the correct Vercel URL:

- **Prod** `.env.prod`: `["https://your-app.vercel.app"]`
- **Staging** `.env.staging`: `["https://arex-platform-git-staging-yourteam.vercel.app"]`

When you add or change a URL, update the env file on the VM and restart the relevant service:

```bash
cd ~/arex-platform/backend

# Prod
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Staging
docker compose -f docker-compose.staging.yml --env-file .env.staging up -d
```
