from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, Query

from app.api.deps import require_roles
from app.models.auth import AuthenticatedUser, Role
from app.models.workflow import CancelPickupJobRequest, SchedulePickupRequest, ScheduleRewardDeliveryRequest, UpsertLogisticsInfoRequest
from app.services.logistics_service import LogisticsService, get_logistics_service

router = APIRouter(prefix="/logistics", tags=["logistics"])


@router.get("/pickup-queue")
def get_pickup_queue(
    current_user: AuthenticatedUser = Depends(require_roles(Role.LOGISTICS)),
    workflow_service: LogisticsService = Depends(get_logistics_service),
) -> dict[str, Any]:
    return {"queue": workflow_service.list_pickup_queue(current_user.user_id), "actor": current_user.role.value}


@router.get("/pickup-jobs")
def get_pickup_jobs(
    current_user: AuthenticatedUser = Depends(require_roles(Role.LOGISTICS)),
    workflow_service: LogisticsService = Depends(get_logistics_service),
) -> dict[str, Any]:
    return {"jobs": workflow_service.list_logistics_pickup_jobs(current_user.user_id), "actor": current_user.role.value}


@router.get("/factories")
def get_factories(
    material_type: str | None = Query(default=None),
    quantity_kg: float | None = Query(default=None, gt=0),
    submission_id: str | None = Query(default=None),
    current_user: AuthenticatedUser = Depends(require_roles(Role.LOGISTICS)),
    workflow_service: LogisticsService = Depends(get_logistics_service),
) -> dict[str, Any]:
    return {"factories": workflow_service.list_active_factories(material_type, quantity_kg, submission_id), "actor": current_user.role.value}


@router.get("/reward-requests/approved")
def get_approved_reward_requests(
    current_user: AuthenticatedUser = Depends(require_roles(Role.LOGISTICS)),
    workflow_service: LogisticsService = Depends(get_logistics_service),
) -> dict[str, Any]:
    return {"queue": workflow_service.list_approved_reward_requests(current_user.user_id), "actor": current_user.role.value}


@router.get("/reward-delivery-jobs")
def get_reward_delivery_jobs(
    current_user: AuthenticatedUser = Depends(require_roles(Role.LOGISTICS)),
    workflow_service: LogisticsService = Depends(get_logistics_service),
) -> dict[str, Any]:
    return {"jobs": workflow_service.list_reward_delivery_jobs(current_user.user_id), "actor": current_user.role.value}


@router.post("/pickup-jobs/{submission_id}/schedule")
def schedule_pickup(
    submission_id: str,
    payload: SchedulePickupRequest,
    current_user: AuthenticatedUser = Depends(require_roles(Role.LOGISTICS)),
    workflow_service: LogisticsService = Depends(get_logistics_service),
) -> dict[str, Any]:
    result = workflow_service.schedule_pickup(submission_id, current_user.user_id, payload)
    return {"message": "Pickup scheduled", "result": result}


@router.post("/submissions/{submission_id}/cancel")
def cancel_submission(
    submission_id: str,
    payload: CancelPickupJobRequest,
    current_user: AuthenticatedUser = Depends(require_roles(Role.LOGISTICS)),
    workflow_service: LogisticsService = Depends(get_logistics_service),
) -> dict[str, Any]:
    result = workflow_service.cancel_submission(submission_id, current_user.user_id, payload.reason)
    return {"message": "Submission cancelled", "result": result}


@router.get("/pickup-jobs/cancelled")
def get_cancelled_pickup_jobs(
    current_user: AuthenticatedUser = Depends(require_roles(Role.LOGISTICS)),
    workflow_service: LogisticsService = Depends(get_logistics_service),
) -> dict[str, Any]:
    return {"jobs": workflow_service.list_cancelled_submissions(current_user.user_id), "actor": current_user.role.value}


@router.patch("/pickup-jobs/{submission_id}/reschedule")
def reschedule_pickup(
    submission_id: str,
    payload: SchedulePickupRequest,
    current_user: AuthenticatedUser = Depends(require_roles(Role.LOGISTICS)),
    workflow_service: LogisticsService = Depends(get_logistics_service),
) -> dict[str, Any]:
    result = workflow_service.reschedule_pickup(submission_id, current_user.user_id, payload)
    return {"message": "Pickup rescheduled", "result": result}


