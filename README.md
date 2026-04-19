# PMUC Zero Burn to Earn

A supply-chain platform that turns agricultural residue (rice straw, orchard waste, plastic) into PMUC coins — connecting farmers, logistics teams, factories, warehouses, and executives in a points-based circular economy.

Farmers earn coins when factories confirm the weight of collected material. Coins can be redeemed for rewards delivered by logistics. Executives configure material types, point rates, and the rewards catalog.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 |
| Backend | FastAPI (Python 3.11) · Pydantic v2 · supabase-py |
| Database | Supabase (PostgreSQL) · RLS on all tables |
| Dev tooling | mise · Docker Compose with watch |
| Frontend deploy | Vercel (auto on push) |
| Backend deploy | GCP Cloud Run via GitHub Actions |

## Quick Start

**Prerequisites:** `mise`, Docker Desktop

```bash
mise run setup     # install deps (npm + uv)
mise run dev:up    # start Supabase + containers with hot reload
```

Local URLs: frontend `http://localhost:3000` · API `http://localhost:8000/api/v1` · Supabase Studio `http://127.0.0.1:54323`

Reset DB + seed demo data:
```bash
mise run db:reset
```