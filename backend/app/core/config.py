import json
from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AREX Backend API"
    environment: str = "development"
    debug: bool = True
    api_prefix: str = "/api/v1"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    supabase_url: str
    supabase_publishable_key: str
    supabase_secret_key: str
    osrm_url: str = "https://router.project-osrm.org/route/v1/driving"

    gcs_bucket_name: str = "arex-dev"
    service_account_json: str = ""

    model_config = SettingsConfigDict(
        env_file=".env.local",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            stripped = value.strip()
            if stripped.startswith("["):
                return json.loads(stripped)
            return [item.strip() for item in stripped.split(",") if item.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
