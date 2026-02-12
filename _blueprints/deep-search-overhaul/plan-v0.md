# Plan v0: judge-gym Overhaul (Batching, Schema Reset, Mandatory Critics)

> This is the comprehensive implementation plan for the refactor. It is the execution blueprint for the major architectural shift: provider batch APIs, staged critic batches, Convex-ID idempotency, normalized message ledger, and Python-first exports. All data is assumed wiped and rebuilt from scratch.

---

## 0. Goals, Constraints, and Non-Goals

**Goals**
1. Scale throughput with provider batch APIs (OpenAI, Anthropic, Gemini).
2. Enforce mandatory critics per evidence item with standardized naming (`rubric_critic`, `score_critic`).
3. Replace thread-centric usage tracking with a normalized `llm_messages` ledger and request registry.
4. Provide Python-first exports with stable data contracts for analysis notebooks.
5. Ensure durable retries and partial failure recovery without resetting entire batches.

**Constraints**
1. Database is wiped. No migrations required.
2. All schema fields are snake_case.
3. Provider batch APIs are async and polling-based.
4. Regex parsing gates acceptance for rubric and score outputs.
5. Idempotency should leverage existing Convex IDs and null-value checks, not ad hoc hashes.

**Non-goals (for v0)**
1. Full runner/CLI redesign is deferred until batching and schema stabilize.
2. Code implementation is out of scope in this plan; this is an execution blueprint.

---

## 1. System Architecture (Target State)

### 1.1 Components
1. **Convex Core**
   - Domain tables: `experiments`, `windows`, `evidences`, `rubrics`, `samples`, `scores`.
   - LLM system tables: `llm_requests`, `llm_messages`, `llm_batches`, `llm_batch_items`.
2. **Batching Service**
   - Provider adapters for OpenAI, Anthropic, Gemini.
   - Centralized rate limiter and polling workflows.
3. **Analysis Package**
   - Convex query endpoints for data export.
   - Local CSV cache and freshness checks.
4. **Runner or Poller (Deferred)**
   - Optional external process to poll batch status and update Convex.
   - Not required in v0; polling can run in Convex workflows.

### 1.4 Maintainability Patterns (Code Architecture)
1. **Registry pattern for providers**
   - `batch_adapter_registry.ts` exposes a stable `BatchAdapter` interface (`submit_batch`, `poll_batch`, `parse_results`, `cancel_batch`).
   - New providers are added by registering an adapter without touching orchestration logic.
2. **Request ledger as source of truth**
   - All LLM calls are represented by `llm_requests` + `llm_messages`; domain tables only store parsed outputs and references.
3. **Workflow separation by responsibility**
   - Submission, polling, parsing, and stage enqueuing are separate functions.
   - Each step is idempotent and re-entrant, minimizing workflow retries and side effects.
4. **Parser gate as a strict boundary**
   - Parsers are deterministic and versioned; parse failures are explicit and retryable.
5. **Rate limiting as a centralized service**
   - One component for both pre-flight checks and post-hoc accounting, reducing duplicate logic.
6. **Schema-first evolution**
   - Schema changes precede function updates; avoid ad hoc structures inside workflows.
7. **Snake_case everywhere**
   - Convex tables and export bundles use snake_case to minimize pandas friction.

### 1.2 Data Flow (High Level)
1. Create domain rows (`experiments`, `rubrics`, `scores`) first to anchor IDs.
2. Create `llm_requests` linked to domain IDs and stage.
3. Batch `llm_requests` into provider-specific `llm_batches`.
4. Poll provider batch status and parse results into `llm_messages`.
5. Update domain tables with parsed outputs, critic scores, and parse errors.
6. Export analysis bundles via Convex queries.

### 1.3 Architecture Diagrams (Before vs After)

**Before (single-message workflows)**
```text
[Runner/Workflow]
  -> (per-item LLM call)
  -> [Provider API]
  -> [Usage/Thread Logs]
  -> [Domain Tables: rubrics/scores]
```

**After (batched + polling + request ledger)**
```text
[Workflow/Runner]
  -> [Domain Rows Created]
  -> [llm_requests] -> [llm_batch_items] -> [llm_batches]
                         |
                         v
                   [Batch Adapter]
                         |
                   [Provider Batch API]
                         |
               [Polling Workflow + Backoff]
                         |
                   [llm_messages]
                         |
                  [Parser + Gate]
                         |
        [Domain Tables Updated + Critic Enqueue]
                         |
                  [Next Stage Batch]

Rate Limiter:
- Pre-flight: before batch submission
- Post-hoc: after results parsed (actual tokens)
```

