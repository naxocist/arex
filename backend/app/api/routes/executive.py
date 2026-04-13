from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import require_roles
from app.core.errors import WorkflowError
from app.models.auth import AuthenticatedUser, Role
from app.models.workflow import (
    UpsertMaterialPointRuleRequest,
    UpsertMaterialTypeRequest,
    UpsertMeasurementUnitRequest,
)
from app.services.workflow_service import WorkflowService, get_workflow_service

router = APIRouter(prefix="/executive", tags=["executive"])


@router.get("/dashboard/overview")
def get_dashboard_overview(
    current_user: AuthenticatedUser = Depends(
        require_roles(Role.EXECUTIVE, Role.ADMIN)
    ),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, object]:
    try:
        overview = workflow_service.get_executive_overview()
        return {
            "overview": overview,
            "actor": current_user.role.value,
        }
    except WorkflowError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.get("/material-types")
def list_material_types(
    current_user: AuthenticatedUser = Depends(
        require_roles(Role.EXECUTIVE, Role.FACTORY, Role.ADMIN)
    ),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        material_types = workflow_service.list_material_types(active_only=False)
        return {
            "material_types": material_types,
            "actor": current_user.role.value,
        }
    except WorkflowError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.post("/material-types")
def create_material_type(
    payload: UpsertMaterialTypeRequest,
    current_user: AuthenticatedUser = Depends(
        require_roles(Role.EXECUTIVE, Role.FACTORY, Role.ADMIN)
    ),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        material_type = workflow_service.create_material_type(payload)
        return {
            "message": "Material type created",
            "material_type": material_type,
            "actor": current_user.role.value,
        }
    except WorkflowError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.put("/material-types/{material_code}")
def update_material_type(
    material_code: str,
    payload: UpsertMaterialTypeRequest,
    current_user: AuthenticatedUser = Depends(
        require_roles(Role.EXECUTIVE, Role.FACTORY, Role.ADMIN)
    ),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        material_type = workflow_service.update_material_type(material_code, payload)
        return {
            "message": "Material type updated",
            "material_type": material_type,
            "actor": current_user.role.value,
        }
    except WorkflowError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.get("/measurement-units")
def list_measurement_units(
    current_user: AuthenticatedUser = Depends(
        require_roles(Role.EXECUTIVE, Role.FACTORY, Role.ADMIN)
    ),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        units = workflow_service.list_measurement_units(active_only=False)
        return {
            "units": units,
            "actor": current_user.role.value,
        }
    except WorkflowError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.post("/measurement-units")
def create_measurement_unit(
    payload: UpsertMeasurementUnitRequest,
    current_user: AuthenticatedUser = Depends(
        require_roles(Role.EXECUTIVE, Role.FACTORY, Role.ADMIN)
    ),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        unit = workflow_service.create_measurement_unit(payload)
        return {
            "message": "Measurement unit created",
            "unit": unit,
            "actor": current_user.role.value,
        }
    except WorkflowError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.put("/measurement-units/{unit_code}")
def update_measurement_unit(
    unit_code: str,
    payload: UpsertMeasurementUnitRequest,
    current_user: AuthenticatedUser = Depends(
        require_roles(Role.EXECUTIVE, Role.FACTORY, Role.ADMIN)
    ),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        unit = workflow_service.update_measurement_unit(unit_code, payload)
        return {
            "message": "Measurement unit updated",
            "unit": unit,
            "actor": current_user.role.value,
        }
    except WorkflowError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.get("/material-point-rules")
def list_material_point_rules(
    current_user: AuthenticatedUser = Depends(
        require_roles(Role.EXECUTIVE, Role.FACTORY, Role.ADMIN)
    ),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        rules = workflow_service.list_material_point_rules()
        return {
            "rules": rules,
            "formula": "max(floor(weight_kg * points_per_kg), 1)",
            "actor": current_user.role.value,
        }
    except WorkflowError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.put("/material-point-rules/{material_code}")
def upsert_material_point_rule(
    material_code: str,
    payload: UpsertMaterialPointRuleRequest,
    current_user: AuthenticatedUser = Depends(
        require_roles(Role.EXECUTIVE, Role.FACTORY, Role.ADMIN)
    ),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        rule = workflow_service.upsert_material_point_rule(material_code, payload)
        return {
            "message": "Material point rule updated",
            "rule": rule,
            "actor": current_user.role.value,
        }
    except WorkflowError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.get("/rewards")
def list_rewards(
    current_user: AuthenticatedUser = Depends(
        require_roles(Role.EXECUTIVE, Role.ADMIN)
    ),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        rewards = workflow_service.list_all_rewards_catalog()
        return {
            "rewards": rewards,
            "actor": current_user.role.value,
        }
    except WorkflowError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.post("/rewards")
def create_reward(
    payload: dict[str, Any],
    current_user: AuthenticatedUser = Depends(
        require_roles(Role.EXECUTIVE, Role.ADMIN)
    ),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        reward = workflow_service.create_reward(payload)
        return {
            "message": "Reward created",
            "reward": reward,
            "actor": current_user.role.value,
        }
    except WorkflowError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.get("/impact-kpis")
def get_impact_kpis(
    current_user: AuthenticatedUser = Depends(
        require_roles(Role.EXECUTIVE, Role.ADMIN)
    ),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        kpis = workflow_service.get_impact_kpis()
        return {"impact_kpis": kpis, "actor": current_user.role.value}
    except WorkflowError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.get("/value-chain")
def list_value_chain(
    current_user: AuthenticatedUser = Depends(
        require_roles(Role.EXECUTIVE, Role.ADMIN)
    ),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        mappings = workflow_service.list_value_chain()
        return {"value_chain": mappings, "actor": current_user.role.value}
    except WorkflowError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.put("/rewards/{reward_id}")
def update_reward(
    reward_id: str,
    payload: dict[str, Any],
    current_user: AuthenticatedUser = Depends(
        require_roles(Role.EXECUTIVE, Role.ADMIN)
    ),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        reward = workflow_service.update_reward(reward_id, payload)
        return {
            "message": "Reward updated",
            "reward": reward,
            "actor": current_user.role.value,
        }
    except WorkflowError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
