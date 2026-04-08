from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import _extract_role_from_user, _fetch_role_from_profile, get_current_user
from app.db.supabase import get_anon_client
from app.models.auth import AuthenticatedUser

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=6, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=20, max_length=4096)


@router.get("/me")
def auth_me(current_user: AuthenticatedUser = Depends(get_current_user)) -> dict[str, str | None]:
    return {
        "user_id": current_user.user_id,
        "email": current_user.email,
        "role": current_user.role.value,
    }


@router.post("/login")
def login(payload: LoginRequest) -> dict[str, Any]:
    anon_client = get_anon_client()

    try:
        auth_response = anon_client.auth.sign_in_with_password(
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

    user = getattr(auth_response, "user", None)
    session = getattr(auth_response, "session", None)

    if user is None or session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
        )

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


@router.post("/refresh")
def refresh_token(payload: RefreshRequest) -> dict[str, Any]:
    anon_client = get_anon_client()

    try:
        auth_response = anon_client.auth.refresh_session(payload.refresh_token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        ) from exc

    user = getattr(auth_response, "user", None)
    session = getattr(auth_response, "session", None)

    if user is None or session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token refresh failed",
        )

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
