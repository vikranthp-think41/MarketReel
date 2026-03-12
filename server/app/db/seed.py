from __future__ import annotations

import json
from pathlib import Path
from typing import TypedDict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.passwords import hash_password
from app.db.models import User

SEED_FILE = Path(__file__).with_name("seed_users.json")


class SeedUser(TypedDict):
    username: str
    email: str
    password: str
    full_name: str | None


async def seed_users(db: AsyncSession) -> int:
    if not SEED_FILE.exists():
        return 0

    data = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    created = 0
    for raw in data:
        user = _normalize_user(raw)
        if user is None:
            continue

        exists = await db.execute(
            select(User).where((User.username == user["username"]) | (User.email == user["email"]))
        )
        if exists.scalar_one_or_none() is not None:
            continue

        db.add(
            User(
                username=user["username"],
                email=user["email"],
                full_name=user.get("full_name"),
                password_hash=hash_password(user["password"]),
            )
        )
        created += 1

    if created:
        await db.commit()
    return created


def _normalize_user(raw: dict[str, object]) -> SeedUser | None:
    username = _get_str(raw, "username")
    email = _get_str(raw, "email")
    password = _get_str(raw, "password")
    if not username or not email or not password:
        return None

    full_name = _get_str(raw, "full_name")
    return {
        "username": username,
        "email": email,
        "password": password,
        "full_name": full_name,
    }


def _get_str(raw: dict[str, object], key: str) -> str | None:
    value = raw.get(key)
    if isinstance(value, str):
        return value.strip() or None
    return None
