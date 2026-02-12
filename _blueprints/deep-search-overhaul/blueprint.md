# Blueprint: Deep Search Overhaul (Batching + Schema Reset + Mandatory Critics)

> This blueprint is a prebuilt implementation plan for a major refactor after a full database reset. Each step is executable and grounded with explicit evidence references. The focus is to enable scale (provider batch APIs + durable retries), Python-first data exports (snake_case schemas), and a message-led ledger replacing thread-centric usage tracking. Critics are mandatory per evidence item and standardized as `rubric_critic` and `score_critic`.

---

## 0. Run Metadata

- **Run Folder:** /Users/jesselee/dev/research/judge-gym/_blueprints/deep-search-overhaul
- **Research Question:** Since blueprint-init.md, what major changes occurred in the project, and given paper.md, what are the logical next implementation steps? Integrate blueprint-batching.md. Assume tables will be nuked; propose a major overhaul plan.
- **Scope:** Core engine refactor, database schema redesign, batching integration, data endpoints for analysis.
- **Non-goals:** Implementing code changes in this pass.
- **Constraints:** Database wipe; provider batch APIs (OpenAI/Anthropic/Gemini); mandatory critics per evidence item; standardized critic naming (`rubric_critic`, `score_critic`); centralized rate limiter inside batching service using Convex component; message ledger as source of truth; no migrations.

---

## 1. Worldview Register (Single Source of Truth)

`worldview.json` is the registry for subagent assignments, evidence, and synthesis status.

- **Agent Registry:** lead, researchers, falsifier, certainty scorer, synthesizer
- **Assignments:** list of Areas of Analysis and assigned subagents
- **Evidence Registry:** `knowledge/k_..._evidence.md`
- **Hypotheses Registry:** `hypotheses/hyp_...json`
- **Null Challenges:** `null_challenges/nc_...json`
- **Certainty Report:** `certainty/certainty_report.md`

---

## 2. Evidence Ledger (Grounding)

- `knowledge/k_001_blueprint_init_evidence.md` — original blueprint baseline and intended pipeline.  
- `knowledge/k_002_blueprint_batching_evidence.md` — batching + agent-kit refactor design.  
- `knowledge/k_003_current_schema_evidence.md` — current camelCase, thread-centric schema.  
- `knowledge/k_004_runner_layer_evidence.md` — external runner layer.  
- `knowledge/k_005_analysis_package_state_evidence.md` — analysis package mismatch vs intent.  
- `knowledge/k_006_paper_methodology_evidence.md` — paper-driven requirements (DST/JSD, probes).  
- `knowledge/k_007_missing_probe_stage_evidence.md` — probe stage missing in current code.  
- `knowledge/k_008_user_notes_requirements.md` — refactor requirements (snake_case, message ledger, batching).  
- `knowledge/k_009_workflow_rate_limiter_evidence.md` — workflow durability + rate limiter integration.  
- `knowledge/k_010_agent_kit_message_usage_evidence.md` — agent-kit thread/message/usage coupling.  
- `knowledge/k_011_stage_naming_critic_prober_evidence.md` — rubric critic + scoring prober roles.  
- `knowledge/k_012_user_notes_refactor_additions.md` — mandatory critics + provider batch APIs + centralized rate limiter.  
- `knowledge/k_013_user_notes_batching_critics.md` — per-evidence critics + staged batching + normalized messages only.  
- `knowledge/k_014_openai_batch_api_evidence.md` — OpenAI Batch API specifics.  
- `knowledge/k_015_anthropic_message_batches_evidence.md` — Anthropic Message Batches specifics.  
- `knowledge/k_016_gemini_vertex_batch_evidence.md` — Gemini Batch Prediction (Vertex AI) specifics.  
- `knowledge/k_017_user_notes_idempotency_regex.md` — regex-gated acceptance + Convex-ID idempotency.  

---

## 2.5 Major Changes Since Blueprint-Init (Delta Summary)

1. **Probe stage missing:** blueprint-init expects a `4_probe` stage, but current code only has `1_evidence`, `2_rubric`, `3_scoring`. (k_007)  
2. **Analysis package compressed:** only a pilot notebook and partial modules exist versus the full analysis suite described in the blueprint/paper. (k_005, k_006)  
3. **Runner layer added:** a separate experiment runner exists outside Convex workflows. (k_004)  
4. **Schema drift:** current schema is camelCase and thread-centric, not Python-first or message-led. (k_003, k_010)  
5. **Batching refactor required:** blueprint-batching introduces a request-led ledger and provider adapter workflows to scale. (k_002)  
6. **Rate limiter tied to agent-kit usage:** limiter is currently invoked pre-flight + post-hoc via agent-kit usage handler. (k_009, k_010)  
7. **Critic/prober naming divergence:** rubric uses `critic`, scoring uses `prober`, and probe data is persisted separately. (k_011)  
8. **Mandatory per-evidence critics:** requirement to run staged critic batches per evidence item with regex-gated acceptance. (k_013, k_017)  
9. **Provider batch semantics are async/poll-based:** OpenAI/Anthropic return output files; Gemini uses BatchPredictionJob outputs to GCS/BQ. (k_014, k_015, k_016)

