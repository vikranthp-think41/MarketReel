from __future__ import annotations

import pytest
from httpx import AsyncClient
from pytest import MonkeyPatch

from app.services import adk_client


class _FakeAdk:
    def __init__(self) -> None:
        self.calls = 0

    async def __call__(
        self, message: str, user_id: str, session_id: str | None
    ) -> adk_client.AdkRunResult:
        self.calls += 1
        return adk_client.AdkRunResult(reply=f"Echo: {message}", session_id=session_id or "sess-1")


@pytest.mark.asyncio
async def test_chat_flow(
    client: AsyncClient, auth_headers: dict[str, str], monkeypatch: MonkeyPatch
) -> None:
    fake = _FakeAdk()
    monkeypatch.setattr("app.services.chats.run_adk", fake)

    create = await client.post("/api/v1/chats", json={"title": "Deal Room"}, headers=auth_headers)
    assert create.status_code == 200
    chat_id = create.json()["id"]

    listing = await client.get("/api/v1/chats", headers=auth_headers)
    assert listing.status_code == 200
    assert listing.json()[0]["id"] == chat_id

    send = await client.post(
        f"/api/v1/chats/{chat_id}/messages",
        json={"content": "Test"},
        headers=auth_headers,
    )
    assert send.status_code == 200
    messages = send.json()
    assert messages[0]["role"] == "user"
    assert messages[1]["role"] == "assistant"
    assert fake.calls == 1

    detail = await client.get(f"/api/v1/chats/{chat_id}", headers=auth_headers)
    assert detail.status_code == 200
    assert len(detail.json()["messages"]) == 2


@pytest.mark.asyncio
async def test_chat_requires_auth(client: AsyncClient) -> None:
    response = await client.get("/api/v1/chats")
    assert response.status_code == 401
