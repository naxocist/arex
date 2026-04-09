from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import require_roles
from app.core.errors import WorkflowError
from app.models.auth import AuthenticatedUser, Role
from app.models.workflow import SchedulePickupRequest, ScheduleRewardDeliveryRequest
from app.services.workflow_service import WorkflowService, get_workflow_service

router = APIRouter(prefix="/logistics", tags=["logistics"])


@router.get("/pickup-queue")
def get_pickup_queue(
    current_user: AuthenticatedUser = Depends(require_roles(Role.LOGISTICS)),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        queue = workflow_service.list_pickup_queue()
        return {
            "queue": queue,
            "actor": current_user.role.value,
        }
    except WorkflowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/pickup-jobs")
def get_pickup_jobs(
    current_user: AuthenticatedUser = Depends(require_roles(Role.LOGISTICS)),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        jobs = workflow_service.list_logistics_pickup_jobs(current_user.user_id)
        return {
            "jobs": jobs,
            "actor": current_user.role.value,
        }
    except WorkflowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/factories")
def get_factories(
    current_user: AuthenticatedUser = Depends(require_roles(Role.LOGISTICS)),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        factories = workflow_service.list_active_factories()
        return {
            "factories": factories,
            "actor": current_user.role.value,
        }
    except WorkflowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/reward-requests/approved")
def get_approved_reward_requests(
    current_user: AuthenticatedUser = Depends(require_roles(Role.LOGISTICS)),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        queue = workflow_service.list_approved_reward_requests()
        return {
            "queue": queue,
            "actor": current_user.role.value,
        }
    except WorkflowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/reward-delivery-jobs")
def get_reward_delivery_jobs(
    current_user: AuthenticatedUser = Depends(require_roles(Role.LOGISTICS)),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        jobs = workflow_service.list_reward_delivery_jobs(current_user.user_id)
        return {
            "jobs": jobs,
            "actor": current_user.role.value,
        }
    except WorkflowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/pickup-jobs/{submission_id}/schedule")
def schedule_pickup(
    submission_id: str,
    payload: SchedulePickupRequest,
    current_user: AuthenticatedUser = Depends(require_roles(Role.LOGISTICS)),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        result = workflow_service.schedule_pickup(submission_id, current_user.user_id, payload)
        return {
            "message": "Pickup scheduled",
            "result": result,
        }
    except WorkflowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/pickup-jobs/{pickup_job_id}/delivered-to-factory")
def mark_delivered_to_factory(
    pickup_job_id: str,
    current_user: AuthenticatedUser = Depends(require_roles(Role.LOGISTICS)),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        result = workflow_service.mark_delivered_to_factory(pickup_job_id, current_user.user_id)
        return {
            "message": "Material marked as delivered to factory",
            "result": result,
        }
    except WorkflowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/pickup-jobs/{pickup_job_id}/picked-up")
def mark_picked_up(
    pickup_job_id: str,
    current_user: AuthenticatedUser = Depends(require_roles(Role.LOGISTICS)),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        result = workflow_service.mark_pickup_picked_up(pickup_job_id, current_user.user_id)
        return {
            "message": "Pickup marked as picked up",
            "result": result,
        }
    except WorkflowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/reward-delivery-jobs/{request_id}/schedule")
def schedule_reward_delivery(
    request_id: str,
    payload: ScheduleRewardDeliveryRequest,
    current_user: AuthenticatedUser = Depends(require_roles(Role.LOGISTICS)),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        result = workflow_service.schedule_reward_delivery(request_id, current_user.user_id, payload)
        return {
            "message": "Reward delivery scheduled",
            "result": result,
        }
    except WorkflowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/reward-delivery-jobs/{delivery_job_id}/out-for-delivery")
def mark_reward_out_for_delivery(
    delivery_job_id: str,
    current_user: AuthenticatedUser = Depends(require_roles(Role.LOGISTICS)),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        result = workflow_service.mark_reward_out_for_delivery(delivery_job_id, current_user.user_id)
        return {
            "message": "Reward job marked out for delivery",
            "result": result,
        }
    except WorkflowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/reward-delivery-jobs/{delivery_job_id}/delivered")
def mark_reward_delivered(
    delivery_job_id: str,
    current_user: AuthenticatedUser = Depends(require_roles(Role.LOGISTICS)),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        result = workflow_service.mark_reward_delivered(delivery_job_id, current_user.user_id)
        return {
            "message": "Reward delivered to farmer",
            "result": result,
        }
    except WorkflowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
