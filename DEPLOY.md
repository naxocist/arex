# Deployment Guide

## Architecture

```
GitHub (main branch)
  ├── push → Vercel       (frontend, auto)
  └── push → GCP VM       (backend, via GitHub Actions)
               └── backend/docker-compose.prod.yml (uvicorn, port 8000)
```

Supabase is always the cloud-hosted project. No local Supabase in production.

---

## Frontend — Vercel

Vercel deploys automatically on every push to `main`. No manual steps needed after initial setup.

### One-time Vercel setup

1. Import repo at vercel.com → New Project
2. Framework: **Next.js** (auto-detected)
3. Root directory: `/` (repo root)
4. Add environment variable in Vercel dashboard:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://YOUR_VM_IP:8000/api/v1` |

5. Deploy. Every future push to `main` redeploys automatically.

> If you add a custom domain later, update `NEXT_PUBLIC_API_BASE_URL` in Vercel and `CORS_ORIGINS` in `backend/.env.prod` on the VM.

---

## Backend — GCP VM

### One-time VM setup

```bash
# 1. Create VM (e2-micro or larger), Debian/Ubuntu, enable HTTP traffic

# 2. SSH into VM, install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# log out and back in

# 3. Clone repo
git clone https://github.com/YOUR_ORG/arex-platform.git ~/arex-platform

# 4. Create env file
cp ~/arex-platform/backend/.env.prod.example ~/arex-platform/backend/.env.prod
nano ~/arex-platform/backend/.env.prod   # fill in Supabase keys + Vercel URL for CORS_ORIGINS

# 5. Open port 8000 in GCP firewall
# GCP Console → VPC network → Firewall → Add rule:
#   Direction: Ingress, Port: tcp:8000, Source: 0.0.0.0/0

# 6. Start backend
cd ~/arex-platform/backend
docker compose -f docker-compose.prod.yml --env-file .env.prod up --build -d
```

### GitHub Actions auto-deploy setup (one-time)

Add these secrets in GitHub → Settings → Secrets → Actions:

| Secret | Value |
|---|---|
| `GCP_VM_HOST` | VM public IP |
| `GCP_VM_USER` | SSH username (e.g. `ubuntu`) |
| `GCP_VM_SSH_KEY` | Private SSH key that has access to the VM |

After this, every push to `main` that touches `backend/` auto-deploys via [`.github/workflows/deploy-backend.yml`](.github/workflows/deploy-backend.yml).

### Manual deploy (if needed)

```bash
ssh user@YOUR_VM_IP
cd ~/arex-platform
git pull origin main
cd backend
docker compose -f docker-compose.prod.yml --env-file .env.prod up --build -d
docker image prune -f
```

### Useful commands on VM

```bash
cd ~/arex-platform/backend

# Tail logs
docker compose -f docker-compose.prod.yml logs -f

# Stop
docker compose -f docker-compose.prod.yml down

# Restart
docker compose -f docker-compose.prod.yml restart backend
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
| `SUPABASE_URL` | `backend/.env.prod` on VM | Supabase cloud project URL |
| `SUPABASE_PUBLISHABLE_KEY` | `backend/.env.prod` on VM | Supabase anon/publishable key |
| `SUPABASE_SECRET_KEY` | `backend/.env.prod` on VM | Supabase service role key |
| `CORS_ORIGINS` | `backend/.env.prod` on VM | JSON array of allowed origins, e.g. `["https://your-app.vercel.app"]` |

---

## CORS note

When you add or change the Vercel URL or a custom domain, update `CORS_ORIGINS` in `backend/.env.prod` on the VM and restart:

```bash
cd ~/arex-platform/backend
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```
