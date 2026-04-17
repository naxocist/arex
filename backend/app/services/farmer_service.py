from typing import Any

from app.core.errors import WorkflowError
from app.models.workflow import (
    CreateRewardRequest,
    CreateSubmissionRequest,
    UpdateFarmerProfileRequest,
)
from app.services._base import BaseService, _first_row


class FarmerService(BaseService):
    def get_farmer_profile(self, farmer_profile_id: str) -> dict[str, Any]:
        try:
            rows = (
                self.client.table("profiles")
                .select("id, display_name, phone, province")
                .eq("id", farmer_profile_id)
                .limit(1)
                .execute()
            ).data or []
            if not rows:
                raise WorkflowError("Profile not found")
            return rows[0]
        except WorkflowError:
            raise
        except Exception as exc:
            raise WorkflowError(f"Failed to fetch farmer profile: {exc}") from exc

    def update_farmer_profile(
        self, farmer_profile_id: str, payload: UpdateFarmerProfileRequest
    ) -> dict[str, Any]:
        try:
            patch: dict[str, Any] = {}
            if payload.display_name is not None:
                patch["display_name"] = payload.display_name.strip() or None
            if payload.phone is not None:
                patch["phone"] = payload.phone.strip() or None
            if payload.province is not None:
                patch["province"] = payload.province.strip() or None
            if not patch:
                return self.get_farmer_profile(farmer_profile_id)

            rows = (
                self.client.table("profiles")
                .update(patch)
                .eq("id", farmer_profile_id)
                .execute()
            ).data or []
            if not rows:
                raise WorkflowError("Profile update returned no data")
            return rows[0]
        except WorkflowError:
            raise
        except Exception as exc:
            raise WorkflowError(f"Failed to update farmer profile: {exc}") from exc

    def create_submission(
        self, farmer_profile_id: str, payload: CreateSubmissionRequest
    ) -> dict[str, Any]:
        try:
            material_code = payload.material_type.strip()
            if not material_code:
                raise WorkflowError("Material type is required")
            if not (
                self.client.table("material_types")
                .select("code")
                .eq("code", material_code)
                .eq("active", True)
                .limit(1)
                .execute()
            ).data:
                raise WorkflowError("Selected material type is invalid or inactive")

            unit_code = payload.quantity_unit.strip()
            if not unit_code:
                raise WorkflowError("Quantity unit is required")
            if not (
                self.client.table("measurement_units")
                .select("code")
                .eq("code", unit_code)
                .eq("active", True)
                .limit(1)
                .execute()
            ).data:
                raise WorkflowError("Selected quantity unit is invalid or inactive")

            if payload.pickup_lat is None or payload.pickup_lng is None:
                raise WorkflowError("Pickup location coordinates are required")

            submission = _first_row(
                self.client.table("material_submissions")
                .insert({
                    "farmer_profile_id": farmer_profile_id,
                    "material_type": material_code,
                    "quantity_value": payload.quantity_value,
                    "quantity_unit": unit_code,
                    "pickup_location_text": payload.pickup_location_text,
                    "pickup_lat": payload.pickup_lat,
                    "pickup_lng": payload.pickup_lng,
                    "notes": payload.notes,
                    "status": "submitted",
                })
                .execute()
                .data
            )

            self.client.table("status_events").insert({
                "entity_type": "submission",
                "entity_id": submission["id"],
                "from_status": None,
                "to_status": "submitted",
                "actor_role": "farmer",
                "actor_profile_id": farmer_profile_id,
                "note": "Farmer submitted material declaration",
            }).execute()

            return submission
        except WorkflowError:
            raise
        except Exception as exc:
            raise WorkflowError(f"Failed to create submission: {exc}") from exc

    def list_farmer_submissions(self, farmer_profile_id: str) -> list[dict[str, Any]]:
        try:
            submissions = (
                self.client.table("material_submissions")
                .select(
                    "id, material_type, quantity_value, quantity_unit, pickup_location_text, "
                    "pickup_lat, pickup_lng, status, created_at"
                )
                .eq("farmer_profile_id", farmer_profile_id)
                .order("created_at", desc=True)
                .execute()
            ).data or []

            if not submissions:
                return []

            submission_ids = [str(item["id"]) for item in submissions if item.get("id")]
            pickup_jobs = (
                self.client.table("pickup_jobs")
                .select("submission_id, planned_pickup_at, pickup_window_end_at, status, created_at")
                .in_("submission_id", submission_ids)
                .neq("status", "cancelled")
                .order("created_at", desc=True)
                .execute()
            ).data or []

            latest_pickup_by_submission: dict[str, dict[str, Any]] = {}
            for job in pickup_jobs:
                sid = str(job.get("submission_id")) if job.get("submission_id") else None
                if sid is None or sid in latest_pickup_by_submission:
                    continue
                latest_pickup_by_submission[sid] = job

            return [
                {
                    **item,
                    "pickup_window_start_at": latest_pickup_by_submission.get(
                        str(item.get("id")) if item.get("id") else "", {}
                    ).get("planned_pickup_at"),
                    "pickup_window_end_at": latest_pickup_by_submission.get(
                        str(item.get("id")) if item.get("id") else "", {}
                    ).get("pickup_window_end_at"),
                    "pickup_job_status": latest_pickup_by_submission.get(
                        str(item.get("id")) if item.get("id") else "", {}
                    ).get("status"),
                }
                for item in submissions
            ]
        except Exception as exc:
            raise WorkflowError(f"Failed to list farmer submissions: {exc}") from exc

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

            ledger = (
                self.client.table("points_ledger")
                .select("id, entry_type, points_amount, reference_type, reference_id, note, created_at")
                .eq("farmer_profile_id", farmer_profile_id)
                .order("created_at", desc=True)
                .execute()
            ).data or []

            return {"available_points": int(available_points), "ledger": ledger}
        except Exception as exc:
            raise WorkflowError(f"Failed to fetch farmer points: {exc}") from exc

    def list_farmer_reward_requests(self, farmer_profile_id: str) -> list[dict[str, Any]]:
        try:
            return (
                self.client.table("reward_requests")
                .select(
                    "id, reward_id, quantity, requested_points, status, requested_at, "
                    "warehouse_decision_at, rejection_reason, "
                    "delivery_location_text, delivery_lat, delivery_lng, "
                    "reward_delivery_jobs(id, status, planned_delivery_at, delivery_window_end_at, "
                    "out_for_delivery_at, delivered_at)"
                )
                .eq("farmer_profile_id", farmer_profile_id)
                .order("requested_at", desc=True)
                .execute()
            ).data or []
        except Exception as exc:
            raise WorkflowError(f"Failed to list farmer reward requests: {exc}") from exc

    def create_reward_request(
        self, farmer_profile_id: str, payload: CreateRewardRequest
    ) -> dict[str, Any]:
        try:
            return _first_row(
                self.client.rpc(
                    "request_reward_trade",
                    {
                        "p_farmer_profile_id": farmer_profile_id,
                        "p_reward_id": payload.reward_id,
                        "p_quantity": payload.quantity,
                        "p_delivery_location_text": payload.delivery_location_text,
                        "p_delivery_lat": payload.delivery_lat,
                        "p_delivery_lng": payload.delivery_lng,
                    },
                ).execute().data
            )
        except Exception as exc:
            raise WorkflowError(f"Failed to create reward request: {exc}") from exc

    def cancel_reward_request(
        self, farmer_profile_id: str, request_id: str
    ) -> dict[str, Any]:
        try:
            return _first_row(
                self.client.rpc(
                    "cancel_reward_request_by_farmer",
                    {
                        "p_request_id": request_id,
                        "p_farmer_profile_id": farmer_profile_id,
                        "p_reason": "Cancelled by farmer",
                    },
                ).execute().data
            )
        except Exception as exc:
            raise WorkflowError(f"Failed to cancel reward request: {exc}") from exc


from app.db.supabase import get_service_client
from app.services.catalog_service import CatalogService
from app.services.rewards_service import RewardsService


class FarmerDomainService(FarmerService, CatalogService, RewardsService):
    pass


def get_farmer_domain_service() -> FarmerDomainService:
    return FarmerDomainService(client=get_service_client())
