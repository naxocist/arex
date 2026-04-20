import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.deps import require_roles
from app.db.supabase import get_service_client
from app.models.auth import AuthenticatedUser, Role
from app.services.executive_service import ExecutiveDomainService, get_executive_domain_service

router = APIRouter(prefix="/admin", tags=["admin"])

_VALID_ROLES = {"farmer", "logistics", "factory", "warehouse", "executive", "admin"}
_VALID_APPROVAL_STATUSES = {"active", "inactive"}
_APPROVABLE_ROLES = {"farmer", "logistics", "factory"}


class UpdateApprovalSettingsRequest(BaseModel):
    approval_required_roles: list[str]


def _validate_uuid(value: str, field_name: str = "id") -> None:
    try:
        uuid.UUID(value)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid {field_name} format")


def _get_admin_settings(client: Any) -> dict[str, Any]:
    res = client.table("admin_settings").select("*").eq("key", "global").execute()
    rows = res.data or []
    if rows:
        return rows[0]
    return {"key": "global", "approval_required_roles": []}


@router.get("/accounts/all")
def list_all_accounts(
    role_filter: str | None = None,
    approval_filter: str | None = None,
    current_user: AuthenticatedUser = Depends(require_roles(Role.ADMIN)),
) -> dict[str, Any]:
    if role_filter is not None and role_filter not in _VALID_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role_filter")
    if approval_filter is not None and approval_filter not in _VALID_APPROVAL_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid approval_filter")
    client = get_service_client()
    try:
        query = (
            client.table("profiles_with_email")
            .select("id, role, display_name, phone, province, approval_status, created_at, email")
            .in_("role", list(_APPROVABLE_ROLES))
            .order("created_at", desc=True)
        )
        if role_filter:
            query = query.eq("role", role_filter)
        if approval_filter:
            query = query.eq("approval_status", approval_filter)
        res = query.execute()
        return {"accounts": res.data or [], "actor": current_user.role.value}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to fetch accounts")


@router.post("/accounts/{profile_id}/toggle")
def toggle_account_status(
    profile_id: str,
    current_user: AuthenticatedUser = Depends(require_roles(Role.ADMIN)),
) -> dict[str, Any]:
    _validate_uuid(profile_id, "profile_id")
    client = get_service_client()
    try:
        current = (
            client.table("profiles")
            .select("id, approval_status, role")
            .eq("id", profile_id)
            .single()
            .execute()
        )
        if not current.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
        if current.data["role"] not in _APPROVABLE_ROLES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role cannot be toggled")
        new_status = "inactive" if current.data["approval_status"] == "active" else "active"
        res = (
            client.table("profiles")
            .update({"approval_status": new_status})
            .eq("id", profile_id)
            .execute()
        )
        rows = res.data or []
        if not rows:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
        return {"message": f"Account set to {new_status}", "account": rows[0], "actor": current_user.role.value}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to toggle account status")


@router.get("/settings")
def get_admin_settings(
    current_user: AuthenticatedUser = Depends(require_roles(Role.ADMIN)),
) -> dict[str, Any]:
    client = get_service_client()
    try:
        settings = _get_admin_settings(client)
        return {"settings": settings, "actor": current_user.role.value}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to fetch settings")


@router.put("/settings")
def update_admin_settings(
    payload: UpdateApprovalSettingsRequest,
    current_user: AuthenticatedUser = Depends(require_roles(Role.ADMIN)),
) -> dict[str, Any]:
    invalid = [r for r in payload.approval_required_roles if r not in _APPROVABLE_ROLES]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid roles: {invalid}. Must be one of {sorted(_APPROVABLE_ROLES)}",
        )
    client = get_service_client()
    try:
        res = (
            client.table("admin_settings")
            .upsert({
                "key": "global",
                "approval_required_roles": payload.approval_required_roles,
                "updated_at": "now()",
            })
            .execute()
        )
        rows = res.data or []
        return {"message": "Settings updated", "settings": rows[0] if rows else {}, "actor": current_user.role.value}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to update settings")


@router.get("/dashboard/overview")
def get_admin_dashboard_overview(
    current_user: AuthenticatedUser = Depends(require_roles(Role.ADMIN)),
    workflow_service: ExecutiveDomainService = Depends(get_executive_domain_service),
) -> dict[str, Any]:
    overview = workflow_service.get_executive_overview()
    client = get_service_client()
    inactive_res = (
        client.table("profiles")
        .select("role", count="exact")
        .eq("approval_status", "inactive")
        .in_("role", list(_APPROVABLE_ROLES))
        .execute()
    )
    inactive_by_role: dict[str, int] = {}
    for row in inactive_res.data or []:
        r = row.get("role", "")
        inactive_by_role[r] = inactive_by_role.get(r, 0) + 1
    return {
        "overview": overview,
        "pending_approvals": inactive_by_role,
        "pending_total": sum(inactive_by_role.values()),
        "actor": current_user.role.value,
    }
