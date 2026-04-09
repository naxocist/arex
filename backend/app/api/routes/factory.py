from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import require_roles
from app.core.errors import WorkflowError
from app.models.auth import AuthenticatedUser, Role
from app.models.workflow import ConfirmFactoryIntakeRequest, UpsertFactoryInfoRequest
from app.services.workflow_service import WorkflowService, get_workflow_service

router = APIRouter(prefix="/factory", tags=["factory"])


@router.get("/intakes/pending")
def list_pending_intakes(
    current_user: AuthenticatedUser = Depends(require_roles(Role.FACTORY)),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        data = workflow_service.list_factory_pending_intakes(current_user.user_id)
        return {**data, "actor": current_user.role.value}
    except WorkflowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/me")
def get_my_factory(
    current_user: AuthenticatedUser = Depends(require_roles(Role.FACTORY)),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        return workflow_service.get_or_create_factory_for_profile(current_user.user_id)
    except WorkflowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.put("/me")
def update_my_factory(
    payload: UpsertFactoryInfoRequest,
    current_user: AuthenticatedUser = Depends(require_roles(Role.FACTORY)),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        return workflow_service.update_factory_for_profile(current_user.user_id, payload)
    except WorkflowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/intakes/confirm")
def confirm_intake(
    payload: ConfirmFactoryIntakeRequest,
    current_user: AuthenticatedUser = Depends(require_roles(Role.FACTORY)),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        result = workflow_service.confirm_factory_intake(current_user.user_id, payload)
        return {
            "message": "Factory intake confirmed",
            "result": result,
        }
    except WorkflowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
