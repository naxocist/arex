import json
import urllib.request
from typing import Any

from app.core.config import get_settings
from app.services._base import BaseService


class DistanceService(BaseService):
    """Handles OSRM route lookups and the two distance cache tables.

    logistics_to_farmer_distances  — per-provider, varies by logistics location
    submission_factory_distances   — provider-independent, farmer pickup → factory
    """

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

    def _fetch_osrm_distances_batch(
        self,
        source_lat: float,
        source_lng: float,
        destinations: list[tuple[float, float]],
    ) -> list[float | None]:
        """One OSRM /table call: source → N destinations. Returns distances in km."""
        if not destinations:
            return []
        try:
            base = get_settings().osrm_url.replace("/route/v1/driving", "/table/v1/driving")
            coords = f"{source_lng},{source_lat};" + ";".join(f"{lng},{lat}" for lat, lng in destinations)
            dest_indices = ";".join(str(i + 1) for i in range(len(destinations)))
            url = f"{base}/{coords}?sources=0&destinations={dest_indices}&annotations=distance"
            with urllib.request.urlopen(url, timeout=10) as resp:  # noqa: S310
                data = json.loads(resp.read())
            row = data["distances"][0]
            return [float(d) / 1000.0 if d is not None else None for d in row]
        except Exception:
            return [None] * len(destinations)

    def _upsert_to_farmer(
        self,
        logistics_profile_id: str,
        reference_type: str,
        reference_id: str,
        distance_km: float | None,
    ) -> None:
        try:
            self.client.table("logistics_to_farmer_distances").upsert({
                "logistics_profile_id": logistics_profile_id,
                "reference_type": reference_type,
                "reference_id": reference_id,
                "distance_km": distance_km,
            }).execute()
        except Exception:
            pass

    def _upsert_submission_factory(
        self,
        submission_id: str,
        factory_id: str,
        distance_km: float | None,
    ) -> None:
        try:
            self.client.table("submission_factory_distances").upsert({
                "submission_id": submission_id,
                "factory_id": factory_id,
                "distance_km": distance_km,
            }).execute()
        except Exception:
            pass

    def _fetch_distances(
        self,
        logistics_profile_id: str,
        reference_type: str,
        reference_ids: list[str],
    ) -> dict[str, float | None]:
        """Returns {reference_id: distance_km} from logistics_to_farmer_distances."""
        if not reference_ids:
            return {}
        try:
            rows = (
                self.client.table("logistics_to_farmer_distances")
                .select("reference_id, distance_km")
                .eq("logistics_profile_id", logistics_profile_id)
                .eq("reference_type", reference_type)
                .in_("reference_id", reference_ids)
                .execute()
            ).data or []
            return {str(row["reference_id"]): row.get("distance_km") for row in rows}
        except Exception:
            return {}

    def _fetch_submission_factory_distance(
        self, submission_id: str, factory_id: str
    ) -> float | None:
        try:
            rows = (
                self.client.table("submission_factory_distances")
                .select("distance_km")
                .eq("submission_id", submission_id)
                .eq("factory_id", factory_id)
                .limit(1)
                .execute()
            ).data or []
            return rows[0].get("distance_km") if rows else None
        except Exception:
            return None

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
            fac_id = str(job["destination_factory_id"]) if job.get("destination_factory_id") else None

            d1 = self._fetch_osrm_distance(log_lat, log_lng, f_lat, f_lng) if all(v is not None for v in [log_lat, log_lng, f_lat, f_lng]) else None
            self._upsert_to_farmer(lid, "submission", sid, d1)

            if fac_id:
                # Check cache before calling OSRM — farmer→factory doesn't vary by provider
                cached = self._fetch_submission_factory_distance(sid, fac_id)
                if cached is None:
                    d2 = self._fetch_osrm_distance(f_lat, f_lng, fac_lat, fac_lng) if all(v is not None for v in [f_lat, f_lng, fac_lat, fac_lng]) else None
                    self._upsert_submission_factory(sid, fac_id, d2)
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
            self._upsert_to_farmer(
                str(job["logistics_profile_id"]),
                "reward_request",
                str(job["reward_request_id"]),
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
                .select("submission_id")
                .eq("logistics_profile_id", logistics_profile_id)
                .in_("status", ["pickup_scheduled", "picked_up"])
                .limit(50)
                .execute()
            ).data or []

            if pickup_jobs:
                sids = list({str(j["submission_id"]) for j in pickup_jobs if j.get("submission_id")})
                sub_rows = (
                    self.client.table("submissions")
                    .select("id, pickup_lat, pickup_lng")
                    .in_("id", sids)
                    .execute()
                ).data or []
                valid = [(r, r["pickup_lat"], r["pickup_lng"]) for r in sub_rows if r.get("pickup_lat") is not None and r.get("pickup_lng") is not None]
                if valid:
                    distances = self._fetch_osrm_distances_batch(new_lat, new_lng, [(la, ln) for _, la, ln in valid])
                    upserts = [
                        {"logistics_profile_id": logistics_profile_id, "reference_type": "submission", "reference_id": str(r["id"]), "distance_km": km}
                        for (r, _, _), km in zip(valid, distances)
                    ]
                    if upserts:
                        try:
                            self.client.table("logistics_to_farmer_distances").upsert(upserts).execute()
                        except Exception:
                            pass

            delivery_jobs = (
                self.client.table("delivery_jobs")
                .select("reward_request_id")
                .eq("logistics_profile_id", logistics_profile_id)
                .in_("status", ["reward_delivery_scheduled", "out_for_delivery"])
                .limit(50)
                .execute()
            ).data or []

            if delivery_jobs:
                rids = list({str(j["reward_request_id"]) for j in delivery_jobs if j.get("reward_request_id")})
                req_rows = (
                    self.client.table("reward_requests")
                    .select("id, delivery_lat, delivery_lng")
                    .in_("id", rids)
                    .execute()
                ).data or []
                valid = [(r, r["delivery_lat"], r["delivery_lng"]) for r in req_rows if r.get("delivery_lat") is not None and r.get("delivery_lng") is not None]
                if valid:
                    distances = self._fetch_osrm_distances_batch(new_lat, new_lng, [(la, ln) for _, la, ln in valid])
                    upserts = [
                        {"logistics_profile_id": logistics_profile_id, "reference_type": "reward_request", "reference_id": str(r["id"]), "distance_km": km}
                        for (r, _, _), km in zip(valid, distances)
                    ]
                    if upserts:
                        try:
                            self.client.table("logistics_to_farmer_distances").upsert(upserts).execute()
                        except Exception:
                            pass
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

            valid_submissions = [(s, s["pickup_lat"], s["pickup_lng"]) for s in submissions if s.get("pickup_lat") is not None and s.get("pickup_lng") is not None]
            if valid_submissions:
                dests = [(s_lat, s_lng) for _, s_lat, s_lng in valid_submissions]
                distances = self._fetch_osrm_distances_batch(lat, lng, dests)
                upserts = [
                    {"logistics_profile_id": logistics_profile_id, "reference_type": "submission", "reference_id": str(s["id"]), "distance_km": km}
                    for (s, _, _), km in zip(valid_submissions, distances)
                ]
                if upserts:
                    try:
                        self.client.table("logistics_to_farmer_distances").upsert(upserts).execute()
                    except Exception:
                        pass
            for s in submissions:
                if s.get("pickup_lat") is None or s.get("pickup_lng") is None:
                    self._upsert_to_farmer(logistics_profile_id, "submission", str(s["id"]), None)

            valid_requests = [(r, r["delivery_lat"], r["delivery_lng"]) for r in reward_requests if r.get("delivery_lat") is not None and r.get("delivery_lng") is not None]
            if valid_requests:
                dests = [(r_lat, r_lng) for _, r_lat, r_lng in valid_requests]
                distances = self._fetch_osrm_distances_batch(lat, lng, dests)
                upserts = [
                    {"logistics_profile_id": logistics_profile_id, "reference_type": "reward_request", "reference_id": str(r["id"]), "distance_km": km}
                    for (r, _, _), km in zip(valid_requests, distances)
                ]
                if upserts:
                    try:
                        self.client.table("logistics_to_farmer_distances").upsert(upserts).execute()
                    except Exception:
                        pass
            for r in reward_requests:
                if r.get("delivery_lat") is None or r.get("delivery_lng") is None:
                    self._upsert_to_farmer(logistics_profile_id, "reward_request", str(r["id"]), None)
        except Exception:
            pass

    def recalculate_distances_for_factory(self, factory_id: str, fac_lat: float, fac_lng: float) -> None:
        try:
            job_rows = (
                self.client.table("pickup_jobs")
                .select("submission_id")
                .eq("destination_factory_id", factory_id)
                .in_("status", ["pickup_scheduled", "picked_up", "delivered_to_factory"])
                .limit(100)
                .execute()
            ).data or []

            sids = list({str(j["submission_id"]) for j in job_rows if j.get("submission_id")})
            if not sids:
                return

            sub_rows = (
                self.client.table("submissions")
                .select("id, pickup_lat, pickup_lng")
                .in_("id", sids)
                .execute()
            ).data or []

            valid = [(r, r["pickup_lat"], r["pickup_lng"]) for r in sub_rows if r.get("pickup_lat") is not None and r.get("pickup_lng") is not None]
            if not valid:
                return

            # farmer→factory: source is farmer pickup, destination is factory
            distances = self._fetch_osrm_distances_batch(fac_lat, fac_lng, [(la, ln) for _, la, ln in valid])
            upserts = [
                {"submission_id": str(r["id"]), "factory_id": factory_id, "distance_km": km}
                for (r, _, _), km in zip(valid, distances)
            ]
            if upserts:
                try:
                    self.client.table("submission_factory_distances").upsert(upserts).execute()
                except Exception:
                    pass
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

            missing_ids = [item["id"] for item in items if item["id"] not in dist_map]
            if missing_ids:
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
                item["distance_to_farmer_km"] = dist_map.get(item["id"])
        except Exception:
            pass
