import random
from locust import task, between
from common.client import ArexClient
from common import config


class WarehouseUser(ArexClient):
    weight = 1
    wait_time = between(3, 8)
    _email = config.WAREHOUSE_EMAIL
    _password = config.WAREHOUSE_PASSWORD

    @task(3)
    def review_requests(self) -> None:
        self.client.get(
            "/api/v1/warehouse/reward-requests/pending",
            name="GET /warehouse/reward-requests/pending",
        )

    @task(1)
    def approve_request(self) -> None:
        r = self.client.get(
            "/api/v1/warehouse/reward-requests/pending",
            name="GET /warehouse/reward-requests/pending",
        )
        if r.status_code != 200:
            return
        requests = r.json()
        if not requests:
            return
        request_id = random.choice(requests)["id"]
        self.client.post(
            f"/api/v1/warehouse/reward-requests/{request_id}/approve",
            name="POST /warehouse/reward-requests/{id}/approve",
        )
