from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth.deps import require_user
from app.db.models import User
from app.services.adk_client import run_adk

router = APIRouter(prefix="/agent", tags=["agent"])


class AgentRequest(BaseModel):
    message: str


class AgentResponse(BaseModel):
    reply: str


@router.post("/run", response_model=AgentResponse)
async def agent_run(
    body: AgentRequest,
    user: User = Depends(require_user),
) -> AgentResponse:
    result = await run_adk(body.message, user_id=str(user.id), session_id=None)
    return AgentResponse(reply=result.reply)
