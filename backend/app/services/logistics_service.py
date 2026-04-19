import json
import urllib.request
from typing import Any

from app.core.config import get_settings
from app.core.errors import WorkflowError
from app.db.supabase import get_service_client
from app.models.workflow import (
    SchedulePickupRequest,
    ScheduleRewardDeliveryRequest,
    UpsertLogisticsInfoRequest,
)
from app.services._base import BaseService, _first_row


class LogisticsService(BaseService):

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

            log_lat = logistics.get("lat")
            log_lng = logistics.get("lng")
            f_lat = submission.get("pickup_lat")
            f_lng = submission.get("pickup_lng")
            fac_lat = factory.get("lat")
            fac_lng = factory.get("lng")

            lid = str(job["logistics_profile_id"])
            sid = str(job["submission_id"])

            d1 = self._fetch_osrm_distance(log_lat, log_lng, f_lat, f_lng) if all(v is not None for v in [log_lat, log_lng, f_lat, f_lng]) else None
            d2 = self._fetch_osrm_distance(f_lat, f_lng, fac_lat, fac_lng) if all(v is not None for v in [f_lat, f_lng, fac_lat, fac_lng]) else None

            self._upsert_distance(lid, "submission", sid, "to_farmer", d1)
            self._upsert_distance(lid, "submission", sid, "farmer_to_factory", d2)
        except Exception:
            pass  # never block the main flow

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

            log_lat = logistics.get("lat")
            log_lng = logistics.get("lng")
            d_lat = request.get("delivery_lat")
            d_lng = request.get("delivery_lng")

            d = self._fetch_osrm_distance(log_lat, log_lng, d_lat, d_lng) if all(v is not None for v in [log_lat, log_lng, d_lat, d_lng]) else None

            self._upsert_distance(
                str(job["logistics_profile_id"]),
                "reward_request",
                str(job["reward_request_id"]),
                "to_farmer",
                d,
            )
        except Exception:
            pass  # never block the main flow

    def _recalculate_distances_for_logistics(
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

                f_lat = submission.get("pickup_lat")
                f_lng = submission.get("pickup_lng")
                fac_lat = factory.get("lat")
                fac_lng = factory.get("lng")
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

                d_lat = request.get("delivery_lat")
                d_lng = request.get("delivery_lng")
                d = self._fetch_osrm_distance(new_lat, new_lng, d_lat, d_lng) if all(v is not None for v in [d_lat, d_lng]) else None

                self._upsert_distance(logistics_profile_id, "reward_request", str(job["reward_request_id"]), "to_farmer", d)
        except Exception:
            pass  # background task — never raises

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
                s_lat = s.get("pickup_lat")
                s_lng = s.get("pickup_lng")
                km = self._fetch_osrm_distance(lat, lng, s_lat, s_lng) if all(v is not None for v in [s_lat, s_lng]) else None
                self._upsert_distance(logistics_profile_id, "submission", str(s["id"]), "to_farmer", km)

            for r in reward_requests:
                r_lat = r.get("delivery_lat")
                r_lng = r.get("delivery_lng")
                km = self._fetch_osrm_distance(lat, lng, r_lat, r_lng) if all(v is not None for v in [r_lat, r_lng]) else None
                self._upsert_distance(logistics_profile_id, "reward_request", str(r["id"]), "to_farmer", km)
        except Exception:
            pass

    def _recalculate_distances_for_factory(self, factory_id: str, fac_lat: float, fac_lng: float) -> None:
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
                f_lat = sub.get("pickup_lat")
                f_lng = sub.get("pickup_lng")
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

    def get_route_distance(self, from_lat: float, from_lng: float, to_lat: float, to_lng: float) -> float | None:
        return self._fetch_osrm_distance(from_lat, from_lng, to_lat, to_lng)

    def list_pickup_queue(self, logistics_profile_id: str | None = None) -> list[dict[str, Any]]:
        try:
            submissions = (
                self.client.table("submissions")
                .select(
                    "id, farmer_profile_id, material_type, quantity_value, quantity_unit, "
                    "pickup_location_text, pickup_lat, pickup_lng, status, created_at"
                )
                .in_("status", ["submitted", "pickup_scheduled"])
                .order("created_at", desc=False)
                .execute()
            ).data or []

            if not submissions:
                return []

            material_codes = list({s.get("material_type") for s in submissions if s.get("material_type")})
            material_types_by_code: dict[str, str] = {}
            if material_codes:
                for row in (
                    self.client.table("material_types")
                    .select("code, name_th")
                    .in_("code", material_codes)
                    .execute()
                ).data or []:
                    if row.get("code"):
                        material_types_by_code[str(row["code"])] = row.get("name_th", "")

            result = [
                {
                    "id": str(s["id"]),
                    "farmer_profile_id": str(s.get("farmer_profile_id", "")),
                    "material_type": s.get("material_type", ""),
                    "material_name_th": material_types_by_code.get(s.get("material_type", ""), s.get("material_type", "")),
                    "quantity_value": s.get("quantity_value"),
                    "quantity_unit": s.get("quantity_unit"),
                    "pickup_location_text": s.get("pickup_location_text"),
                    "pickup_lat": s.get("pickup_lat"),
                    "pickup_lng": s.get("pickup_lng"),
                    "status": s.get("status"),
                    "created_at": s.get("created_at"),
                    "distance_to_farmer_km": None,
                }
                for s in submissions
            ]

            if logistics_profile_id:
                self._merge_queue_distances(result, logistics_profile_id, "submission")

            return result
        except Exception as exc:
            raise WorkflowError(f"Failed to fetch pickup queue: {exc}") from exc

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

    def list_active_factories(self) -> list[dict[str, Any]]:
        try:
            return (
                self.client.table("org_accounts")
                .select("id, name_th, location_text, lat, lng, active, is_focal_point")
                .eq("type", "factory")
                .eq("active", True)
                .order("name_th", desc=False)
                .execute()
            ).data or []
        except Exception as exc:
            raise WorkflowError(f"Failed to fetch active factories: {exc}") from exc

    def list_logistics_pickup_jobs(self, logistics_profile_id: str) -> list[dict[str, Any]]:
        try:
            jobs = (
                self.client.table("pickup_jobs")
                .select(
                    "id, submission_id, logistics_profile_id, destination_factory_id, status, "
                    "planned_pickup_at, pickup_window_end_at, picked_up_at, delivered_factory_at, created_at"
                )
                .eq("logistics_profile_id", logistics_profile_id)
                .in_("status", ["pickup_scheduled", "picked_up", "delivered_to_factory"])
                .order("created_at", desc=True)
                .execute()
            ).data or []

            if not jobs:
                return []

            submission_ids = [str(job["submission_id"]) for job in jobs if job.get("submission_id")]
            if not submission_ids:
                return []

            submissions = (
                self.client.table("submissions")
                .select(
                    "id, farmer_profile_id, material_type, quantity_value, quantity_unit, "
                    "pickup_location_text, pickup_lat, pickup_lng, status"
                )
                .in_("id", submission_ids)
                .execute()
            ).data or []
            submissions_by_id = {str(row["id"]): row for row in submissions if row.get("id")}

            farmer_ids = list({str(s["farmer_profile_id"]) for s in submissions if s.get("farmer_profile_id")})
            farmer_by_id: dict[str, dict[str, Any]] = {}
            if farmer_ids:
                for row in (
                    self.client.table("profiles")
                    .select("id, display_name, phone")
                    .in_("id", farmer_ids)
                    .execute()
                ).data or []:
                    if row.get("id"):
                        farmer_by_id[str(row["id"])] = row

            material_codes = list({s.get("material_type") for s in submissions if s.get("material_type")})
            material_types_by_code: dict[str, str] = {}
            if material_codes:
                for row in (
                    self.client.table("material_types")
                    .select("code, name_th")
                    .in_("code", material_codes)
                    .execute()
                ).data or []:
                    if row.get("code"):
                        material_types_by_code[str(row["code"])] = row.get("name_th", "")

            dest_factory_ids = list({
                str(job["destination_factory_id"])
                for job in jobs
                if job.get("destination_factory_id") is not None
            })
            dest_factory_by_id: dict[str, dict[str, Any]] = {}
            if dest_factory_ids:
                for row in (
                    self.client.table("org_accounts")
                    .select("id, name_th, location_text, lat, lng, is_focal_point")
                    .eq("type", "factory")
                    .in_("id", dest_factory_ids)
                    .execute()
                ).data or []:
                    if row.get("id"):
                        dest_factory_by_id[str(row["id"])] = row

            dist_map = self._fetch_distances(logistics_profile_id, "submission", submission_ids)

            result: list[dict[str, Any]] = []
            for job in jobs:
                submission = submissions_by_id.get(str(job.get("submission_id")))
                if submission is None:
                    continue

                dest_id = str(job.get("destination_factory_id") or "")
                dest = dest_factory_by_id.get(dest_id, {})
                farmer = farmer_by_id.get(str(submission.get("farmer_profile_id") or ""), {})
                sid = str(job.get("submission_id"))

                result.append({
                    "id": str(job["id"]),
                    "submission_id": sid,
                    "logistics_profile_id": str(job.get("logistics_profile_id")),
                    "destination_factory_id": str(job.get("destination_factory_id")) if job.get("destination_factory_id") else None,
                    "destination_factory_name_th": dest.get("name_th"),
                    "destination_factory_location_text": dest.get("location_text"),
                    "destination_factory_is_focal_point": bool(dest.get("is_focal_point", False)),
                    "destination_factory_lat": dest.get("lat"),
                    "destination_factory_lng": dest.get("lng"),
                    "status": job.get("status"),
                    "planned_pickup_at": job.get("planned_pickup_at"),
                    "pickup_window_end_at": job.get("pickup_window_end_at"),
                    "picked_up_at": job.get("picked_up_at"),
                    "delivered_factory_at": job.get("delivered_factory_at"),
                    "created_at": job.get("created_at"),
                    "material_type": submission.get("material_type"),
                    "material_name_th": material_types_by_code.get(
                        submission.get("material_type", ""), submission.get("material_type", "")
                    ),
                    "quantity_value": submission.get("quantity_value"),
                    "quantity_unit": submission.get("quantity_unit"),
                    "pickup_location_text": submission.get("pickup_location_text"),
                    "pickup_lat": submission.get("pickup_lat"),
                    "pickup_lng": submission.get("pickup_lng"),
                    "submission_status": submission.get("status"),
                    "farmer_display_name": farmer.get("display_name"),
                    "farmer_phone": farmer.get("phone"),
                    "distance_to_farmer_km": dist_map.get((sid, "to_farmer")),
                    "distance_farmer_to_factory_km": dist_map.get((sid, "farmer_to_factory")),
                })

            return result
        except Exception as exc:
            raise WorkflowError(f"Failed to fetch logistics pickup jobs: {exc}") from exc

    def schedule_pickup(
        self,
        submission_id: str,
        logistics_profile_id: str,
        payload: SchedulePickupRequest,
    ) -> dict[str, Any]:
        try:
            if payload.pickup_window_end_at < payload.pickup_window_start_at:
                raise WorkflowError(
                    "Pickup window end must be greater than or equal to pickup window start"
                )

            dest_rows = (
                self.client.table("org_accounts")
                .select("id, active")
                .eq("id", payload.destination_factory_id)
                .eq("type", "factory")
                .limit(1)
                .execute()
            ).data or []
            if not dest_rows:
                raise WorkflowError("Destination factory not found")
            if not bool(dest_rows[0].get("active")):
                raise WorkflowError("Destination factory is inactive")

            result = _first_row(
                self.client.rpc(
                    "schedule_pickup_job",
                    {
                        "p_submission_id": submission_id,
                        "p_logistics_profile_id": logistics_profile_id,
                        "p_planned_pickup_at": payload.pickup_window_start_at.isoformat(),
                        "p_pickup_window_end_at": payload.pickup_window_end_at.isoformat(),
                        "p_destination_factory_id": payload.destination_factory_id,
                        "p_notes": payload.notes,
                    },
                ).execute().data
            )

            if job_id := result.get("pickup_job_id"):
                self._update_pickup_job_distances(str(job_id))
            return result
        except Exception as exc:
            raise WorkflowError(f"Failed to schedule pickup: {exc}") from exc

    def mark_pickup_picked_up(
        self, pickup_job_id: str, logistics_profile_id: str
    ) -> dict[str, Any]:
        try:
            return _first_row(
                self.client.rpc(
                    "mark_pickup_picked_up",
                    {"p_pickup_job_id": pickup_job_id, "p_logistics_profile_id": logistics_profile_id},
                ).execute().data
            )
        except Exception as exc:
            raise WorkflowError(f"Failed to mark pickup as picked up: {exc}") from exc

    def mark_delivered_to_factory(
        self, pickup_job_id: str, logistics_profile_id: str
    ) -> dict[str, Any]:
        try:
            return _first_row(
                self.client.rpc(
                    "mark_pickup_delivered_to_factory",
                    {"p_pickup_job_id": pickup_job_id, "p_logistics_profile_id": logistics_profile_id},
                ).execute().data
            )
        except Exception as exc:
            raise WorkflowError(f"Failed to mark delivered to factory: {exc}") from exc

    def reschedule_pickup_job(
        self,
        pickup_job_id: str,
        payload: SchedulePickupRequest,
    ) -> dict[str, Any]:
        try:
            dest_rows = (
                self.client.table("org_accounts")
                .select("id, active")
                .eq("id", payload.destination_factory_id)
                .eq("type", "factory")
                .limit(1)
                .execute()
            ).data or []
            if not dest_rows:
                raise WorkflowError("Destination factory not found")
            if not bool(dest_rows[0].get("active")):
                raise WorkflowError("Destination factory is inactive")
            rows = (
                self.client.table("pickup_jobs")
                .update({
                    "planned_pickup_at": payload.pickup_window_start_at.isoformat(),
                    "pickup_window_end_at": payload.pickup_window_end_at.isoformat(),
                    "destination_factory_id": payload.destination_factory_id,
                })
                .eq("id", pickup_job_id)
                .execute()
            ).data or []
            if not rows:
                raise WorkflowError("Pickup job not found")
            self._update_pickup_job_distances(pickup_job_id)
            return rows[0]
        except WorkflowError:
            raise
        except Exception as exc:
            raise WorkflowError(f"Failed to reschedule pickup job: {exc}") from exc

    def reschedule_delivery_job(
        self,
        delivery_job_id: str,
        payload: ScheduleRewardDeliveryRequest,
    ) -> dict[str, Any]:
        try:
            rows = (
                self.client.table("delivery_jobs")
                .update({
                    "planned_delivery_at": payload.delivery_window_start_at.isoformat(),
                    "delivery_window_end_at": payload.delivery_window_end_at.isoformat(),
                })
                .eq("id", delivery_job_id)
                .execute()
            ).data or []
            if not rows:
                raise WorkflowError("Delivery job not found")
            self._update_delivery_job_distance(delivery_job_id)
            return rows[0]
        except WorkflowError:
            raise
        except Exception as exc:
            raise WorkflowError(f"Failed to reschedule delivery job: {exc}") from exc

    def list_approved_reward_requests(self, logistics_profile_id: str | None = None) -> list[dict[str, Any]]:
        try:
            approved = (
                self.client.table("reward_requests")
                .select(
                    "id, farmer_profile_id, reward_id, quantity, requested_points, status, "
                    "requested_at, delivery_location_text, delivery_lat, delivery_lng"
                )
                .eq("status", "warehouse_approved")
                .order("requested_at", desc=False)
                .execute()
            ).data or []

            if not approved:
                return []

            request_ids = [str(item["id"]) for item in approved if item.get("id")]
            jobs_with_delivery = {
                str(row["reward_request_id"])
                for row in (
                    self.client.table("delivery_jobs")
                    .select("reward_request_id, status")
                    .in_("reward_request_id", request_ids)
                    .neq("status", "cancelled")
                    .execute()
                ).data or []
                if row.get("reward_request_id")
            }

            reward_ids = [str(item["reward_id"]) for item in approved if item.get("reward_id")]
            rewards_by_id: dict[str, dict[str, Any]] = {}
            if reward_ids:
                for row in (
                    self.client.table("rewards")
                    .select("id, name_th, description_th, points_cost")
                    .in_("id", reward_ids)
                    .execute()
                ).data or []:
                    if row.get("id"):
                        rewards_by_id[str(row["id"])] = row

            farmer_ids = list({str(item["farmer_profile_id"]) for item in approved if item.get("farmer_profile_id")})
            profiles_by_id: dict[str, dict[str, Any]] = {}
            if farmer_ids:
                for row in (
                    self.client.table("profiles")
                    .select("id, display_name, phone, province")
                    .in_("id", farmer_ids)
                    .execute()
                ).data or []:
                    if row.get("id"):
                        profiles_by_id[str(row["id"])] = row

            result = []
            for item in approved:
                if str(item.get("id")) in jobs_with_delivery:
                    continue
                reward = rewards_by_id.get(str(item.get("reward_id") or ""), {})
                profile = profiles_by_id.get(str(item.get("farmer_profile_id") or ""), {})
                result.append({
                    **item,
                    "id": str(item["id"]),
                    "reward_name_th": reward.get("name_th"),
                    "reward_description_th": reward.get("description_th"),
                    "reward_points_cost": reward.get("points_cost"),
                    "farmer_display_name": profile.get("display_name"),
                    "farmer_phone": profile.get("phone"),
                    "pickup_location_text": item.get("delivery_location_text"),
                    "pickup_lat": item.get("delivery_lat"),
                    "pickup_lng": item.get("delivery_lng"),
                    "distance_to_farmer_km": None,
                })

            if logistics_profile_id:
                self._merge_queue_distances(result, logistics_profile_id, "reward_request")

            return result
        except Exception as exc:
            raise WorkflowError(f"Failed to fetch approved reward requests: {exc}") from exc

    def list_reward_delivery_jobs(self, logistics_profile_id: str) -> list[dict[str, Any]]:
        try:
            jobs = (
                self.client.table("delivery_jobs")
                .select(
                    "id, reward_request_id, logistics_profile_id, status, planned_delivery_at, "
                    "delivery_window_end_at, out_for_delivery_at, delivered_at, created_at"
                )
                .eq("logistics_profile_id", logistics_profile_id)
                .order("created_at", desc=True)
                .execute()
            ).data or []

            if not jobs:
                return []

            request_ids = [str(job["reward_request_id"]) for job in jobs if job.get("reward_request_id")]
            if not request_ids:
                return []

            requests = (
                self.client.table("reward_requests")
                .select(
                    "id, farmer_profile_id, reward_id, quantity, requested_points, "
                    "delivery_location_text, delivery_lat, delivery_lng"
                )
                .in_("id", request_ids)
                .execute()
            ).data or []
            requests_by_id = {str(row["id"]): row for row in requests if row.get("id")}

            reward_ids = [str(row["reward_id"]) for row in requests if row.get("reward_id")]
            rewards_by_id: dict[str, dict[str, Any]] = {}
            if reward_ids:
                for row in (
                    self.client.table("rewards")
                    .select("id, name_th")
                    .in_("id", reward_ids)
                    .execute()
                ).data or []:
                    if row.get("id"):
                        rewards_by_id[str(row["id"])] = row

            farmer_ids = list({str(row["farmer_profile_id"]) for row in requests if row.get("farmer_profile_id")})
            profiles_by_id: dict[str, dict[str, Any]] = {}
            if farmer_ids:
                for row in (
                    self.client.table("profiles")
                    .select("id, display_name, phone")
                    .in_("id", farmer_ids)
                    .execute()
                ).data or []:
                    if row.get("id"):
                        profiles_by_id[str(row["id"])] = row

            dist_map = self._fetch_distances(logistics_profile_id, "reward_request", request_ids)

            result = []
            for job in jobs:
                request = requests_by_id.get(str(job.get("reward_request_id")))
                if request is None:
                    continue

                reward_id = str(request.get("reward_id")) if request.get("reward_id") is not None else None
                profile = profiles_by_id.get(str(request.get("farmer_profile_id") or ""), {})
                rid = str(job.get("reward_request_id"))

                result.append({
                    "id": str(job["id"]),
                    "reward_request_id": rid,
                    "logistics_profile_id": str(job.get("logistics_profile_id")),
                    "status": job.get("status"),
                    "planned_delivery_at": job.get("planned_delivery_at"),
                    "delivery_window_end_at": job.get("delivery_window_end_at"),
                    "out_for_delivery_at": job.get("out_for_delivery_at"),
                    "delivered_at": job.get("delivered_at"),
                    "created_at": job.get("created_at"),
                    "farmer_profile_id": str(request.get("farmer_profile_id")),
                    "farmer_display_name": profile.get("display_name"),
                    "farmer_phone": profile.get("phone"),
                    "reward_id": reward_id,
                    "reward_name_th": rewards_by_id.get(reward_id, {}).get("name_th") if reward_id else None,
                    "quantity": request.get("quantity"),
                    "requested_points": request.get("requested_points"),
                    "pickup_location_text": request.get("delivery_location_text"),
                    "pickup_lat": request.get("delivery_lat"),
                    "pickup_lng": request.get("delivery_lng"),
                    "distance_to_farmer_km": dist_map.get((rid, "to_farmer")),
                })

            return result
        except Exception as exc:
            raise WorkflowError(f"Failed to list reward delivery jobs: {exc}") from exc

    def schedule_reward_delivery(
        self,
        request_id: str,
        logistics_profile_id: str,
        payload: ScheduleRewardDeliveryRequest,
    ) -> dict[str, Any]:
        try:
            if payload.delivery_window_end_at < payload.delivery_window_start_at:
                raise WorkflowError(
                    "Delivery window end must be greater than or equal to delivery window start"
                )
            result = _first_row(
                self.client.rpc(
                    "schedule_reward_delivery_job",
                    {
                        "p_reward_request_id": request_id,
                        "p_logistics_profile_id": logistics_profile_id,
                        "p_planned_delivery_at": payload.delivery_window_start_at.isoformat(),
                        "p_delivery_window_end_at": payload.delivery_window_end_at.isoformat(),
                        "p_notes": payload.notes,
                    },
                ).execute().data
            )
            if job_id := result.get("delivery_job_id"):
                self._update_delivery_job_distance(str(job_id))
            return result
        except Exception as exc:
            raise WorkflowError(f"Failed to schedule reward delivery: {exc}") from exc

    def mark_reward_out_for_delivery(
        self, delivery_job_id: str, logistics_profile_id: str
    ) -> dict[str, Any]:
        try:
            return _first_row(
                self.client.rpc(
                    "mark_reward_out_for_delivery",
                    {"p_delivery_job_id": delivery_job_id, "p_logistics_profile_id": logistics_profile_id},
                ).execute().data
            )
        except Exception as exc:
            raise WorkflowError(f"Failed to mark reward out for delivery: {exc}") from exc

    def mark_reward_delivered(
        self, delivery_job_id: str, logistics_profile_id: str
    ) -> dict[str, Any]:
        try:
            return _first_row(
                self.client.rpc(
                    "mark_reward_delivered",
                    {"p_delivery_job_id": delivery_job_id, "p_logistics_profile_id": logistics_profile_id},
                ).execute().data
            )
        except Exception as exc:
            raise WorkflowError(f"Failed to mark reward delivered: {exc}") from exc

    def get_or_create_logistics_for_profile(self, logistics_profile_id: str) -> dict[str, Any]:
        try:
            rows = (
                self.client.table("org_accounts")
                .select("id, profile_id, name_th, location_text, lat, lng, active, created_at")
                .eq("profile_id", logistics_profile_id)
                .eq("type", "logistics")
                .limit(1)
                .execute()
            ).data or []
            if rows:
                return _first_row(rows)

            profile_rows = (
                self.client.table("profiles")
                .select("display_name")
                .eq("id", logistics_profile_id)
                .limit(1)
                .execute()
            ).data or []
            if not profile_rows:
                raise WorkflowError("Logistics profile not found")

            display_name = str(profile_rows[0].get("display_name") or "").strip()
            default_name = display_name or f"ทีมขนส่ง {logistics_profile_id[:8]}"
            return _first_row(
                self.client.table("org_accounts")
                .insert({"profile_id": logistics_profile_id, "type": "logistics", "name_th": default_name, "active": True})
                .execute()
                .data
            )
        except WorkflowError:
            raise
        except Exception as exc:
            raise WorkflowError(f"Failed to load logistics info: {exc}") from exc

    def update_logistics_for_profile(
        self, logistics_profile_id: str, payload: UpsertLogisticsInfoRequest
    ) -> dict[str, Any]:
        try:
            if (payload.lat is None) != (payload.lng is None):
                raise WorkflowError("lat and lng must be provided together")

            account = self.get_or_create_logistics_for_profile(logistics_profile_id)
            account_id = str(account.get("id") or "")
            if not account_id:
                raise WorkflowError("Logistics account record not found")

            name_th = payload.name_th.strip()
            if not name_th:
                raise WorkflowError("Logistics name is required")

            location_text = payload.location_text.strip() if payload.location_text else None
            return _first_row(
                self.client.table("org_accounts")
                .update({"name_th": name_th, "location_text": location_text, "lat": payload.lat, "lng": payload.lng})
                .eq("id", account_id)
                .eq("profile_id", logistics_profile_id)
                .eq("type", "logistics")
                .execute()
                .data
            )
        except WorkflowError:
            raise
        except Exception as exc:
            raise WorkflowError(f"Failed to update logistics info: {exc}") from exc


def get_logistics_service() -> LogisticsService:
    return LogisticsService(client=get_service_client())
