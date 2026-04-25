import logging
import random
from locust import task, between
from common.client import ArexClient
from common import config


_MATERIAL_TYPES = ["rice_straw", "orchard_residue", "plastic_waste"]


class FactoryUser(ArexClient):
    weight = 2
    wait_time = between(2, 6)
    _email = config.FACTORY_EMAIL
    _password = config.FACTORY_PASSWORD

    def setup(self) -> None:
        r = self.client.put(
            "/api/v1/factory/material-preferences",
            json={
                "items": [
                    {
                        "material_type_code": code,
                        "accepts": True,
                        "capacity_value": 10000,
                        "capacity_unit_code": "kg",
                        "minimum_amount_value": 1,
                        "minimum_amount_unit_code": "kg",
                    }
                    for code in _MATERIAL_TYPES
                ]
            },
            name="PUT /factory/material-preferences",
        )
        if r.status_code != 200:
            logging.warning("FactoryUser setup failed: %s %s", r.status_code, r.text[:200])

    @task(3)
    def browse(self) -> None:
        self.client.get("/api/v1/factory/intakes/pending", name="GET /factory/intakes/pending")
        self.client.get("/api/v1/factory/me", name="GET /factory/me")

    @task(2)
    def confirm_intake(self) -> None:
        r = self.client.get("/api/v1/factory/intakes/pending", name="GET /factory/intakes/pending")
        if r.status_code != 200:
            return
        intakes = r.json()
        if not intakes:
            return
        intake = random.choice(intakes)
        job_id = intake.get("pickup_job_id")
        if not job_id:
            return
        self.client.post(
            "/api/v1/factory/intakes/confirm",
            json={
                "pickup_job_id": job_id,
                "measured_weight_kg": round(random.uniform(50, 400), 1),
                "discrepancy_note": "",
            },
            name="POST /factory/intakes/confirm",
        )
