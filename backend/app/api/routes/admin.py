from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.deps import require_roles
from app.core.errors import WorkflowError
from app.db.supabase import get_service_client
from app.models.auth import AuthenticatedUser, Role
from app.services.workflow_service import WorkflowService, get_workflow_service

router = APIRouter(prefix="/admin", tags=["admin"])


# ─── Pydantic models ──────────────────────────────────────────────────────────

class ApproveAccountRequest(BaseModel):
    note: str | None = None


class RejectAccountRequest(BaseModel):
    note: str = ""


class UpdateApprovalSettingsRequest(BaseModel):
    approval_required_roles: list[str]


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _get_admin_settings(client: Any) -> dict[str, Any]:
    res = client.table("admin_settings").select("*").eq("key", "global").execute()
    rows = res.data or []
    if rows:
        return rows[0]
    # Default: no roles require approval
    return {"key": "global", "approval_required_roles": []}


# ─── Account approval ─────────────────────────────────────────────────────────

@router.get("/accounts/pending")
def list_pending_accounts(
    role_filter: str | None = None,
    current_user: AuthenticatedUser = Depends(require_roles(Role.ADMIN)),
) -> dict[str, Any]:
    """List profiles with approval_status = pending, optionally filtered by role."""
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
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/accounts/all")
def list_all_accounts(
    role_filter: str | None = None,
    approval_filter: str | None = None,
    current_user: AuthenticatedUser = Depends(require_roles(Role.ADMIN)),
) -> dict[str, Any]:
    """List all profiles, optionally filtered by role and/or approval_status."""
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
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/accounts/{profile_id}/approve")
def approve_account(
    profile_id: str,
    payload: ApproveAccountRequest,
    current_user: AuthenticatedUser = Depends(require_roles(Role.ADMIN)),
) -> dict[str, Any]:
    client = get_service_client()
    try:
        res = (
            client.table("profiles")
            .update({
                "approval_status": "approved",
                "approval_note": payload.note,
            })
            .eq("id", profile_id)
            .execute()
        )
        rows = res.data or []
        if not rows:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
        return {"message": "Account approved", "account": rows[0], "actor": current_user.role.value}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/accounts/{profile_id}/reject")
def reject_account(
    profile_id: str,
    payload: RejectAccountRequest,
    current_user: AuthenticatedUser = Depends(require_roles(Role.ADMIN)),
) -> dict[str, Any]:
    client = get_service_client()
    try:
        res = (
            client.table("profiles")
            .update({
                "approval_status": "rejected",
                "approval_note": payload.note or None,
            })
            .eq("id", profile_id)
            .execute()
        )
        rows = res.data or []
        if not rows:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
        return {"message": "Account rejected", "account": rows[0], "actor": current_user.role.value}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


# ─── Admin settings (approval_required_roles toggle) ─────────────────────────

@router.get("/settings")
def get_admin_settings(
    current_user: AuthenticatedUser = Depends(require_roles(Role.ADMIN)),
) -> dict[str, Any]:
    client = get_service_client()
    try:
        settings = _get_admin_settings(client)
        return {"settings": settings, "actor": current_user.role.value}
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.put("/settings")
def update_admin_settings(
    payload: UpdateApprovalSettingsRequest,
    current_user: AuthenticatedUser = Depends(require_roles(Role.ADMIN)),
) -> dict[str, Any]:
    """Update which roles require manual approval on registration."""
    valid_roles = {"farmer", "logistics", "factory"}
    invalid = [r for r in payload.approval_required_roles if r not in valid_roles]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid roles: {invalid}. Must be one of {sorted(valid_roles)}",
        )
    client = get_service_client()
    try:
        import json
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
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


# ─── Dashboard overview (same as executive but for admin) ────────────────────

@router.get("/dashboard/overview")
def get_admin_dashboard_overview(
    current_user: AuthenticatedUser = Depends(require_roles(Role.ADMIN)),
    workflow_service: WorkflowService = Depends(get_workflow_service),
) -> dict[str, Any]:
    try:
        overview = workflow_service.get_executive_overview()
        # Add pending approval counts
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
    except WorkflowError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
