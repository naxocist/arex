# Deployment Guide

## Architecture

```
GitHub branches
  ├── staging → Vercel preview URL  +  Cloud Run service: arex-backend-staging  (HTTPS)
  └── main    → Vercel production   +  Cloud Run service: arex-backend-prod     (HTTPS)

CI/CD pipeline per push:
  1. Build Docker image → push to Artifact Registry (tagged by commit SHA)
  2. Deploy image to Cloud Run
  3. Smoke-check /api/v1/health — rollback if it fails
  4. Upload deploy report artifact to GitHub Actions

App secrets (Supabase keys, CORS origins) live in GCP Secret Manager only.
GitHub Actions deploys code — it never sees or stores app secrets.
Cloud Run pulls secrets from Secret Manager at runtime.

Supabase is always cloud-hosted.
```

### Branch workflow

```
feature branch → merge to staging → test staging → merge to main → prod deploys
```

You can also trigger a deploy manually from GitHub Actions → workflow → "Run workflow"
and specify any branch, tag, or SHA.

---

## Frontend — Vercel

Vercel deploys automatically on every push. No manual steps needed.

- `main` → production URL
- `staging` → preview URL (e.g. `arex-platform-git-staging-yourteam.vercel.app`)

> Vercel may detect the `backend/` folder and offer to deploy it as a service.
> **Ignore it.** Only deploy the frontend (root `/`). The backend runs on Cloud Run.

### One-time Vercel setup

1. Import repo at vercel.com → New Project
2. Framework: **Next.js** (auto-detected)
3. Root directory: `/` (repo root)
4. After Cloud Run is deployed (see below), add env vars in Vercel dashboard → Settings → Environment Variables:

| Variable | Value | Environment |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://arex-backend-prod-xxx.run.app/api/v1` | Production |
| `NEXT_PUBLIC_API_BASE_URL` | `https://arex-backend-staging-xxx.run.app/api/v1` | Preview (staging branch) |

> Get the exact URLs from Cloud Run Console or from the GitHub Actions deploy summary.

5. Deploy. Every future push to `main` or `staging` redeploys automatically.

---

## Backend — GCP Cloud Run + Artifact Registry + Secret Manager

Each environment is a separate Cloud Run **service**. Docker images are built by
GitHub Actions and stored in Artifact Registry, tagged by commit SHA for full
traceability. Secrets are stored in Secret Manager and mounted at runtime.

| Env | Cloud Run service | Image tag |
|---|---|---|
| Production | `arex-backend-prod` | `REGION-docker.pkg.dev/PROJECT/arex-backend/arex-backend:SHA` |
| Staging | `arex-backend-staging` | `REGION-docker.pkg.dev/PROJECT/arex-backend/arex-backend:SHA-staging` |

### One-time GCP setup

