# Engine Guarantees + Orchestration/Data Model (Repo)

**Confidence:** 0.72

**Sources:**
- packages/engine/convex/domain/experiments/entrypoints.ts
- packages/engine/convex/domain/llm_calls/llm_requests.ts
- packages/engine/convex/domain/runs/entrypoints.ts
- packages/engine/convex/domain/runs/workflows/run_state.ts
- packages/engine/convex/domain/llm_calls/workflows/batch_queue_logic.ts
- packages/engine/convex/domain/llm_calls/workflows/batch_poll.ts
- packages/engine/convex/domain/llm_calls/llm_batches.ts
- packages/engine/convex/domain/llm_calls/workflows/batch_poll_logic.ts
- packages/engine/convex/models/core.ts
- packages/engine/convex/domain/experiments/stages/rubric/workflows/enqueue_critics.ts
- packages/engine/convex/domain/experiments/stages/scoring/workflows/seed_requests.ts

**Summary:**
The engine enforces idempotent experiment initialization by `experiment_tag` and validates window/config consistency via `spec_signature`, reusing existing records on matches and rejecting mismatches. LLM requests are de-duplicated by a composite identity index; `getOrCreate` returns existing records and only fills missing prompts. Runs create explicit run and run_stage rows, and run completion is derived from stage-level request counts. Batch scheduling respects backoff, desired state, stop-at-stage gating, and uses leases (`locked_until`) to prevent concurrent polling. Retry/backoff is policy-driven (`max_batch_retries`, `retry_backoff_ms`). Critics are only enqueued once parses succeed, and scoring requires enough parsed rubrics. These patterns represent the core engine guarantees around idempotency, staged progression, and controlled retries.
