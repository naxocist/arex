import json
import urllib.request
from typing import Any

from app.core.config import get_settings
from app.services._base import BaseService


class DistanceService(BaseService):
    """Handles OSRM route lookups and the logistics_distances cache table."""

    def _fetch_osrm_distance(
        self, lat1: float, lng1: float, lat2: float, lng2: float
    ) -> float | None:
        try:
            osrm_url = get_settings().osrm_url
            url = f"{osrm_url}/{lng1},{lat1};{lng2},{lat2}?overview=false"
            with urllib.request.urlopen(url, timeout=5) as resp:  # noqa: S310
                data = json.loads(resp.read())
            return float(data["routes"][0]["distance"]) / 1000.0
        except Exception:
            return None

    def _upsert_distance(
        self,
        logistics_profile_id: str,
        reference_type: str,
        reference_id: str,
        leg: str,
        distance_km: float | None,
    ) -> None:
        try:
            self.client.table("logistics_distances").upsert({
                "logistics_profile_id": logistics_profile_id,
                "reference_type": reference_type,
                "reference_id": reference_id,
                "leg": leg,
                "distance_km": distance_km,
            }).execute()
        except Exception:
            pass

    def _fetch_distances(
        self,
        logistics_profile_id: str,
        reference_type: str,
        reference_ids: list[str],
    ) -> dict[tuple[str, str], float | None]:
        if not reference_ids:
            return {}
        try:
            rows = (
                self.client.table("logistics_distances")
                .select("reference_id, leg, distance_km")
                .eq("logistics_profile_id", logistics_profile_id)
                .eq("reference_type", reference_type)
                .in_("reference_id", reference_ids)
                .execute()
            ).data or []
            return {(str(row["reference_id"]), row["leg"]): row.get("distance_km") for row in rows}
        except Exception:
            return {}

    def _update_pickup_job_distances(self, pickup_job_id: str) -> None:
        try:
            job_rows = (
                self.client.table("pickup_jobs")
                .select("id, logistics_profile_id, submission_id, destination_factory_id")
                .eq("id", pickup_job_id)
                .limit(1)
                .execute()
            ).data or []
            if not job_rows:
                return
            job = job_rows[0]

            logistics_rows = (
                self.client.table("org_accounts")
                .select("lat, lng")
                .eq("profile_id", job["logistics_profile_id"])
                .eq("type", "logistics")
                .limit(1)
                .execute()
            ).data or []
            logistics = logistics_rows[0] if logistics_rows else {}

            submission_rows = (
                self.client.table("submissions")
                .select("pickup_lat, pickup_lng")
                .eq("id", job["submission_id"])
                .limit(1)
                .execute()
            ).data or []
            submission = submission_rows[0] if submission_rows else {}

            factory_rows = (
                self.client.table("org_accounts")
                .select("lat, lng")
                .eq("id", job["destination_factory_id"])
                .eq("type", "factory")
                .limit(1)
                .execute()
            ).data or [] if job.get("destination_factory_id") else []
            factory = factory_rows[0] if factory_rows else {}

            log_lat, log_lng = logistics.get("lat"), logistics.get("lng")
            f_lat, f_lng = submission.get("pickup_lat"), submission.get("pickup_lng")
            fac_lat, fac_lng = factory.get("lat"), factory.get("lng")

            lid = str(job["logistics_profile_id"])
            sid = str(job["submission_id"])

            d1 = self._fetch_osrm_distance(log_lat, log_lng, f_lat, f_lng) if all(v is not None for v in [log_lat, log_lng, f_lat, f_lng]) else None
            d2 = self._fetch_osrm_distance(f_lat, f_lng, fac_lat, fac_lng) if all(v is not None for v in [f_lat, f_lng, fac_lat, fac_lng]) else None

            self._upsert_distance(lid, "submission", sid, "to_farmer", d1)
            self._upsert_distance(lid, "submission", sid, "farmer_to_factory", d2)
        except Exception:
            pass

    def _update_delivery_job_distance(self, delivery_job_id: str) -> None:
        try:
            job_rows = (
                self.client.table("delivery_jobs")
                .select("id, logistics_profile_id, reward_request_id")
                .eq("id", delivery_job_id)
                .limit(1)
                .execute()
            ).data or []
            if not job_rows:
                return
            job = job_rows[0]

            logistics_rows = (
                self.client.table("org_accounts")
                .select("lat, lng")
                .eq("profile_id", job["logistics_profile_id"])
                .eq("type", "logistics")
                .limit(1)
                .execute()
            ).data or []
            logistics = logistics_rows[0] if logistics_rows else {}

            request_rows = (
                self.client.table("reward_requests")
                .select("delivery_lat, delivery_lng")
                .eq("id", job["reward_request_id"])
                .limit(1)
                .execute()
            ).data or []
            request = request_rows[0] if request_rows else {}

            log_lat, log_lng = logistics.get("lat"), logistics.get("lng")
            d_lat, d_lng = request.get("delivery_lat"), request.get("delivery_lng")

            d = self._fetch_osrm_distance(log_lat, log_lng, d_lat, d_lng) if all(v is not None for v in [log_lat, log_lng, d_lat, d_lng]) else None
            self._upsert_distance(
                str(job["logistics_profile_id"]),
                "reward_request",
                str(job["reward_request_id"]),
                "to_farmer",
                d,
            )
        except Exception:
            pass

    def recalculate_distances_for_logistics(
        self, logistics_profile_id: str, new_lat: float, new_lng: float
    ) -> None:
        try:
            pickup_jobs = (
                self.client.table("pickup_jobs")
                .select("id, submission_id, destination_factory_id")
                .eq("logistics_profile_id", logistics_profile_id)
                .in_("status", ["pickup_scheduled", "picked_up"])
                .limit(50)
                .execute()
            ).data or []

            for job in pickup_jobs:
                submission_rows = (
                    self.client.table("submissions")
                    .select("pickup_lat, pickup_lng")
                    .eq("id", job["submission_id"])
                    .limit(1)
                    .execute()
                ).data or []
                submission = submission_rows[0] if submission_rows else {}

                factory_rows = (
                    self.client.table("org_accounts")
                    .select("lat, lng")
                    .eq("id", job["destination_factory_id"])
                    .eq("type", "factory")
                    .limit(1)
                    .execute()
                ).data or [] if job.get("destination_factory_id") else []
                factory = factory_rows[0] if factory_rows else {}

                f_lat, f_lng = submission.get("pickup_lat"), submission.get("pickup_lng")
                fac_lat, fac_lng = factory.get("lat"), factory.get("lng")
                sid = str(job["submission_id"])

                d1 = self._fetch_osrm_distance(new_lat, new_lng, f_lat, f_lng) if all(v is not None for v in [f_lat, f_lng]) else None
                d2 = self._fetch_osrm_distance(f_lat, f_lng, fac_lat, fac_lng) if all(v is not None for v in [f_lat, f_lng, fac_lat, fac_lng]) else None

                self._upsert_distance(logistics_profile_id, "submission", sid, "to_farmer", d1)
                self._upsert_distance(logistics_profile_id, "submission", sid, "farmer_to_factory", d2)

            delivery_jobs = (
                self.client.table("delivery_jobs")
                .select("id, reward_request_id")
                .eq("logistics_profile_id", logistics_profile_id)
                .in_("status", ["reward_delivery_scheduled", "out_for_delivery"])
                .limit(50)
                .execute()
            ).data or []

            for job in delivery_jobs:
                request_rows = (
                    self.client.table("reward_requests")
                    .select("delivery_lat, delivery_lng")
                    .eq("id", job["reward_request_id"])
                    .limit(1)
                    .execute()
                ).data or []
                request = request_rows[0] if request_rows else {}

                d_lat, d_lng = request.get("delivery_lat"), request.get("delivery_lng")
                d = self._fetch_osrm_distance(new_lat, new_lng, d_lat, d_lng) if all(v is not None for v in [d_lat, d_lng]) else None
                self._upsert_distance(logistics_profile_id, "reward_request", str(job["reward_request_id"]), "to_farmer", d)
        except Exception:
            pass

        try:
            self._populate_queue_distances(logistics_profile_id, new_lat, new_lng)
        except Exception:
            pass

    def _populate_queue_distances(self, logistics_profile_id: str, lat: float, lng: float) -> None:
        try:
            submissions = (
                self.client.table("submissions")
                .select("id, pickup_lat, pickup_lng")
                .in_("status", ["submitted", "pickup_scheduled"])
                .execute()
            ).data or []

            request_ids_with_jobs = {
                str(row["reward_request_id"])
                for row in (
                    self.client.table("delivery_jobs")
                    .select("reward_request_id")
                    .neq("status", "cancelled")
                    .execute()
                ).data or []
                if row.get("reward_request_id")
            }
            reward_requests = (
                self.client.table("reward_requests")
                .select("id, delivery_lat, delivery_lng")
                .eq("status", "warehouse_approved")
                .execute()
            ).data or []
            reward_requests = [r for r in reward_requests if str(r.get("id", "")) not in request_ids_with_jobs]

            for s in submissions:
                s_lat, s_lng = s.get("pickup_lat"), s.get("pickup_lng")
                km = self._fetch_osrm_distance(lat, lng, s_lat, s_lng) if all(v is not None for v in [s_lat, s_lng]) else None
                self._upsert_distance(logistics_profile_id, "submission", str(s["id"]), "to_farmer", km)

            for r in reward_requests:
                r_lat, r_lng = r.get("delivery_lat"), r.get("delivery_lng")
                km = self._fetch_osrm_distance(lat, lng, r_lat, r_lng) if all(v is not None for v in [r_lat, r_lng]) else None
                self._upsert_distance(logistics_profile_id, "reward_request", str(r["id"]), "to_farmer", km)
        except Exception:
            pass

    def recalculate_distances_for_factory(self, factory_id: str, fac_lat: float, fac_lng: float) -> None:
        try:
            pickup_jobs = (
                self.client.table("pickup_jobs")
                .select("id, submission_id, logistics_profile_id")
                .eq("destination_factory_id", factory_id)
                .in_("status", ["pickup_scheduled", "picked_up", "delivered_to_factory"])
                .limit(100)
                .execute()
            ).data or []

            for job in pickup_jobs:
                submission_rows = (
                    self.client.table("submissions")
                    .select("pickup_lat, pickup_lng")
                    .eq("id", job["submission_id"])
                    .limit(1)
                    .execute()
                ).data or []
                sub = submission_rows[0] if submission_rows else {}
                f_lat, f_lng = sub.get("pickup_lat"), sub.get("pickup_lng")
                d2 = self._fetch_osrm_distance(f_lat, f_lng, fac_lat, fac_lng) if all(v is not None for v in [f_lat, f_lng]) else None
                self._upsert_distance(
                    str(job["logistics_profile_id"]),
                    "submission",
                    str(job["submission_id"]),
                    "farmer_to_factory",
                    d2,
                )
        except Exception:
            pass

    def _merge_queue_distances(
        self, items: list[dict[str, Any]], logistics_profile_id: str, reference_type: str
    ) -> None:
        if not items:
            return
        try:
            item_ids = [item["id"] for item in items]
            dist_map = self._fetch_distances(logistics_profile_id, reference_type, item_ids)

            if not dist_map:
                logistics_rows = (
                    self.client.table("org_accounts")
                    .select("lat, lng")
                    .eq("profile_id", logistics_profile_id)
                    .eq("type", "logistics")
                    .limit(1)
                    .execute()
                ).data or []
                if logistics_rows:
                    loc = logistics_rows[0]
                    lat, lng = loc.get("lat"), loc.get("lng")
                    if lat is not None and lng is not None:
                        self._populate_queue_distances(logistics_profile_id, lat, lng)
                        dist_map = self._fetch_distances(logistics_profile_id, reference_type, item_ids)

            for item in items:
                item["distance_to_farmer_km"] = dist_map.get((item["id"], "to_farmer"))
        except Exception:
            pass
