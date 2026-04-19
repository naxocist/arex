from typing import Any

from app.core.errors import WorkflowError
from app.db.supabase import get_service_client
from app.models.workflow import ConfirmFactoryIntakeRequest, UpsertFactoryInfoRequest
from app.services._base import BaseService, _first_row


def _to_float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


class FactoryService(BaseService):
    def get_or_create_factory_for_profile(self, factory_profile_id: str) -> dict[str, Any]:
        try:
            rows = (
                self.client.table("org_accounts")
                .select("id, profile_id, name_th, location_text, lat, lng, active, created_at")
                .eq("profile_id", factory_profile_id)
                .eq("type", "factory")
                .limit(1)
                .execute()
            ).data or []
            if rows:
                return _first_row(rows)

            profile_rows = (
                self.client.table("profiles")
                .select("display_name")
                .eq("id", factory_profile_id)
                .limit(1)
                .execute()
            ).data or []
            if not profile_rows:
                raise WorkflowError("Factory profile not found")

            display_name = str(profile_rows[0].get("display_name") or "").strip()
            default_name = display_name or f"โรงงาน {factory_profile_id[:8]}"
            return _first_row(
                self.client.table("org_accounts")
                .insert({"profile_id": factory_profile_id, "type": "factory", "name_th": default_name, "active": True})
                .execute()
                .data
            )
        except WorkflowError:
            raise
        except Exception as exc:
            raise WorkflowError(f"Failed to load factory info: {exc}") from exc

    def update_factory_for_profile(
        self, factory_profile_id: str, payload: UpsertFactoryInfoRequest
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

            location_text = payload.location_text.strip() if payload.location_text else None
            return _first_row(
                self.client.table("org_accounts")
                .update({"name_th": name_th, "location_text": location_text, "lat": payload.lat, "lng": payload.lng})
                .eq("id", factory_id)
                .eq("profile_id", factory_profile_id)
                .eq("type", "factory")
                .execute()
                .data
            )
        except WorkflowError:
            raise
        except Exception as exc:
            raise WorkflowError(f"Failed to update factory info: {exc}") from exc

    def list_factory_pending_intakes(self, factory_profile_id: str) -> dict[str, Any]:
        try:
            my_factory = self.get_or_create_factory_for_profile(factory_profile_id)
            my_factory_id = str(my_factory.get("id") or "")
            if not my_factory_id:
                raise WorkflowError("Factory record not found")

            pickup_jobs_arrived = (
                self.client.table("pickup_jobs")
                .select(
                    "id, submission_id, logistics_profile_id, destination_factory_id, status, "
                    "planned_pickup_at, picked_up_at, delivered_factory_at"
                )
                .eq("status", "delivered_to_factory")
                .eq("destination_factory_id", my_factory_id)
                .order("delivered_factory_at", desc=True)
                .execute()
            ).data or []

            factory_intakes = (
                self.client.table("intakes")
                .select("id, pickup_job_id, factory_profile_id, measured_weight_kg, discrepancy_note, status, confirmed_at")
                .eq("factory_profile_id", factory_profile_id)
                .order("confirmed_at", desc=True)
                .execute()
            ).data or []

            intake_pickup_job_ids = list({
                str(item["pickup_job_id"])
                for item in factory_intakes
                if item.get("pickup_job_id") is not None
            })

            pickup_jobs_confirmed: list[dict[str, Any]] = []
            if intake_pickup_job_ids:
                pickup_jobs_confirmed = (
                    self.client.table("pickup_jobs")
                    .select(
                        "id, submission_id, logistics_profile_id, destination_factory_id, status, "
                        "planned_pickup_at, picked_up_at, delivered_factory_at"
                    )
                    .in_("id", intake_pickup_job_ids)
                    .execute()
                ).data or []

            pickup_jobs_by_id: dict[str, dict[str, Any]] = {}
            for row in [*pickup_jobs_arrived, *pickup_jobs_confirmed]:
                row_id = row.get("id")
                if row_id is not None:
                    pickup_jobs_by_id[str(row_id)] = row

            submission_ids = list({
                str(row["submission_id"])
                for row in pickup_jobs_by_id.values()
                if row.get("submission_id") is not None
            })

            submissions: list[dict[str, Any]] = []
            submissions_by_id: dict[str, dict[str, Any]] = {}
            if submission_ids:
                submissions = (
                    self.client.table("submissions")
                    .select("id, material_type, quantity_value, quantity_unit, pickup_location_text")
                    .in_("id", submission_ids)
                    .execute()
                ).data or []
                submissions_by_id = {str(row["id"]): row for row in submissions if row.get("id")}

            material_codes = list({
                str(row.get("material_type"))
                for row in submissions
                if row.get("material_type") is not None
            })
            material_names_by_code: dict[str, str] = {}
            if material_codes:
                for row in (
                    self.client.table("material_types")
                    .select("code, name_th")
                    .in_("code", material_codes)
                    .execute()
                ).data or []:
                    if row.get("code") is not None and row.get("name_th") is not None:
                        material_names_by_code[str(row["code"])] = str(row["name_th"])

            unit_codes = list({
                str(row["quantity_unit"])
                for row in submissions
                if row.get("quantity_unit") is not None
            })
            units_by_code: dict[str, dict[str, Any]] = {}
            if unit_codes:
                for row in (
                    self.client.table("measurement_units")
                    .select("code, to_kg_factor")
                    .in_("code", unit_codes)
                    .execute()
                ).data or []:
                    if row.get("code"):
                        units_by_code[str(row["code"])] = row

            queue: list[dict[str, Any]] = []
            for job in pickup_jobs_arrived:
                submission = submissions_by_id.get(str(job.get("submission_id")))
                if submission is None:
                    continue
                unit_code = submission.get("quantity_unit")
                unit_meta = units_by_code.get(str(unit_code)) if unit_code is not None else None
                queue.append({
                    "pickup_job_id": str(job["id"]),
                    "submission_id": str(job.get("submission_id")),
                    "logistics_profile_id": str(job.get("logistics_profile_id")),
                    "status": job.get("status"),
                    "planned_pickup_at": job.get("planned_pickup_at"),
                    "picked_up_at": job.get("picked_up_at"),
                    "delivered_factory_at": job.get("delivered_factory_at"),
                    "material_type": submission.get("material_type"),
                    "material_name_th": material_names_by_code.get(str(submission.get("material_type") or "")),
                    "quantity_value": submission.get("quantity_value"),
                    "quantity_unit": submission.get("quantity_unit"),
                    "quantity_to_kg_factor": unit_meta.get("to_kg_factor") if unit_meta else None,
                    "pickup_location_text": submission.get("pickup_location_text"),
                })

            confirmed: list[dict[str, Any]] = []
            confirmed_weight_kg_total = 0.0
            for intake in factory_intakes:
                job = pickup_jobs_by_id.get(str(intake.get("pickup_job_id") or ""))
                if job is None:
                    continue
                submission = submissions_by_id.get(str(job.get("submission_id")))
                if submission is None:
                    continue
                measured_weight_kg = float(intake.get("measured_weight_kg") or 0)
                confirmed_weight_kg_total += measured_weight_kg
                confirmed.append({
                    "intake_id": str(intake.get("id")),
                    "pickup_job_id": str(intake.get("pickup_job_id") or ""),
                    "submission_id": str(job.get("submission_id")),
                    "material_type": submission.get("material_type"),
                    "material_name_th": material_names_by_code.get(str(submission.get("material_type") or "")),
                    "quantity_value": submission.get("quantity_value"),
                    "quantity_unit": submission.get("quantity_unit"),
                    "measured_weight_kg": measured_weight_kg,
                    "measured_weight_ton": round(measured_weight_kg / 1000, 3),
                    "pickup_location_text": submission.get("pickup_location_text"),
                    "confirmed_at": intake.get("confirmed_at"),
                    "status": intake.get("status"),
                    "factory_profile_id": intake.get("factory_profile_id"),
                    "discrepancy_note": intake.get("discrepancy_note"),
                })

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
                    "arrived_estimated_weight_kg_total": round(arrived_estimated_weight_kg_total, 3),
                    "arrived_convertible_count": arrived_convertible_count,
                    "arrived_non_convertible_count": arrived_non_convertible_count,
                    "arrived_non_convertible_quantity_total": round(arrived_non_convertible_quantity_total, 3),
                    "confirmed_weight_kg_total": round(confirmed_weight_kg_total, 3),
                    "confirmed_weight_ton_total": round(confirmed_weight_kg_total / 1000, 3),
                },
            }
        except Exception as exc:
            raise WorkflowError(f"Failed to list factory pending intakes: {exc}") from exc

    def confirm_factory_intake(
        self, factory_profile_id: str, payload: ConfirmFactoryIntakeRequest
    ) -> dict[str, Any]:
        try:
            my_factory = self.get_or_create_factory_for_profile(factory_profile_id)
            my_factory_id = str(my_factory.get("id") or "")
            if not my_factory_id:
                raise WorkflowError("Factory record not found")

            pickup_job_rows = (
                self.client.table("pickup_jobs")
                .select("id, destination_factory_id")
                .eq("id", payload.pickup_job_id)
                .limit(1)
                .execute()
            ).data or []
            if not pickup_job_rows:
                raise WorkflowError("Pickup job not found")

            destination_factory_id = pickup_job_rows[0].get("destination_factory_id")
            if destination_factory_id is not None and str(destination_factory_id) != my_factory_id:
                raise WorkflowError("Pickup job is assigned to another factory")

            return _first_row(
                self.client.rpc(
                    "confirm_factory_intake",
                    {
                        "p_pickup_job_id": payload.pickup_job_id,
                        "p_factory_profile_id": factory_profile_id,
                        "p_measured_weight_kg": payload.measured_weight_kg,
                        "p_discrepancy_note": payload.discrepancy_note,
                    },
                ).execute().data
            )
        except Exception as exc:
            raise WorkflowError(f"Failed to confirm factory intake: {exc}") from exc


def get_factory_service() -> FactoryService:
    return FactoryService(client=get_service_client())
