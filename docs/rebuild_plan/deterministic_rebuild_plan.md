# Deterministic Rebuild Plan: Turn-Type Routing, Stable Scorecard Schema, and Controlled Reuse

## Summary
Rebuild the orchestration layer with a two-step router (`turn_type` -> `workflow_intent`), enforce deterministic partial-workflow execution, freeze final scorecard schema now, and align backend/frontend/tests/evals to one stable response contract. Remove legacy route `/api/v1/agent/run` immediately.

## Implementation Changes
1. **Routing model (separate turn type from workflow intent)**
- Add `turn_type` classifier with: `greeting`, `acknowledgement`, `help`, `clarification`, `workflow_request`, `workflow_followup`.
- Add second-stage `workflow_intent` resolver (only when `turn_type` is workflow): `valuation`, `risk`, `strategy`, `full_scorecard`.
- Enforce routing invariant: only `workflow_request` and `workflow_followup` can invoke specialist pipeline.

2. **Response metadata and schema freeze**
- Standardize `response_type` to exactly:
  - `conversation_response`
  - `clarification_response`
  - `scorecard_response`
- Freeze scorecard schema (single canonical contract) including:
  - `projected_revenue_by_territory`
  - `risk_flags`
  - `recommended_acquisition_price`
  - `release_timeline`
  - `marketing_spend_usd`
  - `platform_priority`
  - `roi_scenarios`
  - `citations`
  - `confidence`
  - `warnings`
  - `response_type`
- Update ADK final formatter and backend/frontend parsing to this exact contract.

3. **Partial workflow execution + validation policy**
- `valuation` flow: Data -> Valuation -> validation (`financial_sanity`, `hallucination`, `confidence_threshold`).
- `risk` flow: Data -> Risk -> validation (`hallucination`, `confidence_threshold`) and explicitly skip `financial_sanity`.
- `strategy` flow: Data -> (reuse/run Valuation + Risk as required) -> Strategy -> validation (`hallucination`, `confidence_threshold`, plus `financial_sanity` if valuation present).
- `full_scorecard` flow: full pipeline + all validations.

4. **Follow-up reuse rules (explicit)**
- Reuse cached artifacts only when all are true:
  - same normalized movie and territory
  - compatible scenario assumptions (no conflict between prior baseline and requested override)
  - cached evidence present and above freshness/sufficiency guardrails
- Reuse by artifact type (evidence/risk/valuation/strategy) instead of all-or-none.
- If any guard fails, rerun only missing/invalid stages.

5. **Explainability/evidence inspection behavior**
- Add explicit non-pipeline read path for explainability requests (e.g., “why this score?”, “show evidence/citations”).
- Serve from session-state artifacts (`last_scorecard`, `evidence_bundle`, `risk`, `valuation`, `strategy`) when available.
- Trigger rerun only if required data is absent/invalid.

6. **Retrieval path consistency**
- Pass `doc_types` from ADK retrieval plan to internal docs search request and enforce server-side filtering.
- Keep sufficiency expand/refetch loop deterministic and intent-aware.

7. **Removal and cleanup**
- Remove `/api/v1/agent/run` endpoint and route registration.
- Remove associated tests and any dead caller code.
- Clean stale empty agent-doc scaffolding if unused.

8. **ADK eval and test hardening**
- Replace empty eval file with real regression evals covering:
  - turn-type classification
  - workflow intent mapping
  - partial workflow gating
  - follow-up reuse acceptance/rejection
  - explainability state-read path
  - scorecard schema conformance
- Update integration/unit tests across ADK/server/client for new response schema and removed endpoint.

## Public API / Interface Changes
- **Removed**: `POST /api/v1/agent/run`.
- **Updated ADK reply contract**: fixed scorecard schema + strict `response_type` enum.
- **Updated internal docs API**: include and enforce `doc_types` in docs search contract.
- **Frontend contract update**: Chat UI parser/renderer expects stable scorecard schema and new `response_type`.

## Test Plan
1. Routing tests for all `turn_type` values and legal/illegal workflow transitions.
2. Workflow-intent tests for `valuation`, `risk`, `strategy`, `full_scorecard` stage gating.
3. Validation tests confirming per-intent minimal validation policy.
4. Follow-up reuse tests for positive/negative cache reuse conditions.
5. Explainability tests confirming session-state read without unnecessary rerun.
6. Schema tests (backend + frontend) validating exact scorecard keys and `response_type` enum.
7. Endpoint removal test ensuring `/api/v1/agent/run` is absent.

## Assumptions
- Clean in-place rebuild is preferred over compatibility shims.
- Frontend and backend are updated together in the same change set.
- Existing chat-based flow (`/api/v1/chats/*`) remains the only supported user interaction path.
