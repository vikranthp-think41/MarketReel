# MarketReel

## MarketLogic AI System
*Global Film Distribution & Acquisition Agent*

**Production Architecture Document**

---

# 1. System Overview

MarketReel is a multi-agent AI system that assists film distribution executives in evaluating independent films for global acquisition and theatrical release strategy. The system combines agentic RAG (retrieval-augmented generation) over local documents with structured PostgreSQL database queries to produce auditable, citation-backed distribution scorecards.

## Design Principles

- Split agents by reasoning type, not by data source.
- All external data access flows through a single `DataAgent`. No other agent queries the database or documents directly.
- Tools are bounded execution components with fixed inputs and outputs. Agents own planning, interpretation, and decision-making.
- Validation happens inline inside the Orchestrator, not as a separate service or agent.
- Every output claim must trace to a source document and page number.

---

# 2. Execution Flow

Every query follows this sequence. `ValuationAgent` and `RiskAgent` are independent and can run in parallel in a scaled execution model.

| Orchestrator | DataAgent | ValuationAgent | RiskAgent | StrategyAgent | `validate_output()` |
| :---: | :---: | :---: | :---: | :---: | :---: |
| Routes and manages session | Fetches all data | MG and revenue reasoning | Risk flag generation with citations | Release-plan synthesis | Sanity and hallucination checks |

---

# 3. Component Summary

| 1 | 4 | 1 | 14 | 3 |
| :---: | :---: | :---: | :---: | :---: |
| **ORCHESTRATOR** | **AGENTS** | **SUB-AGENT** | **TOOLS** | **VALIDATORS** |

---

# 4. Full Architecture Tree

Complete hierarchy showing every component, its type, and its role in the system.

| Component | Type | Description |
| :---- | :---- | :---- |
| **MarketLogicOrchestrator** | **ORCHESTRATOR** | Top-level controller. Routes queries, manages session state, and calls `validate_output()` before every response. |
| └─ **DataAgent** | **AGENT** | Single gateway for all external data access across documents and database. No other agent touches data directly. |
| &nbsp;&nbsp;&nbsp;&nbsp;└─ **DocumentRetrievalAgent** | **SUB-AGENT** | Agentic RAG controller. Navigates document indexes, builds retrieval plans, fetches exact pages, checks sufficiency, and iterates when needed. |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├─ **IndexRegistry** | **TOOL** | Static index catalog built at ingestion. Maps `Act → Scene → Page`, `Country → Rule → Page`, and similar references. |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├─ **IndexNavigator** | **TOOL** | Produces a retrieval plan from the index, such as `[{doc_id, page_range, reason}]`. |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├─ **TargetedFetcher** | **TOOL** | Executes the retrieval plan and fetches exact pages only. No similarity search. |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└─ **SufficiencyChecker** | **TOOL** | Checks whether retrieved content satisfies the retrieval intent. If not, expands by ±3 pages and re-fetches automatically. |
| &nbsp;&nbsp;&nbsp;&nbsp;└─ **DB Tools (×6)** | **TOOLS** | `get_box_office_by_genre_territory()`, `get_actor_qscore()`, `get_theatrical_window_trends()`, `get_exchange_rates()`, `get_vod_price_benchmarks()`, `get_comparable_films()` |
| └─ **ValuationAgent** | **AGENT** | Quantitative reasoning. Answers: *How much is this film worth?* Calls `DataAgent`, then uses local computation tools for MG estimation and currency conversion. |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **mg_calculator_tool** | **TOOL** | Computes MG from comparables, Q-scores, and genre multipliers. Local computation only. |
| &nbsp;&nbsp;&nbsp;&nbsp;└─ **exchange_rate_tool** | **TOOL** | Converts MG estimates to a target currency using rates already fetched by `DataAgent`. |
| └─ **RiskAgent** | **AGENT** | Qualitative reasoning. Answers: *What could go wrong?* Produces typed `RiskFlag[]` outputs with scene references, severity, and mitigation. |
| └─ **StrategyAgent** | **AGENT** | Prescriptive reasoning. Answers: *What should we do?* Reads `ValuationAgent` and `RiskAgent` outputs from session state, and requests any additional supporting data through `DataAgent`. |
| └─ **validate_output()** | **VALIDATION ENTRYPOINT** | Inline validation sequence owned by the Orchestrator and run before every response. |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **financial_sanity_check()** | **VALIDATION** | Blocks MG estimates outside historical bounds for the genre and territory. |
| &nbsp;&nbsp;&nbsp;&nbsp;├─ **hallucination_check()** | **VALIDATION** | Verifies that every claim traces to a fetched page via `source_citation_tool()`. |
| &nbsp;&nbsp;&nbsp;&nbsp;└─ **confidence_threshold_check()** | **VALIDATION** | Blocks outputs where `data_sufficiency_score < 0.60` and surfaces a gap warning instead. |
| └─ **format_scorecard()** | **TOOL** | Assembles validated outputs into the final structured JSON distribution scorecard. |
| └─ **source_citation_tool()** | **TOOL** | Links every claim to `doc_id` and page number. Used internally during output verification. |

---

