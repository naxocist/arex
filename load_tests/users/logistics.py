import random
from datetime import datetime, timedelta, timezone
from locust import task, between
from common.client import ArexClient
from common import config


def _window() -> tuple[str, str]:
    now = datetime.now(timezone.utc)
    start = now + timedelta(hours=2)
    end = start + timedelta(hours=4)
    return start.isoformat(), end.isoformat()


class LogisticsUser(ArexClient):
    weight = 2
    wait_time = between(2, 5)
    _email = config.LOGISTICS_EMAIL
    _password = config.LOGISTICS_PASSWORD

    @task(3)
    def check_queue(self) -> None:
        self.client.get("/api/v1/logistics/pickup-queue", name="GET /logistics/pickup-queue")
        self.client.get(
            "/api/v1/logistics/factories",
            name="GET /logistics/factories",
        )

    @task(2)
    def run_pickup_cycle(self) -> None:
        # 1. Get a pending submission from the queue
        r = self.client.get("/api/v1/logistics/pickup-queue", name="GET /logistics/pickup-queue")
        if r.status_code != 200:
            return
        queue = r.json().get("queue", [])
        if not queue:
            return
        submission = random.choice(queue)
        submission_id = submission["id"]
        material_type = submission.get("material_type_code", "rice_straw")
        qty_kg = submission.get("quantity_kg", 100)

        # 2. Find a matching factory
        r = self.client.get(
            "/api/v1/logistics/factories",
            params={"material_type": material_type, "quantity_kg": qty_kg, "submission_id": submission_id},
            name="GET /logistics/factories",
        )
        factories = r.json().get("factories", []) if r.status_code == 200 else []
        if not factories:
            return
        factory_id = factories[0]["id"]

        # 3. Schedule pickup
        start, end = _window()
        r = self.client.post(
            f"/api/v1/logistics/pickup-jobs/{submission_id}/schedule",
            json={
                "pickup_window_start_at": start,
                "pickup_window_end_at": end,
                "destination_factory_id": factory_id,
                "notes": "load test pickup",
            },
            name="POST /logistics/pickup-jobs/{id}/schedule",
        )
        if r.status_code != 200:
            return
        job_id = r.json().get("result", {}).get("pickup_job_id")
        if not job_id:
            return

        # 4. Mark picked up
        r = self.client.post(
            f"/api/v1/logistics/pickup-jobs/{job_id}/picked-up",
            name="POST /logistics/pickup-jobs/{id}/picked-up",
        )
        if r.status_code != 200:
            return

        # 5. Mark delivered to factory
        self.client.post(
            f"/api/v1/logistics/pickup-jobs/{job_id}/delivered-to-factory",
            name="POST /logistics/pickup-jobs/{id}/delivered-to-factory",
        )

    @task(1)
    def run_delivery_cycle(self) -> None:
        # 1. Get approved reward requests
        r = self.client.get(
            "/api/v1/logistics/reward-requests/approved",
            name="GET /logistics/reward-requests/approved",
        )
        if r.status_code != 200:
            return
        approved = r.json().get("queue", [])
        if not approved:
            return
        request_id = approved[0]["id"]

        # 2. Schedule delivery
        start, end = _window()
        r = self.client.post(
            f"/api/v1/logistics/reward-delivery-jobs/{request_id}/schedule",
            json={
                "delivery_window_start_at": start,
                "delivery_window_end_at": end,
                "notes": "load test delivery",
            },
            name="POST /logistics/reward-delivery-jobs/{id}/schedule",
        )
        if r.status_code != 200:
            return
        job_id = r.json().get("result", {}).get("delivery_job_id")
        if not job_id:
            return

        # 3. Out for delivery
        r = self.client.post(
            f"/api/v1/logistics/reward-delivery-jobs/{job_id}/out-for-delivery",
            name="POST /logistics/reward-delivery-jobs/{id}/out-for-delivery",
        )
        if r.status_code != 200:
            return

        # 4. Delivered
        self.client.post(
            f"/api/v1/logistics/reward-delivery-jobs/{job_id}/delivered",
            name="POST /logistics/reward-delivery-jobs/{id}/delivered",
        )
