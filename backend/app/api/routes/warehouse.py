from typing import Any

from fastapi import APIRouter, Depends

from app.api.deps import require_roles
from app.models.auth import AuthenticatedUser, Role
from app.models.workflow import RejectRewardRequest
from app.services.warehouse_service import WarehouseService, get_warehouse_service

router = APIRouter(prefix="/warehouse", tags=["warehouse"])


@router.get("/reward-requests/pending")
def list_pending_reward_requests(
    current_user: AuthenticatedUser = Depends(require_roles(Role.WAREHOUSE)),
    workflow_service: WarehouseService = Depends(get_warehouse_service),
) -> dict[str, Any]:
    return {"requests": workflow_service.list_pending_reward_requests(), "actor": current_user.role.value}


@router.get("/reward-requests/answered")
def list_answered_reward_requests(
    current_user: AuthenticatedUser = Depends(require_roles(Role.WAREHOUSE)),
    workflow_service: WarehouseService = Depends(get_warehouse_service),
) -> dict[str, Any]:
    return {"requests": workflow_service.list_answered_reward_requests(), "actor": current_user.role.value}


@router.post("/reward-requests/{request_id}/approve")
def approve_reward_request(
    request_id: str,
    current_user: AuthenticatedUser = Depends(require_roles(Role.WAREHOUSE)),
    workflow_service: WarehouseService = Depends(get_warehouse_service),
) -> dict[str, Any]:
    result = workflow_service.approve_reward_request(request_id, current_user.user_id)
    return {"message": "Reward request approved", "result": result}


@router.post("/reward-requests/{request_id}/reject")
def reject_reward_request(
    request_id: str,
    payload: RejectRewardRequest,
    current_user: AuthenticatedUser = Depends(require_roles(Role.WAREHOUSE)),
    workflow_service: WarehouseService = Depends(get_warehouse_service),
) -> dict[str, Any]:
    result = workflow_service.reject_reward_request(request_id, current_user.user_id, payload)
    return {"message": "Reward request rejected", "result": result}