**After (staged critic lifecycle)**
```text
Stage A: rubric_gen
  [rubrics rows] -> [llm_requests: rubric_gen] -> [batch submit/poll]
    -> [llm_messages] -> [regex parse gate]
    -> if pass: enqueue rubric_critic batch
    -> if fail: parse_error + retry budget

Stage B: rubric_critic
  [llm_requests: rubric_critic] -> [batch submit/poll]
    -> [llm_messages] -> [critic parse gate]
    -> store in rubrics (rubric_critic_*)

Stage C: score_gen (per evidence)
  [scores rows] -> [llm_requests: score_gen] -> [batch submit/poll]
    -> [llm_messages] -> [regex parse gate]
    -> if pass: enqueue score_critic batch
    -> if fail: parse_error + retry budget

Stage D: score_critic (per evidence)
  [llm_requests: score_critic] -> [batch submit/poll]
    -> [llm_messages] -> [critic parse gate]
    -> store in scores (score_critic_*)
```

**Workflow DAG (Convex functions, planned)**
```text
[domain_rows_create]
  -> [llm_requests_get_or_create]
  -> [llm_batches_create]
  -> [batch_submit] --(rate_limit_preflight)-->
  -> [batch_poll] -> [batch_status]
  -> [batch_finalize] --(parse + write llm_messages)-->
  -> [rate_limit_account]
  -> [stage_enqueue] -> (next stage)
```

---

### 1.5 Operational Control (Bun Lab Supervisor)

**Bun Lab responsibilities**
1. Subscribe to Convex changes (websocket) for `pending` requests, `in_flight` batches, and run state.
2. Build batches dynamically by grouping `pending` requests per `(stage, provider, model)`.
3. Submit batches via provider adapters; honor Convex rate limiter pre-flight.
4. Poll batch status; finalize results and enqueue next stages.
5. Enforce run controls (start, pause, stop-at-stage, cancel) by gating stage enqueue.

**Auto-resume principle**
1. All state is stored in Convex tables.
2. Bun Lab can be restarted at any time; it re-subscribes and continues from existing state.
3. Optional `locked_until` leases prevent multiple pollers from colliding.

**Pause/stop/cancel semantics**
1. `pause`: stop enqueuing new batches; allow current stage batches to finish.
2. `stop_at_stage`: run current stage to completion, then freeze the run.
3. `cancel`: stop enqueuing new batches and attempt provider cancel for in-flight batches; mark run canceled.

**Run policy (user-configurable via CLI)**
1. `completion_mode`: `exact` | `best_effort` | `throughput`.
2. `min_batch_size`: below this, allow direct (non-batch) calls.
3. `max_attempts`: retry cap for parse or provider failures.
4. `repair_after_failures`: threshold before repair prompts.
5. `rate_limit_profile`: name of rate limit spec to use for this run.

**Rate limit ownership**
1. Lab owns configuration profiles (per provider/model).
2. Convex rate limiter enforces limits using the selected profile.
3. Profiles are versioned and stored in Convex for auditability.


## 2. Schema Plan (Snake Case)

### 2.1 Domain Tables (Core)
1. **experiments**
   - `experiment_tag`, `window_id`, `model_id`, `task_type`, `ground_truth`, `config`, `status`.
2. **windows**
   - `start_date`, `end_date`, `country`, `concept`.
3. **evidences**
   - `window_id`, `title`, `url`, `raw_content`, `cleaned_content`, `neutralized_content`, `abstracted_content`.
4. **rubrics**
   - `experiment_id`, `model_id`, `concept`, `scale_size`, `stages`, `rubricer_message_id`, `rubricer_output`,
   - `rubric_critic_message_id`, `rubric_critic_output`, `rubric_critic_reasoning`, `quality_stats`,
   - `parse_error`, `parse_status`, `attempt_count`.
5. **samples**
   - `experiment_id`, `model_id`, `rubric_id`, `is_swap`, `label_mapping`, `display_seed`.
6. **scores**
   - `sample_id`, `experiment_id`, `model_id`, `rubric_id`, `evidence_id`, `is_swap`, `abstained`,
   - `score_message_id`, `raw_verdict`, `decoded_scores`,
   - `score_critic_message_id`, `score_critic_output`, `score_critic_reasoning`, `expert_agreement_prob`,
   - `parse_error`, `parse_status`, `attempt_count`.
7. **runs**
   - `experiment_id`, `status`, `desired_state`, `stop_at_stage`, `current_stage`,
   - `last_stage_completed_at`, `created_at`, `updated_at`.
