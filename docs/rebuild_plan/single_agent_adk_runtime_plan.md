# Single-Agent ADK Runtime Plan

## Summary
Refactor ADK runtime to one `Agent` entrypoint that delegates all routing/execution to `run_marketlogic_orchestrator(...)`, removing multi-stage sequential callbacks that currently create misleading “pass” behavior.

## Implementation Changes
- Replace `SequentialAgent` in `adk-server/agents/marketlogic/agent.py` with one `Agent` (name `MarketLogicOrchestrator`) and one `before_agent_callback` (or equivalent single callback path).
- Move current resolve/finalize logic into that single callback:
  - read user message
  - load session state
  - call `run_marketlogic_orchestrator(message, session_state, provider_enabled)`
  - persist returned `state_delta`
  - return final JSON payload string
- Remove temporary stage keys no longer needed (`_TEMP_*` route/input/message keys tied to staged flow).
- Remove stage callback functions (`_resolve_stage`, `_data_stage`, `_risk_stage`, `_valuation_stage`, `_strategy_stage`, `_finalize_stage`) and replace with one callback.
- Keep existing `run_agent(...)` session handling, lazy `Runner`, and fallback path, but ensure fallback calls the same single orchestrator contract.
- Keep `ADK_MODEL` usage by assigning model on the single root `Agent`.
- Keep API/auth boundary in `adk-server/app/main.py` unchanged.

## Public Interface / Behavior
- No external API endpoint change (`POST /v1/run` remains unchanged).
- Response contract remains unchanged from current rebuild:
  - `response_type` with `conversation_response | clarification_response | scorecard_response`
  - stable scorecard fields and warning/citation/confidence payloads.
- Internal runtime behavior changes:
  - no pseudo-stage “pass” execution logs for non-workflow turns.

## Test Plan
- Update ADK unit tests to assert single-agent behavior:
  - `"hi"` returns `conversation_response` and does not emit stage-pass artifacts.
  - missing movie/territory returns `clarification_response`.
  - workflow request returns `scorecard_response`.
- Keep and run eval suite (`agents/eval/test_eval.py`) for conversational gate, clarification, explainability session reads, and scorecard schema.
- Run ADK API test (`tests/test_run.py`) to verify `/v1/run` contract unchanged.
- Run end-to-end smoke:
  - backend + ADK up
  - one greeting turn
  - one scorecard turn
  - one follow-up turn with scenario reuse.

## Assumptions
- All orchestration decisions stay in `run_marketlogic_orchestrator(...)` (single source of truth).
- No need for ADK workflow branching primitives right now; deterministic Python orchestrator remains preferred.
- Logging can be simplified to run-level events plus orchestrator route logs (no staged callback telemetry required).
