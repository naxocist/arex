from typing import Any

from app.core.errors import WorkflowError
from app.core.image_utils import resolve_image_url
from app.db.supabase import get_service_client
from app.models.workflow import (
    CancelPickupJobRequest,
    SchedulePickupRequest,
    ScheduleRewardDeliveryRequest,
    UpsertLogisticsInfoRequest,
)
from app.services._base import _first_row
from app.services.distance_service import DistanceService


class LogisticsService(DistanceService):

    def get_route_distance(self, from_lat: float, from_lng: float, to_lat: float, to_lng: float) -> float | None:
        return self._fetch_osrm_distance(from_lat, from_lng, to_lat, to_lng)

    def list_pickup_queue(self, logistics_profile_id: str | None = None) -> list[dict[str, Any]]:
        try:
            submissions = (
                self.client.table("material_submissions")
                .select(
                    "id, farmer_profile_id, material_type, quantity_value, quantity_unit, "
                    "pickup_location_text, pickup_lat, pickup_lng, status, created_at, image_url"
                )
                .in_("status", ["submitted", "pickup_scheduled"])
                .order("created_at", desc=False)
                .execute()
            ).data or []

            if not submissions:
                return []

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
                    "image_url": resolve_image_url(s.get("image_url")),
                    "distance_to_farmer_km": None,
                    "farmer_display_name": farmer_by_id.get(str(s.get("farmer_profile_id") or ""), {}).get("display_name"),
                    "farmer_phone": farmer_by_id.get(str(s.get("farmer_profile_id") or ""), {}).get("phone"),
                }
                for s in submissions
            ]

            if logistics_profile_id:
                self._merge_queue_distances(result, logistics_profile_id, "material_submission")

            return result
        except Exception as exc:
            raise WorkflowError(f"Failed to fetch pickup queue: {exc}") from exc

    def list_active_factories(
        self,
        material_type_code: str | None = None,
        quantity_kg: float | None = None,
        submission_id: str | None = None,
    ) -> list[dict[str, Any]]:
        try:
            factories = (
                self.client.table("org_accounts")
                .select("id, name_th, location_text, lat, lng, active, is_focal_point")
                .eq("type", "factory")
                .eq("active", True)
                .order("name_th", desc=False)
                .execute()
            ).data or []

            if not material_type_code or not factories:
                return factories

            factory_ids = [str(f["id"]) for f in factories if f.get("id")]
            prefs_rows = (
                self.client.table("factory_material_preferences")
                .select("factory_id, accepts, capacity_value, capacity_unit")
                .eq("material_type_code", material_type_code)
                .in_("factory_id", factory_ids)
                .execute()
            ).data or []
            prefs_by_factory = {str(r["factory_id"]): r for r in prefs_rows if r.get("factory_id")}

            unit_codes = list({str(r["capacity_unit"]) for r in prefs_rows if r.get("capacity_unit")})
            factors_by_unit: dict[str, float] = {}
            if unit_codes:
                for row in (
                    self.client.table("measurement_units")
                    .select("code, to_kg_factor")
                    .in_("code", unit_codes)
                    .execute()
                ).data or []:
                    if row.get("code") and row.get("to_kg_factor") is not None:
                        factors_by_unit[str(row["code"])] = float(row["to_kg_factor"])

            for f in factories:
                fid = str(f.get("id") or "")
                pref = prefs_by_factory.get(fid)
                if pref is None:
                    f["preference"] = {"accepts": True, "capacity_value": None, "capacity_unit": None, "capacity_kg": None, "has_capacity": True}
                else:
                    accepts = bool(pref.get("accepts", True))
                    cap_val = pref.get("capacity_value")
                    cap_unit = pref.get("capacity_unit")
                    capacity_kg: float | None = None
                    if cap_val is not None and cap_unit:
                        factor = factors_by_unit.get(str(cap_unit))
                        if factor:
                            capacity_kg = float(cap_val) * factor
                    has_capacity: bool
                    if not accepts:
                        has_capacity = False
                    elif capacity_kg is None:
                        has_capacity = True
                    else:
                        has_capacity = quantity_kg is None or capacity_kg >= quantity_kg
                    f["preference"] = {
                        "accepts": accepts,
                        "capacity_value": float(cap_val) if cap_val is not None else None,
                        "capacity_unit": cap_unit,
                        "capacity_kg": capacity_kg,
                        "has_capacity": has_capacity,
                    }

            if submission_id:
                submission_rows = (
                    self.client.table("material_submissions")
                    .select("pickup_lat, pickup_lng")
                    .eq("id", submission_id)
                    .limit(1)
                    .execute()
                ).data or []
                sub = submission_rows[0] if submission_rows else {}
                pickup_lat = sub.get("pickup_lat")
                pickup_lng = sub.get("pickup_lng")

                if pickup_lat is not None and pickup_lng is not None:
                    factory_ids = [str(f["id"]) for f in factories if f.get("id")]
                    cached_rows = (
                        self.client.table("material_submission_factory_distances")
                        .select("factory_id, distance_km")
                        .eq("submission_id", submission_id)
                        .in_("factory_id", factory_ids)
                        .execute()
                    ).data or []
                    dist_by_id: dict[str, float | None] = {str(r["factory_id"]): r.get("distance_km") for r in cached_rows}

                    missing = [f for f in factories if str(f["id"]) not in dist_by_id and f.get("lat") is not None and f.get("lng") is not None]
                    if missing:
                        from concurrent.futures import ThreadPoolExecutor, as_completed
                        def _dist(f: dict[str, Any]) -> tuple[str, float | None]:
                            return str(f["id"]), self._fetch_osrm_distance(float(pickup_lat), float(pickup_lng), float(f["lat"]), float(f["lng"]))  # type: ignore[arg-type]
                        with ThreadPoolExecutor(max_workers=8) as pool:
                            for fut in as_completed({pool.submit(_dist, f): f for f in missing}):
                                fid, km = fut.result()
                                dist_by_id[fid] = km
                                self._upsert_submission_factory(submission_id, fid, km)

                    for f in factories:
                        f["distance_km"] = dist_by_id.get(str(f["id"]))

            return factories
        except Exception as exc:
            raise WorkflowError(f"Failed to fetch active factories: {exc}") from exc

    def list_logistics_pickup_jobs(self, logistics_profile_id: str) -> list[dict[str, Any]]:
        try:
            submissions = (
                self.client.table("material_submissions")
                .select(
                    "id, farmer_profile_id, material_type, quantity_value, quantity_unit, "
                    "pickup_location_text, pickup_lat, pickup_lng, status, image_url, "
                    "logistics_profile_id, destination_factory_id, "
                    "scheduled_pickup_at, pickup_window_end_at, received_at, delivered_at, created_at"
                )
                .eq("logistics_profile_id", logistics_profile_id)
                .in_("status", ["pickup_scheduled", "received", "delivered"])
                .order("created_at", desc=True)
                .execute()
            ).data or []

            if not submissions:
                return []

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
                str(s["destination_factory_id"])
                for s in submissions
                if s.get("destination_factory_id") is not None
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

            submission_ids = [str(s["id"]) for s in submissions if s.get("id")]
            dist_map = self._fetch_distances(logistics_profile_id, "material_submission", submission_ids)

            sub_factory_pairs = [
                (str(s["id"]), str(s["destination_factory_id"]))
                for s in submissions
                if s.get("id") and s.get("destination_factory_id")
            ]
            sub_factory_dist: dict[tuple[str, str], float | None] = {}
            if sub_factory_pairs:
                sf_rows = (
                    self.client.table("material_submission_factory_distances")
                    .select("submission_id, factory_id, distance_km")
                    .in_("submission_id", list({p[0] for p in sub_factory_pairs}))
                    .in_("factory_id", list({p[1] for p in sub_factory_pairs}))
                    .execute()
                ).data or []
                for row in sf_rows:
                    sub_factory_dist[(str(row["submission_id"]), str(row["factory_id"]))] = row.get("distance_km")

            result: list[dict[str, Any]] = []
            for s in submissions:
                sid = str(s["id"])
                dest_id = str(s.get("destination_factory_id") or "")
                dest = dest_factory_by_id.get(dest_id, {})
                farmer = farmer_by_id.get(str(s.get("farmer_profile_id") or ""), {})

                result.append({
                    "id": sid,
                    "submission_id": sid,
                    "logistics_profile_id": str(s.get("logistics_profile_id")),
                    "destination_factory_id": dest_id or None,
                    "destination_factory_name_th": dest.get("name_th"),
                    "destination_factory_location_text": dest.get("location_text"),
                    "destination_factory_is_focal_point": bool(dest.get("is_focal_point", False)),
                    "destination_factory_lat": dest.get("lat"),
                    "destination_factory_lng": dest.get("lng"),
                    "status": s.get("status"),
                    "scheduled_pickup_at": s.get("scheduled_pickup_at"),
                    "pickup_window_end_at": s.get("pickup_window_end_at"),
                    "received_at": s.get("received_at"),
                    "delivered_at": s.get("delivered_at"),
                    "created_at": s.get("created_at"),
                    "material_type": s.get("material_type"),
                    "material_name_th": material_types_by_code.get(
                        s.get("material_type", ""), s.get("material_type", "")
                    ),
                    "quantity_value": s.get("quantity_value"),
                    "quantity_unit": s.get("quantity_unit"),
                    "pickup_location_text": s.get("pickup_location_text"),
                    "pickup_lat": s.get("pickup_lat"),
                    "pickup_lng": s.get("pickup_lng"),
                    "farmer_display_name": farmer.get("display_name"),
                    "farmer_phone": farmer.get("phone"),
                    "image_url": resolve_image_url(s.get("image_url")),
                    "distance_to_farmer_km": dist_map.get(sid),
                    "distance_farmer_to_factory_km": sub_factory_dist.get((sid, dest_id)) if dest_id else None,
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
            if not payload.destination_factory_id:
                raise WorkflowError("destination_factory_id is required for scheduling pickup")

            result = _first_row(
                self.client.rpc(
                    "schedule_pickup",
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

            self._update_submission_distances(submission_id)
            return result
        except WorkflowError:
            raise
        except Exception as exc:
            raise WorkflowError(f"Failed to schedule pickup: {exc}") from exc

    def mark_pickup_received(self, submission_id: str, logistics_profile_id: str) -> dict[str, Any]:
        try:
            return _first_row(
                self.client.rpc(
                    "mark_received",
                    {"p_submission_id": submission_id, "p_logistics_profile_id": logistics_profile_id},
                ).execute().data
            )
        except Exception as exc:
            raise WorkflowError(f"Failed to mark pickup as received: {exc}") from exc

    def mark_delivered_to_factory(self, submission_id: str, logistics_profile_id: str) -> dict[str, Any]:
        try:
            return _first_row(
                self.client.rpc(
                    "mark_delivered_to_factory",
                    {"p_submission_id": submission_id, "p_logistics_profile_id": logistics_profile_id},
                ).execute().data
            )
        except Exception as exc:
            raise WorkflowError(f"Failed to mark delivered to factory: {exc}") from exc

    def cancel_submission(self, submission_id: str, logistics_profile_id: str, reason: str) -> dict[str, Any]:
        try:
            return _first_row(
                self.client.rpc(
                    "cancel_submission_by_logistics",
                    {
                        "p_submission_id": submission_id,
                        "p_logistics_profile_id": logistics_profile_id,
                        "p_reason": reason,
                    },
                ).execute().data
            )
        except Exception as exc:
            raise WorkflowError(f"Failed to cancel submission: {exc}") from exc

    def list_cancelled_submissions(self, logistics_profile_id: str) -> list[dict[str, Any]]:
        try:
            submissions = (
                self.client.table("material_submissions")
                .select(
                    "id, farmer_profile_id, material_type, quantity_value, quantity_unit, "
                    "pickup_location_text, pickup_lat, pickup_lng, image_url, "
                    "destination_factory_id, scheduled_pickup_at, pickup_window_end_at, "
                    "cancellation_reason, created_at"
                )
                .eq("logistics_profile_id", logistics_profile_id)
                .eq("status", "cancelled")
                .order("created_at", desc=True)
                .execute()
            ).data or []

            if not submissions:
                return []

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
                str(s["destination_factory_id"])
                for s in submissions
                if s.get("destination_factory_id") is not None
            })
            dest_factory_by_id: dict[str, dict[str, Any]] = {}
            if dest_factory_ids:
                for row in (
                    self.client.table("org_accounts")
                    .select("id, name_th, location_text, lat, lng")
                    .eq("type", "factory")
                    .in_("id", dest_factory_ids)
                    .execute()
                ).data or []:
                    if row.get("id"):
                        dest_factory_by_id[str(row["id"])] = row

            result: list[dict[str, Any]] = []
            for s in submissions:
                dest_id = str(s.get("destination_factory_id") or "")
                dest = dest_factory_by_id.get(dest_id, {})
                farmer = farmer_by_id.get(str(s.get("farmer_profile_id") or ""), {})
                result.append({
                    "id": str(s["id"]),
                    "submission_id": str(s["id"]),
                    "status": "cancelled",
                    "scheduled_pickup_at": s.get("scheduled_pickup_at"),
                    "pickup_window_end_at": s.get("pickup_window_end_at"),
                    "cancellation_reason": s.get("cancellation_reason"),
                    "created_at": s.get("created_at"),
                    "destination_factory_name_th": dest.get("name_th"),
                    "destination_factory_location_text": dest.get("location_text"),
                    "destination_factory_lat": dest.get("lat"),
                    "destination_factory_lng": dest.get("lng"),
                    "material_type": s.get("material_type"),
                    "material_name_th": material_types_by_code.get(
                        s.get("material_type", ""), s.get("material_type", "")
                    ),
                    "quantity_value": s.get("quantity_value"),
                    "quantity_unit": s.get("quantity_unit"),
                    "pickup_location_text": s.get("pickup_location_text"),
                    "pickup_lat": s.get("pickup_lat"),
                    "pickup_lng": s.get("pickup_lng"),
                    "farmer_display_name": farmer.get("display_name"),
                    "farmer_phone": farmer.get("phone"),
                    "image_url": resolve_image_url(s.get("image_url")),
                })

            return result
        except Exception as exc:
            raise WorkflowError(f"Failed to list cancelled submissions: {exc}") from exc

    def reschedule_pickup(self, submission_id: str, logistics_profile_id: str, payload: SchedulePickupRequest) -> dict[str, Any]:
        try:
            return _first_row(
                self.client.rpc(
                    "reschedule_pickup",
                    {
                        "p_submission_id": submission_id,
                        "p_logistics_profile_id": logistics_profile_id,
                        "p_new_pickup_at": payload.pickup_window_start_at.isoformat(),
                        "p_new_window_end_at": payload.pickup_window_end_at.isoformat(),
                    },
                ).execute().data
            )
        except Exception as exc:
            raise WorkflowError(f"Failed to reschedule pickup: {exc}") from exc

    def reschedule_reward_delivery(self, request_id: str, logistics_profile_id: str, payload: ScheduleRewardDeliveryRequest) -> dict[str, Any]:
        try:
            return _first_row(
                self.client.rpc(
                    "reschedule_reward_delivery",
                    {
                        "p_request_id": request_id,
                        "p_logistics_profile_id": logistics_profile_id,
                        "p_new_delivery_at": payload.delivery_window_start_at.isoformat(),
                        "p_new_window_end_at": payload.delivery_window_end_at.isoformat(),
                    },
                ).execute().data
            )
        except Exception as exc:
            raise WorkflowError(f"Failed to reschedule reward delivery: {exc}") from exc

    def list_approved_reward_requests(self, logistics_profile_id: str | None = None) -> list[dict[str, Any]]:
        try:
            approved = (
                self.client.table("reward_requests")
                .select(
                    "id, farmer_profile_id, reward_id, quantity, requested_points, status, "
                    "requested_at, delivery_location_text, delivery_lat, delivery_lng"
                )
                .eq("status", "approved")
                .is_("logistics_profile_id", "null")
                .order("requested_at", desc=False)
                .execute()
            ).data or []

            if not approved:
                return []

            reward_ids = [str(item["reward_id"]) for item in approved if item.get("reward_id")]
            rewards_by_id: dict[str, dict[str, Any]] = {}
            if reward_ids:
                for row in (
                    self.client.table("rewards")
                    .select("id, name_th, description_th, points_cost, instruction_notes")
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
                reward = rewards_by_id.get(str(item.get("reward_id") or ""), {})
                profile = profiles_by_id.get(str(item.get("farmer_profile_id") or ""), {})
                result.append({
                    **item,
                    "id": str(item["id"]),
                    "reward_name_th": reward.get("name_th"),
                    "reward_description_th": reward.get("description_th"),
                    "reward_points_cost": reward.get("points_cost"),
                    "reward_instruction_notes": reward.get("instruction_notes"),
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
            requests = (
                self.client.table("reward_requests")
                .select(
                    "id, farmer_profile_id, reward_id, quantity, requested_points, status, "
                    "delivery_location_text, delivery_lat, delivery_lng, "
                    "scheduled_delivery_at, delivery_window_end_at, out_for_delivery_at, delivered_at, requested_at"
                )
                .eq("logistics_profile_id", logistics_profile_id)
                .in_("status", ["delivery_scheduled", "out_for_delivery", "done"])
                .order("requested_at", desc=True)
                .execute()
            ).data or []

            if not requests:
                return []

            reward_ids = [str(r["reward_id"]) for r in requests if r.get("reward_id")]
            rewards_by_id: dict[str, dict[str, Any]] = {}
            if reward_ids:
                for row in (
                    self.client.table("rewards")
                    .select("id, name_th, instruction_notes")
                    .in_("id", reward_ids)
                    .execute()
                ).data or []:
                    if row.get("id"):
                        rewards_by_id[str(row["id"])] = row

            farmer_ids = list({str(r["farmer_profile_id"]) for r in requests if r.get("farmer_profile_id")})
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

            request_ids = [str(r["id"]) for r in requests if r.get("id")]
            dist_map = self._fetch_distances(logistics_profile_id, "reward_request", request_ids)

            result = []
            for req in requests:
                rid = str(req["id"])
                reward_id = str(req.get("reward_id")) if req.get("reward_id") is not None else None
                profile = profiles_by_id.get(str(req.get("farmer_profile_id") or ""), {})

                result.append({
                    "id": rid,
                    "reward_request_id": rid,
                    "logistics_profile_id": logistics_profile_id,
                    "status": req.get("status"),
                    "scheduled_delivery_at": req.get("scheduled_delivery_at"),
                    "delivery_window_end_at": req.get("delivery_window_end_at"),
                    "out_for_delivery_at": req.get("out_for_delivery_at"),
                    "delivered_at": req.get("delivered_at"),
                    "created_at": req.get("requested_at"),
                    "farmer_profile_id": str(req.get("farmer_profile_id")),
                    "farmer_display_name": profile.get("display_name"),
                    "farmer_phone": profile.get("phone"),
                    "reward_id": reward_id,
                    "reward_name_th": rewards_by_id.get(reward_id, {}).get("name_th") if reward_id else None,
                    "reward_instruction_notes": rewards_by_id.get(reward_id, {}).get("instruction_notes") if reward_id else None,
                    "quantity": req.get("quantity"),
                    "requested_points": req.get("requested_points"),
                    "pickup_location_text": req.get("delivery_location_text"),
                    "pickup_lat": req.get("delivery_lat"),
                    "pickup_lng": req.get("delivery_lng"),
                    "distance_to_farmer_km": dist_map.get(rid),
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
            result = _first_row(
                self.client.rpc(
                    "schedule_reward_delivery",
                    {
                        "p_request_id": request_id,
                        "p_logistics_profile_id": logistics_profile_id,
                        "p_planned_delivery_at": payload.delivery_window_start_at.isoformat(),
                        "p_delivery_window_end_at": payload.delivery_window_end_at.isoformat(),
                        "p_notes": payload.notes,
                    },
                ).execute().data
            )
            self._update_reward_request_distance(request_id)
            return result
        except Exception as exc:
            raise WorkflowError(f"Failed to schedule reward delivery: {exc}") from exc

    def mark_reward_out_for_delivery(self, request_id: str, logistics_profile_id: str) -> dict[str, Any]:
        try:
            return _first_row(
                self.client.rpc(
                    "mark_reward_out_for_delivery",
                    {"p_request_id": request_id, "p_logistics_profile_id": logistics_profile_id},
                ).execute().data
            )
        except Exception as exc:
            raise WorkflowError(f"Failed to mark reward out for delivery: {exc}") from exc

    def mark_reward_delivered(self, request_id: str, logistics_profile_id: str) -> dict[str, Any]:
        try:
            return _first_row(
                self.client.rpc(
                    "mark_reward_delivered",
                    {"p_request_id": request_id, "p_logistics_profile_id": logistics_profile_id},
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
