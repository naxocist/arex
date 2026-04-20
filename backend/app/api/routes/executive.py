from typing import Any

from fastapi import APIRouter, Depends

from app.api.deps import require_roles
from app.models.auth import AuthenticatedUser, Role
from app.models.workflow import (
    UpsertMaterialTypeRequest,
    UpsertMeasurementUnitRequest,
)
from app.services.executive_service import ExecutiveDomainService, get_executive_domain_service

router = APIRouter(prefix="/executive", tags=["executive"])


@router.get("/dashboard/overview")
def get_dashboard_overview(
    current_user: AuthenticatedUser = Depends(require_roles(Role.EXECUTIVE, Role.ADMIN)),
    workflow_service: ExecutiveDomainService = Depends(get_executive_domain_service),
) -> dict[str, object]:
    return {"overview": workflow_service.get_executive_overview(), "actor": current_user.role.value}


@router.get("/material-types")
def list_material_types(
    current_user: AuthenticatedUser = Depends(require_roles(Role.EXECUTIVE, Role.FACTORY, Role.ADMIN)),
    workflow_service: ExecutiveDomainService = Depends(get_executive_domain_service),
) -> dict[str, Any]:
    return {"material_types": workflow_service.list_material_types(active_only=False), "actor": current_user.role.value}


@router.post("/material-types")
def create_material_type(
    payload: UpsertMaterialTypeRequest,
    current_user: AuthenticatedUser = Depends(require_roles(Role.EXECUTIVE, Role.FACTORY, Role.ADMIN)),
    workflow_service: ExecutiveDomainService = Depends(get_executive_domain_service),
) -> dict[str, Any]:
    material_type = workflow_service.create_material_type(payload)
    return {"message": "Material type created", "material_type": material_type, "actor": current_user.role.value}


@router.put("/material-types/{material_code}")
def update_material_type(
    material_code: str,
    payload: UpsertMaterialTypeRequest,
    current_user: AuthenticatedUser = Depends(require_roles(Role.EXECUTIVE, Role.FACTORY, Role.ADMIN)),
    workflow_service: ExecutiveDomainService = Depends(get_executive_domain_service),
) -> dict[str, Any]:
    material_type = workflow_service.update_material_type(material_code, payload)
    return {"message": "Material type updated", "material_type": material_type, "actor": current_user.role.value}


@router.get("/measurement-units")
def list_measurement_units(
    current_user: AuthenticatedUser = Depends(require_roles(Role.EXECUTIVE, Role.FACTORY, Role.ADMIN)),
    workflow_service: ExecutiveDomainService = Depends(get_executive_domain_service),
) -> dict[str, Any]:
    return {"units": workflow_service.list_measurement_units(active_only=False), "actor": current_user.role.value}


@router.post("/measurement-units")
def create_measurement_unit(
    payload: UpsertMeasurementUnitRequest,
    current_user: AuthenticatedUser = Depends(require_roles(Role.EXECUTIVE, Role.FACTORY, Role.ADMIN)),
    workflow_service: ExecutiveDomainService = Depends(get_executive_domain_service),
) -> dict[str, Any]:
    unit = workflow_service.create_measurement_unit(payload)
    return {"message": "Measurement unit created", "unit": unit, "actor": current_user.role.value}


@router.put("/measurement-units/{unit_code}")
def update_measurement_unit(
    unit_code: str,
    payload: UpsertMeasurementUnitRequest,
    current_user: AuthenticatedUser = Depends(require_roles(Role.EXECUTIVE, Role.FACTORY, Role.ADMIN)),
    workflow_service: ExecutiveDomainService = Depends(get_executive_domain_service),
) -> dict[str, Any]:
    unit = workflow_service.update_measurement_unit(unit_code, payload)
    return {"message": "Measurement unit updated", "unit": unit, "actor": current_user.role.value}


@router.get("/rewards")
def list_rewards(
    current_user: AuthenticatedUser = Depends(require_roles(Role.EXECUTIVE, Role.ADMIN, Role.FACTORY)),
    workflow_service: ExecutiveDomainService = Depends(get_executive_domain_service),
) -> dict[str, Any]:
    return {"rewards": workflow_service.list_all_rewards(), "actor": current_user.role.value}


@router.post("/rewards")
def create_reward(
    payload: dict[str, Any],
    current_user: AuthenticatedUser = Depends(require_roles(Role.EXECUTIVE, Role.ADMIN, Role.FACTORY)),
    workflow_service: ExecutiveDomainService = Depends(get_executive_domain_service),
) -> dict[str, Any]:
    reward = workflow_service.create_reward(payload)
    return {"message": "Reward created", "reward": reward, "actor": current_user.role.value}


@router.put("/rewards/{reward_id}")
def update_reward(
    reward_id: str,
    payload: dict[str, Any],
    current_user: AuthenticatedUser = Depends(require_roles(Role.EXECUTIVE, Role.ADMIN, Role.FACTORY)),
    workflow_service: ExecutiveDomainService = Depends(get_executive_domain_service),
) -> dict[str, Any]:
    reward = workflow_service.update_reward(reward_id, payload)
    return {"message": "Reward updated", "reward": reward, "actor": current_user.role.value}


@router.get("/impact-kpis")
def get_impact_kpis(
    current_user: AuthenticatedUser = Depends(require_roles(Role.EXECUTIVE, Role.ADMIN)),
    workflow_service: ExecutiveDomainService = Depends(get_executive_domain_service),
) -> dict[str, Any]:
    return {"impact_kpis": workflow_service.get_impact_kpis(), "actor": current_user.role.value}


@router.get("/value-chain")
def list_value_chain(
    current_user: AuthenticatedUser = Depends(require_roles(Role.EXECUTIVE, Role.ADMIN)),
    workflow_service: ExecutiveDomainService = Depends(get_executive_domain_service),
) -> dict[str, Any]:
    return {"value_chain": workflow_service.list_value_chain(), "actor": current_user.role.value}
