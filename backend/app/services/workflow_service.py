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

    def create_submission(self, farmer_profile_id: str, payload: CreateSubmissionRequest) -> dict[str, Any]:
        try:
            response = (
                self.client.table("material_submissions")
                .insert(
                    {
                        "farmer_profile_id": farmer_profile_id,
                        "material_type": payload.material_type.value,
                        "quantity_value": payload.quantity_value,
                        "quantity_unit": payload.quantity_unit.value,
                        "pickup_location_text": payload.pickup_location_text,
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
                .select("id, material_type, quantity_value, quantity_unit, pickup_location_text, status, created_at")
                .eq("farmer_profile_id", farmer_profile_id)
                .order("created_at", desc=True)
                .execute()
            )
            return response.data or []
        except Exception as exc:
            raise WorkflowError(f"Failed to list farmer submissions: {exc}") from exc

    def list_rewards_catalog(self) -> list[dict[str, Any]]:
        try:
            response = (
                self.client.table("rewards_catalog")
                .select("id, name_th, description_th, points_cost, stock_qty, active")
                .eq("active", True)
                .order("points_cost", desc=False)
                .execute()
            )
            return response.data or []
        except Exception as exc:
            raise WorkflowError(f"Failed to list rewards catalog: {exc}") from exc

    def list_farmer_reward_requests(self, farmer_profile_id: str) -> list[dict[str, Any]]:
        try:
            response = (
                self.client.table("reward_requests")
                .select(
                    "id, reward_id, quantity, requested_points, status, requested_at, warehouse_decision_at, rejection_reason, "
                    "reward_delivery_jobs(id, status, planned_delivery_at, out_for_delivery_at, delivered_at)"
                )
                .eq("farmer_profile_id", farmer_profile_id)
                .order("requested_at", desc=True)
                .execute()
            )
            return response.data or []
        except Exception as exc:
            raise WorkflowError(f"Failed to list farmer reward requests: {exc}") from exc

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
                .select("id, entry_type, points_amount, reference_type, reference_id, note, created_at")
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

    def create_reward_request(self, farmer_profile_id: str, payload: CreateRewardRequest) -> dict[str, Any]:
        try:
            response = self.client.rpc(
                "request_reward_trade",
                {
                    "p_farmer_profile_id": farmer_profile_id,
                    "p_reward_id": payload.reward_id,
                    "p_quantity": payload.quantity,
                },
            ).execute()
            return _first_row(response.data)
        except Exception as exc:
            raise WorkflowError(f"Failed to create reward request: {exc}") from exc

    def list_pickup_queue(self) -> list[dict[str, Any]]:
        try:
            response = (
                self.client.table("material_submissions")
                .select("id, farmer_profile_id, material_type, quantity_value, quantity_unit, pickup_location_text, status, created_at")
                .in_("status", ["submitted", "pickup_scheduled"])
                .order("created_at", desc=False)
                .execute()
            )
            return response.data or []
        except Exception as exc:
            raise WorkflowError(f"Failed to fetch pickup queue: {exc}") from exc

    def list_logistics_pickup_jobs(self, logistics_profile_id: str) -> list[dict[str, Any]]:
        try:
            jobs_response = (
                self.client.table("pickup_jobs")
                .select(
                    "id, submission_id, logistics_profile_id, status, planned_pickup_at, picked_up_at, delivered_factory_at, created_at"
                )
                .eq("logistics_profile_id", logistics_profile_id)
                .in_("status", ["pickup_scheduled", "picked_up", "delivered_to_factory"])
                .order("created_at", desc=True)
                .execute()
            )

            jobs = jobs_response.data or []
            if not jobs:
                return []

            submission_ids = [str(job["submission_id"]) for job in jobs if job.get("submission_id")]
            if not submission_ids:
                return []

            submissions_response = (
                self.client.table("material_submissions")
                .select("id, material_type, quantity_value, quantity_unit, pickup_location_text, status")
                .in_("id", submission_ids)
                .execute()
            )
            submissions = submissions_response.data or []
            submissions_by_id = {str(row["id"]): row for row in submissions if row.get("id")}

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
                        "status": job.get("status"),
                        "planned_pickup_at": job.get("planned_pickup_at"),
                        "picked_up_at": job.get("picked_up_at"),
                        "delivered_factory_at": job.get("delivered_factory_at"),
                        "created_at": job.get("created_at"),
                        "material_type": submission.get("material_type"),
                        "quantity_value": submission.get("quantity_value"),
                        "quantity_unit": submission.get("quantity_unit"),
                        "pickup_location_text": submission.get("pickup_location_text"),
                        "submission_status": submission.get("status"),
                    }
                )

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
            response = self.client.rpc(
                "schedule_pickup_job",
                {
                    "p_submission_id": submission_id,
                    "p_logistics_profile_id": logistics_profile_id,
                    "p_planned_pickup_at": payload.planned_pickup_at.isoformat(),
                    "p_notes": payload.notes,
                },
            ).execute()
            return _first_row(response.data)
        except Exception as exc:
            raise WorkflowError(f"Failed to schedule pickup: {exc}") from exc

    def mark_delivered_to_factory(self, pickup_job_id: str, logistics_profile_id: str) -> dict[str, Any]:
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

    def mark_pickup_picked_up(self, pickup_job_id: str, logistics_profile_id: str) -> dict[str, Any]:
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
                .select("id, farmer_profile_id, reward_id, quantity, requested_points, status, requested_at")
                .eq("status", "warehouse_approved")
                .order("requested_at", desc=False)
                .execute()
            )

            approved_requests = response.data or []
            if not approved_requests:
                return []

            request_ids = [str(item["id"]) for item in approved_requests if item.get("id")]
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

            return [
                item
                for item in approved_requests
                if str(item.get("id")) not in request_ids_with_jobs
            ]
        except Exception as exc:
            raise WorkflowError(f"Failed to fetch approved reward requests: {exc}") from exc

    def list_reward_delivery_jobs(self, logistics_profile_id: str) -> list[dict[str, Any]]:
        try:
            jobs_response = (
                self.client.table("reward_delivery_jobs")
                .select(
                    "id, reward_request_id, logistics_profile_id, status, planned_delivery_at, out_for_delivery_at, delivered_at, created_at"
                )
                .eq("logistics_profile_id", logistics_profile_id)
                .in_("status", ["reward_delivery_scheduled", "out_for_delivery"])
                .order("created_at", desc=True)
                .execute()
            )

            jobs = jobs_response.data or []
            if not jobs:
                return []

            request_ids = [str(job["reward_request_id"]) for job in jobs if job.get("reward_request_id")]
            if not request_ids:
                return []

            requests_response = (
                self.client.table("reward_requests")
                .select("id, farmer_profile_id, reward_id, quantity, requested_points")
                .in_("id", request_ids)
                .execute()
            )
            requests = requests_response.data or []
            requests_by_id = {str(row["id"]): row for row in requests if row.get("id")}

            reward_ids = [str(row["reward_id"]) for row in requests if row.get("reward_id")]
            rewards_by_id: dict[str, dict[str, Any]] = {}
            if reward_ids:
                rewards_response = (
                    self.client.table("rewards_catalog")
                    .select("id, name_th")
                    .in_("id", reward_ids)
                    .execute()
                )
                rewards = rewards_response.data or []
                rewards_by_id = {str(row["id"]): row for row in rewards if row.get("id")}

            result: list[dict[str, Any]] = []
            for job in jobs:
                request_id = str(job.get("reward_request_id"))
                request = requests_by_id.get(request_id)
                if request is None:
                    continue

                reward_id = str(request.get("reward_id")) if request.get("reward_id") is not None else None
                reward_name = rewards_by_id.get(reward_id, {}).get("name_th") if reward_id is not None else None

                result.append(
                    {
                        "id": str(job["id"]),
                        "reward_request_id": request_id,
                        "logistics_profile_id": str(job.get("logistics_profile_id")),
                        "status": job.get("status"),
                        "planned_delivery_at": job.get("planned_delivery_at"),
                        "out_for_delivery_at": job.get("out_for_delivery_at"),
                        "delivered_at": job.get("delivered_at"),
                        "created_at": job.get("created_at"),
                        "farmer_profile_id": str(request.get("farmer_profile_id")),
                        "reward_id": reward_id,
                        "reward_name_th": reward_name,
                        "quantity": request.get("quantity"),
                        "requested_points": request.get("requested_points"),
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
            response = self.client.rpc(
                "schedule_reward_delivery_job",
                {
                    "p_reward_request_id": request_id,
                    "p_logistics_profile_id": logistics_profile_id,
                    "p_planned_delivery_at": payload.planned_delivery_at.isoformat(),
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
            raise WorkflowError(f"Failed to mark reward out for delivery: {exc}") from exc

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

    def list_factory_pending_intakes(self) -> list[dict[str, Any]]:
        try:
            pickup_response = (
                self.client.table("pickup_jobs")
                .select(
                    "id, submission_id, logistics_profile_id, status, planned_pickup_at, picked_up_at, delivered_factory_at"
                )
                .eq("status", "delivered_to_factory")
                .order("delivered_factory_at", desc=True)
                .execute()
            )

            pickup_jobs = pickup_response.data or []
            if not pickup_jobs:
                return []

            submission_ids = [str(row["submission_id"]) for row in pickup_jobs if row.get("submission_id")]
            if not submission_ids:
                return []

            submissions_response = (
                self.client.table("material_submissions")
                .select("id, material_type, quantity_value, quantity_unit, pickup_location_text")
                .in_("id", submission_ids)
                .execute()
            )
            submissions = submissions_response.data or []
            submissions_by_id = {str(row["id"]): row for row in submissions if row.get("id")}

            queue: list[dict[str, Any]] = []
            for job in pickup_jobs:
                submission_id = str(job.get("submission_id"))
                submission = submissions_by_id.get(submission_id)
                if submission is None:
                    continue

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
                        "quantity_value": submission.get("quantity_value"),
                        "quantity_unit": submission.get("quantity_unit"),
                        "pickup_location_text": submission.get("pickup_location_text"),
                    }
                )

            return queue
        except Exception as exc:
            raise WorkflowError(f"Failed to list factory pending intakes: {exc}") from exc

    def confirm_factory_intake(
        self,
        factory_profile_id: str,
        payload: ConfirmFactoryIntakeRequest,
    ) -> dict[str, Any]:
        try:
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

    def list_pending_reward_requests(self) -> list[dict[str, Any]]:
        try:
            response = (
                self.client.table("reward_requests")
                .select(
                    "id, farmer_profile_id, reward_id, quantity, requested_points, status, requested_at"
                )
                .eq("status", "requested")
                .order("requested_at", desc=False)
                .execute()
            )
            return response.data or []
        except Exception as exc:
            raise WorkflowError(f"Failed to fetch pending reward requests: {exc}") from exc

    def approve_reward_request(self, request_id: str, warehouse_profile_id: str) -> dict[str, Any]:
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

    def get_executive_overview(self) -> dict[str, int]:
        try:
            submissions_response = self.client.table("material_submissions").select("id,status").execute()
            reward_requests_response = self.client.table("reward_requests").select("id,status").execute()
            pickup_jobs_response = self.client.table("pickup_jobs").select("id,status").execute()

            submissions = submissions_response.data or []
            reward_requests = reward_requests_response.data or []
            pickup_jobs = pickup_jobs_response.data or []

            return {
                "submissions_total": len(submissions),
                "submissions_pending_pickup": sum(1 for row in submissions if row.get("status") == "submitted"),
                "pickup_jobs_active": sum(
                    1 for row in pickup_jobs if row.get("status") in {"pickup_scheduled", "picked_up", "delivered_to_factory"}
                ),
                "reward_requests_pending_warehouse": sum(
                    1 for row in reward_requests if row.get("status") == "requested"
                ),
            }
        except Exception as exc:
            raise WorkflowError(f"Failed to fetch executive overview: {exc}") from exc


def get_workflow_service() -> WorkflowService:
    return WorkflowService(client=get_service_client())
