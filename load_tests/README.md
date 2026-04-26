# AREX Load Tests

Locust-based load tests targeting the staging API.

## Prerequisites

- Python 3.11+, uv (`mise run setup` covers this)
- `load_tests/.env` with values filled in (copy from `load_tests/.env.example`)

## Run locally (web UI)

```bash
mise run load-test
```

Opens Locust web UI at http://localhost:8089. Set users/spawn rate in the UI, click Start.

## Run locally (headless)

```bash
mise run load-test:headless
```

Outputs `load_tests/report.html`. Open in browser to view results.

Override defaults:

```bash
LOCUST_USERS=100 LOCUST_SPAWN_RATE=10 LOCUST_RUN_TIME=10m mise run load-test:headless
```

> **Note:** Supabase JWT tokens expire after 1 hour. Keep `LOCUST_RUN_TIME` under 55 minutes to avoid 401 failures mid-run.

## Run via GitHub Actions

1. Go to **Actions → Load Test → Run workflow**
2. Set `users`, `spawn_rate`, `run_time` inputs
3. Click **Run workflow**
4. After completion, download `locust-report-<run_id>` artifact from the run page

Required GitHub secrets (set once in repo Settings → Secrets → Actions):

| Secret | Description |
|--------|-------------|
| `STAGING_TARGET_HOST` | Cloud Run staging URL |
| `STAGING_LOAD_TEST_LOGISTICS_EMAIL` | Staging logistics account email |
| `STAGING_LOAD_TEST_LOGISTICS_PASSWORD` | Staging logistics account password |
| `STAGING_LOAD_TEST_FACTORY_EMAIL` | Staging factory account email |
| `STAGING_LOAD_TEST_FACTORY_PASSWORD` | Staging factory account password |
| `STAGING_LOAD_TEST_WAREHOUSE_EMAIL` | Staging warehouse account email |
| `STAGING_LOAD_TEST_WAREHOUSE_PASSWORD` | Staging warehouse account password |
| `STAGING_LOAD_TEST_ADMIN_EMAIL` | Staging admin account email (approves load test farmers) |
| `STAGING_LOAD_TEST_ADMIN_PASSWORD` | Staging admin account password |

## Maintenance

When an API endpoint changes, find the corresponding file:

| Changed route file | Update load test file |
|-------------------|-----------------------|
| `backend/app/api/routes/farmer.py` | `load_tests/users/farmer.py` |
| `backend/app/api/routes/logistics.py` | `load_tests/users/logistics.py` |
| `backend/app/api/routes/factory.py` | `load_tests/users/factory.py` |
| `backend/app/api/routes/warehouse.py` | `load_tests/users/warehouse.py` |
| Auth changes | `load_tests/common/auth.py` |
| New env vars | `load_tests/common/config.py` + `load_tests/.env.example` |

## User weights

| User class | Weight | Simulates |
|------------|--------|-----------|
| FarmerUser | 5 | Self-register, get approved, browse, submit material, request/cancel reward |
| LogisticsUser | 2 | Queue check, full pickup cycle, reward delivery cycle |
| FactoryUser | 2 | Browse intakes, confirm intake |
| WarehouseUser | 1 | Review + approve reward requests |

## Post-run cleanup

Each load test run creates real DB records that must be manually removed.

### 1. Delete farmer accounts (cascades everything)

In **Supabase Dashboard → Authentication → Users**, filter by email and delete all `loadtest.farmer.*@arex-load.test` accounts.

This cascades:
`profiles` → `submissions` → `pickup_jobs` → `factory_intakes` → `points_ledger` → `reward_requests` → `reward_delivery_jobs`

### 2. Clean orphaned status_events (not covered by cascade)

`status_events` stores audit trail rows keyed by `entity_id` (bare UUID, no FK). Deleting submissions leaves orphan rows behind.

```sql
DELETE FROM status_events
WHERE entity_type = 'submission'
  AND entity_id NOT IN (SELECT id FROM submissions);
```

Run this in **Supabase Dashboard → SQL Editor** after step 1.

### Notes

- Logistics, factory, and warehouse users are pre-existing seeded accounts — no cleanup needed for those roles.
- At typical load (50 users, 5 min run), expect ~500–1000 orphan `status_events` rows.
