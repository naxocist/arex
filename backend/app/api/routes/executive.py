from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import require_roles
from app.core.errors import WorkflowError
from app.models.auth import AuthenticatedUser, Role
from app.services.workflow_service import WorkflowService, get_workflow_service

router = APIRouter(prefix="/executive", tags=["executive"])


@router.get("/dashboard/overview")
def get_dashboard_overview(
    current_user: AuthenticatedUser = Depends(require_roles(Role.EXECUTIVE, Role.ADMIN)),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, object]:
    try:
        overview = workflow_service.get_executive_overview()
        return {
            "overview": overview,
            "actor": current_user.role.value,
        }
    except WorkflowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
