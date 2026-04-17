from typing import Any

from app.core.errors import WorkflowError
from app.models.workflow import (
    UpsertMaterialPointRuleRequest,
    UpsertMaterialTypeRequest,
    UpsertMeasurementUnitRequest,
)
from app.services._base import BaseService, _first_row


class CatalogService(BaseService):
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
            code = payload.code.strip()
            name_th = payload.name_th.strip()
            if not code:
                raise WorkflowError("Material code is required")
            if not name_th:
                raise WorkflowError("Material name is required")

            response = (
                self.client.table("material_types")
                .insert({"code": code, "name_th": name_th, "active": payload.active})
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

            if not (
                self.client.table("material_types")
                .select("code")
                .eq("code", source_code)
                .limit(1)
                .execute()
            ).data:
                raise WorkflowError("Material type not found")

            if target_code != source_code:
                if (
                    self.client.table("material_types")
                    .select("code")
                    .eq("code", target_code)
                    .limit(1)
                    .execute()
                ).data:
                    raise WorkflowError("Material code already exists")

            (
                self.client.table("material_types")
                .update({"code": target_code, "name_th": name_th, "active": payload.active})
                .eq("code", source_code)
                .execute()
            )
            updated = (
                self.client.table("material_types")
                .select("code, name_th, active")
                .eq("code", target_code)
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
            code = payload.code.strip()
            name_th = payload.name_th.strip()
            if not code:
                raise WorkflowError("Unit code is required")
            if not name_th:
                raise WorkflowError("Unit name is required")

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
            target_code = payload.code.strip()
            name_th = payload.name_th.strip()
            if not source_code:
                raise WorkflowError("Unit code to update is required")
            if not target_code:
                raise WorkflowError("Unit code is required")
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

            if target_code != source_code:
                if (
                    self.client.table("measurement_units")
                    .select("code")
                    .eq("code", target_code)
                    .limit(1)
                    .execute()
                ).data:
                    raise WorkflowError("Unit code already exists")

            (
                self.client.table("measurement_units")
                .update({
                    "code": target_code,
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
                .eq("code", target_code)
                .limit(1)
                .execute()
            )
            return _first_row(updated.data)
        except WorkflowError:
            raise
        except Exception as exc:
            raise WorkflowError(f"Failed to update measurement unit: {exc}") from exc

    def list_material_point_rules(self) -> list[dict[str, Any]]:
        try:
            material_types = self.list_material_types(active_only=False)
            rules = (
                self.client.table("material_point_rules")
                .select("material_type, points_per_kg")
                .execute()
            ).data or []
            rules_by_material = {
                str(row["material_type"]): row
                for row in rules
                if row.get("material_type")
            }
            return [
                {
                    "material_type": str(m.get("code")),
                    "material_name_th": m.get("name_th"),
                    "material_active": m.get("active"),
                    "points_per_kg": rules_by_material.get(str(m.get("code")), {}).get("points_per_kg"),
                }
                for m in material_types
            ]
        except Exception as exc:
            raise WorkflowError(f"Failed to fetch material point rules: {exc}") from exc

    def upsert_material_point_rule(
        self, material_code: str, payload: UpsertMaterialPointRuleRequest
    ) -> dict[str, Any]:
        try:
            target_code = material_code.strip()
            if not target_code:
                raise WorkflowError("Material code is required")

            if not (
                self.client.table("material_types")
                .select("code")
                .eq("code", target_code)
                .limit(1)
                .execute()
            ).data:
                raise WorkflowError("Material type not found")

            existing = (
                self.client.table("material_point_rules")
                .select("material_type")
                .eq("material_type", target_code)
                .limit(1)
                .execute()
            ).data

            if existing:
                (
                    self.client.table("material_point_rules")
                    .update({"points_per_kg": payload.points_per_kg})
                    .eq("material_type", target_code)
                    .execute()
                )
            else:
                (
                    self.client.table("material_point_rules")
                    .insert({"material_type": target_code, "points_per_kg": payload.points_per_kg})
                    .execute()
                )

            updated = (
                self.client.table("material_point_rules")
                .select("material_type, points_per_kg")
                .eq("material_type", target_code)
                .limit(1)
                .execute()
            )
            return _first_row(updated.data)
        except WorkflowError:
            raise
        except Exception as exc:
            raise WorkflowError(f"Failed to update material point rule: {exc}") from exc
