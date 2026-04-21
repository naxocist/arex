from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends

from app.api.deps import require_roles
from app.models.auth import AuthenticatedUser, Role
from app.models.workflow import ConfirmFactoryIntakeRequest, UpsertFactoryInfoRequest, UpsertFactoryMaterialPreferencesRequest
from app.services.factory_service import FactoryService, get_factory_service
from app.services.logistics_service import LogisticsService, get_logistics_service

router = APIRouter(prefix="/factory", tags=["factory"])


@router.get("/intakes/pending")
def list_pending_intakes(
    current_user: AuthenticatedUser = Depends(require_roles(Role.FACTORY)),
    workflow_service: FactoryService = Depends(get_factory_service),
) -> dict[str, Any]:
    data = workflow_service.list_factory_pending_intakes(current_user.user_id)
    return {**data, "actor": current_user.role.value}


@router.get("/me")
def get_my_factory(
    current_user: AuthenticatedUser = Depends(require_roles(Role.FACTORY)),
    workflow_service: FactoryService = Depends(get_factory_service),
) -> dict[str, Any]:
    return workflow_service.get_or_create_factory_for_profile(current_user.user_id)


@router.put("/me")
def update_my_factory(
    payload: UpsertFactoryInfoRequest,
    background_tasks: BackgroundTasks,
    current_user: AuthenticatedUser = Depends(require_roles(Role.FACTORY)),
    workflow_service: FactoryService = Depends(get_factory_service),
    logistics_service: LogisticsService = Depends(get_logistics_service),
) -> dict[str, Any]:
    result = workflow_service.update_factory_for_profile(current_user.user_id, payload)
    if result.get("lat") is not None and result.get("lng") is not None:
        background_tasks.add_task(
            logistics_service.recalculate_distances_for_factory,
            str(result["id"]),
            float(result["lat"]),
            float(result["lng"]),
        )
    return result


@router.get("/material-preferences")
def get_material_preferences(
    current_user: AuthenticatedUser = Depends(require_roles(Role.FACTORY)),
    workflow_service: FactoryService = Depends(get_factory_service),
) -> dict[str, Any]:
    preferences, units = workflow_service.list_material_preferences(current_user.user_id)
    return {"preferences": preferences, "units": units, "actor": current_user.role.value}


@router.put("/material-preferences")
def update_material_preferences(
    payload: UpsertFactoryMaterialPreferencesRequest,
    current_user: AuthenticatedUser = Depends(require_roles(Role.FACTORY)),
    workflow_service: FactoryService = Depends(get_factory_service),
) -> dict[str, Any]:
    result = workflow_service.upsert_material_preferences(current_user.user_id, payload)
    return {"message": "บันทึกความต้องการวัสดุสำเร็จ", **result}


@router.post("/intakes/confirm")
def confirm_intake(
    payload: ConfirmFactoryIntakeRequest,
    current_user: AuthenticatedUser = Depends(require_roles(Role.FACTORY)),
    workflow_service: FactoryService = Depends(get_factory_service),
) -> dict[str, Any]:
    result = workflow_service.confirm_factory_intake(current_user.user_id, payload)
    return {"message": "Factory intake confirmed", "result": result}
