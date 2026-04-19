import uuid
from typing import Any

from app.core.errors import WorkflowError
from app.models.workflow import (
    UpsertMaterialTypeRequest,
    UpsertMeasurementUnitRequest,
)
from app.services._base import BaseService, _first_row


class CatalogService(BaseService):
    def list_material_types(self, active_only: bool = True) -> list[dict[str, Any]]:
        try:
            query = (
                self.client.table("material_types")
                .select("code, name_th, active, points_per_kg")
                .order("active", desc=True)
                .order("name_th", desc=False)
                .order("code", desc=False)
            )
            if active_only:
                query = query.eq("active", True)
            return query.execute().data or []
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
            return query.execute().data or []
        except Exception as exc:
            raise WorkflowError(f"Failed to fetch measurement units: {exc}") from exc

    def create_material_type(self, payload: UpsertMaterialTypeRequest) -> dict[str, Any]:
        try:
            name_th = payload.name_th.strip()
            if not name_th:
                raise WorkflowError("Material name is required")

            code = f"mat_{uuid.uuid4().hex[:8]}"
            row: dict[str, Any] = {"code": code, "name_th": name_th, "active": payload.active}
            if payload.points_per_kg is not None:
                row["points_per_kg"] = payload.points_per_kg

            response = self.client.table("material_types").insert(row).execute()
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
            name_th = payload.name_th.strip()
            if not source_code:
                raise WorkflowError("Material code to update is required")
            if not name_th:
                raise WorkflowError("Material name is required")

            if not (
                self.client.table("material_types")
                .select("code")
                .eq("code", source_code)
                .limit(1)
                .execute()
            ).data:
                raise WorkflowError("Material type not found")

            update_data: dict[str, Any] = {"name_th": name_th, "active": payload.active}
            if payload.points_per_kg is not None:
                update_data["points_per_kg"] = payload.points_per_kg

            (
                self.client.table("material_types")
                .update(update_data)
                .eq("code", source_code)
                .execute()
            )
            updated = (
                self.client.table("material_types")
                .select("code, name_th, active, points_per_kg")
                .eq("code", source_code)
                .limit(1)
                .execute()
            )
            return _first_row(updated.data)
        except WorkflowError:
            raise
        except Exception as exc:
            raise WorkflowError(f"Failed to update material type: {exc}") from exc

    def create_measurement_unit(self, payload: UpsertMeasurementUnitRequest) -> dict[str, Any]:
        try:
            name_th = payload.name_th.strip()
            if not name_th:
                raise WorkflowError("Unit name is required")
            code = f"unit_{uuid.uuid4().hex[:8]}"
            response = (
                self.client.table("measurement_units")
                .insert({
                    "code": code,
                    "name_th": name_th,
                    "to_kg_factor": payload.to_kg_factor,
                    "active": payload.active,
                })
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
            name_th = payload.name_th.strip()
            if not source_code:
                raise WorkflowError("Unit code to update is required")
            if not name_th:
                raise WorkflowError("Unit name is required")

            if not (
                self.client.table("measurement_units")
                .select("code")
                .eq("code", source_code)
                .limit(1)
                .execute()
            ).data:
                raise WorkflowError("Measurement unit not found")

            (
                self.client.table("measurement_units")
                .update({
                    "name_th": name_th,
                    "to_kg_factor": payload.to_kg_factor,
                    "active": payload.active,
                })
                .eq("code", source_code)
                .execute()
            )
            updated = (
                self.client.table("measurement_units")
                .select("code, name_th, to_kg_factor, active")
                .eq("code", source_code)
                .limit(1)
                .execute()
            )
            return _first_row(updated.data)
        except WorkflowError:
            raise
        except Exception as exc:
            raise WorkflowError(f"Failed to update measurement unit: {exc}") from exc
