from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import require_roles
from app.core.errors import WorkflowError
from app.models.auth import AuthenticatedUser, Role
from app.models.workflow import ConfirmFactoryIntakeRequest
from app.services.workflow_service import WorkflowService, get_workflow_service

router = APIRouter(prefix="/factory", tags=["factory"])


@router.get("/intakes/pending")
def list_pending_intakes(
    current_user: AuthenticatedUser = Depends(require_roles(Role.FACTORY)),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        queue = workflow_service.list_factory_pending_intakes()
        return {
            "queue": queue,
            "actor": current_user.role.value,
        }
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
