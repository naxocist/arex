"""
Farmer lifecycle load test.

Each virtual user:
  1. Registers a unique farmer account (POST /auth/register/farmer)
  2. Uses admin credentials to approve that account (POST /admin/accounts/{id}/toggle)
  3. Browses dashboard (submissions, points, rewards, profile)
  4. Submits materials
  5. Requests a reward when points allow
  6. Occasionally cancels a pending reward request
  7. Occasionally deletes a pending submission

One ArexClient login per role is shared across all instances of that role class,
but FarmerUser needs per-instance tokens because each virtual user is a distinct
registered account. We therefore manage auth manually rather than relying on
ArexClient.on_start().
"""

import random
import time
import uuid
import logging
from locust import HttpUser, task, between
from common import config

log = logging.getLogger(__name__)

_PROVINCES = [
    "เชียงใหม่", "เชียงราย", "ลำปาง", "พะเยา",
    "สระบุรี", "อยุธยา", "ชัยนาท", "ลพบุรี",
    "นครราชสีมา", "ขอนแก่น", "อุบลราชธานี", "สุรินทร์",
]

_LOC_VARIANTS = [
    (13.7563, 100.5018),   # Bangkok area
    (18.7883, 98.9853),    # Chiang Mai
    (14.9799, 102.0978),   # Nakhon Ratchasima
    (16.4419, 102.8360),   # Khon Kaen
]


def _coords() -> tuple[float, float]:
    base_lat, base_lng = random.choice(_LOC_VARIANTS)
    return (
        round(base_lat + random.uniform(-0.3, 0.3), 6),
        round(base_lng + random.uniform(-0.3, 0.3), 6),
    )


