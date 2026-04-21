from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import _extract_role_from_user, _fetch_role_from_profile, get_current_user
from app.core.config import get_settings
from app.db.supabase import _build_client, get_publishable_client, get_service_client
from app.models.auth import AuthenticatedUser, Role

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=6, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1, max_length=4096)


class RegisterBaseRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=6, max_length=128)
    display_name: str = Field(min_length=1, max_length=255)
    phone: str = Field(min_length=3, max_length=50)
    province: str = Field(min_length=1, max_length=120)


class RegisterFarmerRequest(RegisterBaseRequest):
    pass


class RegisterLogisticsRequest(RegisterBaseRequest):
    name_th: str = Field(min_length=1, max_length=255)
    location_text: str | None = Field(default=None, max_length=500)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)


class RegisterFactoryRequest(RegisterBaseRequest):
    name_th: str = Field(min_length=1, max_length=255)
    location_text: str | None = Field(default=None, max_length=500)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _is_duplicate_user_error(exc: Exception) -> bool:
    message = str(exc).lower()
    duplicate_markers = (
        "already registered",
        "already been registered",
        "already exists",
        "duplicate",
        "email exists",
        "email address already",
        "user already",
        "user_already_exists",
    )
    return any(marker in message for marker in duplicate_markers)


def _auth_user_exists_by_email(service_client: Any, normalized_email: str) -> bool:
    page = 1
    per_page = 1000

    while True:
        users = service_client.auth.admin.list_users(page=page, per_page=per_page)
        if not users:
            return False

        for user in users:
            if (getattr(user, "email", "") or "").strip().lower() == normalized_email:
                return True

        if len(users) < per_page:
            return False

        page += 1


def _is_key_compatibility_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return "invalid api key" in message or "apikey" in message


def _resolve_role_or_raise(user: Any) -> Role:
    role = _extract_role_from_user(user)
    if role is None:
        try:
            role = _fetch_role_from_profile(str(user.id))
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Unable to resolve user role",
            ) from exc

    if role is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authenticated user has no assigned role",
        )

    return role


def _serialize_auth_response(auth_response: Any) -> dict[str, Any]:
    user = getattr(auth_response, "user", None)
    session = getattr(auth_response, "session", None)

    if user is None or session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
        )

    role = _resolve_role_or_raise(user)

    return {
        "access_token": getattr(session, "access_token", None),
        "refresh_token": getattr(session, "refresh_token", None),
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "role": role.value,
        },
    }