@router.patch("/reward-delivery-jobs/{request_id}/reschedule")
def reschedule_reward_delivery(
    request_id: str,
    payload: ScheduleRewardDeliveryRequest,
    current_user: AuthenticatedUser = Depends(require_roles(Role.LOGISTICS)),
    workflow_service: LogisticsService = Depends(get_logistics_service),
) -> dict[str, Any]:
    result = workflow_service.reschedule_reward_delivery(request_id, current_user.user_id, payload)
    return {"message": "Reward delivery rescheduled", "result": result}


@router.post("/pickup-jobs/{submission_id}/delivered-to-factory")
def mark_delivered_to_factory(
    submission_id: str,
    current_user: AuthenticatedUser = Depends(require_roles(Role.LOGISTICS)),
    workflow_service: LogisticsService = Depends(get_logistics_service),
) -> dict[str, Any]:
    result = workflow_service.mark_delivered_to_factory(submission_id, current_user.user_id)
    return {"message": "Material marked as delivered to factory", "result": result}


@router.post("/pickup-jobs/{submission_id}/picked-up")
def mark_picked_up(
    submission_id: str,
    current_user: AuthenticatedUser = Depends(require_roles(Role.LOGISTICS)),
    workflow_service: LogisticsService = Depends(get_logistics_service),
) -> dict[str, Any]:
    result = workflow_service.mark_pickup_received(submission_id, current_user.user_id)
    return {"message": "Pickup marked as received", "result": result}


@router.post("/reward-delivery-jobs/{request_id}/schedule")
def schedule_reward_delivery(
    request_id: str,
    payload: ScheduleRewardDeliveryRequest,
    current_user: AuthenticatedUser = Depends(require_roles(Role.LOGISTICS)),
    workflow_service: LogisticsService = Depends(get_logistics_service),
) -> dict[str, Any]:
    result = workflow_service.schedule_reward_delivery(request_id, current_user.user_id, payload)
    return {"message": "Reward delivery scheduled", "result": result}


@router.post("/reward-delivery-jobs/{request_id}/out-for-delivery")
def mark_reward_out_for_delivery(
    request_id: str,
    current_user: AuthenticatedUser = Depends(require_roles(Role.LOGISTICS)),
    workflow_service: LogisticsService = Depends(get_logistics_service),
) -> dict[str, Any]:
    result = workflow_service.mark_reward_out_for_delivery(request_id, current_user.user_id)
    return {"message": "Reward job marked out for delivery", "result": result}


@router.post("/reward-delivery-jobs/{request_id}/delivered")
def mark_reward_delivered(
    request_id: str,
    current_user: AuthenticatedUser = Depends(require_roles(Role.LOGISTICS)),
    workflow_service: LogisticsService = Depends(get_logistics_service),
) -> dict[str, Any]:
    result = workflow_service.mark_reward_delivered(request_id, current_user.user_id)
    return {"message": "Reward delivered to farmer", "result": result}


@router.get("/route-distance")
def get_route_distance(
    from_lat: float,
    from_lng: float,
    to_lat: float,
    to_lng: float,
    current_user: AuthenticatedUser = Depends(require_roles(Role.LOGISTICS)),
    workflow_service: LogisticsService = Depends(get_logistics_service),
) -> dict[str, Any]:
    return {"distance_km": workflow_service.get_route_distance(from_lat, from_lng, to_lat, to_lng)}


@router.get("/me")
def get_my_logistics(
    current_user: AuthenticatedUser = Depends(require_roles(Role.LOGISTICS)),
    workflow_service: LogisticsService = Depends(get_logistics_service),
) -> dict[str, Any]:
    return workflow_service.get_or_create_logistics_for_profile(current_user.user_id)


@router.put("/me")
def update_my_logistics(
    payload: UpsertLogisticsInfoRequest,
    background_tasks: BackgroundTasks,
    current_user: AuthenticatedUser = Depends(require_roles(Role.LOGISTICS)),
    workflow_service: LogisticsService = Depends(get_logistics_service),
) -> dict[str, Any]:
    result = workflow_service.update_logistics_for_profile(current_user.user_id, payload)
    if result.get("lat") is not None and result.get("lng") is not None:
        background_tasks.add_task(
            workflow_service.recalculate_distances_for_logistics,
            current_user.user_id,
            float(result["lat"]),
            float(result["lng"]),
        )
    return result