class FarmerUser(HttpUser):
    weight = 5
    wait_time = between(2, 5)
    host = config.TARGET_HOST

    # Per-instance state
    _token: str = ""
    _profile_id: str = ""
    _ready: bool = False
    _material_types: list[dict] = []
    _units: list[dict] = []

    # ---------- lifecycle ----------

    def on_start(self) -> None:
        suffix = uuid.uuid4().hex[:10]
        email = f"loadtest.farmer.{suffix}@arex-load.test"
        password = "LoadTest1!"
        display_name = f"Load Farmer {suffix[:6]}"
        phone = f"06{random.randint(10000000, 99999999)}"
        province = random.choice(_PROVINCES)

        # 1. Register
        with self.client.post(
            "/api/v1/auth/register/farmer",
            json={
                "email": email,
                "password": password,
                "display_name": display_name,
                "phone": phone,
                "province": province,
            },
            catch_response=True,
            name="POST /auth/register/farmer",
        ) as resp:
            if resp.status_code not in (200, 201):
                resp.failure(f"Registration failed: {resp.status_code} {resp.text[:200]}")
                log.warning("FarmerUser registration failed — this virtual user will be idle")
                return
            data = resp.json()
            self._token = data["access_token"]
            self._profile_id = data["user"]["id"]
            approval = data.get("approval_status", "active")
            resp.success()

        # 2. Approve if required (admin toggles inactive → active)
        if approval != "active":
            self._admin_approve(self._profile_id)

        self.client.headers.update({"Authorization": f"Bearer {self._token}"})

        # Give Supabase a moment to commit the profile row before querying it
        time.sleep(1)

        # 3. Verify profile exists before running tasks
        r = self.client.get("/api/v1/farmer/profile", name="GET /farmer/profile")
        if r.status_code != 200:
            log.warning("FarmerUser profile missing after registration (id=%s) — this virtual user will be idle", self._profile_id)
            return

        # 4. Fetch reference data
        r = self.client.get("/api/v1/farmer/material-types", name="GET /farmer/material-types")
        if r.status_code == 200:
            self._material_types = r.json().get("material_types", [])

        r = self.client.get("/api/v1/farmer/measurement-units", name="GET /farmer/measurement-units")
        if r.status_code == 200:
            self._units = r.json().get("units", [])

        self._ready = True

    def _admin_approve(self, profile_id: str) -> None:
        """Toggle the new farmer account from inactive → active using admin credentials."""
        with self.client.post(
            "/api/v1/auth/login",
            json={"email": config.ADMIN_EMAIL, "password": config.ADMIN_PASSWORD},
            catch_response=True,
            name="POST /auth/login (admin)",
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"Admin login failed: {resp.status_code}")
                log.warning("Admin login failed — farmer %s will remain inactive", profile_id)
                return
            admin_token = resp.json()["access_token"]
            resp.success()

        with self.client.post(
            f"/api/v1/admin/accounts/{profile_id}/toggle",
            headers={"Authorization": f"Bearer {admin_token}"},
            catch_response=True,
            name="POST /admin/accounts/{id}/toggle",
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"Approval toggle failed: {resp.status_code} {resp.text[:200]}")
                log.warning("Could not approve farmer %s", profile_id)
            else:
                resp.success()

    # ---------- tasks ----------

    @task(4)
    def browse_dashboard(self) -> None:
        if not self._ready:
            return
        self.client.get("/api/v1/farmer/profile", name="GET /farmer/profile")
        self.client.get("/api/v1/farmer/submissions", name="GET /farmer/submissions")
        self.client.get("/api/v1/farmer/points", name="GET /farmer/points")
        self.client.get("/api/v1/farmer/rewards", name="GET /farmer/rewards")
        self.client.get("/api/v1/farmer/reward-requests", name="GET /farmer/reward-requests")

    @task(3)
    def submit_material(self) -> None:
        if not self._ready or not self._material_types or not self._units:
            return
        material = random.choice(self._material_types)
        unit = random.choice(self._units)
        lat, lng = _coords()
        self.client.post(
            "/api/v1/farmer/submissions",
            json={
                "material_type": material["code"],
                "quantity_value": round(random.uniform(50, 500), 1),
                "quantity_unit": unit["code"],
                "pickup_location_text": f"ฟาร์มทดสอบ ตำบลทดสอบ {random.randint(1, 99)}",
                "pickup_lat": lat,
                "pickup_lng": lng,
                "notes": "load test submission",
            },
            name="POST /farmer/submissions",
        )

    @task(2)
    def request_reward(self) -> None:
        if not self._ready:
            return
        r = self.client.get("/api/v1/farmer/points", name="GET /farmer/points")
        if r.status_code != 200:
            return
        available = r.json().get("available_points", 0)
        if available <= 0:
            return

        r = self.client.get("/api/v1/farmer/rewards", name="GET /farmer/rewards")
        if r.status_code != 200:
            return
        affordable = [rw for rw in r.json().get("rewards", []) if rw.get("points_cost", float("inf")) <= available]
        if not affordable:
            return

        reward = random.choice(affordable)
        lat, lng = _coords()
        self.client.post(
            "/api/v1/farmer/reward-requests",
            json={
                "reward_id": reward["id"],
                "quantity": 1,
                "delivery_location_text": f"บ้านทดสอบ ตำบลทดสอบ {random.randint(1, 99)}",
                "delivery_lat": lat,
                "delivery_lng": lng,
            },
            name="POST /farmer/reward-requests",
        )

    @task(1)
    def cancel_pending_reward(self) -> None:
        if not self._ready:
            return
        r = self.client.get("/api/v1/farmer/reward-requests", name="GET /farmer/reward-requests")
        if r.status_code != 200:
            return
        pending = [rq for rq in r.json().get("requests", []) if rq.get("status") == "pending"]
        if not pending:
            return
        target = random.choice(pending)
        self.client.post(
            f"/api/v1/farmer/reward-requests/{target['id']}/cancel",
            name="POST /farmer/reward-requests/{id}/cancel",
        )

    @task(1)
    def delete_pending_submission(self) -> None:
        if not self._ready:
            return
        r = self.client.get("/api/v1/farmer/submissions", name="GET /farmer/submissions")
        if r.status_code != 200:
            return
        deletable = [s for s in r.json().get("submissions", []) if s.get("status") == "submitted"]
        if not deletable:
            return
        target = random.choice(deletable)
        self.client.delete(
            f"/api/v1/farmer/submissions/{target['id']}",
            name="DELETE /farmer/submissions/{id}",
        )

    @task(1)
    def update_profile(self) -> None:
        if not self._ready:
            return
        province = random.choice(_PROVINCES)
        self.client.patch(
            "/api/v1/farmer/profile",
            json={"province": province},
            name="PATCH /farmer/profile",
        )
