import random
from locust import task, between
from common.client import ArexClient
from common import config


class FarmerUser(ArexClient):
    weight = 5
    wait_time = between(1, 3)
    _email = config.FARMER_EMAIL
    _password = config.FARMER_PASSWORD

    _material_types: list[dict] = []
    _units: list[dict] = []

    def setup(self) -> None:
        r = self.client.get("/api/v1/farmer/material-types", name="GET /farmer/material-types")
        if r.status_code == 200:
            self._material_types = r.json()
        r = self.client.get("/api/v1/farmer/measurement-units", name="GET /farmer/measurement-units")
        if r.status_code == 200:
            self._units = r.json()

    @task(3)
    def browse(self) -> None:
        self.client.get("/api/v1/farmer/submissions", name="GET /farmer/submissions")
        self.client.get("/api/v1/farmer/points", name="GET /farmer/points")
        self.client.get("/api/v1/farmer/rewards", name="GET /farmer/rewards")

    @task(2)
    def submit_material(self) -> None:
        if not self._material_types or not self._units:
            return
        material = random.choice(self._material_types)
        unit = random.choice(self._units)
        self.client.post(
            "/api/v1/farmer/submissions",
            json={
                "material_type_code": material["code"],
                "quantity_value": round(random.uniform(50, 500), 1),
                "quantity_unit_code": unit["code"],
                "pickup_location_text": "Test Farm, Load Test Province",
                "pickup_lat": 13.7563 + random.uniform(-0.5, 0.5),
                "pickup_lng": 100.5018 + random.uniform(-0.5, 0.5),
                "notes": "load test submission",
            },
            name="POST /farmer/submissions",
        )

    @task(1)
    def request_reward(self) -> None:
        r = self.client.get("/api/v1/farmer/points", name="GET /farmer/points")
        if r.status_code != 200:
            return
        points = r.json().get("balance", 0)
        if points <= 0:
            return

        r = self.client.get("/api/v1/farmer/rewards", name="GET /farmer/rewards")
        if r.status_code != 200:
            return
        rewards = [rw for rw in r.json() if rw.get("points_cost", 9999) <= points]
        if not rewards:
            return

        reward = random.choice(rewards)
        self.client.post(
            "/api/v1/farmer/reward-requests",
            json={
                "reward_id": reward["id"],
                "quantity": 1,
                "delivery_location_text": "Test Farm, Load Test Province",
                "delivery_lat": 13.7563 + random.uniform(-0.5, 0.5),
                "delivery_lng": 100.5018 + random.uniform(-0.5, 0.5),
            },
            name="POST /farmer/reward-requests",
        )