```bash
# 1. Create a GCP project (or use existing one)
# GCP Console → New Project, note the Project ID

# 2. Enable required APIs
gcloud config set project YOUR_PROJECT_ID
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com

# 3. Create Artifact Registry repository for Docker images
gcloud artifacts repositories create arex-backend \
  --repository-format docker \
  --location YOUR_REGION \
  --description "AREX backend images"

# 4. Store app secrets in Secret Manager
# Create two separate Supabase projects first — one for prod, one for staging.
# Get each project's URL and keys from supabase.com → Project Settings → API.

# --- Production Supabase ---
echo -n "https://PROD_REF.supabase.co" | \
  gcloud secrets create AREX_PROD_SUPABASE_URL --data-file=-

echo -n "sb_publishable_prod_..." | \
  gcloud secrets create AREX_PROD_SUPABASE_PUBLISHABLE_KEY --data-file=-

echo -n "sb_secret_prod_..." | \
  gcloud secrets create AREX_PROD_SUPABASE_SECRET_KEY --data-file=-

# --- Staging Supabase ---
echo -n "https://STAGING_REF.supabase.co" | \
  gcloud secrets create AREX_STAGING_SUPABASE_URL --data-file=-

echo -n "sb_publishable_staging_..." | \
  gcloud secrets create AREX_STAGING_SUPABASE_PUBLISHABLE_KEY --data-file=-

echo -n "sb_secret_staging_..." | \
  gcloud secrets create AREX_STAGING_SUPABASE_SECRET_KEY --data-file=-

# --- CORS origins ---
echo -n '["https://arex-platform.vercel.app"]' | \
  gcloud secrets create AREX_PROD_CORS_ORIGINS --data-file=-

echo -n '["https://arex-git-staging-naxocists-projects.vercel.app"]' | \
  gcloud secrets create AREX_STAGING_CORS_ORIGINS --data-file=-

# 5. Grant Cloud Run's compute SA read access to all secrets
# Get project number first:
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)")

for secret in AREX_PROD_SUPABASE_URL AREX_PROD_SUPABASE_PUBLISHABLE_KEY AREX_PROD_SUPABASE_SECRET_KEY \
              AREX_STAGING_SUPABASE_URL AREX_STAGING_SUPABASE_PUBLISHABLE_KEY AREX_STAGING_SUPABASE_SECRET_KEY \
              AREX_PROD_CORS_ORIGINS AREX_STAGING_CORS_ORIGINS; do
  gcloud secrets add-iam-policy-binding $secret \
    --member "serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role "roles/secretmanager.secretAccessor"
done

# 6. Create Service Account for GitHub Actions (deploy + push images only — no secret access)
gcloud iam service-accounts create arex-github-deployer \
  --display-name "GitHub Actions Deployer"

for role in roles/run.admin roles/storage.admin roles/iam.serviceAccountUser roles/artifactregistry.admin; do
  gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member "serviceAccount:arex-github-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role "${role}"
done

# 7. Create and download a JSON key for arex-github-deployer
gcloud iam service-accounts keys create ~/gcp-sa-key.json \
  --iam-account arex-github-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com
# Copy full contents → GitHub secret GCP_SA_KEY
rm ~/gcp-sa-key.json   # delete local copy immediately
```

### GitHub Actions secrets (one-time)

Only infrastructure credentials go in GitHub — **no app secrets**:

| Secret | Value |
|---|---|
| `GCP_SA_KEY` | Full JSON contents of the arex-github-deployer service account key |
| `GCP_PROJECT_ID` | Your GCP project ID (can also be a repo variable) |
| `GCP_REGION` | Artifact Registry + Cloud Run region, e.g. `asia-southeast1` |

After this, deploys are fully automatic:
- Push to `main` touching `backend/` → [deploy-backend.yml](.github/workflows/deploy-backend.yml) runs
- Push to `staging` touching `backend/` → [deploy-backend-staging.yml](.github/workflows/deploy-backend-staging.yml) runs
- Manual trigger available on both workflows from GitHub Actions UI

### What the CI/CD pipeline does

Each workflow run:
1. **Resolves config** — ref, project ID, region, image URI
2. **Validates** — backend dir exists, `GCP_SA_KEY` is set
3. **Builds image** — `docker buildx build --platform linux/amd64 --target prod`, pushes two tags: `SHA` (immutable) and `latest`/`staging` (floating)
4. **Deploys** — `gcloud run deploy --image SHA-tag --set-secrets ...`
5. **Smoke checks** — `curl` hits `/api/v1/health` with 5 retries; fails pipeline if unhealthy
6. **Publishes summary** — table in GitHub Actions step summary
7. **Uploads artifact** — `backend-cicd-report-prod` or `backend-cicd-report-staging` containing `build.log`, `deploy.log`, `healthcheck.log`, `service.json`, `deployment-summary.json`

Concurrency is locked per environment — a second push while a deploy is running
will wait, not cancel the in-flight deploy.

### First deploy (before GitHub Actions has ever run)

