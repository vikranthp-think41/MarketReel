# MarketLogic MVP Plan — Phase 0

## Summary
- Split into three services: `/server` (backend API + chat DB), `/client` (React UI), `/adk-server` (Google ADK runtime + persistent session store).
- Backend stores chats/messages and calls ADK over HTTP to run the agent and persist/reuse session state.
- ADK session state is stored in Postgres for persistence across restarts.

## Implementation Changes

### Repo Structure and Docker
1. Add a new top-level `/adk-server` service with its own `pyproject.toml` (uv), `app/`, and `Dockerfile`.
2. Update `docker-compose.yml` to include:
   - `db` (existing Postgres)
   - `api` (backend)
   - `adk` (new ADK service)
   - `client` (frontend)
3. Use the same Postgres instance; ADK service uses a separate schema/tables for session persistence.

### ADK Server (`/adk-server`)
1. Implement the agent in `adk-server/app/agent.py` (based on the existing sample).
2. Add a persistent session store backed by Postgres.
   - Define tables (e.g., `adk_sessions`, `adk_events` or `adk_messages`) to store session state required by ADK runner.
   - Implement a `SessionService` that loads/saves session state by `session_id`.
3. Expose HTTP API:
   - `POST /v1/run` with `{ session_id, user_id, message }` → returns `{ reply, session_id }`.
   - If `session_id` is missing or unknown, create a new session and return its id.
4. Keep it stateless beyond Postgres so it scales horizontally.

### Backend (`/server`)
1. Chats/messages remain in Postgres:
   - `chats` and `messages` tables with indexes.
2. Add `app/services/adk_client.py`:
   - HTTP client to call ADK server `POST /v1/run`.
   - Pass `session_id` stored in `chats.adk_session_id` (new column).
   - If ADK returns a new `session_id`, persist it on the chat record.
3. Update chat service:
   - On new chat, no session id yet.
   - On first message, call ADK with `session_id=null` → ADK returns new session id; store it.
   - Each subsequent message uses the stored `adk_session_id`.
4. Update API routes:
   - `POST /api/v1/chats` creates chat.
   - `GET /api/v1/chats`, `GET /api/v1/chats/{id}` list/get chats/messages.
   - `POST /api/v1/chats/{id}/messages` inserts user message, calls ADK, inserts assistant reply.

### Frontend (`/client`)
1. JWT login, token storage, and protected routes.
2. Chat UI with:
   - Sidebar list of chats
   - `New Chat` action
   - History view
   - Message input + send
3. API integration with backend chat endpoints (not ADK directly).

## Public API / Interface Changes
- Backend (JWT protected):
  - `POST /api/v1/chats`
  - `GET /api/v1/chats`
  - `GET /api/v1/chats/{chat_id}`
  - `POST /api/v1/chats/{chat_id}/messages`
- ADK server:
  - `POST /v1/run`

## Test Plan
- Backend integration tests:
  1. Create chat, list chats, get chat.
  2. Send message: persists user + assistant messages.
  3. Verifies `adk_session_id` is set after first message and reused.
  4. Auth enforcement for chat endpoints.
- ADK server tests:
  1. Run without session id creates new session and returns it.
  2. Run with existing session id reuses it and produces a response.

## Assumptions
- ADK session persistence is sufficient for multi-turn agent context; chat history remains authoritative in backend.
- ADK server and backend share the same Postgres instance but different tables.
- Minimal UI styling (MUI) to validate flow end-to-end.