# 5. Agents — Detailed Breakdown

Agents make decisions, iterate, and reason. Each has one clearly defined job.

## ORCHESTRATOR

| [ORCHESTRATOR] MarketLogicOrchestrator |  |  |
| :---- | :---- | :---- |
|  | **INPUT** | **OUTPUT** |
| **Reasoning** Flow control and session management | - Natural language query from executive  <br> - Session ID for state lookup  <br> - Film ID or script reference | - Structured distribution scorecard (JSON)  <br> - Territory MG estimates with confidence  <br> - Typed risk flags with page citations  <br> - Release-window and marketing recommendations |

## AGENTS

| [AGENT] DataAgent *(owned by Orchestrator)* |  |  |
| :---- | :---- | :---- |
|  | **INPUT** | **OUTPUT** |
| **Reasoning** Chooses document retrieval, database query, or both | - Typed data request from any functional agent  <br> - Query intent, territory, and `film_id` | - Unified context object combining document pages and DB rows  <br> - Source citations per data item  <br> - `data_sufficiency_score` |

| [AGENT] ValuationAgent *(owned by Orchestrator)* |  |  |
| :---- | :---- | :---- |
|  | **INPUT** | **OUTPUT** |
| **Reasoning** Quantitative financial reasoning | - Box office history by genre and territory (from `DataAgent`)  <br> - Actor Q-scores and social reach  <br> - Comparable films and their MGs  <br> - Exchange rates  <br> - Script themes from document retrieval | - MG estimate per territory  <br> - Confidence interval `[low, high]`  <br> - Revenue projection for theatrical and VOD  <br> - `data_sufficiency_score` (`0.0–1.0`)  <br> - List of comparable films used |

| [AGENT] StrategyAgent *(owned by Orchestrator)* |  |  |
| :---- | :---- | :---- |
|  | **INPUT** | **OUTPUT** |
| **Reasoning** Prescriptive synthesis reasoning | - `ValuationAgent` output (from session cache)  <br> - `RiskAgent` output (from session cache)  <br> - Festival sentiment and reviews (via `DataAgent`)  <br> - Marketing brief pages (via `DataAgent`)  <br> - VOD benchmarks and theatrical window trends | - Optimal release window per territory  <br> - Theatrical vs streaming split recommendation  <br> - Marketing spend recommendation  <br> - Platform priority ranking  <br> - ROI scenario comparisons (for example, skip theatrical release in France) |

## AGENT (QUALITATIVE)

| [AGENT] RiskAgent *(owned by Orchestrator)* |  |  |
| :---- | :---- | :---- |
|  | **INPUT** | **OUTPUT** |
| **Reasoning** Qualitative regulatory and market risk reasoning | - Script scenes with themes and page references (from `DataAgent`)  <br> - Censorship regulation sections by country  <br> - Cultural sensitivity report pages  <br> - Regional theatrical window trends | - `RiskFlag[]`: category, severity, scene, page, mitigation, confidence  <br> - Risk types: `CENSORSHIP`, `CULTURAL_SENSITIVITY`, `MARKET`  <br> - Severity levels: `HIGH`, `MEDIUM`, `LOW`  <br> - Specific script page references per flag |

---

# 6. Sub-Agent

## SUB-AGENT

| [SUB-AGENT] DocumentRetrievalAgent *(owned by DataAgent)* |  |  |
| :---- | :---- | :---- |
|  | **INPUT** | **OUTPUT** |
| **Reasoning** Index-guided retrieval and iterative refinement | - Retrieval intent from `DataAgent`  <br> - Document type, territory, and themes to find | - Exact page content with source references  <br> - Page references for `source_citation_tool()`  <br> - Sufficiency status: `PASS` or `EXPAND` |

### How Agentic RAG works in this system

| Traditional RAG | This System — Agentic RAG |
| :---- | :---- |
| `query → embed → similarity search → return chunks` | `query → IndexNavigator builds RetrievalPlan → TargetedFetcher pulls exact pages → SufficiencyChecker validates → iterate if needed` |
| Blind semantic search across all content | Reasoning-first retrieval guided by document structure |
| May return irrelevant chunks | Returns exact pages with traceable fetch paths |

---

# 7. Tools — Complete List

Tools are bounded execution components: input in, output out. They do not own end-to-end decision-making or cross-step planning.

## Document Tools — owned by DocumentRetrievalAgent

| Function / Name | Description | Owned By |
| :---- | :---- | :---- |
| **IndexRegistry** | Static index catalog built at document ingestion. Maps `Act → Scene → Page`, `Country → Rule → Page`, and `Film → Reviewer → Page`. | DocumentRetrievalAgent |
| **IndexNavigator** | Builds a `RetrievalPlan`, such as `[{doc_id, page_range, reason}]`, from the available index structures. | DocumentRetrievalAgent |
| **TargetedFetcher** | Executes the `RetrievalPlan` and pulls only the specified pages from the document store. No similarity search. | DocumentRetrievalAgent |
| **SufficiencyChecker** | Validates whether the retrieved content fully answers the retrieval intent. If insufficient, expands the page range by ±3 and triggers a re-fetch. | DocumentRetrievalAgent |