8. **run_stages**
   - `run_id`, `stage`, `status`, `total_requests`, `completed_requests`, `failed_requests`,
   - `last_batch_id`, `updated_at`.

### 2.2 LLM System Tables
1. **llm_requests**
   - Identity: `stage`, `provider`, `model`, `experiment_id`, `rubric_id`, `sample_id`, `evidence_id` (as relevant).
   - Request params: `temperature`, `top_p`, `seed`, `max_tokens`, `stop`.
   - Status: `status`, `attempt`, `request_version`, `last_error`, `parse_error`.
   - Links: `result_message_id`, `batch_item_id`.
2. **llm_messages**
   - Normalized fields only: `system_prompt`, `user_prompt`, `assistant_output`, `assistant_reasoning`.
   - Token usage: `input_tokens`, `output_tokens`, `total_tokens`, `cached_input_tokens`, `reasoning_tokens`.
   - Params: `provider`, `model`, `temperature`, `top_p`, `seed`, `max_tokens`, `stop`.
3. **llm_batches**
   - Provider metadata: `provider`, `model`, `batch_ref`, `status`, `completion_window`, `created_at`.
4. **llm_batch_items**
   - Link: `batch_id`, `request_id`, `custom_id`, `status`, `attempt`, `last_error`.

### 2.3 Idempotency Policy (Schema-Level)
1. Use composite indexes on `llm_requests` keyed by domain IDs plus `stage`, `provider`, `model`.
2. Use null `result_message_id` and `status` for retry eligibility.
3. Add optional `request_version` when prompts or params change but IDs remain constant.

---

## 3. Pipeline and Stage Redesign

### 3.1 Evidence Stage
1. Evidence collection and neutralization remain as workflows.
2. Evidence rows are created before any LLM requests.

### 3.2 Rubric Generation + Critic (Staged Batch)
1. **rubric_gen** batch creates rubric outputs per experiment.
2. Parse rubric output with regex. If parse fails, mark `parse_error` and retry.
3. On successful parse, enqueue **rubric_critic** batch.
4. Store critic output in `rubrics` and link to `llm_messages`.

### 3.3 Scoring + Critic (Staged Batch)
1. **score_gen** batch runs per evidence item.
2. Parse score output with regex. If parse fails, mark `parse_error` and retry.
3. On successful parse, enqueue **score_critic** batch per evidence item.
4. Store critic output in `scores` and link to `llm_messages`.

### 3.4 Regex Gating and Durable Errors
1. Regex parsing is the acceptance gate for rubric and score.
2. On failure, record `parse_error`, `attempt_count`, `last_error` and schedule retry.
3. Retry budget is capped and recorded per item.

### 3.5 Save States and Stage Checkpoints
1. Each stage writes progress into `run_stages` with counts and `last_batch_id`.
2. Stage transitions occur only when `completed_requests + failed_requests == total_requests`.
3. `stop_at_stage` prevents the next stage from enqueueing.
4. `desired_state=paused|canceled` stops stage enqueue and batch creation.

---

## 4. Batching Subsystem Design

### 4.1 Provider Adapters
1. **OpenAI**
   - JSONL input file with `custom_id` per request.
   - Poll batch status; download output and error files.
2. **Anthropic**
   - Create batch; poll `processing_status` until complete.
   - Download results JSONL from `results_url`.
3. **Gemini (Vertex AI)**
   - Create `BatchPredictionJob`.
   - Poll job state and read outputs from GCS or BigQuery.

### 4.1A Provider Polling Spec (Baseline)
1. **OpenAI**
   - Telemetry: `request_counts` (completed/failed/total) + batch status.
   - Results: output JSONL via `output_file_id` on completion.
   - Polling: start at 30s, backoff to 120s if still running >10 min; tighten to 30s near completion window.
2. **Anthropic**
   - Telemetry: `request_counts` + `processing_status`.
   - Results: JSONL via `results_url` on completion.
   - Polling: start at 30s, backoff to 120s after 10 min.
3. **Gemini (Vertex AI)**
   - Telemetry: job state only (SUCCEEDED/FAILED/CANCELLED).
   - Results: output files in GCS or BQ destination.
   - Polling: start at 120s, backoff to 300s after 20 min.

### 4.2 Polling Workflows
1. Polling-first design. No webhook dependency.
2. Exponential backoff per provider and batch state.
3. Pollers map outputs by `custom_id` to `llm_batch_items` and `llm_requests`.
4. `locked_until` on `llm_batches` prevents concurrent polling collisions.
5. `next_poll_at` controls cadence and supports auto-resume.

