import json
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import require_roles
from app.db.supabase import get_service_client
from app.models.auth import AuthenticatedUser, Role
from app.services.executive_service import ExecutiveDomainService, get_executive_domain_service

router = APIRouter(prefix="/admin", tags=["admin"])

_VALID_ROLES = {"farmer", "logistics", "factory", "warehouse", "executive", "admin"}
_VALID_APPROVAL_STATUSES = {"pending", "approved", "rejected"}


class ApproveAccountRequest(BaseModel):
    note: str | None = Field(default=None, max_length=1000)


class RejectAccountRequest(BaseModel):
    note: str = Field(default="", max_length=1000)


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


@router.get("/accounts/pending")
def list_pending_accounts(
    role_filter: str | None = None,
    current_user: AuthenticatedUser = Depends(require_roles(Role.ADMIN)),
) -> dict[str, Any]:
    if role_filter is not None and role_filter not in _VALID_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role_filter")
    client = get_service_client()
    try:
        query = (
            client.table("profiles")
            .select("id, role, display_name, phone, province, approval_status, approval_note, created_at")
            .eq("approval_status", "pending")
            .order("created_at", desc=False)
        )
        if role_filter:
            query = query.eq("role", role_filter)
        res = query.execute()
        return {"accounts": res.data or [], "actor": current_user.role.value}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to fetch accounts")


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
            client.table("profiles")
            .select("id, role, display_name, phone, province, approval_status, approval_note, created_at")
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


@router.post("/accounts/{profile_id}/approve")
def approve_account(
    profile_id: str,
    current_user: AuthenticatedUser = Depends(require_roles(Role.ADMIN)),
) -> dict[str, Any]:
    _validate_uuid(profile_id, "profile_id")
    client = get_service_client()
    try:
        res = (
            client.table("profiles")
            .update({"approval_status": "approved", "approval_note": None})
            .eq("id", profile_id)
            .execute()
        )
        rows = res.data or []
        if not rows:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
        return {"message": "Account approved", "account": rows[0], "actor": current_user.role.value}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to approve account")


@router.post("/accounts/{profile_id}/reject")
def reject_account(
    profile_id: str,
    payload: RejectAccountRequest,
    current_user: AuthenticatedUser = Depends(require_roles(Role.ADMIN)),
) -> dict[str, Any]:
    _validate_uuid(profile_id, "profile_id")
    client = get_service_client()
    try:
        res = (
            client.table("profiles")
            .update({"approval_status": "rejected", "approval_note": payload.note or None})
            .eq("id", profile_id)
            .execute()
        )
        rows = res.data or []
        if not rows:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
        return {"message": "Account rejected", "account": rows[0], "actor": current_user.role.value}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to reject account")


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
    valid_roles = {"farmer", "logistics", "factory"}
    invalid = [r for r in payload.approval_required_roles if r not in valid_roles]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid roles: {invalid}. Must be one of {sorted(valid_roles)}",
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
    pending_res = (
        client.table("profiles")
        .select("role", count="exact")
        .eq("approval_status", "pending")
        .execute()
    )
    pending_by_role: dict[str, int] = {}
    for row in pending_res.data or []:
        r = row.get("role", "")
        pending_by_role[r] = pending_by_role.get(r, 0) + 1
    return {
        "overview": overview,
        "pending_approvals": pending_by_role,
        "pending_total": sum(pending_by_role.values()),
        "actor": current_user.role.value,
    }