def _register_user(
    payload: RegisterBaseRequest,
    role: Role,
    factory_payload: RegisterFactoryRequest | None = None,
    logistics_payload: RegisterLogisticsRequest | None = None,
) -> dict[str, Any]:
    service_client = get_service_client()
    publishable_client = get_publishable_client()

    normalized_email = _normalize_email(payload.email)
    created_user_id: str | None = None

    try:
        if _auth_user_exists_by_email(service_client, normalized_email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )
    except HTTPException:
        raise
    except Exception:
        # If listing users fails, continue to create flow and rely on create_user response.
        pass

    create_payload = {
        "email": normalized_email,
        "password": payload.password,
        "email_confirm": True,
        "user_metadata": {"role": role.value},
        "app_metadata": {"role": role.value},
    }

    try:
        create_response = service_client.auth.admin.create_user(create_payload)
    except Exception as exc:
        if _is_key_compatibility_error(exc):
            settings = get_settings()
            if settings.supabase_legacy_service_role_jwt:
                try:
                    fallback_client = _build_client(settings.supabase_legacy_service_role_jwt)
                    create_response = fallback_client.auth.admin.create_user(create_payload)
                    service_client = fallback_client
                except Exception as fallback_exc:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Unable to create auth user: invalid service key configuration",
                    ) from fallback_exc
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Unable to create auth user: set SUPABASE_LEGACY_SERVICE_ROLE_JWT or use a compatible secret key",
                ) from exc

        if _is_duplicate_user_error(exc):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            ) from exc

        try:
            if _auth_user_exists_by_email(service_client, normalized_email):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email already registered",
                )
        except HTTPException:
            raise
        except Exception:
            pass

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to create auth user",
        ) from exc

    created_user = getattr(create_response, "user", None)
    if created_user is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase did not return created user",
        )

    created_user_id = str(getattr(created_user, "id", "") or "")
    if not created_user_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Missing created user id",
        )

    # Check if this role requires approval before activation
    approval_status = "active"
    try:
        settings_res = service_client.table("admin_settings").select("approval_required_roles").eq("key", "global").execute()
        settings_rows = settings_res.data or []
        if settings_rows:
            required_roles: list[str] = settings_rows[0].get("approval_required_roles") or []
            if role.value in required_roles:
                approval_status = "inactive"
    except Exception:
        approval_status = "active"

    try:
        service_client.table("profiles").insert(
            {
                "id": created_user_id,
                "role": role.value,
                "display_name": payload.display_name.strip(),
                "phone": payload.phone.strip(),
                "province": payload.province.strip(),
                "approval_status": approval_status,
            }
        ).execute()

        if role == Role.FACTORY:
            if factory_payload is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Factory registration payload is required",
                )

            if (factory_payload.lat is None) != (factory_payload.lng is None):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Factory lat/lng must be provided together",
                )

            service_client.table("org_accounts").insert(
                {
                    "profile_id": created_user_id,
                    "type": "factory",
                    "name_th": factory_payload.name_th.strip(),
                    "location_text": (
                        factory_payload.location_text.strip()
                        if factory_payload.location_text
                        else None
                    ),
                    "lat": factory_payload.lat,
                    "lng": factory_payload.lng,
                    "active": True,
                }
            ).execute()

        if role == Role.LOGISTICS:
            if logistics_payload is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Logistics registration payload is required",
                )

            if (logistics_payload.lat is None) != (logistics_payload.lng is None):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Logistics lat/lng must be provided together",
                )

            service_client.table("org_accounts").insert(
                {
                    "profile_id": created_user_id,
                    "type": "logistics",
                    "name_th": logistics_payload.name_th.strip(),
                    "location_text": (
                        logistics_payload.location_text.strip()
                        if logistics_payload.location_text
                        else None
                    ),
                    "lat": logistics_payload.lat,
                    "lng": logistics_payload.lng,
                    "active": True,
                }
            ).execute()
    except HTTPException:
        if created_user_id:
            try:
                service_client.auth.admin.delete_user(created_user_id)
            except Exception:
                pass
        raise
    except Exception as exc:
        if created_user_id:
            try:
                service_client.auth.admin.delete_user(created_user_id)
            except Exception:
                pass
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to initialize user profile",
        ) from exc

    try:
        login_response = publishable_client.auth.sign_in_with_password(
            {
                "email": normalized_email,
                "password": payload.password,
            }
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Registration succeeded but auto-login failed",
        ) from exc

    result = _serialize_auth_response(login_response)
    result["approval_status"] = approval_status
    return result


@router.get("/me")
def auth_me(current_user: AuthenticatedUser = Depends(get_current_user)) -> dict[str, str | None]:
    return {
        "user_id": current_user.user_id,
        "email": current_user.email,
        "role": current_user.role.value,
    }


@router.post("/login")
def login(payload: LoginRequest) -> dict[str, Any]:
    publishable_client = get_publishable_client()

    try:
        auth_response = publishable_client.auth.sign_in_with_password(
            {
                "email": payload.email,
                "password": payload.password,
            }
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        ) from exc

    result = _serialize_auth_response(auth_response)
    # Attach approval_status from profiles so frontend can gate access
    try:
        service_client = get_service_client()
        user_id = result["user"]["id"]
        profile_res = (
            service_client.table("profiles")
            .select("approval_status")
            .eq("id", user_id)
            .single()
            .execute()
        )
        result["approval_status"] = (profile_res.data or {}).get("approval_status", "active")
    except Exception:
        result["approval_status"] = "active"
    return result


@router.post("/refresh")
def refresh_token(payload: RefreshRequest) -> dict[str, Any]:
    publishable_client = get_publishable_client()

    try:
        auth_response = publishable_client.auth.refresh_session(payload.refresh_token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        ) from exc

    return _serialize_auth_response(auth_response)


@router.post("/register/farmer")
def register_farmer(payload: RegisterFarmerRequest) -> dict[str, Any]:
    return _register_user(payload=payload, role=Role.FARMER)


@router.post("/register/logistics")
def register_logistics(payload: RegisterLogisticsRequest) -> dict[str, Any]:
    return _register_user(payload=payload, role=Role.LOGISTICS, logistics_payload=payload)


@router.post("/register/factory")
def register_factory(payload: RegisterFactoryRequest) -> dict[str, Any]:
    return _register_user(payload=payload, role=Role.FACTORY, factory_payload=payload)
