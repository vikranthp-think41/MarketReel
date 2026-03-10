from __future__ import annotations

from functools import lru_cache

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT_DIR / ".env", extra="ignore")

    env: str = "development"
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5433/app_scaffold"
    google_api_key: str = ""
    google_genai_use_vertexai: bool = False
    app_name: str = "marketlogic_adk"


@lru_cache
def get_settings() -> Settings:
    return Settings()
