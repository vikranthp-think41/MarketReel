from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app import agent
from app.main import app


@pytest.mark.asyncio
async def test_run_endpoint(monkeypatch):
    async def _fake_run(message: str, user_id: str, session_id: str | None):
        return f"Echo: {message}", session_id or "sess-1"

    monkeypatch.setattr(agent, "run_agent", _fake_run)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/v1/run",
            json={"message": "Hello", "user_id": "u1", "session_id": None},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["reply"] == "Echo: Hello"
    assert data["session_id"] == "sess-1"
