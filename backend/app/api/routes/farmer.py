from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import require_roles
from app.core.errors import WorkflowError
from app.models.auth import AuthenticatedUser, Role
from app.models.workflow import CreateRewardRequest, CreateSubmissionRequest, UpdateFarmerProfileRequest
from app.services.farmer_service import FarmerDomainService, get_farmer_domain_service

router = APIRouter(prefix="/farmer", tags=["farmer"])


@router.get("/me")
def get_me(
    current_user: AuthenticatedUser = Depends(require_roles(Role.FARMER)),
) -> dict[str, str | None]:
    return {
        "user_id": current_user.user_id,
        "email": current_user.email,
        "role": current_user.role.value,
    }


@router.get("/profile")
def get_profile(
    current_user: AuthenticatedUser = Depends(require_roles(Role.FARMER)),
    workflow_service: FarmerDomainService = Depends(get_farmer_domain_service),
) -> dict[str, Any]:
    try:
        return workflow_service.get_farmer_profile(current_user.user_id)
    except WorkflowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.patch("/profile")
def update_profile(
    payload: UpdateFarmerProfileRequest,
    current_user: AuthenticatedUser = Depends(require_roles(Role.FARMER)),
    workflow_service: FarmerDomainService = Depends(get_farmer_domain_service),
) -> dict[str, Any]:
    try:
        return workflow_service.update_farmer_profile(current_user.user_id, payload)
    except WorkflowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/submissions")
def create_submission(
    payload: CreateSubmissionRequest,
    current_user: AuthenticatedUser = Depends(require_roles(Role.FARMER)),
    workflow_service: FarmerDomainService = Depends(get_farmer_domain_service),
) -> dict[str, Any]:
    try:
        submission = workflow_service.create_submission(current_user.user_id, payload)
        return {
            "message": "Submission created",
            "submission": submission,
        }
    except WorkflowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/submissions")
def list_submissions(
    current_user: AuthenticatedUser = Depends(require_roles(Role.FARMER)),
    workflow_service: FarmerDomainService = Depends(get_farmer_domain_service),
) -> dict[str, Any]:
    try:
        submissions = workflow_service.list_farmer_submissions(current_user.user_id)
        return {"submissions": submissions}
    except WorkflowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/material-types")
def list_material_types(
    current_user: AuthenticatedUser = Depends(require_roles(Role.FARMER)),
    workflow_service: FarmerDomainService = Depends(get_farmer_domain_service),
) -> dict[str, Any]:
    try:
        material_types = workflow_service.list_material_types()
        return {
            "material_types": material_types,
            "actor": current_user.role.value,
        }
    except WorkflowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/measurement-units")
def list_measurement_units(
    current_user: AuthenticatedUser = Depends(require_roles(Role.FARMER)),
    workflow_service: FarmerDomainService = Depends(get_farmer_domain_service),
) -> dict[str, Any]:
    try:
        units = workflow_service.list_measurement_units()
        return {
            "units": units,
            "actor": current_user.role.value,
        }
    except WorkflowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/rewards")
def list_rewards(
    current_user: AuthenticatedUser = Depends(require_roles(Role.FARMER)),
    workflow_service: FarmerDomainService = Depends(get_farmer_domain_service),
) -> dict[str, Any]:
    try:
        rewards = workflow_service.list_rewards_catalog()
        return {
            "rewards": rewards,
            "actor": current_user.role.value,
        }
    except WorkflowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/reward-requests")
def list_reward_requests(
    current_user: AuthenticatedUser = Depends(require_roles(Role.FARMER)),
    workflow_service: FarmerDomainService = Depends(get_farmer_domain_service),
) -> dict[str, Any]:
    try:
        requests = workflow_service.list_farmer_reward_requests(current_user.user_id)
        return {
            "requests": requests,
            "actor": current_user.role.value,
        }
    except WorkflowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/points")
def get_points(
    current_user: AuthenticatedUser = Depends(require_roles(Role.FARMER)),
    workflow_service: FarmerDomainService = Depends(get_farmer_domain_service),
) -> dict[str, Any]:
    try:
        return workflow_service.get_farmer_points(current_user.user_id)
    except WorkflowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/reward-requests")
def create_reward_request(
    payload: CreateRewardRequest,
    current_user: AuthenticatedUser = Depends(require_roles(Role.FARMER)),
    workflow_service: FarmerDomainService = Depends(get_farmer_domain_service),
) -> dict[str, Any]:
    try:
        request_data = workflow_service.create_reward_request(current_user.user_id, payload)
        return {
            "message": "Reward request created",
            "request": request_data,
        }
    except WorkflowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/reward-requests/{request_id}/cancel")
def cancel_reward_request(
    request_id: str,
    current_user: AuthenticatedUser = Depends(require_roles(Role.FARMER)),
    workflow_service: FarmerDomainService = Depends(get_farmer_domain_service),
) -> dict[str, Any]:
    try:
        result = workflow_service.cancel_reward_request(current_user.user_id, request_id)
        return {
            "message": "Reward request cancelled",
            "result": result,
        }
    except WorkflowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