### 4.3 Rate Limiting Integration
1. Pre-flight checks use Convex rate limiter with estimated tokens.
2. Post-hoc accounting uses actual token counts from provider response.
3. Rate limiting is centralized in the batching service, not agent-kit usage handlers.

### 4.4 Workflow Refactor: Function Map (Convex Boundaries)

**Note:** Names are illustrative; actual filenames should use underscores.

1. `domain_rows_create` (mutation): Create `experiments`, `rubrics`, `scores`, `samples` rows before any LLM requests.
2. `llm_requests_get_or_create` (mutation): Idempotent request creation keyed by domain IDs + `stage` + `provider` + `model` (+ `request_version`).
3. `llm_batches_create` (mutation): Group pending requests into a batch and create `llm_batch_items` with stable `custom_id`.
4. `batch_submit` (internal action): Provider adapter submission; pre-flight rate limit; upload JSONL; persist `batch_ref`.
5. `batch_poll` (workflow): Backoff loop; calls `batch_status` until completion.
6. `batch_status` (internal action): Provider polling; returns status + result handles.
7. `batch_finalize` (mutation): Map results by `custom_id`; create `llm_messages`; update `llm_requests` + `llm_batch_items`; parse outputs; write `parse_error` and `attempt_count`.
8. `stage_enqueue` (workflow): Enqueue `rubric_critic` or `score_critic` batches only for parse-accepted items.
9. `rate_limit_account` (mutation): Post-hoc accounting from actual token usage.
10. `parser_repair` (internal action, optional): Repair prompt flow if parse failures exceed threshold; re-parse and update retry state.

**Existing workflow changes (summary)**
1. Evidence collection workflows remain but stop making provider calls.
2. Current single-call generation workflows become request creation + batch orchestration.
3. `workflow_manager.ts` focuses on scheduling, polling, and stage transitions.

---

## 5. Idempotency and Retry Model

### 5.1 Identity Rules
1. A unique request is defined by domain IDs plus `stage`, `provider`, `model`.
2. Existing `llm_requests` rows are the single source of truth.
3. Null `result_message_id` indicates retry eligibility.

### 5.2 Retry Rules
1. Retries update the same `llm_requests` row.
2. `attempt` is incremented and errors recorded.
3. A retry stops when the max attempt budget is reached.
4. Retry batches are created only from failed requests; completed items are not re-batched.

### 5.3 Forced Reruns
1. If prompts or params change, use `request_version` to force a new request row.
2. Existing domain IDs remain stable. Only the request version changes.

---

## 6. Data Export and Analysis Contracts

### 6.1 Convex Endpoints
1. Versioned export endpoints return CSV bundles.
2. Lightweight query endpoints return row counts or last_updated timestamps.

### 6.2 Analysis Package
1. Python scripts call export endpoints and cache CSV files locally.
2. A freshness check prevents redundant downloads if counts are unchanged.

---

## 7. Runner and Poller (Deferred Scope)

### 7.1 Current Idea
1. The runner can act as a live poller that checks Convex for outstanding batches.
2. If a batch is completed, it triggers parsing and updates.

### 7.2 Decision Deferred
1. We will finalize runner packaging after the core batching and schema are stable.

---

## 7A. File System Changes (Planned)

**New or refactored Convex areas (indicative)**
1. `packages/engine/convex/schema.ts` - Replace with snake_case tables and new `llm_*` system tables.
2. `packages/engine/convex/llm_requests.ts` - Request ledger CRUD and idempotent `get_or_create` helpers.
3. `packages/engine/convex/llm_batches.ts` - Batch creation, item tracking, status updates.
4. `packages/engine/convex/llm_messages.ts` - Normalized message ledger writes + token accounting.
5. `packages/engine/convex/batch_adapter_registry.ts` - Provider adapter interface + registry.
6. `packages/engine/convex/providers/` - `openai_batch.ts`, `anthropic_batch.ts`, `gemini_batch.ts`.
7. `packages/engine/convex/workflows/` - `batch_submit.ts`, `batch_poll.ts`, `batch_finalize.ts`, `stage_enqueue.ts`.
8. `packages/engine/convex/parsers/` - `rubric_parser.ts`, `score_parser.ts`, `critic_parser.ts` (regex gates).
9. `packages/engine/convex/rate_limiter/` - Centralized pre-flight + post-hoc accounting.
10. `packages/engine/convex/export/` - Versioned export queries for analysis bundles.
11. `packages/engine/convex/runs/` - Run state + stage checkpoint helpers.

