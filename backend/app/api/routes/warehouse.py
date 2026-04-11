from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import require_roles
from app.core.errors import WorkflowError
from app.models.auth import AuthenticatedUser, Role
from app.models.workflow import RejectRewardRequest
from app.services.workflow_service import WorkflowService, get_workflow_service

router = APIRouter(prefix="/warehouse", tags=["warehouse"])


@router.get("/reward-requests/pending")
def list_pending_reward_requests(
    current_user: AuthenticatedUser = Depends(require_roles(Role.WAREHOUSE)),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        pending = workflow_service.list_pending_reward_requests()
        return {
            "requests": pending,
            "actor": current_user.role.value,
        }
    except WorkflowError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.get("/reward-requests/answered")
def list_answered_reward_requests(
    current_user: AuthenticatedUser = Depends(require_roles(Role.WAREHOUSE)),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        answered = workflow_service.list_answered_reward_requests()
        return {
            "requests": answered,
            "actor": current_user.role.value,
        }
    except WorkflowError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.post("/reward-requests/{request_id}/approve")
def approve_reward_request(
    request_id: str,
    current_user: AuthenticatedUser = Depends(require_roles(Role.WAREHOUSE)),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        result = workflow_service.approve_reward_request(
            request_id, current_user.user_id
        )
        return {
            "message": "Reward request approved",
            "result": result,
        }
    except WorkflowError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.post("/reward-requests/{request_id}/reject")
def reject_reward_request(
    request_id: str,
    payload: RejectRewardRequest,
    current_user: AuthenticatedUser = Depends(require_roles(Role.WAREHOUSE)),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        result = workflow_service.reject_reward_request(
            request_id, current_user.user_id, payload
        )
        return {
            "message": "Reward request rejected",
            "result": result,
        }
    except WorkflowError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