## DB Tools — owned by DataAgent

| Function / Name | Description | Owned By |
| :---- | :---- | :---- |
| **get_box_office_by_genre_territory()** | Historical global box office performance filtered by genre and territory from PostgreSQL. | DataAgent |
| **get_actor_qscore()** | Returns actor Q-scores and social media reach by talent name. | DataAgent |
| **get_theatrical_window_trends()** | Regional theatrical window durations and VOD timing trends. | DataAgent |
| **get_exchange_rates()** | Current currency exchange rates for MG calculations by currency code. | DataAgent |
| **get_vod_price_benchmarks()** | Existing VOD and streaming licensing price benchmarks by territory. | DataAgent |
| **get_comparable_films()** | Returns similar films by genre, budget range, and territory for MG comparables. | DataAgent |

## Computation Tools — owned by ValuationAgent

| Function / Name | Description | Owned By |
| :---- | :---- | :---- |
| **mg_calculator_tool** | Computes Minimum Guarantee using comparables, Q-scores, and genre multipliers. Local computation only. | ValuationAgent |
| **exchange_rate_tool** | Converts MG estimates into the target currency using rates already fetched by `DataAgent`. | ValuationAgent |

## Utility Tools — owned by Orchestrator

| Function / Name | Description | Owned By |
| :---- | :---- | :---- |
| **format_scorecard()** | Assembles validated outputs into the final structured JSON distribution scorecard. | Orchestrator |
| **source_citation_tool()** | Links every claim in the output to its source `doc_id` and page number. Used internally during verification. | Orchestrator |

---

# 8. Validation — Inline in Orchestrator

Validation is not a separate layer or agent. It is a set of inline functions called by the Orchestrator before every response reaches the user. This keeps the architecture simple while maintaining production-grade reliability.

| Function | What It Checks | Action If Fails |
| :---- | :---- | :---- |
| **financial_sanity_check()** | MG estimate is within historical bounds for the relevant genre and territory | Block output, flag as anomaly, and request `ValuationAgent` re-evaluation |
| **hallucination_check()** | Every claim in the output traces to an actually fetched page via `source_citation_tool()` | Remove unverified claims, mark them as unverified, and surface a warning |
| **confidence_threshold_check()** | `data_sufficiency_score` is above the minimum threshold of `0.60` | Do not present as a confident output; instead surface a gap warning for insufficient data |

---

# 9. Complete Component Reference

| Component | Type | Owned By | Calls | Reasoning? |
| :---- | :---- | :---- | :---- | :---- |
| **MarketLogicOrchestrator** | **ORCHESTRATOR** | — | `DataAgent`, `ValuationAgent`, `RiskAgent`, `StrategyAgent` | Yes |
| **DataAgent** | **AGENT** | Orchestrator | `DocumentRetrievalAgent`, all DB tools | Yes |
| **DocumentRetrievalAgent** | **SUB-AGENT** | DataAgent | `IndexRegistry`, `IndexNavigator`, `TargetedFetcher`, `SufficiencyChecker` | Yes |
| **ValuationAgent** | **AGENT** | Orchestrator | `DataAgent`, `mg_calculator_tool`, `exchange_rate_tool` | Yes |
| **RiskAgent** | **AGENT** | Orchestrator | `DataAgent` | Yes |
| **StrategyAgent** | **AGENT** | Orchestrator | `DataAgent` and session outputs from `ValuationAgent` and `RiskAgent` | Yes |
| **IndexRegistry** | **TOOL** | DocumentRetrievalAgent | — | No |
| **IndexNavigator** | **TOOL** | DocumentRetrievalAgent | `IndexRegistry` | No |
| **TargetedFetcher** | **TOOL** | DocumentRetrievalAgent | Document store | No |
| **SufficiencyChecker** | **TOOL** | DocumentRetrievalAgent | `TargetedFetcher` (re-fetch if needed) | No |
| **get_box_office_by_genre_territory()** | **TOOL** | DataAgent | PostgreSQL | No |
| **get_actor_qscore()** | **TOOL** | DataAgent | PostgreSQL | No |
| **get_theatrical_window_trends()** | **TOOL** | DataAgent | PostgreSQL | No |
| **get_exchange_rates()** | **TOOL** | DataAgent | PostgreSQL | No |
| **get_vod_price_benchmarks()** | **TOOL** | DataAgent | PostgreSQL | No |
| **get_comparable_films()** | **TOOL** | DataAgent | PostgreSQL | No |
| **mg_calculator_tool** | **TOOL** | ValuationAgent | — | No |
| **exchange_rate_tool** | **TOOL** | ValuationAgent | — | No |
| **financial_sanity_check()** | **VALIDATION** | Orchestrator | — | No |
| **hallucination_check()** | **VALIDATION** | Orchestrator | `source_citation_tool()` | No |
| **confidence_threshold_check()** | **VALIDATION** | Orchestrator | — | No |
| **format_scorecard()** | **TOOL** | Orchestrator | — | No |
| **source_citation_tool()** | **TOOL** | Orchestrator | — | No |

---

**MarketReel — MarketLogic AI System — Production Architecture**