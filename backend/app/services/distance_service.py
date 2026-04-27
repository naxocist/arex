import json
import urllib.request
from typing import Any

from app.core.config import get_settings
from app.services._base import BaseService


class DistanceService(BaseService):
    """Handles OSRM route lookups and the two distance cache tables.

    logistics_to_farmer_distances          — per-provider, varies by logistics location
    material_submission_factory_distances  — provider-independent, farmer pickup → factory
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
            self.client.table("material_submission_factory_distances").upsert({
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
                self.client.table("material_submission_factory_distances")
                .select("distance_km")
                .eq("submission_id", submission_id)
                .eq("factory_id", factory_id)
                .limit(1)
                .execute()
            ).data or []
            return rows[0].get("distance_km") if rows else None
        except Exception:
            return None

    def _update_submission_distances(self, submission_id: str) -> None:
        """Recompute logistics→farmer and farmer→factory distances for a material_submission."""
        try:
            sub_rows = (
                self.client.table("material_submissions")
                .select("id, logistics_profile_id, destination_factory_id, pickup_lat, pickup_lng")
                .eq("id", submission_id)
                .limit(1)
                .execute()
            ).data or []
            if not sub_rows:
                return
            sub = sub_rows[0]

            logistics_profile_id = sub.get("logistics_profile_id")
            destination_factory_id = sub.get("destination_factory_id")
            f_lat, f_lng = sub.get("pickup_lat"), sub.get("pickup_lng")

            if logistics_profile_id:
                logistics_rows = (
                    self.client.table("org_accounts")
                    .select("lat, lng")
                    .eq("profile_id", logistics_profile_id)
                    .eq("type", "logistics")
                    .limit(1)
                    .execute()
                ).data or []
                logistics = logistics_rows[0] if logistics_rows else {}
                log_lat, log_lng = logistics.get("lat"), logistics.get("lng")
                lid = str(logistics_profile_id)
                sid = str(submission_id)
                d1 = self._fetch_osrm_distance(log_lat, log_lng, f_lat, f_lng) if all(v is not None for v in [log_lat, log_lng, f_lat, f_lng]) else None
                self._upsert_to_farmer(lid, "material_submission", sid, d1)

            if destination_factory_id:
                fac_rows = (
                    self.client.table("org_accounts")
                    .select("lat, lng")
                    .eq("id", destination_factory_id)
                    .eq("type", "factory")
                    .limit(1)
                    .execute()
                ).data or []
                factory = fac_rows[0] if fac_rows else {}
                fac_lat, fac_lng = factory.get("lat"), factory.get("lng")
                fac_id = str(destination_factory_id)
                sid = str(submission_id)
                cached = self._fetch_submission_factory_distance(sid, fac_id)
                if cached is None:
                    d2 = self._fetch_osrm_distance(f_lat, f_lng, fac_lat, fac_lng) if all(v is not None for v in [f_lat, f_lng, fac_lat, fac_lng]) else None
                    self._upsert_submission_factory(sid, fac_id, d2)
        except Exception:
            pass

    def _update_reward_request_distance(self, request_id: str) -> None:
        """Recompute logistics→farmer distance for a reward_request."""
        try:
            req_rows = (
                self.client.table("reward_requests")
                .select("id, logistics_profile_id, delivery_lat, delivery_lng")
                .eq("id", request_id)
                .limit(1)
                .execute()
            ).data or []
            if not req_rows:
                return
            req = req_rows[0]

            logistics_profile_id = req.get("logistics_profile_id")
            if not logistics_profile_id:
                return

            logistics_rows = (
                self.client.table("org_accounts")
                .select("lat, lng")
                .eq("profile_id", logistics_profile_id)
                .eq("type", "logistics")
                .limit(1)
                .execute()
            ).data or []
            logistics = logistics_rows[0] if logistics_rows else {}

            log_lat, log_lng = logistics.get("lat"), logistics.get("lng")
            d_lat, d_lng = req.get("delivery_lat"), req.get("delivery_lng")

            d = self._fetch_osrm_distance(log_lat, log_lng, d_lat, d_lng) if all(v is not None for v in [log_lat, log_lng, d_lat, d_lng]) else None
            self._upsert_to_farmer(str(logistics_profile_id), "reward_request", str(request_id), d)
        except Exception:
            pass

    def recalculate_distances_for_logistics(
        self, logistics_profile_id: str, new_lat: float, new_lng: float
    ) -> None:
        try:
            active_subs = (
                self.client.table("material_submissions")
                .select("id, pickup_lat, pickup_lng")
                .eq("logistics_profile_id", logistics_profile_id)
                .in_("status", ["pickup_scheduled", "received"])
                .limit(50)
                .execute()
            ).data or []

            if active_subs:
                valid = [(r, r["pickup_lat"], r["pickup_lng"]) for r in active_subs if r.get("pickup_lat") is not None and r.get("pickup_lng") is not None]
                if valid:
                    distances = self._fetch_osrm_distances_batch(new_lat, new_lng, [(la, ln) for _, la, ln in valid])
                    upserts = [
                        {"logistics_profile_id": logistics_profile_id, "reference_type": "material_submission", "reference_id": str(r["id"]), "distance_km": km}
                        for (r, _, _), km in zip(valid, distances)
                    ]
                    if upserts:
                        try:
                            self.client.table("logistics_to_farmer_distances").upsert(upserts).execute()
                        except Exception:
                            pass

            active_reqs = (
                self.client.table("reward_requests")
                .select("id, delivery_lat, delivery_lng")
                .eq("logistics_profile_id", logistics_profile_id)
                .in_("status", ["delivery_scheduled", "out_for_delivery"])
                .limit(50)
                .execute()
            ).data or []

            if active_reqs:
                valid = [(r, r["delivery_lat"], r["delivery_lng"]) for r in active_reqs if r.get("delivery_lat") is not None and r.get("delivery_lng") is not None]
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
                self.client.table("material_submissions")
                .select("id, pickup_lat, pickup_lng")
                .in_("status", ["submitted", "pickup_scheduled"])
                .execute()
            ).data or []

            # Reward requests approved but not yet assigned to any logistics provider
            reward_requests = (
                self.client.table("reward_requests")
                .select("id, delivery_lat, delivery_lng")
                .eq("status", "approved")
                .is_("logistics_profile_id", "null")
                .execute()
            ).data or []

            valid_submissions = [(s, s["pickup_lat"], s["pickup_lng"]) for s in submissions if s.get("pickup_lat") is not None and s.get("pickup_lng") is not None]
            if valid_submissions:
                dests = [(s_lat, s_lng) for _, s_lat, s_lng in valid_submissions]
                distances = self._fetch_osrm_distances_batch(lat, lng, dests)
                upserts = [
                    {"logistics_profile_id": logistics_profile_id, "reference_type": "material_submission", "reference_id": str(s["id"]), "distance_km": km}
                    for (s, _, _), km in zip(valid_submissions, distances)
                ]
                if upserts:
                    try:
                        self.client.table("logistics_to_farmer_distances").upsert(upserts).execute()
                    except Exception:
                        pass
            for s in submissions:
                if s.get("pickup_lat") is None or s.get("pickup_lng") is None:
                    self._upsert_to_farmer(logistics_profile_id, "material_submission", str(s["id"]), None)

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
            sub_rows = (
                self.client.table("material_submissions")
                .select("id, pickup_lat, pickup_lng")
                .eq("destination_factory_id", factory_id)
                .in_("status", ["pickup_scheduled", "received", "delivered"])
                .limit(100)
                .execute()
            ).data or []

            if not sub_rows:
                return

            valid = [(r, r["pickup_lat"], r["pickup_lng"]) for r in sub_rows if r.get("pickup_lat") is not None and r.get("pickup_lng") is not None]
            if not valid:
                return

            distances = self._fetch_osrm_distances_batch(fac_lat, fac_lng, [(la, ln) for _, la, ln in valid])
            upserts = [
                {"submission_id": str(r["id"]), "factory_id": factory_id, "distance_km": km}
                for (r, _, _), km in zip(valid, distances)
            ]
            if upserts:
                try:
                    self.client.table("material_submission_factory_distances").upsert(upserts).execute()
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