---

## 3. Areas of Analysis

| Area ID | Scope | Assigned Subagent | Evidence IDs |
| :------ | :---- | :---------------- | :---------- |
| A_arch_deltas | Deltas vs blueprint-init; per-evidence critics + regex gating | explorer-A1 | k_001, k_007, k_011, k_017 |
| A_batching | Provider batch APIs + staged batches + polling | explorer-A2 | k_002, k_009, k_014, k_015, k_016 |
| A_schema | Python-first, snake_case schema + normalized message ledger | explorer-A4 | k_003, k_010, k_013 |
| A_orchestration | Runner removal + workflow scheduling | explorer-A1 | k_004 |
| A_analysis | Paper-driven data/export needs | explorer-A3 | k_005, k_006 |

---

## 4. Micro-Hypotheses (v5)

| Hypothesis ID | Statement | Evidence | Confidence |
| :------------ | :-------- | :------- | :--------- |
| h_A_arch_deltas_001 | Mandatory per-evidence critics with standardized naming and regex-gated acceptance; failures are durable with explicit error states and retries. | k_013, k_017 | 0.70 |
| h_A_batching_001 | Provider batch APIs are async/poll-based; a polling-first adapter with staged batches, centralized rate limiting, and Convex-ID-based idempotency is the pragmatic baseline. | k_014, k_015, k_016, k_017 | 0.74 |
| h_A_schema_001 | Snake_case message ledger with normalized fields (plus params) should be the source of truth; critic outputs remain in rubrics/scores with message refs. | k_003, k_010, k_013 | 0.67 |
| h_A_orchestration_001 | Replace or minimize external runner in favor of workflows + thin CLI. | k_004 | 0.58 |
| h_A_analysis_001 | Define stable export endpoints aligned with paper methodology. | k_005, k_006 | 0.66 |

---

## 5. Null Challenge Summary (v5)

| Hypothesis ID | Outcome | Key Disconfirming Evidence |
| :------------ | :------ | :------------------------- |
| h_A_arch_deltas_001 | Inconclusive | k_011, k_017 |
| h_A_batching_001 | Inconclusive | k_017 |
| h_A_schema_001 | Inconclusive | k_010, k_013 |
| h_A_orchestration_001 | Passed | k_004 |
| h_A_analysis_001 | Passed | k_005, k_006 |

---

## 6. Certainty Scoring Summary

- **Method:** Isolated certainty scorer reviewed evidence and hypotheses.
- **Report:** `certainty/certainty_report.md`
- **Lowest-confidence items:** polling/backoff tuning and parser-brittleness mitigations.

---

## 7. Prebuilt Implementation Plan

Each step must cite evidence, specify outputs, and include verification criteria. This plan is intended to be executed without re-deriving decisions.

### S1: Lock the Target Architecture and Data Flow

- **Objective:** Confirm refactor goals and architecture shape before schema work.
- **Evidence to Review:** k_001, k_002, k_006, k_009, k_013, k_017.
- **Inputs:** blueprint-init baseline, batching blueprint, paper methodology, workflow durability patterns, user constraints.
- **Actions:**
  1. Draft a one-page architecture spec showing: request ledger, batch registry/adapters, centralized rate limiter, core domain tables, export endpoints, and external data store boundaries.
  2. Explicitly model the staged batch lifecycle (gen → critic) and how per-request retries occur without resetting whole batches.
- **Outputs:** Architecture spec + lifecycle diagram + boundary document.
- **Verification:** Spec covers mandatory critics, message ledger, staged batch retries, and rate-limiter integration.
- **Risks/Assumptions:** Assumes provider batch APIs can be normalized into a common adapter contract.
- **Confidence:** 0.70.

### S2: Design the New Schema (Snake_Case + Message Ledger)

