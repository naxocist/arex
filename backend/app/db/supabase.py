from functools import lru_cache

from supabase import Client, create_client

from app.core.config import get_settings


def _build_client(api_key: str) -> Client:
    settings = get_settings()
    return create_client(settings.supabase_url, api_key)


@lru_cache
def get_anon_client() -> Client:
    settings = get_settings()
    return _build_client(settings.supabase_anon_key)


@lru_cache
def get_service_client() -> Client:
    settings = get_settings()
    return _build_client(settings.supabase_service_role_key)
