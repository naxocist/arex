# AREX Load Tests

Locust-based load tests targeting the staging API.

## Prerequisites

- Python 3.11+, uv (`mise run setup` covers this)
- `backend/.env.staging` with `LOAD_TEST_*` vars filled in (see `backend/.env.staging.example`)

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

## Run via GitHub Actions

1. Go to **Actions → Load Test → Run workflow**
2. Set `users`, `spawn_rate`, `run_time` inputs
3. Click **Run workflow**
4. After completion, download `locust-report-<run_id>` artifact from the run page

Required GitHub secrets (set once in repo Settings → Secrets → Actions):

| Secret | Description |
|--------|-------------|
| `STAGING_TARGET_HOST` | Cloud Run staging URL |
| `STAGING_LOAD_TEST_FARMER_EMAIL` | Staging farmer account email |
| `STAGING_LOAD_TEST_FARMER_PASSWORD` | Staging farmer account password |
| `STAGING_LOAD_TEST_LOGISTICS_EMAIL` | Staging logistics account email |
| `STAGING_LOAD_TEST_LOGISTICS_PASSWORD` | Staging logistics account password |
| `STAGING_LOAD_TEST_FACTORY_EMAIL` | Staging factory account email |
| `STAGING_LOAD_TEST_FACTORY_PASSWORD` | Staging factory account password |
| `STAGING_LOAD_TEST_WAREHOUSE_EMAIL` | Staging warehouse account email |
| `STAGING_LOAD_TEST_WAREHOUSE_PASSWORD` | Staging warehouse account password |

## Maintenance

When an API endpoint changes, find the corresponding file:

| Changed route file | Update load test file |
|-------------------|-----------------------|
| `backend/app/api/routes/farmer.py` | `load_tests/users/farmer.py` |
| `backend/app/api/routes/logistics.py` | `load_tests/users/logistics.py` |
| `backend/app/api/routes/factory.py` | `load_tests/users/factory.py` |
| `backend/app/api/routes/warehouse.py` | `load_tests/users/warehouse.py` |
| Auth changes | `load_tests/common/auth.py` |
| New env vars | `load_tests/common/config.py` + `backend/.env.staging.example` |

## User weights

| User class | Weight | Simulates |
|------------|--------|-----------|
| FarmerUser | 5 | Browse, submit material, request reward |
| LogisticsUser | 2 | Queue check, full pickup cycle, reward delivery cycle |
| FactoryUser | 2 | Browse intakes, confirm intake |
| WarehouseUser | 1 | Review + approve reward requests |
