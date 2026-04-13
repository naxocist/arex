from typing import Any

from supabase import Client

from app.core.errors import WorkflowError
from app.db.supabase import get_service_client
from app.models.workflow import (
    ConfirmFactoryIntakeRequest,
    CreateRewardRequest,
    CreateSubmissionRequest,
    RejectRewardRequest,
    SchedulePickupRequest,
    ScheduleRewardDeliveryRequest,
    UpsertFactoryInfoRequest,
    UpsertLogisticsInfoRequest,
    UpsertMaterialPointRuleRequest,
    UpsertMaterialTypeRequest,
    UpsertMeasurementUnitRequest,
)


def _first_row(data: Any) -> dict[str, Any]:
    if isinstance(data, list):
        if not data:
            raise WorkflowError("No data returned from database operation")
        first = data[0]
        if not isinstance(first, dict):
            raise WorkflowError("Unexpected database response shape")
        return first

    if isinstance(data, dict):
        return data

    raise WorkflowError("Unexpected database response type")


class WorkflowService:
    def __init__(self, client: Client):
        self.client = client

    def _get_latest_pickup_location_by_farmer(
        self,
        farmer_profile_ids: list[str],
    ) -> dict[str, dict[str, Any]]:
        if not farmer_profile_ids:
            return {}

        response = (
            self.client.table("material_submissions")
            .select(
                "farmer_profile_id, pickup_location_text, pickup_lat, pickup_lng, created_at"
            )
            .in_("farmer_profile_id", farmer_profile_ids)
            .order("created_at", desc=True)
            .execute()
        )

        rows = response.data or []
        latest_by_farmer: dict[str, dict[str, Any]] = {}
        for row in rows:
            farmer_profile_id = str(row.get("farmer_profile_id") or "")
            if not farmer_profile_id or farmer_profile_id in latest_by_farmer:
                continue

            latest_by_farmer[farmer_profile_id] = {
                "pickup_location_text": row.get("pickup_location_text"),
                "pickup_lat": row.get("pickup_lat"),
                "pickup_lng": row.get("pickup_lng"),
            }

        return latest_by_farmer

    def list_material_types(self, active_only: bool = True) -> list[dict[str, Any]]:
        try:
            query = (
                self.client.table("material_types")
                .select("code, name_th, active")
                .order("active", desc=True)
                .order("name_th", desc=False)
                .order("code", desc=False)
            )
            if active_only:
                query = query.eq("active", True)

            response = query.execute()
            return response.data or []
        except Exception as exc:
            raise WorkflowError(f"Failed to fetch material types: {exc}") from exc

    def list_measurement_units(self, active_only: bool = True) -> list[dict[str, Any]]:
        try:
            query = (
                self.client.table("measurement_units")
                .select("code, name_th, to_kg_factor, active")
                .order("active", desc=True)
                .order("name_th", desc=False)
                .order("code", desc=False)
            )
            if active_only:
                query = query.eq("active", True)

            response = query.execute()
            return response.data or []
        except Exception as exc:
            raise WorkflowError(f"Failed to fetch measurement units: {exc}") from exc

    def create_material_type(
        self, payload: UpsertMaterialTypeRequest
    ) -> dict[str, Any]:
        try:
            code = payload.code.strip()
            name_th = payload.name_th.strip()
            if not code:
                raise WorkflowError("Material code is required")
            if not name_th:
                raise WorkflowError("Material name is required")

            response = (
                self.client.table("material_types")
                .insert(
                    {
                        "code": code,
                        "name_th": name_th,
                        "active": payload.active,
                    }
                )
                .execute()
            )
            return _first_row(response.data)
        except WorkflowError:
            raise
        except Exception as exc:
            raise WorkflowError(f"Failed to create material type: {exc}") from exc

    def update_material_type(
        self, original_code: str, payload: UpsertMaterialTypeRequest
    ) -> dict[str, Any]:
        try:
            source_code = original_code.strip()
            target_code = payload.code.strip()
            name_th = payload.name_th.strip()
            if not source_code:
                raise WorkflowError("Material code to update is required")
            if not target_code:
                raise WorkflowError("Material code is required")
            if not name_th:
                raise WorkflowError("Material name is required")

            existing_response = (
                self.client.table("material_types")
                .select("code")
                .eq("code", source_code)
                .limit(1)
                .execute()
            )
            if not (existing_response.data or []):
                raise WorkflowError("Material type not found")

            if target_code != source_code:
                conflict_response = (
                    self.client.table("material_types")
                    .select("code")
                    .eq("code", target_code)
                    .limit(1)
                    .execute()
                )
                if conflict_response.data:
                    raise WorkflowError("Material code already exists")

            (
                self.client.table("material_types")
                .update(
                    {
                        "code": target_code,
                        "name_th": name_th,
                        "active": payload.active,
                    }
                )
                .eq("code", source_code)
                .execute()
            )

            updated_response = (
                self.client.table("material_types")
                .select("code, name_th, active")
                .eq("code", target_code)
                .limit(1)
                .execute()
            )
            return _first_row(updated_response.data)
        except WorkflowError:
            raise
        except Exception as exc:
            raise WorkflowError(f"Failed to update material type: {exc}") from exc

    def create_measurement_unit(
        self, payload: UpsertMeasurementUnitRequest
    ) -> dict[str, Any]:
        try:
            code = payload.code.strip()
            name_th = payload.name_th.strip()
            if not code:
                raise WorkflowError("Unit code is required")
            if not name_th:
                raise WorkflowError("Unit name is required")

            response = (
                self.client.table("measurement_units")
                .insert(
                    {
                        "code": code,
                        "name_th": name_th,
                        "to_kg_factor": payload.to_kg_factor,
                        "active": payload.active,
                    }
                )
                .execute()
            )
            return _first_row(response.data)
        except WorkflowError:
            raise
        except Exception as exc:
            raise WorkflowError(f"Failed to create measurement unit: {exc}") from exc

    def update_measurement_unit(
        self, original_code: str, payload: UpsertMeasurementUnitRequest
    ) -> dict[str, Any]:
        try:
            source_code = original_code.strip()
            target_code = payload.code.strip()
            name_th = payload.name_th.strip()
            if not source_code:
                raise WorkflowError("Unit code to update is required")
            if not target_code:
                raise WorkflowError("Unit code is required")
            if not name_th:
                raise WorkflowError("Unit name is required")

            existing_response = (
                self.client.table("measurement_units")
                .select("code")
                .eq("code", source_code)
                .limit(1)
                .execute()
            )
            if not (existing_response.data or []):
                raise WorkflowError("Measurement unit not found")

            if target_code != source_code:
                conflict_response = (
                    self.client.table("measurement_units")
                    .select("code")
                    .eq("code", target_code)
                    .limit(1)
                    .execute()
                )
                if conflict_response.data:
                    raise WorkflowError("Unit code already exists")

            (
                self.client.table("measurement_units")
                .update(
                    {
                        "code": target_code,
                        "name_th": name_th,
                        "to_kg_factor": payload.to_kg_factor,
                        "active": payload.active,
                    }
                )
                .eq("code", source_code)
                .execute()
            )

            updated_response = (
                self.client.table("measurement_units")
                .select("code, name_th, to_kg_factor, active")
                .eq("code", target_code)
                .limit(1)
                .execute()
            )
            return _first_row(updated_response.data)
        except WorkflowError:
            raise
        except Exception as exc:
            raise WorkflowError(f"Failed to update measurement unit: {exc}") from exc

    def list_material_point_rules(self) -> list[dict[str, Any]]:
        try:
            material_types = self.list_material_types(active_only=False)
            rules_response = (
                self.client.table("material_point_rules")
                .select("material_type, points_per_kg")
                .execute()
            )
            rules = rules_response.data or []
            rules_by_material = {
                str(row["material_type"]): row
                for row in rules
                if row.get("material_type")
            }

            result: list[dict[str, Any]] = []
            for material in material_types:
                material_code = str(material.get("code"))
                material_rule = rules_by_material.get(material_code, {})
                result.append(
                    {
                        "material_type": material_code,
                        "material_name_th": material.get("name_th"),
                        "material_active": material.get("active"),
                        "points_per_kg": material_rule.get("points_per_kg"),
                    }
                )

            return result
        except Exception as exc:
            raise WorkflowError(f"Failed to fetch material point rules: {exc}") from exc

    def upsert_material_point_rule(
        self,
        material_code: str,
        payload: UpsertMaterialPointRuleRequest,
    ) -> dict[str, Any]:
        try:
            target_code = material_code.strip()
            if not target_code:
                raise WorkflowError("Material code is required")

            material_response = (
                self.client.table("material_types")
                .select("code")
                .eq("code", target_code)
                .limit(1)
                .execute()
            )
            if not (material_response.data or []):
                raise WorkflowError("Material type not found")

            existing_rule_response = (
                self.client.table("material_point_rules")
                .select("material_type")
                .eq("material_type", target_code)
                .limit(1)
                .execute()
            )

            if existing_rule_response.data:
                (
                    self.client.table("material_point_rules")
                    .update({"points_per_kg": payload.points_per_kg})
                    .eq("material_type", target_code)
                    .execute()
                )
            else:
                (
                    self.client.table("material_point_rules")
                    .insert(
                        {
                            "material_type": target_code,
                            "points_per_kg": payload.points_per_kg,
                        }
                    )
                    .execute()
                )

            updated_response = (
                self.client.table("material_point_rules")
                .select("material_type, points_per_kg")
                .eq("material_type", target_code)
                .limit(1)
                .execute()
            )
            return _first_row(updated_response.data)
        except WorkflowError:
            raise
        except Exception as exc:
            raise WorkflowError(f"Failed to update material point rule: {exc}") from exc

    def create_submission(
        self, farmer_profile_id: str, payload: CreateSubmissionRequest
    ) -> dict[str, Any]:
        try:
            material_code = payload.material_type.strip()
            if not material_code:
                raise WorkflowError("Material type is required")

            material_response = (
                self.client.table("material_types")
                .select("code")
                .eq("code", material_code)
                .eq("active", True)
                .limit(1)
                .execute()
            )
            if not (material_response.data or []):
                raise WorkflowError("Selected material type is invalid or inactive")

            unit_code = payload.quantity_unit.strip()
            if not unit_code:
                raise WorkflowError("Quantity unit is required")

            unit_response = (
                self.client.table("measurement_units")
                .select("code")
                .eq("code", unit_code)
                .eq("active", True)
                .limit(1)
                .execute()
            )
            if not (unit_response.data or []):
                raise WorkflowError("Selected quantity unit is invalid or inactive")

            if payload.pickup_lat is None or payload.pickup_lng is None:
                raise WorkflowError("Pickup location coordinates are required")

            response = (
                self.client.table("material_submissions")
                .insert(
                    {
                        "farmer_profile_id": farmer_profile_id,
                        "material_type": material_code,
                        "quantity_value": payload.quantity_value,
                        "quantity_unit": unit_code,
                        "pickup_location_text": payload.pickup_location_text,
                        "pickup_lat": payload.pickup_lat,
                        "pickup_lng": payload.pickup_lng,
                        "notes": payload.notes,
                        "status": "submitted",
                    }
                )
                .execute()
            )

            submission = _first_row(response.data)

            self.client.table("status_events").insert(
                {
                    "entity_type": "submission",
                    "entity_id": submission["id"],
                    "from_status": None,
                    "to_status": "submitted",
                    "actor_role": "farmer",
                    "actor_profile_id": farmer_profile_id,
                    "note": "Farmer submitted material declaration",
                }
            ).execute()

            return submission
        except WorkflowError:
            raise
        except Exception as exc:
            raise WorkflowError(f"Failed to create submission: {exc}") from exc

    def list_farmer_submissions(self, farmer_profile_id: str) -> list[dict[str, Any]]:
        try:
            response = (
                self.client.table("material_submissions")
                .select(
                    "id, material_type, quantity_value, quantity_unit, pickup_location_text, pickup_lat, pickup_lng, status, created_at"
                )
                .eq("farmer_profile_id", farmer_profile_id)
                .order("created_at", desc=True)
                .execute()
            )

            submissions = response.data or []
            if not submissions:
                return []

            submission_ids = [str(item["id"]) for item in submissions if item.get("id")]
            pickup_jobs_response = (
                self.client.table("pickup_jobs")
                .select(
                    "submission_id, planned_pickup_at, pickup_window_end_at, status, created_at"
                )
                .in_("submission_id", submission_ids)
                .neq("status", "cancelled")
                .order("created_at", desc=True)
                .execute()
            )
            pickup_jobs = pickup_jobs_response.data or []

            latest_pickup_by_submission: dict[str, dict[str, Any]] = {}
            for job in pickup_jobs:
                submission_id = (
                    str(job.get("submission_id")) if job.get("submission_id") else None
                )
                if (
                    submission_id is None
                    or submission_id in latest_pickup_by_submission
                ):
                    continue
                latest_pickup_by_submission[submission_id] = job

            result: list[dict[str, Any]] = []
            for item in submissions:
                submission_id = str(item.get("id")) if item.get("id") else ""
                pickup_job = latest_pickup_by_submission.get(submission_id, {})
                result.append(
                    {
                        **item,
                        "pickup_window_start_at": pickup_job.get("planned_pickup_at"),
                        "pickup_window_end_at": pickup_job.get("pickup_window_end_at"),
                        "pickup_job_status": pickup_job.get("status"),
                    }
                )

            return result
        except Exception as exc:
            raise WorkflowError(f"Failed to list farmer submissions: {exc}") from exc

    def list_rewards_catalog(self) -> list[dict[str, Any]]:
        try:
            response = (
                self.client.table("rewards_catalog")
                .select("id, name_th, description_th, points_cost, stock_qty, active")
                .eq("active", True)
                .gt("stock_qty", 0)
                .order("points_cost", desc=False)
                .execute()
            )
            return response.data or []
        except Exception as exc:
            raise WorkflowError(f"Failed to list rewards catalog: {exc}") from exc

    def list_all_rewards_catalog(self) -> list[dict[str, Any]]:
        try:
            response = (
                self.client.table("rewards_catalog")
                .select(
                    "id, name_th, description_th, points_cost, stock_qty, active, created_at, updated_at"
                )
                .order("points_cost", desc=False)
                .execute()
            )
            return response.data or []
        except Exception as exc:
            raise WorkflowError(f"Failed to list all rewards catalog: {exc}") from exc

    def create_reward(self, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            name_th = payload.get("name_th", "").strip()
            if not name_th:
                raise WorkflowError("Reward name is required")

            points_cost = payload.get("points_cost")
            if not points_cost or not isinstance(points_cost, int) or points_cost <= 0:
                raise WorkflowError("Points cost must be a positive integer")

            stock_qty = payload.get("stock_qty", 0)
            if not isinstance(stock_qty, int) or stock_qty < 0:
                raise WorkflowError("Stock quantity must be a non-negative integer")

            response = (
                self.client.table("rewards_catalog")
                .insert(
                    {
                        "name_th": name_th,
                        "description_th": payload.get("description_th", "").strip()
                        or None,
                        "points_cost": points_cost,
                        "stock_qty": stock_qty,
                        "active": payload.get("active", True),
                    }
                )
                .execute()
            )
            return _first_row(response.data)
        except WorkflowError:
            raise
        except Exception as exc:
            raise WorkflowError(f"Failed to create reward: {exc}") from exc

    def update_reward(self, reward_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            if not reward_id:
                raise WorkflowError("Reward ID is required")

            name_th = payload.get("name_th", "").strip()
            if name_th:
                points_cost = payload.get("points_cost")
                if points_cost is not None:
                    if not isinstance(points_cost, int) or points_cost <= 0:
                        raise WorkflowError("Points cost must be a positive integer")
                stock_qty = payload.get("stock_qty")
                if stock_qty is not None:
                    if not isinstance(stock_qty, int) or stock_qty < 0:
                        raise WorkflowError(
                            "Stock quantity must be a non-negative integer"
                        )

            update_data: dict[str, Any] = {}
            if name_th:
                update_data["name_th"] = name_th
            if "description_th" in payload:
                update_data["description_th"] = (
                    payload["description_th"].strip()
                    if payload["description_th"]
                    else None
                )
            if "points_cost" in payload and payload["points_cost"] is not None:
                update_data["points_cost"] = payload["points_cost"]
            if "stock_qty" in payload and payload["stock_qty"] is not None:
                update_data["stock_qty"] = payload["stock_qty"]
            if "active" in payload:
                update_data["active"] = payload["active"]

            if not update_data:
                raise WorkflowError("No fields to update")

            (
                self.client.table("rewards_catalog")
                .update(update_data)
                .eq("id", reward_id)
                .execute()
            )

            updated_response = (
                self.client.table("rewards_catalog")
                .select(
                    "id, name_th, description_th, points_cost, stock_qty, active, created_at, updated_at"
                )
                .eq("id", reward_id)
                .limit(1)
                .execute()
            )
            if not (updated_response.data or []):
                raise WorkflowError("Reward not found")

            return _first_row(updated_response.data)
        except WorkflowError:
            raise
        except Exception as exc:
            raise WorkflowError(f"Failed to update reward: {exc}") from exc

    def list_farmer_reward_requests(
        self, farmer_profile_id: str
    ) -> list[dict[str, Any]]:
        try:
            response = (
                self.client.table("reward_requests")
                .select(
                    "id, reward_id, quantity, requested_points, status, requested_at, warehouse_decision_at, rejection_reason, "
                    "delivery_location_text, delivery_lat, delivery_lng, "
                    "reward_delivery_jobs(id, status, planned_delivery_at, delivery_window_end_at, out_for_delivery_at, delivered_at)"
                )
                .eq("farmer_profile_id", farmer_profile_id)
                .order("requested_at", desc=True)
                .execute()
            )
            return response.data or []
        except Exception as exc:
            raise WorkflowError(
                f"Failed to list farmer reward requests: {exc}"
            ) from exc

    def get_farmer_points(self, farmer_profile_id: str) -> dict[str, Any]:
        try:
            points_response = self.client.rpc(
                "calculate_available_points",
                {"p_farmer_profile_id": farmer_profile_id},
            ).execute()

            available_points = points_response.data
            if isinstance(available_points, list):
                if available_points and isinstance(available_points[0], dict):
                    # PostgREST scalar compatibility fallback.
                    available_points = next(iter(available_points[0].values()), 0)
                else:
                    available_points = 0

            if available_points is None:
                available_points = 0

            ledger_response = (
                self.client.table("points_ledger")
                .select(
                    "id, entry_type, points_amount, reference_type, reference_id, note, created_at"
                )
                .eq("farmer_profile_id", farmer_profile_id)
                .order("created_at", desc=True)
                .execute()
            )

            return {
                "available_points": int(available_points),
                "ledger": ledger_response.data or [],
            }
        except Exception as exc:
            raise WorkflowError(f"Failed to fetch farmer points: {exc}") from exc

    def create_reward_request(
        self, farmer_profile_id: str, payload: CreateRewardRequest
    ) -> dict[str, Any]:
        try:
            response = self.client.rpc(
                "request_reward_trade",
                {
                    "p_farmer_profile_id": farmer_profile_id,
                    "p_reward_id": payload.reward_id,
                    "p_quantity": payload.quantity,
                    "p_delivery_location_text": payload.delivery_location_text,
                    "p_delivery_lat": payload.delivery_lat,
                    "p_delivery_lng": payload.delivery_lng,
                },
            ).execute()
            return _first_row(response.data)
        except Exception as exc:
            raise WorkflowError(f"Failed to create reward request: {exc}") from exc

    def cancel_reward_request(
        self, farmer_profile_id: str, request_id: str
    ) -> dict[str, Any]:
        try:
            response = self.client.rpc(
                "cancel_reward_request_by_farmer",
                {
                    "p_request_id": request_id,
                    "p_farmer_profile_id": farmer_profile_id,
                    "p_reason": "Cancelled by farmer",
                },
            ).execute()
            return _first_row(response.data)
        except Exception as exc:
            raise WorkflowError(f"Failed to cancel reward request: {exc}") from exc

    def list_pickup_queue(self) -> list[dict[str, Any]]:
        try:
            response = (
                self.client.table("material_submissions")
                .select(
                    "id, farmer_profile_id, material_type, quantity_value, quantity_unit, pickup_location_text, pickup_lat, pickup_lng, status, created_at"
                )
                .in_("status", ["submitted", "pickup_scheduled"])
                .order("created_at", desc=False)
                .execute()
            )
            submissions = response.data or []
            if not submissions:
                return []

            material_codes = list(
                {s.get("material_type") for s in submissions if s.get("material_type")}
            )
            material_types_by_code: dict[str, str] = {}
            if material_codes:
                mt_response = (
                    self.client.table("material_types")
                    .select("code, name_th")
                    .in_("code", material_codes)
                    .execute()
                )
                for row in mt_response.data or []:
                    if row.get("code"):
                        material_types_by_code[str(row["code"])] = row.get(
                            "name_th", ""
                        )

            result = []
            for s in submissions:
                code = s.get("material_type", "")
                result.append(
                    {
                        "id": str(s["id"]),
                        "farmer_profile_id": str(s.get("farmer_profile_id", "")),
                        "material_type": code,
                        "material_name_th": material_types_by_code.get(code, code),
                        "quantity_value": s.get("quantity_value"),
                        "quantity_unit": s.get("quantity_unit"),
                        "pickup_location_text": s.get("pickup_location_text"),
                        "pickup_lat": s.get("pickup_lat"),
                        "pickup_lng": s.get("pickup_lng"),
                        "status": s.get("status"),
                        "created_at": s.get("created_at"),
                    }
                )
            return result
        except Exception as exc:
            raise WorkflowError(f"Failed to fetch pickup queue: {exc}") from exc

    def list_active_factories(self) -> list[dict[str, Any]]:
        try:
            response = (
                self.client.table("factories")
                .select("id, name_th, location_text, lat, lng, active, is_focal_point")
                .eq("active", True)
                .order("name_th", desc=False)
                .execute()
            )
            return response.data or []
        except Exception as exc:
            raise WorkflowError(f"Failed to fetch active factories: {exc}") from exc

    def list_logistics_pickup_jobs(
        self, logistics_profile_id: str
    ) -> list[dict[str, Any]]:
        try:
            jobs_response = (
                self.client.table("pickup_jobs")
                .select(
                    "id, submission_id, logistics_profile_id, destination_factory_id, status, planned_pickup_at, pickup_window_end_at, picked_up_at, delivered_factory_at, created_at"
                )
                .eq("logistics_profile_id", logistics_profile_id)
                .in_(
                    "status", ["pickup_scheduled", "picked_up", "delivered_to_factory"]
                )
                .order("created_at", desc=True)
                .execute()
            )

            jobs = jobs_response.data or []
            if not jobs:
                return []

            submission_ids = [
                str(job["submission_id"]) for job in jobs if job.get("submission_id")
            ]
            if not submission_ids:
                return []

            submissions_response = (
                self.client.table("material_submissions")
                .select(
                    "id, material_type, quantity_value, quantity_unit, pickup_location_text, pickup_lat, pickup_lng, status"
                )
                .in_("id", submission_ids)
                .execute()
            )
            submissions = submissions_response.data or []
            submissions_by_id = {
                str(row["id"]): row for row in submissions if row.get("id")
            }

            material_codes = list(
                {s.get("material_type") for s in submissions if s.get("material_type")}
            )
            material_types_by_code: dict[str, str] = {}
            if material_codes:
                mt_response = (
                    self.client.table("material_types")
                    .select("code, name_th")
                    .in_("code", material_codes)
                    .execute()
                )
                for row in mt_response.data or []:
                    if row.get("code"):
                        material_types_by_code[str(row["code"])] = row.get(
                            "name_th", ""
                        )

            destination_factory_ids = [
                str(job["destination_factory_id"])
                for job in jobs
                if job.get("destination_factory_id") is not None
            ]
            destination_factory_by_id: dict[str, dict[str, Any]] = {}
            if destination_factory_ids:
                factories_response = (
                    self.client.table("factories")
                    .select("id, name_th, location_text, lat, lng, is_focal_point")
                    .in_("id", list(set(destination_factory_ids)))
                    .execute()
                )
                factories = factories_response.data or []
                destination_factory_by_id = {
                    str(row["id"]): row
                    for row in factories
                    if row.get("id") is not None
                }

            result: list[dict[str, Any]] = []
            for job in jobs:
                submission_id = str(job.get("submission_id"))
                submission = submissions_by_id.get(submission_id)
                if submission is None:
                    continue

                result.append(
                    {
                        "id": str(job["id"]),
                        "submission_id": submission_id,
                        "logistics_profile_id": str(job.get("logistics_profile_id")),
                        "destination_factory_id": str(job.get("destination_factory_id"))
                        if job.get("destination_factory_id")
                        else None,
                        "destination_factory_name_th": (
                            destination_factory_by_id.get(
                                str(job.get("destination_factory_id") or ""), {}
                            ).get("name_th")
                        ),
                        "destination_factory_location_text": (
                            destination_factory_by_id.get(
                                str(job.get("destination_factory_id") or ""), {}
                            ).get("location_text")
                        ),
                        "destination_factory_is_focal_point": bool(
                            destination_factory_by_id.get(
                                str(job.get("destination_factory_id") or ""), {}
                            ).get("is_focal_point", False)
                        ),
                        "destination_factory_lat": (
                            destination_factory_by_id.get(
                                str(job.get("destination_factory_id") or ""), {}
                            ).get("lat")
                        ),
                        "destination_factory_lng": (
                            destination_factory_by_id.get(
                                str(job.get("destination_factory_id") or ""), {}
                            ).get("lng")
                        ),
                        "status": job.get("status"),
                        "planned_pickup_at": job.get("planned_pickup_at"),
                        "pickup_window_end_at": job.get("pickup_window_end_at"),
                        "picked_up_at": job.get("picked_up_at"),
                        "delivered_factory_at": job.get("delivered_factory_at"),
                        "created_at": job.get("created_at"),
                        "material_type": submission.get("material_type"),
                        "material_name_th": material_types_by_code.get(
                            submission.get("material_type", ""),
                            submission.get("material_type", ""),
                        ),
                        "quantity_value": submission.get("quantity_value"),
                        "quantity_unit": submission.get("quantity_unit"),
                        "pickup_location_text": submission.get("pickup_location_text"),
                        "pickup_lat": submission.get("pickup_lat"),
                        "pickup_lng": submission.get("pickup_lng"),
                        "submission_status": submission.get("status"),
                    }
                )

            return result
        except Exception as exc:
            raise WorkflowError(
                f"Failed to fetch logistics pickup jobs: {exc}"
            ) from exc

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

            destination_factory_response = (
                self.client.table("factories")
                .select("id, active")
                .eq("id", payload.destination_factory_id)
                .limit(1)
                .execute()
            )
            destination_factories = destination_factory_response.data or []
            if not destination_factories:
                raise WorkflowError("Destination factory not found")
            if not bool(destination_factories[0].get("active")):
                raise WorkflowError("Destination factory is inactive")

            try:
                response = self.client.rpc(
                    "schedule_pickup_job",
                    {
                        "p_submission_id": submission_id,
                        "p_logistics_profile_id": logistics_profile_id,
                        "p_planned_pickup_at": payload.pickup_window_start_at.isoformat(),
                        "p_pickup_window_end_at": payload.pickup_window_end_at.isoformat(),
                        "p_destination_factory_id": payload.destination_factory_id,
                        "p_notes": payload.notes,
                    },
                ).execute()
                return _first_row(response.data)
            except Exception as rpc_exc:
                # Backward compatibility for environments where migration 0009 is not applied yet.
                message = str(rpc_exc)
                if (
                    "Could not find the function public.schedule_pickup_job"
                    not in message
                ):
                    raise

                legacy_response = self.client.rpc(
                    "schedule_pickup_job",
                    {
                        "p_submission_id": submission_id,
                        "p_logistics_profile_id": logistics_profile_id,
                        "p_planned_pickup_at": payload.pickup_window_start_at.isoformat(),
                        "p_pickup_window_end_at": payload.pickup_window_end_at.isoformat(),
                        "p_notes": payload.notes,
                    },
                ).execute()
                legacy_result = _first_row(legacy_response.data)

                pickup_job_id = legacy_result.get("pickup_job_id")
                if pickup_job_id is None:
                    raise WorkflowError(
                        "Failed to schedule pickup: missing pickup_job_id from legacy function"
                    )

                self.client.table("pickup_jobs").update(
                    {
                        "destination_factory_id": payload.destination_factory_id,
                    }
                ).eq("id", pickup_job_id).execute()

                return legacy_result
        except Exception as exc:
            raise WorkflowError(f"Failed to schedule pickup: {exc}") from exc

    def mark_delivered_to_factory(
        self, pickup_job_id: str, logistics_profile_id: str
    ) -> dict[str, Any]:
        try:
            response = self.client.rpc(
                "mark_pickup_delivered_to_factory",
                {
                    "p_pickup_job_id": pickup_job_id,
                    "p_logistics_profile_id": logistics_profile_id,
                },
            ).execute()
            return _first_row(response.data)
        except Exception as exc:
            raise WorkflowError(f"Failed to mark delivered to factory: {exc}") from exc

    def mark_pickup_picked_up(
        self, pickup_job_id: str, logistics_profile_id: str
    ) -> dict[str, Any]:
        try:
            response = self.client.rpc(
                "mark_pickup_picked_up",
                {
                    "p_pickup_job_id": pickup_job_id,
                    "p_logistics_profile_id": logistics_profile_id,
                },
            ).execute()
            return _first_row(response.data)
        except Exception as exc:
            raise WorkflowError(f"Failed to mark pickup as picked up: {exc}") from exc

    def list_approved_reward_requests(self) -> list[dict[str, Any]]:
        try:
            response = (
                self.client.table("reward_requests")
                .select(
                    "id, farmer_profile_id, reward_id, quantity, requested_points, status, "
                    "requested_at, delivery_location_text, delivery_lat, delivery_lng"
                )
                .eq("status", "warehouse_approved")
                .order("requested_at", desc=False)
                .execute()
            )

            approved_requests = response.data or []
            if not approved_requests:
                return []

            request_ids = [
                str(item["id"]) for item in approved_requests if item.get("id")
            ]
            if not request_ids:
                return []

            delivery_jobs_response = (
                self.client.table("reward_delivery_jobs")
                .select("reward_request_id, status")
                .in_("reward_request_id", request_ids)
                .neq("status", "cancelled")
                .execute()
            )
            delivery_jobs = delivery_jobs_response.data or []
            request_ids_with_jobs = {
                str(row["reward_request_id"])
                for row in delivery_jobs
                if row.get("reward_request_id")
            }

            reward_ids = [
                str(item["reward_id"])
                for item in approved_requests
                if item.get("reward_id")
            ]
            rewards_by_id: dict[str, dict[str, Any]] = {}
            if reward_ids:
                rewards_response = (
                    self.client.table("rewards_catalog")
                    .select("id, name_th, description_th, points_cost")
                    .in_("id", reward_ids)
                    .execute()
                )
                rewards = rewards_response.data or []
                rewards_by_id = {
                    str(row["id"]): row for row in rewards if row.get("id")
                }

            farmer_ids = list(
                {str(item["farmer_profile_id"]) for item in approved_requests if item.get("farmer_profile_id")}
            )
            profiles_by_id: dict[str, dict[str, Any]] = {}
            if farmer_ids:
                prof_rows = (
                    self.client.table("profiles")
                    .select("id, display_name, phone, province")
                    .in_("id", farmer_ids)
                    .execute()
                ).data or []
                profiles_by_id = {str(r["id"]): r for r in prof_rows if r.get("id")}

            result: list[dict[str, Any]] = []
            for item in approved_requests:
                if str(item.get("id")) in request_ids_with_jobs:
                    continue

                reward = rewards_by_id.get(str(item.get("reward_id") or ""), {})
                profile = profiles_by_id.get(str(item.get("farmer_profile_id") or ""), {})
                result.append(
                    {
                        **item,
                        "reward_name_th": reward.get("name_th"),
                        "reward_description_th": reward.get("description_th"),
                        "reward_points_cost": reward.get("points_cost"),
                        "farmer_display_name": profile.get("display_name"),
                        "farmer_phone": profile.get("phone"),
                        "pickup_location_text": item.get("delivery_location_text"),
                        "pickup_lat": item.get("delivery_lat"),
                        "pickup_lng": item.get("delivery_lng"),
                    }
                )

            return result
        except Exception as exc:
            raise WorkflowError(
                f"Failed to fetch approved reward requests: {exc}"
            ) from exc

    def list_reward_delivery_jobs(
        self, logistics_profile_id: str
    ) -> list[dict[str, Any]]:
        try:
            jobs_response = (
                self.client.table("reward_delivery_jobs")
                .select(
                    "id, reward_request_id, logistics_profile_id, status, planned_delivery_at, delivery_window_end_at, out_for_delivery_at, delivered_at, created_at"
                )
                .eq("logistics_profile_id", logistics_profile_id)
                .in_("status", ["reward_delivery_scheduled", "out_for_delivery"])
                .order("created_at", desc=True)
                .execute()
            )

            jobs = jobs_response.data or []
            if not jobs:
                return []

            request_ids = [
                str(job["reward_request_id"])
                for job in jobs
                if job.get("reward_request_id")
            ]
            if not request_ids:
                return []

            requests_response = (
                self.client.table("reward_requests")
                .select(
                    "id, farmer_profile_id, reward_id, quantity, requested_points, "
                    "delivery_location_text, delivery_lat, delivery_lng"
                )
                .in_("id", request_ids)
                .execute()
            )
            requests = requests_response.data or []
            requests_by_id = {str(row["id"]): row for row in requests if row.get("id")}

            reward_ids = [
                str(row["reward_id"]) for row in requests if row.get("reward_id")
            ]
            rewards_by_id: dict[str, dict[str, Any]] = {}
            if reward_ids:
                rewards_response = (
                    self.client.table("rewards_catalog")
                    .select("id, name_th")
                    .in_("id", reward_ids)
                    .execute()
                )
                rewards = rewards_response.data or []
                rewards_by_id = {
                    str(row["id"]): row for row in rewards if row.get("id")
                }

            farmer_ids = list(
                {str(row["farmer_profile_id"]) for row in requests if row.get("farmer_profile_id")}
            )
            profiles_by_id: dict[str, dict[str, Any]] = {}
            if farmer_ids:
                prof_rows = (
                    self.client.table("profiles")
                    .select("id, display_name, phone")
                    .in_("id", farmer_ids)
                    .execute()
                ).data or []
                profiles_by_id = {str(r["id"]): r for r in prof_rows if r.get("id")}

            result: list[dict[str, Any]] = []
            for job in jobs:
                request_id = str(job.get("reward_request_id"))
                request = requests_by_id.get(request_id)
                if request is None:
                    continue

                reward_id = (
                    str(request.get("reward_id"))
                    if request.get("reward_id") is not None
                    else None
                )
                reward_name = (
                    rewards_by_id.get(reward_id, {}).get("name_th")
                    if reward_id is not None
                    else None
                )
                profile = profiles_by_id.get(str(request.get("farmer_profile_id") or ""), {})

                result.append(
                    {
                        "id": str(job["id"]),
                        "reward_request_id": request_id,
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
                        "reward_name_th": reward_name,
                        "quantity": request.get("quantity"),
                        "requested_points": request.get("requested_points"),
                        "pickup_location_text": request.get("delivery_location_text"),
                        "pickup_lat": request.get("delivery_lat"),
                        "pickup_lng": request.get("delivery_lng"),
                    }
                )

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

            response = self.client.rpc(
                "schedule_reward_delivery_job",
                {
                    "p_reward_request_id": request_id,
                    "p_logistics_profile_id": logistics_profile_id,
                    "p_planned_delivery_at": payload.delivery_window_start_at.isoformat(),
                    "p_delivery_window_end_at": payload.delivery_window_end_at.isoformat(),
                    "p_notes": payload.notes,
                },
            ).execute()
            return _first_row(response.data)
        except Exception as exc:
            raise WorkflowError(f"Failed to schedule reward delivery: {exc}") from exc

    def mark_reward_out_for_delivery(
        self,
        delivery_job_id: str,
        logistics_profile_id: str,
    ) -> dict[str, Any]:
        try:
            response = self.client.rpc(
                "mark_reward_out_for_delivery",
                {
                    "p_delivery_job_id": delivery_job_id,
                    "p_logistics_profile_id": logistics_profile_id,
                },
            ).execute()
            return _first_row(response.data)
        except Exception as exc:
            raise WorkflowError(
                f"Failed to mark reward out for delivery: {exc}"
            ) from exc

    def mark_reward_delivered(
        self,
        delivery_job_id: str,
        logistics_profile_id: str,
    ) -> dict[str, Any]:
        try:
            response = self.client.rpc(
                "mark_reward_delivered",
                {
                    "p_delivery_job_id": delivery_job_id,
                    "p_logistics_profile_id": logistics_profile_id,
                },
            ).execute()
            return _first_row(response.data)
        except Exception as exc:
            raise WorkflowError(f"Failed to mark reward delivered: {exc}") from exc

    def list_factory_pending_intakes(self, factory_profile_id: str) -> dict[str, Any]:
        try:
            my_factory = self.get_or_create_factory_for_profile(factory_profile_id)
            my_factory_id = str(my_factory.get("id") or "")
            if not my_factory_id:
                raise WorkflowError("Factory record not found")

            pickup_response = (
                self.client.table("pickup_jobs")
                .select(
                    "id, submission_id, logistics_profile_id, destination_factory_id, status, planned_pickup_at, picked_up_at, delivered_factory_at"
                )
                .eq("status", "delivered_to_factory")
                .eq("destination_factory_id", my_factory_id)
                .order("delivered_factory_at", desc=True)
                .execute()
            )

            pickup_jobs_arrived = pickup_response.data or []

            intake_response = (
                self.client.table("factory_intakes")
                .select(
                    "id, pickup_job_id, factory_profile_id, measured_weight_kg, discrepancy_note, status, confirmed_at"
                )
                .eq("factory_profile_id", factory_profile_id)
                .order("confirmed_at", desc=True)
                .execute()
            )
            factory_intakes = intake_response.data or []

            intake_pickup_job_ids = list(
                {
                    str(item["pickup_job_id"])
                    for item in factory_intakes
                    if item.get("pickup_job_id") is not None
                }
            )

            pickup_jobs_confirmed: list[dict[str, Any]] = []
            if intake_pickup_job_ids:
                confirmed_pickup_response = (
                    self.client.table("pickup_jobs")
                    .select(
                        "id, submission_id, logistics_profile_id, destination_factory_id, status, planned_pickup_at, picked_up_at, delivered_factory_at"
                    )
                    .in_("id", intake_pickup_job_ids)
                    .execute()
                )
                pickup_jobs_confirmed = confirmed_pickup_response.data or []

            pickup_jobs_by_id: dict[str, dict[str, Any]] = {}
            for row in [*pickup_jobs_arrived, *pickup_jobs_confirmed]:
                row_id = row.get("id")
                if row_id is None:
                    continue
                pickup_jobs_by_id[str(row_id)] = row

            submission_ids = list(
                {
                    str(row["submission_id"])
                    for row in pickup_jobs_by_id.values()
                    if row.get("submission_id") is not None
                }
            )

            submissions: list[dict[str, Any]] = []
            submissions_by_id: dict[str, dict[str, Any]] = {}
            if submission_ids:
                submissions_response = (
                    self.client.table("material_submissions")
                    .select(
                        "id, material_type, quantity_value, quantity_unit, pickup_location_text"
                    )
                    .in_("id", submission_ids)
                    .execute()
                )
                submissions = submissions_response.data or []
                submissions_by_id = {
                    str(row["id"]): row for row in submissions if row.get("id")
                }

            material_codes = list(
                {
                    str(row.get("material_type"))
                    for row in submissions
                    if row.get("material_type") is not None
                }
            )
            material_names_by_code: dict[str, str] = {}
            if material_codes:
                materials_response = (
                    self.client.table("material_types")
                    .select("code, name_th")
                    .in_("code", material_codes)
                    .execute()
                )
                materials = materials_response.data or []
                material_names_by_code = {
                    str(row["code"]): str(row["name_th"])
                    for row in materials
                    if row.get("code") is not None and row.get("name_th") is not None
                }

            unit_codes = [
                str(row["quantity_unit"])
                for row in submissions
                if row.get("quantity_unit") is not None
            ]
            units_by_code: dict[str, dict[str, Any]] = {}
            if unit_codes:
                units_response = (
                    self.client.table("measurement_units")
                    .select("code, to_kg_factor")
                    .in_("code", list(set(unit_codes)))
                    .execute()
                )
                units = units_response.data or []
                units_by_code = {
                    str(row["code"]): row for row in units if row.get("code")
                }

            def _to_float(value: Any) -> float:
                try:
                    return float(value)
                except (TypeError, ValueError):
                    return 0.0

            queue: list[dict[str, Any]] = []
            for job in pickup_jobs_arrived:
                submission_id = str(job.get("submission_id"))
                submission = submissions_by_id.get(submission_id)
                if submission is None:
                    continue

                unit_code = submission.get("quantity_unit")
                unit_meta = (
                    units_by_code.get(str(unit_code)) if unit_code is not None else None
                )

                queue.append(
                    {
                        "pickup_job_id": str(job["id"]),
                        "submission_id": submission_id,
                        "logistics_profile_id": str(job.get("logistics_profile_id")),
                        "status": job.get("status"),
                        "planned_pickup_at": job.get("planned_pickup_at"),
                        "picked_up_at": job.get("picked_up_at"),
                        "delivered_factory_at": job.get("delivered_factory_at"),
                        "material_type": submission.get("material_type"),
                        "material_name_th": material_names_by_code.get(
                            str(submission.get("material_type") or "")
                        ),
                        "quantity_value": submission.get("quantity_value"),
                        "quantity_unit": submission.get("quantity_unit"),
                        "quantity_to_kg_factor": unit_meta.get("to_kg_factor")
                        if unit_meta
                        else None,
                        "pickup_location_text": submission.get("pickup_location_text"),
                    }
                )

            confirmed: list[dict[str, Any]] = []
            confirmed_weight_kg_total = 0.0
            for intake in factory_intakes:
                pickup_job_id = str(intake.get("pickup_job_id") or "")
                job = pickup_jobs_by_id.get(pickup_job_id)
                if job is None:
                    continue

                submission = submissions_by_id.get(str(job.get("submission_id")))
                if submission is None:
                    continue

                measured_weight_kg = float(intake.get("measured_weight_kg") or 0)
                confirmed_weight_kg_total += measured_weight_kg
                confirmed.append(
                    {
                        "intake_id": str(intake.get("id")),
                        "pickup_job_id": pickup_job_id,
                        "submission_id": str(job.get("submission_id")),
                        "material_type": submission.get("material_type"),
                        "material_name_th": material_names_by_code.get(
                            str(submission.get("material_type") or "")
                        ),
                        "quantity_value": submission.get("quantity_value"),
                        "quantity_unit": submission.get("quantity_unit"),
                        "measured_weight_kg": measured_weight_kg,
                        "measured_weight_ton": round(measured_weight_kg / 1000, 3),
                        "pickup_location_text": submission.get("pickup_location_text"),
                        "confirmed_at": intake.get("confirmed_at"),
                        "status": intake.get("status"),
                        "factory_profile_id": intake.get("factory_profile_id"),
                        "discrepancy_note": intake.get("discrepancy_note"),
                    }
                )

            arrived_estimated_weight_kg_total = 0.0
            arrived_convertible_count = 0
            arrived_non_convertible_count = 0
            arrived_non_convertible_quantity_total = 0.0
            for item in queue:
                quantity_value = _to_float(item.get("quantity_value"))
                factor = _to_float(item.get("quantity_to_kg_factor"))
                if factor > 0:
                    arrived_convertible_count += 1
                    arrived_estimated_weight_kg_total += quantity_value * factor
                else:
                    arrived_non_convertible_count += 1
                    arrived_non_convertible_quantity_total += quantity_value

            return {
                "queue": queue,
                "confirmed": confirmed,
                "summary": {
                    "arrived_count": len(queue),
                    "confirmed_count": len(confirmed),
                    "arrived_estimated_weight_kg_total": round(
                        arrived_estimated_weight_kg_total, 3
                    ),
                    "arrived_convertible_count": arrived_convertible_count,
                    "arrived_non_convertible_count": arrived_non_convertible_count,
                    "arrived_non_convertible_quantity_total": round(
                        arrived_non_convertible_quantity_total, 3
                    ),
                    "confirmed_weight_kg_total": round(confirmed_weight_kg_total, 3),
                    "confirmed_weight_ton_total": round(
                        confirmed_weight_kg_total / 1000, 3
                    ),
                },
            }
        except Exception as exc:
            raise WorkflowError(
                f"Failed to list factory pending intakes: {exc}"
            ) from exc

    def confirm_factory_intake(
        self,
        factory_profile_id: str,
        payload: ConfirmFactoryIntakeRequest,
    ) -> dict[str, Any]:
        try:
            my_factory = self.get_or_create_factory_for_profile(factory_profile_id)
            my_factory_id = str(my_factory.get("id") or "")
            if not my_factory_id:
                raise WorkflowError("Factory record not found")

            pickup_job_response = (
                self.client.table("pickup_jobs")
                .select("id, destination_factory_id")
                .eq("id", payload.pickup_job_id)
                .limit(1)
                .execute()
            )
            pickup_job_rows = pickup_job_response.data or []
            if not pickup_job_rows:
                raise WorkflowError("Pickup job not found")

            destination_factory_id = pickup_job_rows[0].get("destination_factory_id")
            if (
                destination_factory_id is not None
                and str(destination_factory_id) != my_factory_id
            ):
                raise WorkflowError("Pickup job is assigned to another factory")

            response = self.client.rpc(
                "confirm_factory_intake",
                {
                    "p_pickup_job_id": payload.pickup_job_id,
                    "p_factory_profile_id": factory_profile_id,
                    "p_measured_weight_kg": payload.measured_weight_kg,
                    "p_discrepancy_note": payload.discrepancy_note,
                },
            ).execute()
            return _first_row(response.data)
        except Exception as exc:
            raise WorkflowError(f"Failed to confirm factory intake: {exc}") from exc

    def get_or_create_factory_for_profile(
        self, factory_profile_id: str
    ) -> dict[str, Any]:
        try:
            existing_response = (
                self.client.table("factories")
                .select(
                    "id, factory_profile_id, name_th, location_text, lat, lng, active, created_at"
                )
                .eq("factory_profile_id", factory_profile_id)
                .limit(1)
                .execute()
            )
            existing_rows = existing_response.data or []
            if existing_rows:
                return _first_row(existing_rows)

            profile_response = (
                self.client.table("profiles")
                .select("display_name")
                .eq("id", factory_profile_id)
                .limit(1)
                .execute()
            )
            profile_rows = profile_response.data or []
            if not profile_rows:
                raise WorkflowError("Factory profile not found")

            display_name = str(profile_rows[0].get("display_name") or "").strip()
            default_name = display_name or f"โรงงาน {factory_profile_id[:8]}"
            create_response = (
                self.client.table("factories")
                .insert(
                    {
                        "factory_profile_id": factory_profile_id,
                        "name_th": default_name,
                        "active": True,
                    }
                )
                .execute()
            )

            return _first_row(create_response.data)
        except WorkflowError:
            raise
        except Exception as exc:
            raise WorkflowError(f"Failed to load factory info: {exc}") from exc

    def update_factory_for_profile(
        self,
        factory_profile_id: str,
        payload: UpsertFactoryInfoRequest,
    ) -> dict[str, Any]:
        try:
            if (payload.lat is None) != (payload.lng is None):
                raise WorkflowError("lat and lng must be provided together")

            factory = self.get_or_create_factory_for_profile(factory_profile_id)
            factory_id = str(factory.get("id") or "")
            if not factory_id:
                raise WorkflowError("Factory record not found")

            name_th = payload.name_th.strip()
            if not name_th:
                raise WorkflowError("Factory name is required")

            location_text = (
                payload.location_text.strip() if payload.location_text else None
            )

            update_response = (
                self.client.table("factories")
                .update(
                    {
                        "name_th": name_th,
                        "location_text": location_text,
                        "lat": payload.lat,
                        "lng": payload.lng,
                    }
                )
                .eq("id", factory_id)
                .eq("factory_profile_id", factory_profile_id)
                .execute()
            )

            return _first_row(update_response.data)
        except WorkflowError:
            raise
        except Exception as exc:
            raise WorkflowError(f"Failed to update factory info: {exc}") from exc

    def get_or_create_logistics_for_profile(
        self, logistics_profile_id: str
    ) -> dict[str, Any]:
        try:
            existing_response = (
                self.client.table("logistics_accounts")
                .select(
                    "id, logistics_profile_id, name_th, location_text, lat, lng, active, created_at"
                )
                .eq("logistics_profile_id", logistics_profile_id)
                .limit(1)
                .execute()
            )
            existing_rows = existing_response.data or []
            if existing_rows:
                return _first_row(existing_rows)

            profile_response = (
                self.client.table("profiles")
                .select("display_name")
                .eq("id", logistics_profile_id)
                .limit(1)
                .execute()
            )
            profile_rows = profile_response.data or []
            if not profile_rows:
                raise WorkflowError("Logistics profile not found")

            display_name = str(profile_rows[0].get("display_name") or "").strip()
            default_name = display_name or f"ทีมขนส่ง {logistics_profile_id[:8]}"
            create_response = (
                self.client.table("logistics_accounts")
                .insert(
                    {
                        "logistics_profile_id": logistics_profile_id,
                        "name_th": default_name,
                        "active": True,
                    }
                )
                .execute()
            )
            return _first_row(create_response.data)
        except WorkflowError:
            raise
        except Exception as exc:
            raise WorkflowError(f"Failed to load logistics info: {exc}") from exc

    def update_logistics_for_profile(
        self,
        logistics_profile_id: str,
        payload: UpsertLogisticsInfoRequest,
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

            location_text = (
                payload.location_text.strip() if payload.location_text else None
            )

            update_response = (
                self.client.table("logistics_accounts")
                .update(
                    {
                        "name_th": name_th,
                        "location_text": location_text,
                        "lat": payload.lat,
                        "lng": payload.lng,
                    }
                )
                .eq("id", account_id)
                .eq("logistics_profile_id", logistics_profile_id)
                .execute()
            )
            return _first_row(update_response.data)
        except WorkflowError:
            raise
        except Exception as exc:
            raise WorkflowError(f"Failed to update logistics info: {exc}") from exc

    def _enrich_reward_requests(
        self, requests: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """Join rewards_catalog and profiles onto a list of reward_request rows."""
        if not requests:
            return []

        reward_ids = [str(r["reward_id"]) for r in requests if r.get("reward_id")]
        rewards_by_id: dict[str, dict[str, Any]] = {}
        if reward_ids:
            rows = (
                self.client.table("rewards_catalog")
                .select("id, name_th, description_th, points_cost")
                .in_("id", reward_ids)
                .execute()
            ).data or []
            rewards_by_id = {str(r["id"]): r for r in rows if r.get("id")}

        farmer_ids = list(
            {str(r["farmer_profile_id"]) for r in requests if r.get("farmer_profile_id")}
        )
        profiles_by_id: dict[str, dict[str, Any]] = {}
        if farmer_ids:
            rows = (
                self.client.table("profiles")
                .select("id, display_name, phone, province")
                .in_("id", farmer_ids)
                .execute()
            ).data or []
            profiles_by_id = {str(r["id"]): r for r in rows if r.get("id")}

        result: list[dict[str, Any]] = []
        for item in requests:
            reward = rewards_by_id.get(str(item.get("reward_id") or ""), {})
            profile = profiles_by_id.get(str(item.get("farmer_profile_id") or ""), {})
            result.append(
                {
                    **item,
                    "reward_name_th": reward.get("name_th"),
                    "reward_description_th": reward.get("description_th"),
                    "reward_points_cost": reward.get("points_cost"),
                    "farmer_display_name": profile.get("display_name"),
                    "farmer_phone": profile.get("phone"),
                    "farmer_province": profile.get("province"),
                }
            )
        return result

    def list_pending_reward_requests(self) -> list[dict[str, Any]]:
        try:
            response = (
                self.client.table("reward_requests")
                .select(
                    "id, farmer_profile_id, reward_id, quantity, requested_points, status, "
                    "requested_at, delivery_location_text, delivery_lat, delivery_lng"
                )
                .eq("status", "requested")
                .order("requested_at", desc=False)
                .execute()
            )
            return self._enrich_reward_requests(response.data or [])
        except Exception as exc:
            raise WorkflowError(
                f"Failed to fetch pending reward requests: {exc}"
            ) from exc

    def list_answered_reward_requests(self) -> list[dict[str, Any]]:
        try:
            response = (
                self.client.table("reward_requests")
                .select(
                    "id, farmer_profile_id, reward_id, quantity, requested_points, status, "
                    "requested_at, delivery_location_text, delivery_lat, delivery_lng, "
                    "warehouse_decision_at, rejection_reason"
                )
                .in_("status", ["warehouse_approved", "warehouse_rejected"])
                .order("requested_at", desc=True)
                .execute()
            )
            return self._enrich_reward_requests(response.data or [])
        except Exception as exc:
            raise WorkflowError(
                f"Failed to fetch answered reward requests: {exc}"
            ) from exc

    def approve_reward_request(
        self, request_id: str, warehouse_profile_id: str
    ) -> dict[str, Any]:
        try:
            response = self.client.rpc(
                "approve_reward_request",
                {
                    "p_request_id": request_id,
                    "p_warehouse_profile_id": warehouse_profile_id,
                },
            ).execute()
            return _first_row(response.data)
        except Exception as exc:
            raise WorkflowError(f"Failed to approve reward request: {exc}") from exc

    def reject_reward_request(
        self,
        request_id: str,
        warehouse_profile_id: str,
        payload: RejectRewardRequest,
    ) -> dict[str, Any]:
        try:
            response = self.client.rpc(
                "reject_reward_request",
                {
                    "p_request_id": request_id,
                    "p_warehouse_profile_id": warehouse_profile_id,
                    "p_reason": payload.reason,
                },
            ).execute()
            return _first_row(response.data)
        except Exception as exc:
            raise WorkflowError(f"Failed to reject reward request: {exc}") from exc

    def get_executive_overview(self) -> dict[str, Any]:
        try:
            submissions_response = (
                self.client.table("material_submissions")
                .select(
                    "id, farmer_profile_id, material_type, quantity_value, quantity_unit, status"
                )
                .execute()
            )
            reward_requests_response = (
                self.client.table("reward_requests")
                .select("id, status, requested_points")
                .execute()
            )
            pickup_jobs_response = (
                self.client.table("pickup_jobs").select("id,status").execute()
            )
            points_ledger_response = (
                self.client.table("points_ledger")
                .select("entry_type, points_amount")
                .execute()
            )
            factory_intakes_response = (
                self.client.table("factory_intakes")
                .select("measured_weight_kg")
                .execute()
            )
            units_response = (
                self.client.table("measurement_units")
                .select("code, to_kg_factor")
                .execute()
            )

            submissions = submissions_response.data or []
            reward_requests = reward_requests_response.data or []
            pickup_jobs = pickup_jobs_response.data or []
            points_ledger = points_ledger_response.data or []
            factory_intakes = factory_intakes_response.data or []
            units = units_response.data or []
            material_types_response = (
                self.client.table("material_types").select("code, name_th").execute()
            )
            material_types = material_types_response.data or []

            def _to_float(value: Any) -> float:
                try:
                    return float(value)
                except (TypeError, ValueError):
                    return 0.0

            units_to_kg_factor = {
                str(row.get("code")): _to_float(row.get("to_kg_factor"))
                for row in units
                if row.get("code") is not None and row.get("to_kg_factor") is not None
            }
            material_name_by_code = {
                str(row.get("code")): str(row.get("name_th"))
                for row in material_types
                if row.get("code") is not None and row.get("name_th") is not None
            }

            submissions_by_material: dict[str, dict[str, Any]] = {}
            submitted_weight_estimated_kg_total = 0.0
            submissions_convertible_count = 0
            submissions_non_convertible_count = 0
            submissions_non_convertible_quantity_total = 0.0
            unique_farmers: set[str] = set()

            for row in submissions:
                farmer_profile_id = row.get("farmer_profile_id")
                if farmer_profile_id is not None:
                    unique_farmers.add(str(farmer_profile_id))

                material_code = str(row.get("material_type") or "unknown")
                quantity_value = _to_float(row.get("quantity_value"))
                quantity_unit = str(row.get("quantity_unit") or "")
                unit_factor = units_to_kg_factor.get(quantity_unit)
                is_convertible = unit_factor is not None and unit_factor > 0
                estimated_kg = quantity_value * unit_factor if is_convertible else 0.0
                submitted_weight_estimated_kg_total += estimated_kg
                if is_convertible:
                    submissions_convertible_count += 1
                else:
                    submissions_non_convertible_count += 1
                    submissions_non_convertible_quantity_total += quantity_value

                material_stat = submissions_by_material.setdefault(
                    material_code,
                    {
                        "material_type": material_code,
                        "material_name_th": material_name_by_code.get(material_code),
                        "submissions_count": 0,
                        "declared_quantity_total": 0.0,
                        "estimated_weight_kg_total": 0.0,
                        "convertible_submissions_count": 0,
                        "non_convertible_submissions_count": 0,
                    },
                )
                material_stat["submissions_count"] += 1
                material_stat["declared_quantity_total"] += quantity_value
                material_stat["estimated_weight_kg_total"] += estimated_kg
                if is_convertible:
                    material_stat["convertible_submissions_count"] += 1
                else:
                    material_stat["non_convertible_submissions_count"] += 1

            submissions_material_breakdown = sorted(
                submissions_by_material.values(),
                key=lambda row: row["submissions_count"],
                reverse=True,
            )

            reward_requests_status_summary = {
                "requested": sum(
                    1 for row in reward_requests if row.get("status") == "requested"
                ),
                "warehouse_approved": sum(
                    1
                    for row in reward_requests
                    if row.get("status") == "warehouse_approved"
                ),
                "warehouse_rejected": sum(
                    1
                    for row in reward_requests
                    if row.get("status") == "warehouse_rejected"
                ),
                "cancelled": sum(
                    1 for row in reward_requests if row.get("status") == "cancelled"
                ),
            }
            reward_requested_points_total = sum(
                int(_to_float(row.get("requested_points"))) for row in reward_requests
            )
            reward_approved_points_total = sum(
                int(_to_float(row.get("requested_points")))
                for row in reward_requests
                if row.get("status") == "warehouse_approved"
            )

            points_credited_total = sum(
                int(_to_float(row.get("points_amount")))
                for row in points_ledger
                if row.get("entry_type") in {"intake_credit", "adjustment"}
            )
            points_spent_total = sum(
                int(_to_float(row.get("points_amount")))
                for row in points_ledger
                if row.get("entry_type") == "reward_spend"
            )
            points_reserved_total = sum(
                int(_to_float(row.get("points_amount")))
                for row in points_ledger
                if row.get("entry_type") == "reward_reserve"
            ) - sum(
                int(_to_float(row.get("points_amount")))
                for row in points_ledger
                if row.get("entry_type") == "reward_release"
            )

            factory_confirmed_weight_kg_total = sum(
                _to_float(row.get("measured_weight_kg")) for row in factory_intakes
            )
            pickup_jobs_status_summary = {
                "pickup_scheduled": sum(
                    1 for row in pickup_jobs if row.get("status") == "pickup_scheduled"
                ),
                "picked_up": sum(
                    1 for row in pickup_jobs if row.get("status") == "picked_up"
                ),
                "delivered_to_factory": sum(
                    1
                    for row in pickup_jobs
                    if row.get("status") == "delivered_to_factory"
                ),
            }

            return {
                "submissions_total": len(submissions),
                "unique_farmers_total": len(unique_farmers),
                "submissions_pending_pickup": sum(
                    1 for row in submissions if row.get("status") == "submitted"
                ),
                "pickup_jobs_active": sum(
                    1
                    for row in pickup_jobs
                    if row.get("status")
                    in {"pickup_scheduled", "picked_up", "delivered_to_factory"}
                ),
                "pickup_jobs_status_summary": pickup_jobs_status_summary,
                "reward_requests_pending_warehouse": sum(
                    1 for row in reward_requests if row.get("status") == "requested"
                ),
                "submitted_weight_estimated_kg_total": round(
                    submitted_weight_estimated_kg_total, 3
                ),
                "submitted_weight_estimated_ton_total": round(
                    submitted_weight_estimated_kg_total / 1000, 3
                ),
                "submissions_convertible_count": submissions_convertible_count,
                "submissions_non_convertible_count": submissions_non_convertible_count,
                "submissions_non_convertible_quantity_total": round(
                    submissions_non_convertible_quantity_total, 3
                ),
                "factory_confirmed_weight_kg_total": round(
                    factory_confirmed_weight_kg_total, 3
                ),
                "factory_confirmed_weight_ton_total": round(
                    factory_confirmed_weight_kg_total / 1000, 3
                ),
                "points_credited_total": points_credited_total,
                "points_reserved_total": max(points_reserved_total, 0),
                "points_spent_total": points_spent_total,
                "reward_requests_total": len(reward_requests),
                "reward_requested_points_total": reward_requested_points_total,
                "reward_approved_points_total": reward_approved_points_total,
                "reward_requests_status_summary": reward_requests_status_summary,
                "submissions_material_breakdown": submissions_material_breakdown,
            }
        except Exception as exc:
            raise WorkflowError(f"Failed to fetch executive overview: {exc}") from exc

    def get_impact_kpis(self) -> dict[str, Any]:
        try:
            baseline_response = (
                self.client.table("impact_baselines")
                .select(
                    "pilot_area, hotspot_count_baseline, co2_kg_baseline, avg_income_baht_per_household, recorded_by, recorded_at"
                )
                .order("recorded_at", desc=True)
                .limit(1)
                .execute()
            )
            baseline_rows = baseline_response.data or []
            baseline = baseline_rows[0] if baseline_rows else None
            return {
                "has_baseline": baseline is not None,
                "pilot_area": baseline.get("pilot_area") if baseline else None,
                "hotspot_count_baseline": baseline.get("hotspot_count_baseline")
                if baseline
                else None,
                "co2_kg_baseline": baseline.get("co2_kg_baseline")
                if baseline
                else None,
                "avg_income_baht_per_household": baseline.get(
                    "avg_income_baht_per_household"
                )
                if baseline
                else None,
                "recorded_by": baseline.get("recorded_by") if baseline else None,
                "recorded_at": baseline.get("recorded_at") if baseline else None,
            }
        except Exception as exc:
            raise WorkflowError(f"Failed to fetch impact KPIs: {exc}") from exc

    def list_value_chain(self) -> list[dict[str, Any]]:
        try:
            response = (
                self.client.table("value_chain_mappings")
                .select(
                    "id, product_name_th, producer_org, buyer_org, buyer_use_th, active"
                )
                .eq("active", True)
                .order("created_at", desc=False)
                .execute()
            )
            return response.data or []
        except Exception as exc:
            raise WorkflowError(f"Failed to fetch value chain: {exc}") from exc


def get_workflow_service() -> WorkflowService:
    return WorkflowService(client=get_service_client())