- **Objective:** Establish Python-first schemas and replace thread-centric usage with a normalized message ledger.
- **Evidence to Review:** k_002, k_003, k_010, k_013.
- **Inputs:** Current schema, batching blueprint, user constraints.
- **Actions:**
  1. Define snake_case tables for core domain entities: `experiments`, `windows`, `evidences`, `rubrics`, `samples`, `scores`.
  2. Add `llm_requests`, `llm_batches`, `llm_batch_items` to track provider batch lifecycle and per-request status/attempts.
  3. Add `llm_messages` as source of truth with normalized fields: `system_prompt`, `user_prompt`, `assistant_output`, `assistant_reasoning`, `input_tokens`, `output_tokens`, `total_tokens`, `cached_input_tokens`, `reasoning_tokens`, plus params (`temperature`, `top_p`, `seed`, `max_tokens`, `stop`, `provider`, `model`).
  4. Keep critic outputs in domain tables: `rubrics` includes `rubric_critic_*`, `scores` includes `score_critic_*`, each referencing the relevant `llm_message_id`.
- **Outputs:** Schema spec (snake_case) + field map + deletion plan (DB wipe).
- **Verification:** All tables/fields are snake_case; message ledger is authoritative; critic fields align to standardized naming.
- **Risks/Assumptions:** Normalized fields are sufficient for analysis; optional raw payload can be added later if needed.
- **Confidence:** 0.73.

### S3: Build the Batching Service (Provider Registry + Rate Limiter)

- **Objective:** Enable scalable throughput via provider batch APIs and durable per-request retries.
- **Evidence to Review:** k_002, k_009, k_014, k_015, k_016, k_017.
- **Inputs:** Schema spec; provider batch API requirements (OpenAI/Anthropic/Gemini).
- **Actions:**
  1. Implement a **batch registry** interface: `submit_batch`, `poll_batch`, `cancel_batch`, `parse_results` with per-provider adapters.
  2. Centralize rate-limiter checks in the batching service: pre-flight request limiting (estimated tokens) and post-hoc accounting (actual tokens) using Convex rate-limiter component.
  3. Support staged batches: run `rubric_gen` batch first, then `rubric_critic` batch for accepted rubrics; run `score_gen` batch then `score_critic` batch per evidence item.
  4. Use `llm_batch_items` to track request-level states so failed items can be retried without resetting the batch.
  5. **Idempotency:** define request identity using existing domain IDs (e.g., `rubric_id`, `score_id`, `evidence_id`, `sample_id`) plus `stage`, `provider`, and `model`. Use composite indexes to `get_or_create` the request row, and treat null `result_message_id`/status fields in `llm_requests` as the source of truth for retry eligibility rather than ad hoc hash keys. Add optional `request_version` only for intentional reruns with prompt changes.
  6. **Provider specifics:**
     - **OpenAI:** file-based JSONL input with `custom_id`; poll batch status; download `output_file_id`/`error_file_id`; map results by `custom_id`; 24h completion window. (k_014)
     - **Anthropic:** poll retrieve endpoint; use `results_url` JSONL; map by `custom_id`; 24h expiration. (k_015)
     - **Gemini (Vertex):** create BatchPredictionJob; poll job state; read outputs from GCS/BQ. (k_016)
  7. **Polling:** implement polling-first workflows with exponential backoff; defer webhooks unless provider support is confirmed.
- **Outputs:** Batching design spec + adapter contract + retry policy.
- **Verification:** Requests transition individually; batch restarts do not duplicate completed requests; staged batches are explicit.
- **Risks/Assumptions:** Provider batch APIs differ and are polling-based; polling cadence must be tuned to avoid cost spikes.
- **Confidence:** 0.72.

### S4: Refactor Pipeline Stages (Evidence → Rubric → Scoring + Mandatory Critics)

- **Objective:** Align pipeline with paper methodology and standardized critic naming.
- **Evidence to Review:** k_001, k_006, k_007, k_011, k_013, k_017.
- **Inputs:** Stage definitions; mandatory critic requirement; parser constraints.
- **Actions:**
  1. Replace agent-kit threads with `llm_requests` + `llm_messages` for all stage generations.
  2. Ensure domain rows are created before LLM calls so Convex IDs anchor idempotency (e.g., create `rubrics`/`scores` rows first, then attach `llm_requests`).
  3. Make critic passes mandatory per evidence item: `rubric_critic` (rubric validation) and `score_critic` (replacing probe; captures expert-agreement data).
  4. Gate acceptance on regex parser success for both rubric and score outputs; on parse failure, write `parse_error` fields and schedule retry within budget.
  5. Store parsed critic outputs in `rubrics` and `scores`, with `llm_message_id` pointers for auditability.
- **Outputs:** Stage refactor plan with updated critic naming, staged batch linkage, and parser-gated acceptance.
- **Verification:** Every score row has `score_critic` data or a parse_error with retry status.
- **Risks/Assumptions:** Regex-only validation may be brittle; add repair prompts if parse failure rate is high.
- **Confidence:** 0.72.

### S5: Orchestration and Runner Replacement (Deferred Design Decision)