```bash
# Authenticate locally
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Build and push image manually
REGION=YOUR_REGION
PROJECT=YOUR_PROJECT_ID
SHA=$(git rev-parse HEAD)
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/arex-backend/arex-backend"

gcloud auth configure-docker "${REGION}-docker.pkg.dev"

docker buildx build --platform linux/amd64 --target prod \
  --provenance=false \
  --tag "${IMAGE}:${SHA}" --tag "${IMAGE}:latest" \
  --push ./backend

# Deploy production
gcloud run deploy arex-backend-prod \
  --image "${IMAGE}:${SHA}" \
  --region "${REGION}" \
  --allow-unauthenticated \
  --set-secrets "SUPABASE_URL=AREX_PROD_SUPABASE_URL:latest,SUPABASE_PUBLISHABLE_KEY=AREX_PROD_SUPABASE_PUBLISHABLE_KEY:latest,SUPABASE_SECRET_KEY=AREX_PROD_SUPABASE_SECRET_KEY:latest,CORS_ORIGINS=AREX_PROD_CORS_ORIGINS:latest"

# Deploy staging
gcloud run deploy arex-backend-staging \
  --image "${IMAGE}:${SHA}-staging" \
  --region "${REGION}" \
  --allow-unauthenticated \
  --set-secrets "SUPABASE_URL=AREX_STAGING_SUPABASE_URL:latest,SUPABASE_PUBLISHABLE_KEY=AREX_STAGING_SUPABASE_PUBLISHABLE_KEY:latest,SUPABASE_SECRET_KEY=AREX_STAGING_SUPABASE_SECRET_KEY:latest,CORS_ORIGINS=AREX_STAGING_CORS_ORIGINS:latest"
```

Both commands print the HTTPS service URL at the end — paste into Vercel env vars.

### Rotating or updating a secret

Update in Secret Manager, then force a new revision — no code change needed:

```bash
# Update the secret value (example: rotate prod Supabase secret key)
echo -n "new_value" | gcloud secrets versions add AREX_PROD_SUPABASE_SECRET_KEY --data-file=-

# Apply to running service (zero downtime)
gcloud run services update arex-backend-prod \
  --region YOUR_REGION \
  --update-secrets "SUPABASE_SECRET_KEY=AREX_PROD_SUPABASE_SECRET_KEY:latest"
```

### Useful commands

```bash
# List Cloud Run services
gcloud run services list --region YOUR_REGION

# View live logs
gcloud run services logs read arex-backend-prod    --region YOUR_REGION --limit 100
gcloud run services logs read arex-backend-staging --region YOUR_REGION --limit 100

# Describe a service (image, secrets, env, revision)
gcloud run services describe arex-backend-prod --region YOUR_REGION

# List images in Artifact Registry
gcloud artifacts docker images list \
  YOUR_REGION-docker.pkg.dev/YOUR_PROJECT_ID/arex-backend
```

---

## Local dev (unchanged)

```bash
mise run dev:up    # Supabase + frontend + backend with hot reload
mise run dev:down  # stop everything
```

---

## Environment variables reference

| Variable | Stored in | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Vercel dashboard | Cloud Run HTTPS URL the browser calls |
| `AREX_PROD_SUPABASE_URL` | GCP Secret Manager | Prod Supabase project URL |
| `AREX_PROD_SUPABASE_PUBLISHABLE_KEY` | GCP Secret Manager | Prod Supabase anon/publishable key |
| `AREX_PROD_SUPABASE_SECRET_KEY` | GCP Secret Manager | Prod Supabase service role key |
| `AREX_STAGING_SUPABASE_URL` | GCP Secret Manager | Staging Supabase project URL |
| `AREX_STAGING_SUPABASE_PUBLISHABLE_KEY` | GCP Secret Manager | Staging Supabase anon/publishable key |
| `AREX_STAGING_SUPABASE_SECRET_KEY` | GCP Secret Manager | Staging Supabase service role key |
| `AREX_PROD_CORS_ORIGINS` | GCP Secret Manager | Allowed origins for production Cloud Run |
| `AREX_STAGING_CORS_ORIGINS` | GCP Secret Manager | Allowed origins for staging Cloud Run |
| `GCP_SA_KEY` | GitHub Actions secret | arex-github-deployer service account JSON key |
| `GCP_PROJECT_ID` | GitHub Actions secret/var | GCP project ID |
| `GCP_REGION` | GitHub Actions secret/var | Artifact Registry + Cloud Run region |

---

## CORS note

`CORS_ORIGINS` is mounted from Secret Manager — `AREX_PROD_CORS_ORIGINS` for production,
`AREX_STAGING_CORS_ORIGINS` for staging. To update after a Vercel URL change:

```bash
echo -n '["https://new-url.vercel.app"]' | \
  gcloud secrets versions add AREX_PROD_CORS_ORIGINS --data-file=-

gcloud run services update arex-backend-prod \
  --region YOUR_REGION \
  --update-secrets "CORS_ORIGINS=AREX_PROD_CORS_ORIGINS:latest"
```
