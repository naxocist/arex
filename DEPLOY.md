# Deployment Guide

## Architecture

```
GitHub branches
  ├── staging → Vercel preview URL  +  GCP VM ~/arex-platform-staging/backend :8001
  └── main    → Vercel production   +  GCP VM ~/arex-platform-prod/backend    :8000

Each environment has its own isolated directory on the VM — branches and Docker
builds never share state or conflict with each other.

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

> Vercel may detect the `backend/` folder and offer to deploy it as a service.
> **Ignore it.** Only deploy the frontend (root `/`). The backend runs on GCP VM.

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

> If you add a custom domain, update `NEXT_PUBLIC_API_BASE_URL` in Vercel and
> `CORS_ORIGINS` in the corresponding env file on the VM.

---

## Backend — GCP VM

Production and staging each live in their **own directory** on the VM. They never
share a git working tree, so `git pull` on one never touches the other.

| Env | Directory | Port | Compose file | Env file |
|---|---|---|---|---|
| Production | `~/arex-platform-prod` | 8000 | `docker-compose.prod.yml` | `.env.prod` |
| Staging | `~/arex-platform-staging` | 8001 | `docker-compose.staging.yml` | `.env.staging` |

### One-time VM setup

```bash
# 1. Create VM (e2-micro or larger), Debian/Ubuntu, enable HTTP traffic

# 2. SSH into VM, install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# log out and back in

# 3. Clone repo twice — one directory per environment
git clone -b main    https://github.com/naxocist/arex.git ~/arex-platform-prod
git clone -b staging https://github.com/naxocist/arex.git ~/arex-platform-staging

# 4. Set up production env file
cp ~/arex-platform-prod/backend/.env.prod.example ~/arex-platform-prod/backend/.env.prod
nano ~/arex-platform-prod/backend/.env.prod
# → fill in Supabase keys, set CORS_ORIGINS to your Vercel production URL

# 5. Set up staging env file
cp ~/arex-platform-staging/backend/.env.staging.example ~/arex-platform-staging/backend/.env.staging
nano ~/arex-platform-staging/backend/.env.staging
# → fill in Supabase keys, set CORS_ORIGINS to your Vercel staging preview URL

# 6. Open ports in GCP firewall
# GCP Console → VPC network → Firewall → Add two ingress rules:
#   Port 8000 (prod):    tcp:8000, Source: 0.0.0.0/0
#   Port 8001 (staging): tcp:8001, Source: 0.0.0.0/0

# 7. Start production backend
cd ~/arex-platform-prod/backend
docker compose -f docker-compose.prod.yml --env-file .env.prod up --build -d

# 8. Start staging backend
cd ~/arex-platform-staging/backend
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

# --- Production ---
cd ~/arex-platform-prod
git pull origin main
cd backend
docker compose -f docker-compose.prod.yml --env-file .env.prod up --build -d
docker image prune -f

# --- Staging ---
cd ~/arex-platform-staging
git pull origin staging
cd backend
docker compose -f docker-compose.staging.yml --env-file .env.staging up --build -d
docker image prune -f
```

### Useful commands on VM

```bash
# --- Production ---
cd ~/arex-platform-prod/backend
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml restart backend

# --- Staging ---
cd ~/arex-platform-staging/backend
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
# Prod
cd ~/arex-platform-prod/backend
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Staging
cd ~/arex-platform-staging/backend
docker compose -f docker-compose.staging.yml --env-file .env.staging up -d
```
