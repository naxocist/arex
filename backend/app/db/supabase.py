from functools import lru_cache

from supabase import Client, create_client

from app.core.config import get_settings


def _build_client(api_key: str) -> Client:
    settings = get_settings()
    return create_client(settings.supabase_url, api_key)


def get_publishable_client() -> Client:
    settings = get_settings()
    return _build_client(settings.supabase_publishable_key)


@lru_cache
def get_service_client() -> Client:
    settings = get_settings()
    secret_key = settings.supabase_secret_key
    if secret_key.startswith("sb_secret_") and settings.supabase_legacy_service_role_jwt:
        secret_key = settings.supabase_legacy_service_role_jwt
    return _build_client(secret_key)