**New Bun Lab supervisor (indicative)**
1. `packages/lab/`
2. `packages/lab/cli.ts`
3. `packages/lab/supervisor.ts`
4. `packages/lab/tui/`

**Deprecated or replaced (expected)**
1. `packages/engine/convex/agent_kit/*` usage tables and thread-based usage tracking.
2. `packages/engine/src/helpers/runner.ts` as the primary orchestrator (reduced to optional poller).

---

## 7B. Deletion and Cleanup Plan (Explicit Removals)

**Goal**
- Remove or retire legacy paths that are functionally replaced by the new batching + ledger architecture.

**Code removals (candidate list)**
1. Agent-kit thread usage paths, handlers, and usage tables tied to per-message tracking.
2. Workflow paths that directly invoke provider APIs per item (replace with batch submit/poll/finalize).
3. Any duplicate per-stage “usage” collectors that are superseded by `llm_messages`.
4. Legacy runner orchestration logic that creates LLM calls directly (keep only optional poller shell).

**Schema removals**
1. Tables that encode thread-centric usage or partial message logs now replaced by `llm_messages`.
2. Stage-specific log tables that duplicate `llm_requests`/`llm_batch_items`.
3. Any camelCase tables or fields after migration to snake_case.

**Deletion order**
1. Remove or deprecate old workflow entry points after new batch flows are live.
2. Remove old usage tables after `llm_messages` is fully wired.
3. Remove unused runner utilities after Lab supervisor is functional.

**Verification**
1. No code path writes to deprecated tables.
2. All pipelines use `llm_requests` + `llm_messages`.
3. Typecheck passes and no dead imports remain.

**Filesystem diff (conceptual)**
```text
Before (approx):
packages/engine/convex/
  schema.ts
  workflow_manager.ts
  rate_limiter/
  agent_kit/
  strategies/
  workflows/
packages/engine/src/helpers/
  runner.ts

After (planned):
packages/engine/convex/
  schema.ts
  llm_requests.ts
  llm_batches.ts
  llm_messages.ts
  batch_adapter_registry.ts
  providers/
    openai_batch.ts
    anthropic_batch.ts
    gemini_batch.ts
  workflows/
    batch_submit.ts
    batch_poll.ts
    batch_finalize.ts
    stage_enqueue.ts
  parsers/
    rubric_parser.ts
    score_parser.ts
    critic_parser.ts
  rate_limiter/
  export/
packages/engine/src/helpers/
  runner.ts (optional poller only)
```

---

## 8. Implementation Phases

### Phase 1: Architecture and Schema
1. Finalize schema definitions and indexes.
2. Define staged batch lifecycle and request identity rules.

### Phase 2: Batching Subsystem
1. Implement provider adapters.
2. Implement polling workflows and backoff policy.
3. Integrate rate limiter into batching service.

### Phase 3: Pipeline Refactor
1. Replace agent-kit threads with `llm_requests` and `llm_messages`.
2. Implement regex-gated acceptance and durable parse errors.
3. Wire staged critic batches into rubric and scoring flows.

### Phase 4: Exports and Analysis
1. Create versioned export endpoints.
2. Implement analysis scripts for CSV caching and freshness checks.

### Phase 5: Bootstrap Run
1. Wipe database and apply new schemas.
2. Run a small ECC/control pilot to validate batching and critics.

---

## 9. Decisions (Resolved)

1. **Parser failure strategy**
   - Decision: per-request retries only; no workflow-level retries.
   - Policy: retry within the same stage until `attempt_count` hits cap; optionally run a repair prompt after N failures.
2. **Polling cadence**
   - Decision: provider-specific backoff schedule as defined in **4.1A**.
3. **Idempotency with prompt changes**
   - Decision: use `request_version` on `llm_requests` when prompts or params change.
4. **Raw payload retention**
   - Decision: default to normalized `llm_messages` only; optional minimal `raw_payload` field if debugging needs arise.
5. **Runner boundary**
   - Decision: Bun Lab supervisor is the primary poller; Convex workflows remain as fallback/safety net.

---

## 10. Definition of Done (v0)

1. All schema tables are snake_case and recreated cleanly.
2. Batching service works for OpenAI, Anthropic, and Gemini with polling.
3. Mandatory rubric_critic and score_critic are enforced per evidence item.
4. Regex parsing gates acceptance and durable retry states are recorded.
5. Analysis exports are stable and usable by pandas without reshaping.