- **Objective:** Reduce reliance on the external runner and centralize scheduling in workflows.
- **Evidence to Review:** k_004.
- **Inputs:** Current runner behavior and workflow scheduler capabilities.
- **Actions:**
  1. Define `runs` + `run_jobs` workflow that schedules experiments internally.
  2. Prototype a thin CLI (optional) that only creates run configs and enqueues jobs.
  3. Defer final decision on CLI boundary until batching + schema stabilize.
- **Outputs:** Orchestration spec + deferred decision log.
- **Verification:** No essential logic remains exclusively in `packages/engine/src/helpers/runner.ts`.
- **Risks/Assumptions:** CLI refactor may need a separate pass once batching is stable.
- **Confidence:** 0.58.

### S6: Define Export Endpoints and Analysis Bundles

- **Objective:** Eliminate notebook data-shape churn by defining stable exports.
- **Evidence to Review:** k_005, k_006, k_013.
- **Inputs:** Analysis requirements (DST/JSD, swaps, critics) and snake_case schema.
- **Actions:**
  1. Define versioned Convex query endpoints (service-repo contract) returning analysis-ready CSV payloads.
  2. Add lightweight endpoints for freshness checks (row counts, last_updated) to avoid re-downloading unchanged data.
  3. Document bundle schemas for pandas ingestion; add analysis-side scripts that cache CSVs and only refresh when counts change.
- **Outputs:** Export schema docs + endpoint plan.
- **Verification:** Analysis notebooks can ingest bundles with `pd.read_csv` without reshaping.
- **Risks/Assumptions:** Bundle schema may evolve; versioning required.
- **Confidence:** 0.64.

### S7: Wipe & Bootstrap Plan (Clean Start)

- **Objective:** Execute a clean schema reset and prepare the first post-refactor run.
- **Evidence to Review:** k_002, k_003, k_013.
- **Inputs:** New schema + batching service design.
- **Actions:**
  1. Drop old tables; recreate with snake_case schemas.
  2. Backfill minimal run metadata from external store if required.
  3. Run a small ECC/control pilot to validate batching, mandatory critics, parser gating, and export bundle.
- **Outputs:** Clean database and first validation run plan.
- **Verification:** Pilot run produces full message ledger + critic data + export bundle.
- **Risks/Assumptions:** External data store remains available for historical analysis.
- **Confidence:** 0.65.

---

## 8. Validation Gates

1. **Evidence Sufficiency Gate:** Each step cites at least one evidence item.
2. **Conflict Gate:** Hypothesis conflicts resolved or explicitly deferred.
3. **Null Challenge Gate:** No critical hypothesis remains unchallenged.
4. **Verification Gate:** Every step has a checkable outcome.

---

## 9. Open Questions (Next Discussion)

- What parser repair or fallback strategy should we adopt when regex parsing fails? (k_017)
- What polling/backoff schedule should we adopt per provider to balance latency vs cost? (k_014, k_015, k_016)
- If prompts/params change without new domain IDs, do we increment `request_version` or create new domain rows? (k_017)
- Do we need a minimal raw payload field in `llm_messages` for debugging, or keep normalized-only? (k_013)
- Runner replacement: do we commit to a CLI boundary now, or defer until batching is stable? (k_004)

---

## Appendix: Sources

- /Users/jesselee/dev/research/judge-gym/_blueprints/blueprint-init.md
- /Users/jesselee/dev/research/judge-gym/_blueprints/blueprint-batching.md
- /Users/jesselee/dev/research/judge-gym/packages/engine/convex/schema.ts
- /Users/jesselee/dev/research/judge-gym/packages/engine/convex/workflow_manager.ts
- /Users/jesselee/dev/research/judge-gym/packages/engine/convex/rate_limiter/index.ts
- /Users/jesselee/dev/research/judge-gym/packages/engine/convex/agent_config.ts
- /Users/jesselee/dev/research/judge-gym/packages/engine/convex/agents/abstract.ts
- /Users/jesselee/dev/research/judge-gym/packages/engine/convex/stages/2_rubric/rubric_agent.ts
- /Users/jesselee/dev/research/judge-gym/packages/engine/convex/stages/3_scoring/scoring_agent.ts
- /Users/jesselee/dev/research/judge-gym/packages/engine/convex/stages/2_rubric/rubric_steps.ts
- /Users/jesselee/dev/research/judge-gym/packages/engine/convex/stages/3_scoring/scoring_steps.ts
- /Users/jesselee/dev/research/judge-gym/packages/engine/src/helpers/runner.ts
- /Users/jesselee/dev/research/judge-gym/packages/analysis/README.md
- /Users/jesselee/dev/research/judge-gym/paper.md
