from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Chat, Message
from app.services.adk_client import run_adk


async def create_chat(db: AsyncSession, user_id: int, title: str) -> Chat:
    chat = Chat(user_id=user_id, title=title)
    db.add(chat)
    await db.commit()
    await db.refresh(chat)
    return chat


async def list_chats(db: AsyncSession, user_id: int) -> list[Chat]:
    stmt = select(Chat).where(Chat.user_id == user_id).order_by(Chat.updated_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_chat(db: AsyncSession, user_id: int, chat_id: int) -> Chat | None:
    stmt = (
        select(Chat)
        .where(Chat.user_id == user_id, Chat.id == chat_id)
        .options(selectinload(Chat.messages))
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def add_message_and_run(
    db: AsyncSession,
    user_id: int,
    chat_id: int,
    content: str,
) -> tuple[Message, Message]:
    chat = await _require_chat(db, user_id, chat_id)

    user_message = Message(chat_id=chat.id, role="user", content=content)
    db.add(user_message)
    await db.flush()

    result = await run_adk(message=content, user_id=str(user_id), session_id=chat.adk_session_id)
    if chat.adk_session_id != result.session_id:
        chat.adk_session_id = result.session_id
    chat.updated_at = datetime.now()

    assistant_message = Message(chat_id=chat.id, role="assistant", content=result.reply)
    db.add(assistant_message)
    await db.commit()
    await db.refresh(user_message)
    await db.refresh(assistant_message)

    return user_message, assistant_message


async def _require_chat(db: AsyncSession, user_id: int, chat_id: int) -> Chat:
    chat = await get_chat(db, user_id, chat_id)
    if chat is None:
        raise ValueError("Chat not found")
    return chat
