"""Register postgresql+asyncpg:// URI scheme with the adk web service registry.

adk web's built-in registry handles 'postgresql://' but not
'postgresql+asyncpg://' (the asyncpg dialect specifier added by asyncpg).
This registers it so that:

    adk web agents --session_service_uri="postgresql+asyncpg://..."

resolves to DatabaseSessionService, sharing sessions with the production server.
"""
from __future__ import annotations

from google.adk.cli.service_registry import get_service_registry
from google.adk.sessions import DatabaseSessionService


def _pg_asyncpg_factory(uri: str, **kwargs) -> DatabaseSessionService:
    return DatabaseSessionService(db_url=uri)


get_service_registry().register_session_service(
    "postgresql+asyncpg", _pg_asyncpg_factory
)
