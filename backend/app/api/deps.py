from typing import Any, Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.db.supabase import get_anon_client, get_service_client
from app.models.auth import AuthenticatedUser, Role

bearer_scheme = HTTPBearer(auto_error=False)


def get_bearer_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )
    return credentials.credentials


def _normalize_role(raw_role: str | None) -> Role | None:
    if raw_role is None:
        return None

    try:
        return Role(raw_role.lower())
    except ValueError:
        return None


def _extract_role_from_user(user: Any) -> Role | None:
    app_metadata = getattr(user, "app_metadata", {}) or {}
    user_metadata = getattr(user, "user_metadata", {}) or {}

    for payload in (app_metadata, user_metadata):
        role = _normalize_role(payload.get("role"))
        if role is not None:
            return role

    return None


def _fetch_role_from_profile(user_id: str) -> Role | None:
    service_client = get_service_client()

    response = (
        service_client.table("profiles")
        .select("role")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )

    data = response.data or []
    if not data:
        return None

    return _normalize_role(data[0].get("role"))


def get_current_user(token: str = Depends(get_bearer_token)) -> AuthenticatedUser:
    anon_client = get_anon_client()

    try:
        user_response = anon_client.auth.get_user(token)
        user = user_response.user
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from exc

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found for token",
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
            detail="Role not assigned",
        )

    return AuthenticatedUser(
        user_id=str(user.id),
        email=user.email,
        role=role,
    )


def require_roles(*roles: Role) -> Callable[[AuthenticatedUser], AuthenticatedUser]:
    def dependency(current_user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role permissions",
            )
        return current_user

    return dependency
